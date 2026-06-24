#!/usr/bin/env python3
"""Generate the web-app icon PNGs from the JacRentals logo.

The home-screen / PWA / favicon icons are rasterized from assets/jac-rentals-logo.jpg
(4800x4800 source) so they stay on-brand and reproducible — never hand-drawn.

Usage (needs Pillow; dev-time only, not a CI gate):
    pip install Pillow && python3 tools/gen-app-icons.py

Outputs into assets/: apple-touch-icon.png (iOS home screen), icon-192/512.png
(web manifest / Android), favicon-32.png (browser tab). Wired up in index.html
(<link rel="apple-touch-icon">, manifest.webmanifest).
"""
from PIL import Image

SRC = 'assets/jac-rentals-logo.jpg'
SIZES = {
    'apple-touch-icon.png': 180,   # iOS "Add to Home Screen"
    'icon-192.png': 192,           # web manifest / Android
    'icon-512.png': 512,           # web manifest / Android (+ maskable)
    'favicon-32.png': 32,          # browser tab
}

def main():
    src = Image.open(SRC).convert('RGB')
    for name, size in SIZES.items():
        src.resize((size, size), Image.LANCZOS).save('assets/' + name, 'PNG', optimize=True)
        print(f'wrote assets/{name} ({size}x{size})')

if __name__ == '__main__':
    main()
