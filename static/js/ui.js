'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// ui.js — HUD updates, zoom slider, popup management
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABELS = {
  radio:      'RADIO BROADCAST',
  tv:         'TELEVISION BROADCAST',
  directed:   'DIRECTED SIGNAL',
  optical:    'OPTICAL SIGNAL',
  spacecraft: 'SPACECRAFT',
  other:      'SIGNAL',
};

const TYPE_COLORS_CSS = {
  radio:      '#60a5fa',
  tv:         '#f97316',
  directed:   '#a78bfa',
  optical:    '#34d399',
  spacecraft: '#fbbf24',
  other:      '#94a3b8',
};

class UI {
  constructor(physics, sigMgr) {
    this.physics      = physics;
    this.sigMgr       = sigMgr;
    this.onZoomChange = null;
    this._locked      = null;         // currently open popup item

    // ── HUD elements ──────────────────────────────────────────────────────
    this.elDate   = document.getElementById('hud-date');
    this.elTime   = document.getElementById('hud-time');
    this.elRadius = document.getElementById('hud-radius');
    this.elScale  = document.getElementById('hud-scale');
    this.elSlider = document.getElementById('zoom-slider');

    // ── Popup elements ────────────────────────────────────────────────────
    this.elPopup     = document.getElementById('popup');
    this.elBadge     = document.getElementById('popup-type-badge');
    this.elName      = document.getElementById('popup-name');
    this.elMeta      = document.getElementById('popup-meta');
    this.elDist      = document.getElementById('popup-distance');
    this.elDesc      = document.getElementById('popup-desc');
    this.elAudioDot  = document.getElementById('audio-dot');
    this.elAudioLbl  = document.getElementById('popup-audio-label');
    this.elCitation  = document.getElementById('popup-citation');

    this._setupZoom();
    this._setupPopupClose();
  }

  // ── Zoom ───────────────────────────────────────────────────────────────────

  _setupZoom() {
    this.elSlider.value = this.physics.lyToSlider(this.physics.viewportLY);

    this.elSlider.addEventListener('input', () => {
      const ly = this.physics.sliderToLY(parseFloat(this.elSlider.value));
      this.physics.setViewportLY(ly);
      if (this.onZoomChange) this.onZoomChange();
    });

    document.getElementById('zoom-out-btn').addEventListener('click', () => {
      this.physics.setViewportLY(this.physics.viewportLY * 2);
      this.syncSlider();
    });

    document.getElementById('zoom-in-btn').addEventListener('click', () => {
      this.physics.setViewportLY(this.physics.viewportLY / 2);
      this.syncSlider();
    });
  }

  syncSlider() {
    this.elSlider.value = this.physics.lyToSlider(this.physics.viewportLY);
  }

  // ── HUD updates ────────────────────────────────────────────────────────────

  updateClock(now) {
    this.elDate.textContent = now.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    this.elTime.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  updateZoomHUD(canvasWidth) {
    const halfLY  = this.physics.viewportLY / 2;
    const pxPerLY = this.physics.pixelsPerLY(canvasWidth);
    this.elRadius.textContent = this.physics.formatLY(halfLY);
    this.elScale.textContent  = `1 px = ${this.physics.formatLY(1 / pxPerLY)}`;
  }

  // ── Popup ──────────────────────────────────────────────────────────────────

  _setupPopupClose() {
    document.getElementById('popup-close').addEventListener('click', () => this.closePopup());
  }

  showPopup(item, now) {
    this._locked = item;
    const iscraft = this.sigMgr.isSpacecraft(item);
    const type    = iscraft ? 'spacecraft' : (item.type || 'other');
    const color   = item.color || TYPE_COLORS_CSS[type] || TYPE_COLORS_CSS.other;

    // Badge
    this.elBadge.textContent      = TYPE_LABELS[type] || 'SIGNAL';
    this.elBadge.style.color      = color;
    this.elBadge.style.borderColor = color;

    // Name
    this.elName.textContent = item.name;

    // Meta (sent / launched date)
    if (iscraft) {
      const d = new Date(item.launched_year, (item.launched_month || 1) - 1, item.launched_day || 1);
      this.elMeta.textContent = `Launched: ${d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}`;
    } else {
      const d = new Date(item.year, (item.month || 1) - 1, item.day || 1);
      this.elMeta.textContent = `Transmitted: ${d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}`;
    }

    // Distance
    if (iscraft) {
      const au  = this.sigMgr.craftDistanceAU(item, now);
      const ly  = this.physics.auToLY(au);
      this.elDist.textContent = `${au.toFixed(1)} AU  ·  ${this.physics.formatLY(ly)} from Earth`;
    } else {
      const ly = this.physics.signalAgeLY(item.year, item.month, item.day, now);
      this.elDist.textContent = `${this.physics.formatLY(ly)} from Earth`;
    }

    // Description
    this.elDesc.textContent = item.description || '';

    // Audio
    if (item.audio_file) {
      this.elAudioDot.className    = 'audio-dot playing';
      this.elAudioLbl.textContent  = 'Sampling signal…';
    } else {
      this.elAudioDot.className    = 'audio-dot';
      this.elAudioLbl.textContent  = 'No audio available';
    }

    // Citation
    if (item.citation_url) {
      this.elCitation.href = item.citation_url;
      this.elCitation.classList.remove('hidden');
    } else {
      this.elCitation.classList.add('hidden');
    }

    this.elPopup.classList.remove('hidden');
  }

  closePopup() {
    this._locked = null;
    this.elPopup.classList.add('hidden');
    this.elAudioDot.className = 'audio-dot';
  }

  isPopupOpen() { return !this.elPopup.classList.contains('hidden'); }
  getLockedItem() { return this._locked; }

  /** Update only the distance line (called every frame while popup is open) */
  updatePopupDistance(now) {
    if (!this._locked) return;
    const item    = this._locked;
    const iscraft = this.sigMgr.isSpacecraft(item);
    if (iscraft) {
      const au = this.sigMgr.craftDistanceAU(item, now);
      const ly = this.physics.auToLY(au);
      this.elDist.textContent = `${au.toFixed(1)} AU  ·  ${this.physics.formatLY(ly)} from Earth`;
    } else {
      const ly = this.physics.signalAgeLY(item.year, item.month, item.day, now);
      this.elDist.textContent = `${this.physics.formatLY(ly)} from Earth`;
    }
  }
}
