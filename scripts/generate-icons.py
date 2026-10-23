#!/usr/bin/env python3
"""Generate the app icon set from code (no external, watermarked assets)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "src-tauri" / "icons"
ICONSET = ROOT / "src-tauri" / "icons" / "icon.iconset"
S = 1024


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def gradient(size, top, bottom):
    img = Image.new("RGBA", (size, size))
    px = img.load()
    for y in range(size):
        c = lerp(top, bottom, y / (size - 1))
        for x in range(size):
            px[x, y] = (*c, 255)
    return img


def build_master():
    # Apple-style rounded square with a soft navy gradient.
    tile = gradient(S, (17, 36, 84), (5, 13, 36))
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((42, 42, S - 42, S - 42), radius=224, fill=255)
    tile.putalpha(mask)

    # Cyan ambience behind the robot.
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((210, 230, 814, 830), fill=(34, 211, 238, 80))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    tile.alpha_composite(glow)

    d = ImageDraw.Draw(tile)

    # Antenna
    d.line((512, 254, 512, 318), fill=(132, 232, 255, 255), width=20)
    d.ellipse((478, 210, 546, 278), fill=(103, 232, 249, 255))
    d.ellipse((492, 224, 532, 264), fill=(220, 252, 255, 255))

    # Ears
    d.rounded_rectangle((182, 404, 250, 602), radius=34, fill=(40, 125, 235, 255))
    d.rounded_rectangle((774, 404, 842, 602), radius=34, fill=(40, 125, 235, 255))
    d.rounded_rectangle((205, 446, 227, 560), radius=11, fill=(96, 210, 255, 220))

    # Head shell with subtle rim light
    d.rounded_rectangle((232, 302, 792, 742), radius=158, fill=(30, 82, 180, 255))
    d.rounded_rectangle((246, 316, 778, 728), radius=146, fill=(22, 58, 139, 255))
    d.rounded_rectangle((260, 330, 764, 714), radius=136, outline=(75, 179, 255, 255), width=8)

    # Face screen
    d.rounded_rectangle((318, 390, 706, 638), radius=86, fill=(6, 16, 45, 255))
    d.rounded_rectangle((330, 402, 694, 626), radius=76, outline=(52, 119, 214, 180), width=5)

    # Eyes
    for cx in (432, 592):
        d.ellipse((cx - 54, 474, cx + 54, 582), fill=(34, 211, 238, 255))
        d.ellipse((cx - 28, 500, cx + 28, 556), fill=(235, 254, 255, 255))
        d.ellipse((cx - 10, 518, cx + 14, 542), fill=(8, 27, 66, 255))

    # Smile
    d.arc((450, 522, 574, 604), start=18, end=162, fill=(103, 232, 249, 255), width=13)

    # Body
    d.rounded_rectangle((338, 772, 686, 914), radius=58, fill=(23, 67, 154, 255))
    d.rounded_rectangle((380, 794, 644, 890), radius=36, fill=(10, 31, 78, 255))
    for x, color in ((438, (34, 211, 238, 255)), (512, (96, 165, 250, 255)), (586, (167, 139, 250, 255))):
        d.ellipse((x - 17, 823, x + 17, 857), fill=color)

    # Bottom shadow inside the tile.
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse((275, 858, 749, 948), fill=(0, 0, 0, 100))
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    tile.alpha_composite(shadow)

    return tile


def main():
    ICONS.mkdir(parents=True, exist_ok=True)
    master = build_master()
    master.save(ICONS / "icon.png")

    sizes = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon-512.png": 512,
    }
    for filename, size in sizes.items():
        master.resize((size, size), Image.LANCZOS).save(ICONS / filename)

    if ICONSET.exists():
        import shutil
        shutil.rmtree(ICONSET)
    ICONSET.mkdir()
    for size in (16, 32, 128, 256, 512):
        master.resize((size, size), Image.LANCZOS).save(ICONSET / f"icon_{size}x{size}.png")
        master.resize((size * 2, size * 2), Image.LANCZOS).save(
            ICONSET / f"icon_{size}x{size}@2x.png"
        )

    print("icons written to", ICONS)


if __name__ == "__main__":
    main()
