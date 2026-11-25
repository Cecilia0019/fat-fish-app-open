"""生成内置表情包（12 张 256px PNG）和 index.json，不依赖外部素材。"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "stickers"
OUT.mkdir(parents=True, exist_ok=True)
FONT = r"C:\Windows\Fonts\msyhbd.ttc"
S = 2
SIZE = 256

STICKERS = [
    ("good", "好耶", (20, 184, 166), "开心"),
    ("hug", "贴贴", (236, 72, 153), "害羞"),
    ("sleepy", "困", (99, 102, 241), "摆烂"),
    ("angry", "生气", (239, 68, 68), "生气"),
    ("sad", "委屈", (59, 130, 246), "委屈"),
    ("like", "赞", (34, 197, 94), "赞同"),
    ("lol", "笑死", (245, 158, 11), "搞笑"),
    ("night", "晚安", (139, 92, 246), "告别"),
    ("ok", "收到", (14, 165, 233), "赞同"),
    ("shy", "害羞", (244, 114, 182), "害羞"),
    ("eat", "干饭", (249, 115, 22), "馋饿"),
    ("no", "不要", (100, 116, 139), "无语"),
]


def lighten(color, amount=0.25):
    return tuple(min(255, int(c + (255 - c) * amount)) for c in color)


def darken(color, amount=0.2):
    return tuple(max(0, int(c * (1 - amount))) for c in color)


def font(size):
    return ImageFont.truetype(FONT, size * S)


def center_text(draw, text, y, size, fill=(255, 255, 255, 255)):
    f = font(size)
    box = draw.textbbox((0, 0), text, font=f)
    w = box[2] - box[0]
    h = box[3] - box[1]
    draw.text(((SIZE * S - w) / 2 - box[0], y * S - box[1]), text, font=f, fill=fill)
    return h


def draw_face(draw, kind, color):
    cx, cy = SIZE * S / 2, 108 * S
    dark = (18, 28, 38, 235)
    white = (255, 255, 255, 235)
    eye_dx, eye_dy = 30 * S, 0
    r = 7 * S
    lx, rx = cx - eye_dx, cx + eye_dx
    ey = cy - eye_dy

    if kind in ("good", "lol"):
        for x in (lx, rx):
            draw.arc([x - 16 * S, ey - 14 * S, x + 16 * S, ey + 12 * S], 200, 340, fill=dark, width=5 * S)
        if kind == "lol":
            draw.ellipse([cx - 28 * S, cy + 14 * S, cx + 28 * S, cy + 52 * S], fill=dark)
            draw.ellipse([cx - 16 * S, cy + 40 * S, cx + 16 * S, cy + 50 * S], fill=(255, 120, 140, 220))
        else:
            draw.arc([cx - 34 * S, cy + 8 * S, cx + 34 * S, cy + 50 * S], 20, 160, fill=dark, width=6 * S)
    elif kind == "hug":
        for x in (lx, rx):
            draw.arc([x - 16 * S, ey - 8 * S, x + 16 * S, ey + 12 * S], 20, 160, fill=dark, width=5 * S)
        draw.arc([cx - 28 * S, cy + 18 * S, cx + 28 * S, cy + 46 * S], 20, 160, fill=dark, width=5 * S)
        for hx, hy in ((62, 70), (194, 58), (178, 92)):
            draw.ellipse([hx * S, hy * S, (hx + 14) * S, (hy + 14) * S], fill=(255, 150, 190, 230))
    elif kind == "sleepy":
        for x in (lx, rx):
            draw.line([x - 14 * S, ey, x + 14 * S, ey], fill=dark, width=5 * S)
        draw.arc([cx - 22 * S, cy + 18 * S, cx + 22 * S, cy + 40 * S], 200, 340, fill=dark, width=4 * S)
        draw.text((188 * S, 52 * S), "z", font=font(24), fill=white)
        draw.text((206 * S, 38 * S), "z", font=font(18), fill=white)
    elif kind == "angry":
        for x, sign in ((lx, 1), (rx, -1)):
            draw.line([x - sign * 16 * S, ey - 18 * S, x + sign * 14 * S, ey - 6 * S], fill=dark, width=5 * S)
            draw.ellipse([x - 6 * S, ey - 2 * S, x + 6 * S, ey + 10 * S], fill=dark)
        draw.line([cx - 22 * S, cy + 30 * S, cx + 22 * S, cy + 30 * S], fill=dark, width=5 * S)
        draw.line([cx - 46 * S, 52 * S, cx - 56 * S, 38 * S], fill=dark, width=4 * S)
        draw.line([cx + 46 * S, 52 * S, cx + 56 * S, 38 * S], fill=dark, width=4 * S)
    elif kind == "sad":
        for x in (lx, rx):
            draw.arc([x - 14 * S, ey - 6 * S, x + 14 * S, ey + 12 * S], 200, 340, fill=dark, width=5 * S)
        draw.arc([cx - 24 * S, cy + 34 * S, cx + 24 * S, cy + 56 * S], 200, 340, fill=dark, width=5 * S)
        draw.ellipse([rx - 4 * S, ey + 18 * S, rx + 8 * S, ey + 40 * S], fill=(125, 211, 252, 230))
    elif kind == "no":
        for x in (lx, rx):
            draw.line([x - 11 * S, ey - 11 * S, x + 11 * S, ey + 11 * S], fill=dark, width=5 * S)
            draw.line([x + 11 * S, ey - 11 * S, x - 11 * S, ey + 11 * S], fill=dark, width=5 * S)
        draw.line([cx - 20 * S, cy + 30 * S, cx + 20 * S, cy + 30 * S], fill=dark, width=5 * S)
    else:
        for x in (lx, rx):
            draw.ellipse([x - r, ey - r, x + r, ey + r], fill=dark)
            draw.ellipse([x - 3 * S, ey - 3 * S, x + 1 * S, ey + 1 * S], fill=(255, 255, 255, 240))
        if kind == "like":
            draw.arc([cx - 30 * S, cy + 14 * S, cx + 30 * S, cy + 50 * S], 20, 160, fill=dark, width=6 * S)
        elif kind == "night":
            draw.arc([cx - 24 * S, cy + 20 * S, cx + 24 * S, cy + 44 * S], 20, 160, fill=dark, width=4 * S)
            draw.ellipse([188 * S, 50 * S, 218 * S, 80 * S], fill=(255, 245, 200, 220))
            draw.ellipse([198 * S, 44 * S, 228 * S, 74 * S], fill=(139, 92, 246, 255))
        elif kind == "shy":
            draw.arc([cx - 30 * S, cy + 16 * S, cx + 30 * S, cy + 44 * S], 20, 160, fill=dark, width=5 * S)
            draw.ellipse([cx - 52 * S, cy + 18 * S, cx - 28 * S, cy + 30 * S], fill=(255, 120, 150, 110))
            draw.ellipse([cx + 28 * S, cy + 18 * S, cx + 52 * S, cy + 30 * S], fill=(255, 120, 150, 110))
        elif kind == "eat":
            draw.ellipse([cx - 18 * S, cy + 24 * S, cx + 18 * S, cy + 48 * S], fill=dark)
            draw.ellipse([cx - 48 * S, cy + 36 * S, cx - 12 * S, cy + 54 * S], fill=(255, 255, 255, 230))
            draw.arc([cx - 12 * S, cy + 32 * S, cx + 24 * S, cy + 58 * S], 270, 90, fill=dark, width=4 * S)
        else:
            draw.arc([cx - 28 * S, cy + 18 * S, cx + 28 * S, cy + 44 * S], 20, 160, fill=dark, width=5 * S)


def main():
    index = []
    for sid, label, color, emotion in STICKERS:
        W = SIZE * S
        top = lighten(color, 0.18)
        bot = darken(color, 0.12)
        base = Image.new("RGB", (W, W))
        d = ImageDraw.Draw(base)
        for y in range(W):
            t = y / (W - 1)
            d.line([(0, y), (W, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
        mask = Image.new("L", (W, W), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, W - 1], radius=56 * S, fill=255)
        img = base.convert("RGBA")
        img.putalpha(mask)
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([0, 0, W - 1, W - 1], radius=56 * S, outline=(255, 255, 255, 60), width=2 * S)
        draw_face(d, sid, color)
        center_text(d, label, 176, 44, (255, 255, 255, 245))
        img = img.resize((SIZE, SIZE), Image.LANCZOS)
        img.save(OUT / f"{sid}.png", "PNG")
        index.append({"id": sid, "label": label, "file": f"/stickers/{sid}.png", "emotion": emotion})

    (OUT / "index.json").write_text(json.dumps({"stickers": index}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(index)} stickers to {OUT}")


if __name__ == "__main__":
    main()
