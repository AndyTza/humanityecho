'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// renderer.js — Canvas drawing: background, stars, Earth, signal circles, spacecraft
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_COLORS = {
  radio:      '#60a5fa',
  tv:         '#f97316',
  directed:   '#a78bfa',
  optical:    '#34d399',
  spacecraft: '#fbbf24',
  other:      '#94a3b8',
};

class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx    = ctx;
    this._stars = [];
    this._earthPulse = 0;
    this._generateStars(700);
  }

  // ── Stars ──────────────────────────────────────────────────────────────────

  _generateStars(count) {
    const { width: w, height: h } = this.canvas;
    this._stars = [];
    for (let i = 0; i < count; i++) {
      // Concentrate stars slightly toward center (galactic core suggestion)
      const angle = Math.random() * Math.PI * 2;
      const r     = Math.pow(Math.random(), 0.45) * Math.max(w, h) * 0.65;
      this._stars.push({
        x:     w / 2 + Math.cos(angle) * r,
        y:     h / 2 + Math.sin(angle) * r,
        size:  Math.random() * 1.4 + 0.2,
        base:  Math.random() * 0.6 + 0.15,
        speed: Math.random() * 0.5 + 0.1,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  regenerateStars() { this._generateStars(700); }

  // ── Background ─────────────────────────────────────────────────────────────

  drawBackground() {
    const { ctx, canvas: { width: w, height: h } } = this;

    // Deep space black
    ctx.fillStyle = '#00000a';
    ctx.fillRect(0, 0, w, h);

    // Subtle Milky Way core glow
    const cx = w / 2, cy = h / 2;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.5);
    grd.addColorStop(0,   'rgba(25, 15, 55, 0.22)');
    grd.addColorStop(0.4, 'rgba(12, 8, 28, 0.10)');
    grd.addColorStop(1,   'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }

  drawStars(t) {
    const { ctx } = this;
    for (const s of this._stars) {
      const twinkle = Math.sin(t * s.speed + s.phase) * 0.12;
      const alpha   = Math.max(0.04, s.base + twinkle);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210, 225, 255, ${alpha.toFixed(3)})`;
      ctx.fill();
    }
  }

  // ── Earth ──────────────────────────────────────────────────────────────────

  drawEarth(cx, cy) {
    const { ctx } = this;
    this._earthPulse = (this._earthPulse + 0.012) % (Math.PI * 2);
    const r = 6 + Math.sin(this._earthPulse) * 1.2;

    // Outer glow rings
    for (let i = 4; i >= 1; i--) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + i * 7, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(59, 130, 246, ${0.04 * i})`;
      ctx.lineWidth = 9;
      ctx.stroke();
    }

    // Earth sphere gradient
    const grd = ctx.createRadialGradient(cx - 1.5, cy - 1.5, 0, cx, cy, r);
    grd.addColorStop(0,   '#bfdbfe');
    grd.addColorStop(0.4, '#3b82f6');
    grd.addColorStop(1,   '#1e3a8a');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(191, 219, 254, 0.45)';
    ctx.font      = '9px "Space Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EARTH', cx, cy + r + 16);
  }

  // ── Signal circles ─────────────────────────────────────────────────────────

  drawSignalCircle(cx, cy, radiusPx, signal, isHovered) {
    if (radiusPx < 0.5) return; // too small
    const diag = Math.sqrt(this.canvas.width ** 2 + this.canvas.height ** 2);
    if (radiusPx > diag * 3) return; // entirely off-screen

    const { ctx } = this;
    const color    = signal.color || TYPE_COLORS[signal.type] || TYPE_COLORS.other;
    const lineW    = isHovered ? 2.5 : 1.5;
    const alpha    = isHovered ? 0.85 : 0.45;
    const glowAlpha = isHovered ? 0.18 : 0.06;

    // Glow layers (3 concentric halos)
    for (let i = 3; i >= 1; i--) {
      ctx.beginPath();
      ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = this._rgba(color, glowAlpha * (4 - i) / 3);
      ctx.lineWidth   = lineW + i * 5;
      ctx.stroke();
    }

    // Main ring
    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.strokeStyle = this._rgba(color, alpha);
    ctx.lineWidth   = lineW;
    ctx.stroke();

    // Hover label (top of circle or near canvas top)
    if (isHovered) {
      const labelY = Math.max(18, cy - radiusPx - 10);
      ctx.font      = '600 11px "Inter", sans-serif';
      ctx.textAlign = 'center';

      // Shadow for readability
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur  = 6;
      ctx.fillStyle   = this._rgba(color, 0.95);
      ctx.fillText(signal.name, cx, labelY);
      ctx.shadowBlur  = 0;
      ctx.shadowColor = 'transparent';
    }
  }

  // ── Spacecraft ─────────────────────────────────────────────────────────────

  drawSpacecraft(cx, cy, distPx, craft, isHovered) {
    if (distPx < 0.5) return;

    const { ctx, canvas: { width: w, height: h } } = this;

    // Convert direction_deg (0=up, clockwise) to canvas angle
    const angle = ((craft.direction_deg || 0) - 90) * (Math.PI / 180);
    const x = cx + Math.cos(angle) * distPx;
    const y = cy + Math.sin(angle) * distPx;

    // Skip if off-screen
    if (x < -30 || x > w + 30 || y < -30 || y > h + 30) return;

    const color = craft.color || '#fbbf24';
    const r = isHovered ? 5 : 3;

    // Glow
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = this._rgba(color, 0.12);
    ctx.fill();

    // Dot
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Label
    if (isHovered || distPx > 30) {
      ctx.font      = '10px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = this._rgba(color, 0.85);
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur  = 5;
      ctx.fillText(craft.name, x, y - r - 7);
      ctx.shadowBlur  = 0;
      ctx.shadowColor = 'transparent';
    }
  }

  // ── Utility ────────────────────────────────────────────────────────────────

  /** Convert hex color + alpha to rgba() string */
  _rgba(hex, alpha) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return `rgba(150,150,150,${alpha})`;
    return `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},${alpha})`;
  }
}
