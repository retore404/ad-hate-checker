#!/usr/bin/env python3
"""
YouTube Ad Time Tracker - Icon Generator
簡易的なアイコン画像を生成します
"""

from PIL import Image, ImageDraw

def create_icon(size):
    """指定サイズのアイコンを作成"""
    # 赤い背景
    img = Image.new('RGB', (size, size), color='#d32f2f')
    draw = ImageDraw.Draw(img)

    # 白い円（時計の文字盤）
    center_x = size // 2
    center_y = size // 2
    radius = int(size * 0.35)

    # 円の輪郭
    line_width = max(1, size // 16)
    draw.ellipse(
        [center_x - radius, center_y - radius, center_x + radius, center_y + radius],
        outline='white',
        width=line_width
    )

    # 時計の短針（10時の方向）
    hand_length_short = int(radius * 0.4)
    hand_end_x = center_x - int(hand_length_short * 0.5)
    hand_end_y = center_y - int(hand_length_short * 0.866)  # sin(60°)
    draw.line(
        [(center_x, center_y), (hand_end_x, hand_end_y)],
        fill='white',
        width=line_width
    )

    # 時計の長針（12時の方向）
    hand_length_long = int(radius * 0.6)
    draw.line(
        [(center_x, center_y), (center_x, center_y - hand_length_long)],
        fill='white',
        width=line_width
    )

    # 中心の点
    dot_radius = max(1, size // 32)
    draw.ellipse(
        [center_x - dot_radius, center_y - dot_radius,
         center_x + dot_radius, center_y + dot_radius],
        fill='white'
    )

    return img

# 各サイズのアイコンを生成
sizes = [16, 48, 128]
for size in sizes:
    icon = create_icon(size)
    icon.save(f'extension/icons/icon{size}.png')
    print(f'Created icon{size}.png')

print('All icons created successfully!')
