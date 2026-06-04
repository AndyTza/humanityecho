#!/bin/bash
# serve.sh — convert YAML → JSON then start local server
cd "$(dirname "$0")"

echo ""
echo "  🌌  Humanity's Echo"

# Auto-convert nearby_stars.yaml if yaml module is available
if python3 -c "import yaml" 2>/dev/null; then
  echo "  ⭐  Converting nearby_stars.yaml → JSON…"
  python3 convert.py
else
  echo "  ⚠   PyYAML not installed — skipping YAML conversion"
  echo "      Run: pip3 install pyyaml   then re-run this script"
fi

echo ""
echo "  Open: http://localhost:8000"
echo "  Stop: Ctrl+C"
echo ""
python3 -m http.server 8000
