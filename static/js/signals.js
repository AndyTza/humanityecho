'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// signals.js — State for signals and spacecraft; hover detection
// ─────────────────────────────────────────────────────────────────────────────

const HOVER_PX = 9; // pixels from circle edge to trigger hover

class SignalManager {
  constructor(physics) {
    this.physics    = physics;
    this.signals    = [];    // loaded from /api/signals
    this.spacecraft = [];    // loaded from /api/spacecraft
    this.hoveredSignal   = null;
    this.hoveredCraft    = null;
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  loadSignals(data)    { this.signals    = data.signals    || []; }
  loadSpacecraft(data) { this.spacecraft = data.spacecraft || []; }

  // ── Spacecraft position ────────────────────────────────────────────────────

  /** Distance in AU from Earth for a spacecraft at time `now` */
  craftDistanceAU(craft, now) {
    const launch = new Date(
      craft.launched_year,
      (craft.launched_month || 1) - 1,
      craft.launched_day || 1
    );
    const years = Math.max(0, (now - launch) / (365.25 * 24 * 3600 * 1000));
    return years * (craft.speed_au_per_year || 3.5);
  }

  // ── Hover detection ────────────────────────────────────────────────────────

  /**
   * Test mouse position against all signal circles and spacecraft dots.
   * Updates this.hoveredSignal and this.hoveredCraft.
   * Returns the closest hovered item (or null).
   */
  updateHover(mx, my, cx, cy, canvasWidth, now) {
    const pxPerLY  = this.physics.pixelsPerLY(canvasWidth);
    let bestDist   = Infinity;
    let bestSignal = null;
    let bestCraft  = null;

    // ── Check signal circles (rings) ──────────────────────────────────────
    for (const sig of this.signals) {
      const rPx = this.physics.signalAgeLY(sig.year, sig.month, sig.day, now) * pxPerLY;
      if (rPx < 0.5) continue;

      const dx   = mx - cx;
      const dy   = my - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const diff = Math.abs(dist - rPx);

      if (diff < HOVER_PX && diff < bestDist) {
        bestDist   = diff;
        bestSignal = sig;
        bestCraft  = null;
      }
    }

    // ── Check spacecraft dots ─────────────────────────────────────────────
    for (const craft of this.spacecraft) {
      const distAU  = this.craftDistanceAU(craft, now);
      const distPx  = this.physics.auToLY(distAU) * pxPerLY;
      const angle   = ((craft.direction_deg || 0) - 90) * (Math.PI / 180);
      const sx      = cx + Math.cos(angle) * distPx;
      const sy      = cy + Math.sin(angle) * distPx;
      const dx      = mx - sx;
      const dy      = my - sy;
      const dist    = Math.sqrt(dx * dx + dy * dy);

      if (dist < 15 && dist < bestDist) {
        bestDist   = dist;
        bestCraft  = craft;
        bestSignal = null;
      }
    }

    this.hoveredSignal = bestSignal;
    this.hoveredCraft  = bestCraft;
    return bestSignal || bestCraft || null;
  }

  getHoveredItem() {
    return this.hoveredSignal || this.hoveredCraft || null;
  }

  /** True if item is a spacecraft record */
  isSpacecraft(item) {
    return !!item && 'launched_year' in item;
  }
}
