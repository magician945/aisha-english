# -*- coding: utf-8 -*-
"""生成 PWA 应用图标：体素草方块 + 像素字母 A + 雪花点缀（爱莎主题）。
用法：python tools/make_icons.py  （在 aisha-english-pwa 目录下执行）
"""
from PIL import Image, ImageDraw
import os

GREEN_BG = (91, 135, 49, 255)      # 草绿底
GREEN_DK = (60, 93, 34, 255)       # 深绿边框
GREEN_LT = (110, 160, 62, 255)     # 亮绿噪点
WHITE = (255, 255, 255, 255)
ICE = (214, 238, 248, 255)         # 冰雪点缀

LETTER_A = [
    ".XXX.",
    "X...X",
    "X...X",
    "XXXXX",
    "X...X",
    "X...X",
    "X...X",
]

SNOWFLAKE = [
    "...X...",
    ".X.X.X.",
    "..XXX..",
    "XXXXXXX",
    "..XXX..",
    ".X.X.X.",
    "...X...",
]


def draw_icon(size: int, maskable: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), GREEN_BG)
    d = ImageDraw.Draw(img)
    px = max(2, size // 64)  # 噪点像素粒度

    # 背景噪点：随机感用固定伪随机（图标需可复现）
    seed = 7
    def rnd():
        nonlocal seed
        seed = (seed * 1103515245 + 12345) % (2 ** 31)
        return seed / (2 ** 31)

    for y in range(0, size, px):
        for x in range(0, size, px):
            if rnd() < 0.10:
                d.rectangle([x, y, x + px - 1, y + px - 1], fill=GREEN_LT)

    # 深绿边框（体素块边缘感）
    bw = max(3, size // 34)
    for i in range(bw):
        d.rectangle([i, i, size - 1 - i, size - 1 - i], outline=GREEN_DK)

    # 安全区：maskable 图标内容收敛到中央 78%
    scale = 0.62 if maskable else 0.78
    cell = int(size * scale / 7)          # 字母像素单元
    lw = cell * 5
    lh = cell * 7
    ox = (size - lw) // 2
    oy = (size - lh) // 2
    for r, row in enumerate(LETTER_A):
        for c, ch in enumerate(row):
            if ch == "X":
                d.rectangle([ox + c * cell, oy + r * cell,
                             ox + (c + 1) * cell - 1, oy + (r + 1) * cell - 1],
                            fill=WHITE)

    # 雪花点缀（右上角，避开字母）
    s_cell = max(2, size // 56)
    sw = s_cell * 7
    sx = size - bw - int(size * 0.06) - sw
    sy = bw + int(size * 0.06)
    for r, row in enumerate(SNOWFLAKE):
        for c, ch in enumerate(row):
            if ch == "X":
                d.rectangle([sx + c * s_cell, sy + r * s_cell,
                             sx + (c + 1) * s_cell - 1, sy + (r + 1) * s_cell - 1],
                            fill=ICE)
    return img


def main():
    out = os.path.join(os.path.dirname(__file__), "..", "icons")
    out = os.path.abspath(out)
    os.makedirs(out, exist_ok=True)
    for size in (192, 512):
        draw_icon(size, False).save(os.path.join(out, f"icon-{size}.png"))
        draw_icon(size, True).save(os.path.join(out, f"icon-maskable-{size}.png"))
        print("wrote", f"icon-{size}.png", "&", f"icon-maskable-{size}.png")


if __name__ == "__main__":
    main()
