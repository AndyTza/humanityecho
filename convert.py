#!/usr/bin/env python3
"""
convert.py — Convert data/nearby_stars.yaml → data/nearby_stars.json
Run this after editing the YAML file, then refresh your browser.

Usage:
    python3 convert.py
"""

import json
import yaml
from pathlib import Path

ROOT = Path(__file__).parent
SRC  = ROOT / 'data' / 'nearby_stars.yaml'
DST  = ROOT / 'data' / 'nearby_stars.json'

with open(SRC, encoding='utf-8') as f:
    data = yaml.safe_load(f)

stars = data.get('stars', [])

# Validate required fields
required = ('name', 'distance_ly', 'ra', 'dec', 'apparent_mag', 'spectral_type')
ok = 0
for s in stars:
    missing = [k for k in required if k not in s]
    if missing:
        print(f'  ⚠  "{s.get("name","?")}" missing fields: {missing}')
    else:
        ok += 1

with open(DST, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f'  ✅  {ok}/{len(stars)} stars written → data/nearby_stars.json')
