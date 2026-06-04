'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// audio.js — "Radio tuning" audio sampler using the Web Audio API
//
// On play():
//   1. Loads (and caches) the audio file
//   2. Picks a random start position in the first 70% of the track
//   3. Fades in with a bandpass filter for a "radio" coloring
//   4. Loops until stop() is called, which fades out
// ─────────────────────────────────────────────────────────────────────────────

class AudioEngine {
  constructor() {
    this._ctx    = null;
    this._source = null;
    this._gain   = null;
    this._cache  = {};    // url → AudioBuffer
    this.playing = false;

    this.FADE_IN  = 0.5;  // seconds
    this.FADE_OUT = 0.4;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _ensureContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  async _loadBuffer(url) {
    if (this._cache[url]) return this._cache[url];
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Audio not found: ${url}`);
    const arr = await res.arrayBuffer();
    const buf = await this._ctx.decodeAudioData(arr);
    this._cache[url] = buf;
    return buf;
  }

  // ── Public ─────────────────────────────────────────────────────────────────

  /** Play a random sample from audioFile (filename inside /audio/) */
  async play(audioFile) {
    const ctx = this._ensureContext();
    this.stop(); // fade out any current audio first

    if (!audioFile) { this.playing = false; return; }

    try {
      const buf = await this._loadBuffer(`/audio/${audioFile}`);

      // Random start within first 70% of track
      const offset = Math.random() * buf.duration * 0.7;

      // Gain (master volume + fade)
      this._gain = ctx.createGain();
      this._gain.gain.setValueAtTime(0, ctx.currentTime);
      this._gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + this.FADE_IN);

      // Bandpass for "radio" effect
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 0.75;

      // Source
      this._source = ctx.createBufferSource();
      this._source.buffer = buf;
      this._source.loop = true;
      this._source.connect(filter);
      filter.connect(this._gain);
      this._gain.connect(ctx.destination);
      this._source.start(0, offset);

      this.playing = true;
    } catch (err) {
      console.warn('[AudioEngine] Could not load audio:', err.message);
      this.playing = false;
      // Signal to UI that audio failed
      this.onError && this.onError(err.message);
    }
  }

  /** Fade out and stop current audio */
  stop() {
    if (!this._ctx) return;
    if (this._gain) {
      const t = this._ctx.currentTime;
      this._gain.gain.setValueAtTime(this._gain.gain.value, t);
      this._gain.gain.linearRampToValueAtTime(0, t + this.FADE_OUT);
    }
    if (this._source) {
      const src = this._source;
      const delay = (this.FADE_OUT + 0.05) * 1000;
      setTimeout(() => { try { src.stop(); } catch (_) {} }, delay);
      this._source = null;
    }
    this.playing = false;
  }
}
