#!/usr/bin/env python3
"""Generate square favicon and touch/PWA icons from the existing official RMUTI crest.

The source public/logo.png is the exact crest already used in the website header.
Do not replace the source or distort its proportions. Only generated, public
presentation assets are changed.
"""
from pathlib import Path
from PIL import Image, ImageOps

PUBLIC = Path(__file__).resolve().parents[1] / "public"
SOURCE = PUBLIC / "logo.png"

def square_icon(crest: Image.Image, size: int) -> Image.Image:
    # Very small browser tabs cannot display the tall spire's details.
    # Use the recognizable circular seal at 16px; keep the entire crest
    # for 32px and all larger Apple/Android icons.
    image = crest
    if size == 16:
        seal_top = int(image.height * 0.48)
        image = image.crop((0, seal_top, image.width, image.height))
    max_width = round(size * (0.95 if size <= 32 else 0.86))
    max_height = round(size * (0.96 if size <= 32 else 0.86))
    resized = ImageOps.contain(image, (max_width, max_height), Image.Resampling.LANCZOS)
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    square.alpha_composite(resized, (x, y))
    return square

def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit("Official university crest public/logo.png is missing")
    with Image.open(SOURCE) as opened:
        crest = opened.convert("RGBA")
        alpha_bounds = crest.getchannel("A").getbbox()
        if alpha_bounds:
            crest = crest.crop(alpha_bounds)
        renders = {}
        for size in (16, 32, 180, 192, 512):
            result = square_icon(crest, size)
            result.save(PUBLIC / f"rmuti-crest-{size}.png", format="PNG", optimize=True)
            renders[size] = result
        renders[32].save(PUBLIC / "favicon.ico", format="ICO", sizes=[(16,16), (32,32)])
    print("Generated official RMUTI favicon (16/32), Apple touch (180), and Android icons (192/512)")

if __name__ == "__main__":
    main()
