/**
 * tests/test_physics.js — Unit tests for Physics and SignalManager
 *
 * Runs in Node.js (no browser required).
 * Usage:  node tests/test_physics.js
 */

'use strict';

const vm     = require('vm');
const fs     = require('fs');
const path   = require('path');
const assert = require('assert');

// ── Load source files ─────────────────────────────────────────────────────────
// class/const/let declarations don't propagate to a vm context object the way
// var does, so we use new Function() which wraps the source in a real function
// body — classes declared there ARE accessible within the same scope, letting
// us return them cleanly.

const ctx = {};

function load(file) {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'static', 'js', file), 'utf8'
  );
  // Append a return statement that harvests any known class names
  const body = `
    ${src}
    var __exp = {};
    if (typeof Physics      !== 'undefined') __exp.Physics      = Physics;
    if (typeof SignalManager !== 'undefined') __exp.SignalManager = SignalManager;
    if (typeof AudioEngine  !== 'undefined') __exp.AudioEngine  = AudioEngine;
    if (typeof Renderer     !== 'undefined') __exp.Renderer     = Renderer;
    if (typeof UI           !== 'undefined') __exp.UI           = UI;
    return __exp;
  `;
  try {
    const result = new Function(body)();  // eslint-disable-line no-new-func
    Object.assign(ctx, result);
  } catch (e) {
    console.error(`[load] Failed to load ${file}: ${e.message}`);
    process.exit(1);
  }
}

load('physics.js');
load('signals.js');

const { Physics, SignalManager } = ctx;

// ── Minimal test runner ───────────────────────────────────────────────────────

let passed = 0, failed = 0;
let currentSection = '';

function section(name) {
  currentSection = name;
  console.log(`\n${name}`);
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}`);
    console.error(`       → ${err.message}`);
    failed++;
  }
}

/** Assert two numbers are within `tol` of each other */
function approx(actual, expected, tol = 0.01, label = '') {
  if (Math.abs(actual - expected) > tol) {
    throw new assert.AssertionError({
      message: `${label ? label + ': ' : ''}expected ≈${expected} (±${tol}), got ${actual}`,
      actual, expected, operator: '≈',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Physics
// ─────────────────────────────────────────────────────────────────────────────

section('📐  Physics — signalAgeLY');

test('Marconi 1895 has traveled ~130 LY by mid-2026', () => {
  const p   = new Physics();
  const now = new Date(2026, 5, 1);
  approx(p.signalAgeLY(1895, 12, 1, now), 130.5, 1.0);
});

test('Apollo 11 (Jul 1969) has traveled ~57 LY by Jul 2026', () => {
  const p   = new Physics();
  const now = new Date(2026, 6, 20);
  approx(p.signalAgeLY(1969, 7, 20, now), 57.0, 0.5);
});

test('Arecibo 1974 has traveled ~52 LY by 2026', () => {
  const p   = new Physics();
  const now = new Date(2026, 0, 1);
  approx(p.signalAgeLY(1974, 11, 16, now), 51.1, 0.5);
});

test('Future signal returns 0 (not negative)', () => {
  const p   = new Physics();
  const now = new Date(2026, 0, 1);
  assert.strictEqual(p.signalAgeLY(2030, 1, 1, now), 0);
});

test('Signal sent exactly now returns ~0', () => {
  const p   = new Physics();
  const now = new Date();
  approx(p.signalAgeLY(now.getFullYear(), now.getMonth() + 1, now.getDate(), now), 0, 0.01);
});

test('Missing month/day defaults gracefully (no throw)', () => {
  const p   = new Physics();
  const now = new Date(2026, 0, 1);
  const age = p.signalAgeLY(1969, undefined, undefined, now);
  assert.ok(age > 0);
});

// ─────────────────────────────────────────────────────────────────────────────

section('📐  Physics — pixelsPerLY');

test('500 LY viewport on 1000 px canvas → 2 px/LY', () => {
  const p = new Physics();
  p.setViewportLY(500);
  approx(p.pixelsPerLY(1000), 2.0, 0.001);
});

test('1 LY viewport on 1000 px canvas → 1000 px/LY', () => {
  const p = new Physics();
  p.setViewportLY(1);
  approx(p.pixelsPerLY(1000), 1000, 0.001);
});

test('100000 LY viewport on 1920 px → 0.0192 px/LY', () => {
  const p = new Physics();
  p.setViewportLY(100000);
  approx(p.pixelsPerLY(1920), 0.0192, 0.001);
});

// ─────────────────────────────────────────────────────────────────────────────

section('📐  Physics — auToLY');

test('63241.077 AU = 1 LY', () => {
  const p = new Physics();
  approx(p.auToLY(63241.077), 1.0, 0.001);
});

test('0 AU = 0 LY', () => {
  approx(new Physics().auToLY(0), 0, 0.0001);
});

// ─────────────────────────────────────────────────────────────────────────────

section('📐  Physics — setViewportLY / zoom clamping');

test('setViewportLY clamps to minimum (LY_MIN)', () => {
  const p = new Physics();
  p.setViewportLY(-100);
  assert.ok(p.viewportLY > 0, 'must be > 0 after clamping');
});

test('setViewportLY clamps to maximum (LY_MAX = 130000)', () => {
  const p = new Physics();
  p.setViewportLY(999_000_000);
  assert.ok(p.viewportLY <= 130000);
});

test('zoomByDelta positive → zooms out (larger viewportLY)', () => {
  const p      = new Physics();
  const before = p.viewportLY;
  p.zoomByDelta(200);
  assert.ok(p.viewportLY > before, `expected > ${before}, got ${p.viewportLY}`);
});

test('zoomByDelta negative → zooms in (smaller viewportLY)', () => {
  const p      = new Physics();
  const before = p.viewportLY;
  p.zoomByDelta(-200);
  assert.ok(p.viewportLY < before);
});

test('zoomByDelta 0 → no change', () => {
  const p = new Physics();
  const before = p.viewportLY;
  p.zoomByDelta(0);
  assert.strictEqual(p.viewportLY, before);
});

// ─────────────────────────────────────────────────────────────────────────────

section('📐  Physics — slider ↔ LY (log scale)');

test('lyToSlider(LY_MIN=0.005) → 100', () => {
  approx(new Physics().lyToSlider(0.005), 100, 0.1);
});

test('lyToSlider(LY_MAX=130000) → 0', () => {
  approx(new Physics().lyToSlider(130000), 0, 0.1);
});

test('sliderToLY(100) → LY_MIN', () => {
  approx(new Physics().sliderToLY(100), 0.005, 0.001);
});

test('sliderToLY(0) → LY_MAX', () => {
  approx(new Physics().sliderToLY(0), 130000, 1);
});

test('round-trip: lyToSlider → sliderToLY is accurate for many values', () => {
  const p = new Physics();
  for (const ly of [0.01, 0.1, 1, 50, 300, 5000, 50000, 100000]) {
    const back = p.sliderToLY(p.lyToSlider(ly));
    approx(back, ly, ly * 0.002, `round-trip @ ${ly} LY`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────

section('📐  Physics — formatLY');

test('very small value → AU suffix', () => {
  assert.ok(new Physics().formatLY(0.000001).endsWith('AU'));
});

test('sub-LY value → LY with decimals', () => {
  const s = new Physics().formatLY(0.5);
  assert.ok(s.includes('LY'), `got: ${s}`);
});

test('mid-range → LY suffix', () => {
  assert.ok(new Physics().formatLY(57).includes('LY'));
});

test('large value → kLY suffix', () => {
  assert.ok(new Physics().formatLY(5000).includes('kLY'));
});

test('returns a non-empty string for any finite input', () => {
  const p = new Physics();
  for (const v of [0.000001, 0.1, 1, 100, 1000, 100000]) {
    const s = p.formatLY(v);
    assert.ok(typeof s === 'string' && s.length > 0, `empty result for ${v}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SignalManager
