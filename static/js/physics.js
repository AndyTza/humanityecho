'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// physics.js — Unit conversions, zoom model, signal age calculations
// ─────────────────────────────────────────────────────────────────────────────

const MS_PER_YEAR  = 365.25 * 24 * 3600 * 1000; // milliseconds in a Julian year
const AU_PER_LY    = 63241.077;                  // astronomical units per light-year

// Zoom range: viewport width in light-years
const LY_MIN = 0.005;    // ~316 AU — zoomed all the way in (spacecraft visible)
const LY_MAX = 130000;   // ~full Milky Way diameter

class Physics {
  constructor() {
    this._viewportLY = 300; // default: 300 LY across — signal circles are visible
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get viewportLY() { return this._viewportLY; }

  /** How many pixels equal one light-year at current zoom */
  pixelsPerLY(canvasWidth) {
    return canvasWidth / this._viewportLY;
  }

  // ── Zoom ───────────────────────────────────────────────────────────────────

  setViewportLY(ly) {
    this._viewportLY = Math.max(LY_MIN, Math.min(LY_MAX, ly));
  }

  /** Zoom by mouse-wheel delta (positive = scroll down = zoom out) */
  zoomByDelta(delta) {
    const factor = Math.pow(1.0012, delta);
    this.setViewportLY(this._viewportLY * factor);
  }

  // Slider uses log scale so the full range (0.005 LY → 130,000 LY) is usable
  // slider value 0 = most zoomed out (LY_MAX), value 100 = most zoomed in (LY_MIN)

  sliderToLY(v) {
    const logMax = Math.log10(LY_MAX);
    const logMin = Math.log10(LY_MIN);
    // v=0 → LY_MAX, v=100 → LY_MIN
    return Math.pow(10, logMax - (v / 100) * (logMax - logMin));
  }

  lyToSlider(ly) {
    const logMax = Math.log10(LY_MAX);
    const logMin = Math.log10(LY_MIN);
    return ((logMax - Math.log10(Math.max(LY_MIN, Math.min(LY_MAX, ly)))) /
            (logMax - logMin)) * 100;
  }

  // ── Signal physics ─────────────────────────────────────────────────────────

  /**
   * Returns the radius of a signal in light-years at a given moment.
   * At c = 1 LY/year, the radius equals the elapsed years since transmission.
   */
  signalAgeLY(year, month, day, now) {
    const sent = new Date(year, (month || 1) - 1, day || 1);
    const elapsedMs = now - sent;
    return Math.max(0, elapsedMs / MS_PER_YEAR);
  }

  // ── Unit helpers ───────────────────────────────────────────────────────────

  auToLY(au) { return au / AU_PER_LY; }

  /** Human-readable distance label */
  formatLY(ly) {
    if (ly < 0.0001)  return (ly * AU_PER_LY).toFixed(1) + ' AU';
    if (ly < 1)       return ly.toFixed(4) + ' LY';
    if (ly < 1000)    return ly.toFixed(2) + ' LY';
    return (ly / 1000).toFixed(2) + ' kLY';
  }
}
