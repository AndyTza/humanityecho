from flask import Flask, jsonify, send_from_directory, render_template, make_response
import yaml
import os
from pathlib import Path

app = Flask(__name__)
BASE_DIR  = Path(__file__).parent
AUDIO_DIR = BASE_DIR / 'audio'


# ── Helpers ───────────────────────────────────────────────────────────────────

def normalize_audio(value):
    """
    Accept any of these in the YAML and return just the filename:
      "song.mp3"
      "/Users/tasos/.../audio/song.mp3"
      null / None
    Returns None if the file does not exist in audio/.
    """
    if not value:
        return None
    filename = os.path.basename(str(value))
    if not (AUDIO_DIR / filename).exists():
        print(f'  ⚠  Audio file not found in audio/: {filename}')
        return None
    return filename


# ── Main page (no caching so changes appear instantly) ───────────────────────

@app.route('/')
def index():
    resp = make_response(render_template('index.html'))
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    resp.headers['Pragma'] = 'no-cache'
    return resp


# ── API ──────────────────────────────────────────────────────────────────────

@app.route('/api/signals')
def get_signals():
    with open(BASE_DIR / 'data' / 'signals.yaml', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    for s in data.get('signals', []):
        s['audio_file'] = normalize_audio(s.get('audio_file'))
    return jsonify(data)


@app.route('/api/spacecraft')
def get_spacecraft():
    with open(BASE_DIR / 'data' / 'spacecraft.yaml', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    for c in data.get('spacecraft', []):
        c['audio_file'] = normalize_audio(c.get('audio_file'))
    return jsonify(data)


# ── Audio files ───────────────────────────────────────────────────────────────

@app.route('/audio/<path:filename>')
def serve_audio(filename):
    safe = os.path.basename(filename)   # prevent path traversal
    return send_from_directory(AUDIO_DIR, safe)


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print('\n  🌌  Humanity\'s Echo — http://localhost:5000\n')
    app.run(debug=True, port=5000)
