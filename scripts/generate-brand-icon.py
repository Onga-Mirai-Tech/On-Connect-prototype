"""
On-Connect 公式アイコン生成スクリプト

「ミントグリーンのグラデーション角丸正方形を背景に、白線画のON/OFFトグルスイッチと、
メンバー同士がつながっている様子（ノード＋線でつながる3人のモチーフ）を組み合わせたデザイン」を
Pillow（純粋なラスター描画）でベクター変換ツールなしに生成する。
（2026-08-03: フィードバックにより「3つ穴のコンセント」モチーフから
 「トグルスイッチ＋メンバーがつながっているイメージ」へ変更）

再生成する場合：
    python3 -m pip install --quiet Pillow
    python3 scripts/generate-brand-icon.py
"""

from PIL import Image, ImageDraw
import math
import os

SIZE = 1024
BRAND_LIGHT = (159, 255, 214, 255)   # 明るいミント
BRAND = (102, 255, 204, 255)          # #66FFCC
BRAND_DARK = (51, 204, 153, 255)      # #33CC99
WHITE = (255, 255, 255, 255)

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "brand")
os.makedirs(OUT_DIR, exist_ok=True)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(4))


def make_background(size):
    """左上(明るいミント)→右下(ブランドダーク)の対角グラデーション角丸正方形"""
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = base.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = lerp(BRAND_LIGHT, BRAND_DARK, t)

    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    radius = round(size * 0.22)
    mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    return out


def draw_icon(size):
    img = make_background(size)
    draw = ImageDraw.Draw(img)
    stroke = max(2, round(size * 0.028))

    # --- ON/OFFトグルスイッチ（白線画、ONの位置＝右にノブ） ---
    track_w = round(size * 0.46)
    track_h = round(size * 0.20)
    track_x0 = (size - track_w) // 2
    track_y0 = round(size * 0.24)
    track_x1 = track_x0 + track_w
    track_y1 = track_y0 + track_h
    draw.rounded_rectangle(
        [track_x0, track_y0, track_x1, track_y1],
        radius=track_h // 2,
        outline=WHITE,
        width=stroke,
    )
    knob_r = round(track_h * 0.34)
    knob_cx = track_x1 - track_h // 2
    knob_cy = (track_y0 + track_y1) // 2
    draw.ellipse(
        [knob_cx - knob_r, knob_cy - knob_r, knob_cx + knob_r, knob_cy + knob_r],
        fill=WHITE,
    )

    # --- メンバー同士がつながっているモチーフ（ノード3つ＋接続線） ---
    cx = size // 2
    node_r = round(size * 0.06)
    top_y = round(size * 0.57)
    bottom_y = round(size * 0.81)
    dx = round(size * 0.155)

    top_node = (cx, top_y)
    left_node = (cx - dx, bottom_y)
    right_node = (cx + dx, bottom_y)

    for a, b in ((top_node, left_node), (top_node, right_node), (left_node, right_node)):
        draw.line([a, b], fill=WHITE, width=stroke)

    for (nx, ny) in (top_node, left_node, right_node):
        draw.ellipse([nx - node_r, ny - node_r, nx + node_r, ny + node_r], fill=WHITE)

    return img


def export_sizes(master):
    sizes = {
        "icon-1024.png": 1024,
        "icon-512.png": 512,
        "icon-192.png": 192,
        "favicon-64.png": 64,
        "favicon-32.png": 32,
    }
    for filename, s in sizes.items():
        resized = master.resize((s, s), Image.LANCZOS)
        resized.save(os.path.join(OUT_DIR, filename))
        print(f"wrote {filename}")


if __name__ == "__main__":
    master = draw_icon(SIZE)
    master.save(os.path.join(OUT_DIR, "icon-1024.png"))
    export_sizes(master)
    print("done ->", OUT_DIR)
