'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// main.js — Bootstrap, game loop, input handling
// ─────────────────────────────────────────────────────────────────────────────

// ── Visible error reporting ───────────────────────────────────────────────────
// Any uncaught JS error shows up in the red banner, not just the console.
window.onerror = function (msg, src, line, col, err) {
  var banner = document.getElementById('loading-error');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = 'JS Error: ' + msg + '\n(' + (src || '?') + ':' + line + ')';
  }
  console.error('[uncaught]', msg, src, line, err);
  return false;
};

window.addEventListener('unhandledrejection', function (e) {
  var banner = document.getElementById('loading-error');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = 'Unhandled promise rejection: ' + (e.reason || e);
  }
  console.error('[unhandledrejection]', e.reason);
});

// ── Canvas setup ──────────────────────────────────────────────────────────────

var canvas = document.getElementById('main-canvas');
var ctx    = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  if (renderer) renderer.regenerateStars();
}

// ── Systems ───────────────────────────────────────────────────────────────────

var physics  = new Physics();
var audio    = new AudioEngine();
var renderer = new Renderer(canvas, ctx);
var sigMgr   = new SignalManager(physics);
var ui       = new UI(physics, sigMgr, audio);

// If audio fails to load, update the popup label so the user knows
audio.onError = function () {
  var dot = document.getElementById('audio-dot');
  var lbl = document.getElementById('popup-audio-label');
  if (dot) dot.className = 'audio-dot';
  if (lbl) lbl.textContent = 'Audio file not found in audio/ folder';
};

// ── Mouse state ───────────────────────────────────────────────────────────────

var mouseX = -9999, mouseY = -9999;

canvas.addEventListener('mousemove', function (e) {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

canvas.addEventListener('click', function () {
  var item = sigMgr.getHoveredItem();
  if (item) {
    ui.showPopup(item, new Date());
    audio.play(item.audio_file);
  } else if (ui.isPopupOpen()) {
    ui.closePopup();
    audio.stop();
  }
});

canvas.addEventListener('wheel', function (e) {
  e.preventDefault();
  physics.zoomByDelta(e.deltaY);
  ui.syncSlider();
}, { passive: false });

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && ui.isPopupOpen()) {
    ui.closePopup();
    audio.stop();
  }
});

// ── Game loop ─────────────────────────────────────────────────────────────────
// Starts IMMEDIATELY — the canvas draws stars and Earth even before data loads.
// Signals and spacecraft populate as soon as the API responds.

function loop(timestamp) {
  var now  = new Date();
  var t    = timestamp / 1000;
  var cx   = canvas.width  / 2;
  var cy   = canvas.height / 2;
  var pxLY = physics.pixelsPerLY(canvas.width);

  // Draw background layers
  renderer.drawBackground();
  renderer.drawStars(t);

  // Signal circles — sorted oldest → newest
  var sortedSignals = sigMgr.signals.slice().sort(function (a, b) { return a.year - b.year; });
  for (var i = 0; i < sortedSignals.length; i++) {
    var sig  = sortedSignals[i];
    var rPx  = physics.signalAgeLY(sig.year, sig.month, sig.day, now) * pxLY;
    renderer.drawSignalCircle(cx, cy, rPx, sig, sigMgr.hoveredSignal === sig);
  }

  // Spacecraft
  for (var j = 0; j < sigMgr.spacecraft.length; j++) {
    var craft   = sigMgr.spacecraft[j];
    var distPx  = physics.auToLY(sigMgr.craftDistanceAU(craft, now)) * pxLY;
    renderer.drawSpacecraft(cx, cy, distPx, craft, sigMgr.hoveredCraft === craft);
  }

  // Earth on top
  renderer.drawEarth(cx, cy);

  // Hover detection (only when popup is closed)
  if (!ui.isPopupOpen()) {
    sigMgr.updateHover(mouseX, mouseY, cx, cy, canvas.width, now);
  }
  canvas.style.cursor = sigMgr.getHoveredItem() ? 'pointer' : 'crosshair';

  // HUD
  ui.updateClock(now);
  ui.updateZoomHUD(canvas.width);
  if (ui.isPopupOpen()) ui.updatePopupDistance(now);

  requestAnimationFrame(loop);
}

// ── Init ──────────────────────────────────────────────────────────────────────

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Start the render loop right away — no waiting for data
requestAnimationFrame(loop);

function setLoadingText(text) {
  var el = document.getElementById('loading-sub');
  if (el) el.textContent = text;
}

function fadeOutLoading() {
  var el = document.getElementById('loading-screen');
  if (!el) return;
  el.classList.add('fade-out');
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1000);
}

setLoadingText('Fetching signal data…');

Promise.all([
  fetch('/api/signals').then(function (r) {
    if (!r.ok) throw new Error('/api/signals returned ' + r.status);
    return r.json();
  }),
  fetch('/api/spacecraft').then(function (r) {
    if (!r.ok) throw new Error('/api/spacecraft returned ' + r.status);
    return r.json();
  }),
]).then(function (results) {
  sigMgr.loadSignals(results[0]);
  sigMgr.loadSpacecraft(results[1]);
  setLoadingText('Loaded ' + sigMgr.signals.length + ' signals · ' + sigMgr.spacecraft.length + ' spacecraft');
  setTimeout(fadeOutLoading, 600);
}).catch(function (err) {
  console.error('Data load failed:', err);
  setLoadingText('Error: ' + err.message + ' — is the Flask server running?');
  var banner = document.getElementById('loading-error');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = err.message + '\n\nMake sure app.py is running: python app.py';
  }
  // Still fade the overlay after 4 s — the canvas renders even without API data
  setTimeout(fadeOutLoading, 4000);
});
