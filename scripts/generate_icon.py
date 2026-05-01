from PIL import Image, ImageDraw
import math
import os

# Colors
BG = (10, 10, 15)          # #0A0A0F — deep dark with subtle blue
SURFACE = (20, 22, 32)      # slightly lighter surface layer
ACCENT = (0, 201, 167)      # #00C9A7 — teal-green
ACCENT_DIM = (0, 140, 116)  # darker teal for depth
GRAY = (55, 60, 75)         # muted gray

def create_icon(size=512):
    scale = size / 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # --- Background rounded square ---
    corner_r = int(90 * scale)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=corner_r, fill=BG)

    cx = size // 2

    # ---- Layout constants (all at 512, scaled) ----
    bar_w   = int(48 * scale)
    gap     = int(28 * scale)
    total_w = 3 * bar_w + 2 * gap
    start_x = cx - total_w // 2

    # Bar heights: ascending left → right (short, medium, tall)
    bar_heights = [int(118 * scale), int(158 * scale), int(198 * scale)]
    bars_bottom = int(292 * scale)

    bar_radius = int(22 * scale)

    # Draw shadow/glow for bars (slightly larger, dim teal, offset)
    for i, h in enumerate(bar_heights):
        x = start_x + i * (bar_w + gap)
        y_top = bars_bottom - h
        # subtle background layer for depth
        draw.rounded_rectangle(
            [x - 3, y_top - 3, x + bar_w + 3, bars_bottom + 3],
            radius=bar_radius + 2,
            fill=(*ACCENT_DIM, 60)
        )

    # Draw the 3 bars
    for i, h in enumerate(bar_heights):
        x = start_x + i * (bar_w + gap)
        y_top = bars_bottom - h
        draw.rounded_rectangle(
            [x, y_top, x + bar_w, bars_bottom],
            radius=bar_radius,
            fill=ACCENT
        )

    # ---- Bridge connecting bars to handle ----
    bridge_h = int(18 * scale)
    bridge_y = int(298 * scale)
    bridge_radius = int(8 * scale)
    draw.rounded_rectangle(
        [start_x, bridge_y, start_x + total_w, bridge_y + bridge_h],
        radius=bridge_radius,
        fill=ACCENT
    )

    # ---- Handle ----
    handle_w = int(42 * scale)
    handle_h = int(92 * scale)
    handle_x = cx - handle_w // 2
    handle_y = int(316 * scale)
    draw.rounded_rectangle(
        [handle_x, handle_y, handle_x + handle_w, handle_y + handle_h],
        radius=handle_w // 2,
        fill=ACCENT
    )

    # ---- Subtle corner accent line (top-left) for visual interest ----
    line_len = int(48 * scale)
    line_w = int(4 * scale)
    margin = int(32 * scale)
    draw.rounded_rectangle(
        [margin, margin, margin + line_len, margin + line_w],
        radius=line_w // 2,
        fill=(*GRAY, 180)
    )
    draw.rounded_rectangle(
        [margin, margin, margin + line_w, margin + line_len],
        radius=line_w // 2,
        fill=(*GRAY, 180)
    )

    return img


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "app", "public", "icons")
    os.makedirs(out_dir, exist_ok=True)

    for size in [512, 192]:
        icon = create_icon(size)
        path = os.path.join(out_dir, f"icon-{size}.png")
        icon.save(path, "PNG")
        print(f"Saved {path}")

    # Also save a preview at 512
    preview = create_icon(512)
    preview_path = os.path.join(os.path.dirname(__file__), "icon-preview-512.png")
    preview.save(preview_path, "PNG")
    print(f"Preview saved: {preview_path}")


if __name__ == "__main__":
    main()
