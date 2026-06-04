#!/usr/bin/env bash
# run_tests.sh — Run the full Humanity's Echo test suite
# Usage: ./run_tests.sh

set -e
cd "$(dirname "$0")"

echo ""
echo "══════════════════════════════════════════════════"
echo "  🧪  Humanity's Echo — Test Suite"
echo "══════════════════════════════════════════════════"

PY_FAIL=0
JS_FAIL=0

echo ""
echo "── Python / Flask (pytest) ───────────────────────"
if python -m pytest tests/test_app.py -v; then
  echo ""
else
  PY_FAIL=1
fi

echo ""
echo "── JavaScript / Node.js ──────────────────────────"
if node tests/test_physics.js; then
  echo ""
else
  JS_FAIL=1
fi

echo "══════════════════════════════════════════════════"
if [ $PY_FAIL -eq 0 ] && [ $JS_FAIL -eq 0 ]; then
  echo "  ✅  All tests passed"
else
  echo "  ❌  Some tests failed (Python: $PY_FAIL  JS: $JS_FAIL)"
  exit 1
fi
echo "══════════════════════════════════════════════════"
echo ""
