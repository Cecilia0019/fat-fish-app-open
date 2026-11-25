"""Generate neutral FatFish App icons and avatar placeholders."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ANDROID = ROOT / "mobile" / "android" / "app" / "src" / "main" / "res"


def gradient(size, top=(40, 170, 255), bottom=(0, 110, 210)):
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        d.line([(0, y), (size, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img.convert("RGBA")


def fish_icon(size=512):
    img = gradient(size)
    d = ImageDraw.Draw(img)
    # white fish: body + tail + eye, deliberately generic
    cx, cy = size * 0.48, size * 0.52
    body_w, body_h = size * 0.52, size * 0.32
    d.ellipse([cx - body_w / 2, cy - body_h / 2, cx + body_w / 2, cy + body_h / 2], fill=(255, 255, 255, 255))
    tail = [
        (cx + body_w * 0.44, cy),
        (cx + body_w * 0.74, cy - body_h * 0.52),
        (cx + body_w * 0.74, cy + body_h * 0.52),
    ]
    d.polygon(tail, fill=(255, 255, 255, 255))
    d.ellipse([cx + body_w * 0.03, cy - body_h * 0.17, cx + body_w * 0.13, cy - body_h * 0.05], fill=(0, 115, 200, 255))
    # soft bubbles
    d.ellipse([size * 0.12, size * 0.18, size * 0.20, size * 0.26], outline=(255, 255, 255, 160), width=max(2, size // 100))
    d.ellipse([size * 0.78, size * 0.66, size * 0.84, size * 0.72], outline=(255, 255, 255, 160), width=max(2, size // 100))
    return img


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    icon = fish_icon(512)
    icon.save(PUBLIC / "fish-cover.png")
    icon.save(PUBLIC / "icon-512.png")
    icon.resize((192, 192), Image.LANCZOS).save(PUBLIC / "icon-192.png")
    # avatar: circular crop on transparent square
    avatar = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    mask = Image.new("L", (256, 256), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, 255, 255], fill=255)
    avatar.paste(icon.resize((256, 256), Image.LANCZOS), (0, 0), mask)
    avatar.save(PUBLIC / "fish-avatar.png")
    (PUBLIC / "icon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#28aaff"/><stop offset="1" stop-color="#006ed2"/>'
        '</linearGradient></defs>'
        '<rect width="512" height="512" rx="112" fill="url(#g)"/>'
        '<ellipse cx="240" cy="266" rx="132" ry="82" fill="#fff"/>'
        '<path d="M344 266l72-56v112z" fill="#fff"/>'
        '<circle cx="290" cy="242" r="17" fill="#0b74c9"/>'
        '<circle cx="100" cy="140" r="18" fill="none" stroke="#fff" stroke-width="8" opacity=".65"/>'
        '</svg>',
        encoding="utf-8",
    )
    for density, px in {"mipmap-mdpi": 48, "mipmap-hdpi": 72, "mipmap-xhdpi": 96, "mipmap-xxhdpi": 144, "mipmap-xxxhdpi": 192}.items():
        target = ANDROID / density
        target.mkdir(parents=True, exist_ok=True)
        icon.resize((px, px), Image.LANCZOS).save(target / "ic_launcher.png")
    (ANDROID / "drawable").mkdir(parents=True, exist_ok=True)
    icon.resize((512, 512), Image.LANCZOS).save(ANDROID / "drawable" / "splash.png")
    icon.resize((192, 192), Image.LANCZOS).save(ANDROID / "drawable" / "ic_launcher.png")
    print("generic assets written")


if __name__ == "__main__":
    main()