// ─────────────────────────────────────────────────────────────────────────────

section('🛸  SignalManager — isSpacecraft');

test('object with launched_year → true', () => {
  assert.ok(new SignalManager(new Physics()).isSpacecraft({ launched_year: 1977 }));
});

test('object with only year → false', () => {
  assert.ok(!new SignalManager(new Physics()).isSpacecraft({ year: 1969 }));
});

test('null → false', () => {
  assert.ok(!new SignalManager(new Physics()).isSpacecraft(null));
});

test('undefined → false', () => {
  assert.ok(!new SignalManager(new Physics()).isSpacecraft(undefined));
});

// ─────────────────────────────────────────────────────────────────────────────

section('🛸  SignalManager — craftDistanceAU');

test('Voyager 1 (1977, 3.599 AU/yr) ≈ 176 AU by Jun 2026', () => {
  const sm = new SignalManager(new Physics());
  const v1 = { launched_year: 1977, launched_month: 9, launched_day: 5, speed_au_per_year: 3.599 };
  approx(sm.craftDistanceAU(v1, new Date(2026, 5, 1)), 176, 5);
});

test('Pioneer 10 (1972, 2.543 AU/yr) ≈ 137 AU by 2026', () => {
  const sm = new SignalManager(new Physics());
  const p10 = { launched_year: 1972, launched_month: 3, launched_day: 2, speed_au_per_year: 2.543 };
  approx(sm.craftDistanceAU(p10, new Date(2026, 5, 1)), 137, 5);
});

test('craft launched today → 0 AU', () => {
  const sm  = new SignalManager(new Physics());
  const now = new Date();
  const c   = { launched_year: now.getFullYear(), launched_month: now.getMonth() + 1, launched_day: now.getDate(), speed_au_per_year: 3.0 };
  approx(sm.craftDistanceAU(c, now), 0, 0.05);
});

test('future launch → 0 AU (not negative)', () => {
  const sm = new SignalManager(new Physics());
  const c  = { launched_year: 2030, speed_au_per_year: 3.0 };
  assert.strictEqual(sm.craftDistanceAU(c, new Date(2026, 0, 1)), 0);
});

test('missing speed_au_per_year defaults to nonzero fallback', () => {
  const sm  = new SignalManager(new Physics());
  const now = new Date(2026, 0, 1);
  const c   = { launched_year: 1977 }; // no speed field
  assert.ok(sm.craftDistanceAU(c, now) > 0, 'should fall back to a default speed');
});

// ─────────────────────────────────────────────────────────────────────────────

section('🛸  SignalManager — data loading & hover');

test('loadSignals stores the signals array', () => {
  const sm = new SignalManager(new Physics());
  sm.loadSignals({ signals: [{ id: 'a', year: 1969 }, { id: 'b', year: 1974 }] });
  assert.strictEqual(sm.signals.length, 2);
});

test('loadSignals with empty data → empty array', () => {
  const sm = new SignalManager(new Physics());
  sm.loadSignals({});
  assert.deepStrictEqual(sm.signals, []);
});

test('loadSpacecraft stores the spacecraft array', () => {
  const sm = new SignalManager(new Physics());
  sm.loadSpacecraft({ spacecraft: [{ id: 'v1', launched_year: 1977 }] });
  assert.strictEqual(sm.spacecraft.length, 1);
});

test('getHoveredItem → null when nothing hovered', () => {
  assert.strictEqual(new SignalManager(new Physics()).getHoveredItem(), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
console.log('─'.repeat(50) + '\n');

if (failed > 0) process.exit(1);
