#!/usr/bin/env python3
"""
Measure the mole pictures for size and average brightness (README 3.6).

Renders each picture alone, fully up, on a magenta background, then reports
its visible area and its mean relative luminance (CIE Y from sRGB), each
compared with the happy mole. The aim is to keep the pictures within a few
per cent of each other, so a brain difference between them comes from their
meaning, not from one being bigger or brighter.

    python3 scripts/measure-stimuli.py

Needs macOS (it renders with QuickLook's `qlmanage`), Node, NumPy, and Pillow.
These are screen-independent numbers from the drawing's colours. They are not
what a participant's eye receives: before scanning, measure the real
projector with a photometer (README 4.4).
"""
import json, os, subprocess, sys, tempfile

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIN = os.path.join(ROOT, 'src', 'render', 'skin-mole.js')


def linear(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def load_art():
    js = f"import('{SKIN}').then(m => console.log(JSON.stringify(m.moleSkin.art)))"
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', js]))


def measure(art, name, tmp):
    # The hole clips the picture at y = 92 (render/board.js), so clip the same way.
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 120 120">'
           '<rect width="120" height="120" fill="#FF00FF"/>'
           '<defs><clipPath id="c"><rect x="-10" y="-10" width="140" height="102"/></clipPath></defs>'
           f'<g clip-path="url(#c)">{art}</g></svg>')
    path = os.path.join(tmp, f'{name}.svg')
    with open(path, 'w') as f:
        f.write(svg)
    subprocess.run(['qlmanage', '-t', '-s', '1200', '-o', tmp, path], capture_output=True, check=True)
    im = np.asarray(Image.open(path + '.png').convert('RGB')).astype(float)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    # Pixels clearly not magenta are the picture; anti-aliased edges are left out.
    picture = np.sqrt((r - 255) ** 2 + g ** 2 + (b - 255) ** 2) > 120
    y = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
    return picture.mean(), y[picture].mean()


def main():
    if sys.platform != 'darwin':
        sys.exit('This script renders with macOS QuickLook (qlmanage); run it on a Mac.')
    art = load_art()
    with tempfile.TemporaryDirectory() as tmp:
        res = {name: measure(svg, name, tmp) for name, svg in art.items()}
    a0, y0 = res['mole_happy']
    print(f"{'picture':12s} {'area %':>7s} {'vs happy':>9s} {'mean Y':>7s} {'vs happy':>9s}")
    for name, (a, y) in res.items():
        print(f"{name:12s} {100 * a:7.2f} {100 * (a / a0 - 1):+8.1f}% {y:7.4f} {100 * (y / y0 - 1):+8.1f}%")


if __name__ == '__main__':
    main()
