"""
tests/test_app.py — Backend tests for Humanity's Echo Flask app

Run with:
    pytest tests/test_app.py -v
"""

import pytest
import sys
import json
from pathlib import Path

# Make sure the project root is importable
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import app as flask_app
from app import normalize_audio


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    flask_app.app.config['TESTING'] = True
    with flask_app.app.test_client() as c:
        yield c


@pytest.fixture
def audio_dir(tmp_path, monkeypatch):
    """Redirect AUDIO_DIR to a temp directory so tests are fully isolated."""
    monkeypatch.setattr(flask_app, 'AUDIO_DIR', tmp_path)
    return tmp_path


# ── normalize_audio ───────────────────────────────────────────────────────────

class TestNormalizeAudio:

    def test_none_returns_none(self, audio_dir):
        assert normalize_audio(None) is None

    def test_empty_string_returns_none(self, audio_dir):
        assert normalize_audio('') is None

    def test_missing_file_returns_none(self, audio_dir):
        assert normalize_audio('does_not_exist.mp3') is None

    def test_plain_filename_existing_file(self, audio_dir):
        (audio_dir / 'sample.mp3').touch()
        assert normalize_audio('sample.mp3') == 'sample.mp3'

    def test_full_absolute_path_strips_to_basename(self, audio_dir):
        (audio_dir / 'sample.mp3').touch()
        result = normalize_audio('/Users/tasos/Desktop/projects/humanityecho/audio/sample.mp3')
        assert result == 'sample.mp3'

    def test_relative_path_strips_to_basename(self, audio_dir):
        (audio_dir / 'sample.mp3').touch()
        result = normalize_audio('../audio/sample.mp3')
        assert result == 'sample.mp3'

    def test_path_with_spaces_in_filename(self, audio_dir):
        (audio_dir / 'my file.mp3').touch()
        assert normalize_audio('/some/path/my file.mp3') == 'my file.mp3'

    def test_various_audio_extensions(self, audio_dir):
        for ext in ('ogg', 'wav', 'flac'):
            fname = f'test.{ext}'
            (audio_dir / fname).touch()
            assert normalize_audio(fname) == fname


# ── Flask routes ──────────────────────────────────────────────────────────────

class TestIndexRoute:

    def test_returns_200(self, client):
        res = client.get('/')
        assert res.status_code == 200

    def test_returns_html(self, client):
        res = client.get('/')
        assert b'<canvas' in res.data or b'<!DOCTYPE html>' in res.data


class TestSignalsRoute:

    def test_returns_200(self, client):
        assert client.get('/api/signals').status_code == 200

    def test_content_type_is_json(self, client):
        res = client.get('/api/signals')
        assert 'application/json' in res.content_type

    def test_has_signals_key(self, client):
        data = client.get('/api/signals').get_json()
        assert 'signals' in data

    def test_at_least_one_signal(self, client):
        signals = client.get('/api/signals').get_json()['signals']
        assert len(signals) >= 1

    def test_required_fields_present(self, client):
        signals = client.get('/api/signals').get_json()['signals']
        required = ('id', 'name', 'year', 'type')
        for s in signals:
            for field in required:
                assert field in s, f"Signal '{s.get('id')}' missing field '{field}'"

    def test_year_is_integer(self, client):
        signals = client.get('/api/signals').get_json()['signals']
        for s in signals:
            assert isinstance(s['year'], int), f"year must be int in signal '{s['id']}'"

    def test_type_is_valid(self, client):
        valid_types = {'radio', 'tv', 'directed', 'optical', 'spacecraft', 'other'}
        signals = client.get('/api/signals').get_json()['signals']
        for s in signals:
            assert s['type'] in valid_types, \
                f"Signal '{s['id']}' has unknown type '{s['type']}'"

    def test_audio_file_is_normalized(self, client):
        """audio_file in the API response must be None or a plain filename (no path separators)."""
        signals = client.get('/api/signals').get_json()['signals']
        for s in signals:
            af = s.get('audio_file')
            if af is not None:
                assert '/' not in af, f"audio_file still contains '/': {af}"
                assert '\\' not in af, f"audio_file still contains '\\\\': {af}"

    def test_audio_file_is_none_or_string(self, client):
        signals = client.get('/api/signals').get_json()['signals']
        for s in signals:
            af = s.get('audio_file')
            assert af is None or isinstance(af, str), \
                f"audio_file must be null or string, got {type(af)}"


class TestSpacecraftRoute:

    def test_returns_200(self, client):
        assert client.get('/api/spacecraft').status_code == 200

    def test_content_type_is_json(self, client):
        res = client.get('/api/spacecraft')
        assert 'application/json' in res.content_type

    def test_has_spacecraft_key(self, client):
        data = client.get('/api/spacecraft').get_json()
        assert 'spacecraft' in data

    def test_at_least_one_spacecraft(self, client):
        crafts = client.get('/api/spacecraft').get_json()['spacecraft']
        assert len(crafts) >= 1

    def test_required_fields_present(self, client):
        crafts = client.get('/api/spacecraft').get_json()['spacecraft']
        required = ('id', 'name', 'launched_year', 'speed_au_per_year', 'direction_deg')
        for c in crafts:
            for field in required:
                assert field in c, f"Spacecraft '{c.get('id')}' missing field '{field}'"

    def test_speed_is_positive(self, client):
        crafts = client.get('/api/spacecraft').get_json()['spacecraft']
        for c in crafts:
            assert c['speed_au_per_year'] > 0, \
                f"Spacecraft '{c['id']}' has non-positive speed"

    def test_direction_is_0_to_360(self, client):
        crafts = client.get('/api/spacecraft').get_json()['spacecraft']
        for c in crafts:
            assert 0 <= c['direction_deg'] < 360, \
                f"Spacecraft '{c['id']}' direction_deg out of range: {c['direction_deg']}"


class TestAudioRoute:

    def test_missing_file_returns_404(self, client):
        res = client.get('/audio/totally_nonexistent_xyz_abc.mp3')
        assert res.status_code == 404

    def test_directory_traversal_is_blocked(self, client):
        """../app.py should not be served — must not return 200."""
        res = client.get('/audio/../app.py')
        assert res.status_code != 200

    def test_double_dot_in_url_is_blocked(self, client):
        res = client.get('/audio/../../requirements.txt')
        assert res.status_code != 200

    def test_existing_audio_file_returns_200(self, client):
        """WAAM file was confirmed present by the user."""
        audio_path = ROOT / 'audio' / '09111928_WAAM.mp3'
        if not audio_path.exists():
            pytest.skip('09111928_WAAM.mp3 not present — skipping live audio test')
        res = client.get('/audio/09111928_WAAM.mp3')
        assert res.status_code == 200
