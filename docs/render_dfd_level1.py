"""Level-1 DFD — 6 processes, Nawad-specific labels."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1840, 1680
SCALE = 2

INK = (18, 18, 18)
MUTED = (80, 80, 80)
WHITE = (255, 255, 255)
ENTITY = (146, 208, 80)
PROCESS = (79, 163, 223)
STORE = (255, 242, 0)
SOFT = (240, 242, 245)

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "dfd-level-1.png"
FONT_REG = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")


def S(v: float) -> int:
    return int(round(v * SCALE))


def xy(p: tuple[float, float]) -> tuple[int, int]:
    return S(p[0]), S(p[1])


def font(size: float, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REG), S(size))


def head(draw: ImageDraw.ImageDraw, a: tuple[float, float], b: tuple[float, float], size: float = 12) -> None:
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    left = (b[0] - size * math.cos(ang - 0.4), b[1] - size * math.sin(ang - 0.4))
    right = (b[0] - size * math.cos(ang + 0.4), b[1] - size * math.sin(ang + 0.4))
    draw.polygon([xy(b), xy(left), xy(right)], fill=INK)


def stroke(draw: ImageDraw.ImageDraw, pts: list[tuple[float, float]], width: float = 2.4) -> None:
    draw.line([xy(p) for p in pts], fill=INK, width=max(3, S(width)))


def dot(draw: ImageDraw.ImageDraw, x: float, y: float, r: float = 4.2) -> None:
    draw.ellipse([S(x - r), S(y - r), S(x + r), S(y + r)], fill=INK, outline=INK)


def arrow(draw: ImageDraw.ImageDraw, pts: list[tuple[float, float]], start_dot: bool = False, end_dot: bool = False) -> None:
    stroke(draw, pts)
    head(draw, pts[-2], pts[-1])
    if start_dot:
        dot(draw, pts[0][0], pts[0][1])
    if end_dot:
        dot(draw, pts[-1][0], pts[-1][1])


def tag(draw: ImageDraw.ImageDraw, text: str, x: float, y: float, max_w: float = 210) -> None:
    f = font(13, True)
    words = text.split()
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textbbox((0, 0), trial, font=f)[2] > S(max_w) and cur:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    if cur:
        lines.append(cur)
    lh, pad_x, pad_y = S(16), S(8), S(5)
    widths = [draw.textbbox((0, 0), ln, font=f)[2] for ln in lines] or [S(20)]
    bw = max(widths) + pad_x * 2
    bh = lh * len(lines) + pad_y * 2
    left, top = S(x) - bw // 2, S(y) - bh // 2
    draw.rectangle([left - S(1), top - S(1), left + bw + S(1), top + bh + S(1)], fill=WHITE)
    draw.rectangle([left, top, left + bw, top + bh], fill=WHITE, outline=INK, width=S(1.4))
    for i, ln in enumerate(lines):
        draw.text((S(x), top + pad_y + lh * i + lh / 2), ln, font=f, fill=INK, anchor="mm")


def entity(draw: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, title: str) -> None:
    draw.rectangle([S(x), S(y), S(x + w), S(y + h)], fill=ENTITY, outline=INK, width=S(2.6))
    draw.text((S(x + w / 2), S(y + h / 2)), title, font=font(24, True), fill=INK, anchor="mm")


def process_box(draw: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, code: str, title: str) -> None:
    draw.rounded_rectangle([S(x), S(y), S(x + w), S(y + h)], radius=S(7), fill=PROCESS, outline=INK, width=S(2.6))
    draw.text((S(x + w / 2), S(y + 24)), code, font=font(18, True), fill=INK, anchor="mm")
    f = font(15, True)
    if draw.textbbox((0, 0), title, font=f)[2] > S(w - 22):
        words = title.split()
        mid = math.ceil(len(words) / 2)
        draw.text((S(x + w / 2), S(y + 50)), " ".join(words[:mid]), font=f, fill=INK, anchor="mm")
        draw.text((S(x + w / 2), S(y + 70)), " ".join(words[mid:]), font=f, fill=INK, anchor="mm")
    else:
        draw.text((S(x + w / 2), S(y + 58)), title, font=f, fill=INK, anchor="mm")


def store_box(draw: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, code: str, name: str) -> None:
    x0, y0, x1, y1 = S(x), S(y), S(x + w), S(y + h)
    draw.rectangle([x0, y0, x1, y1], fill=STORE)
    draw.line([(x0, y0), (x1, y0)], fill=INK, width=S(2.6))
    draw.line([(x0, y1), (x1, y1)], fill=INK, width=S(2.6))
    draw.line([(x0, y0), (x0, y1)], fill=INK, width=S(2.8))
    draw.line([(x1, y0), (x1, y1)], fill=INK, width=S(2.6))
    label = f"{code}  {name}"
    f = font(16, True)
    if draw.textbbox((0, 0), label, font=f)[2] > S(w - 16):
        draw.text(((x0 + x1) / 2, (y0 + y1) / 2 - S(8)), code, font=f, fill=INK, anchor="mm")
        draw.text(((x0 + x1) / 2, (y0 + y1) / 2 + S(10)), name, font=font(14, True), fill=INK, anchor="mm")
    else:
        draw.text(((x0 + x1) / 2, (y0 + y1) / 2), label, font=f, fill=INK, anchor="mm")


def legend_chip(draw: ImageDraw.ImageDraw, x: float, y: float, kind: str, caption: str) -> None:
    if kind == "entity":
        draw.rectangle([S(x), S(y), S(x + 36), S(y + 20)], fill=ENTITY, outline=INK, width=S(1.6))
    elif kind == "process":
        draw.rounded_rectangle([S(x), S(y), S(x + 36), S(y + 20)], radius=S(4), fill=PROCESS, outline=INK, width=S(1.6))
    else:
        draw.rectangle([S(x), S(y), S(x + 36), S(y + 20)], fill=STORE, outline=INK, width=S(1.6))
    draw.text((S(x + 46), S(y + 10)), caption, font=font(13), fill=INK, anchor="lm")


def main() -> None:
    img = Image.new("RGB", (S(W), S(H)), WHITE)
    draw = ImageDraw.Draw(img)

    draw.text((S(W / 2), S(30)), "Level-1 Data Flow Diagram", font=font(30, True), fill=INK, anchor="mm")
    draw.text((S(W / 2), S(62)), "Nawad Inventory Management System", font=font(17), fill=MUTED, anchor="mm")

    legend_chip(draw, 560, 84, "entity", "External entity")
    legend_chip(draw, 780, 84, "process", "Process")
    legend_chip(draw, 960, 84, "store", "Data store")
    dot(draw, 1168, 94, 4.2)
    draw.text((S(1180), S(94)), "Connection point", font=font(13), fill=INK, anchor="lm")

    staff = (48, 128, 188, 76)
    admin = (1604, 128, 188, 76)
    entity(draw, *staff, "Staff")
    entity(draw, *admin, "Admin")

    staff_bus = staff[0] + staff[2] / 2
    admin_bus = admin[0] + admin[2] / 2
    bus_bottom = 1470
    stroke(draw, [(staff_bus, staff[1] + staff[3]), (staff_bus, bus_bottom)])
    stroke(draw, [(admin_bus, admin[1] + admin[3]), (admin_bus, bus_bottom)])
    dot(draw, staff_bus, staff[1] + staff[3])
    dot(draw, admin_bus, admin[1] + admin[3])

    px, pw, ph = 400, 360, 92
    sx, sw, sh = 900, 280, 60
    row_h = 210
    start_y = 230

    # Naming: process = verb + noun; flow = unique singular noun; store = plural noun
    rows = [
        dict(
            code="1.0",
            title="Authenticate User",
            store=("D1", "Users"),
            staff=True,
            staff_in="Credential",
            staff_out="Session",
            admin=True,
            admin_in="Login Key",
            admin_out="Access Grant",
            to_store="Verification",
            from_store="Permission",
        ),
        dict(
            code="2.0",
            title="Maintain Inventory Catalog",
            store=("D2", "Items"),
            staff=True,
            staff_in="Catalog Item",
            staff_out="Catalog Status",
            admin=True,
            admin_in="Item Detail",
            admin_out="Update Result",
            to_store="Item Entry",
            from_store="Item Record",
        ),
        dict(
            code="3.0",
            title="Forecast Material Demand",
            store=("D3", "Transactions"),
            staff=True,
            staff_in="Forecast Inquiry",
            staff_out="AMC Projection",
            admin=True,
            admin_in="Demand Inquiry",
            admin_out="Restock Need",
            to_store="Usage Inquiry",
            from_store="Usage History",
        ),
        dict(
            code="4.0",
            title="Process Procurement",
            store=("D4", "Procurement Requests"),
            staff=True,
            staff_in="Procurement Submission",
            staff_out="Submission Status",
            admin=True,
            admin_in="Review Decision",
            admin_out="Decision Status",
            to_store="Procurement Request",
            from_store="Request Status",
        ),
        dict(
            code="5.0",
            title="Produce Dashboard Report",
            store=("D2", "Items"),
            staff=True,
            staff_in="Report Inquiry",
            staff_out="Stock Report",
            admin=True,
            admin_in="Overview Inquiry",
            admin_out="Dashboard Summary",
            to_store="Metric Inquiry",
            from_store="Stock Metric",
        ),
        dict(
            code="6.0",
            title="Manage User Account",
            store=("D1", "Users"),
            staff=False,
            staff_in="",
            staff_out="",
            admin=True,
            admin_in="User Account",
            admin_out="Account Confirmation",
            to_store="Account Entry",
            from_store="Account Record",
        ),
    ]

    for i, row in enumerate(rows):
        y = start_y + i * row_h
        box_y = y + 36
        store_y = box_y + ((ph - sh) / 2)
        staff_in_y = box_y + 24
        staff_out_y = box_y + ph - 24
        admin_in_y = box_y
        admin_out_y = box_y + ph
        admin_x = px + pw - 36
        scy = store_y + sh / 2

        if i:
            stroke(draw, [(80, y), (1760, y)], 0.9)

        process_box(draw, px, box_y, pw, ph, row["code"], row["title"])
        store_box(draw, sx, store_y, sw, sh, row["store"][0], row["store"][1])

        arrow(draw, [(px + pw, scy - 10), (sx, scy - 10)], end_dot=True)
        arrow(draw, [(sx, scy + 10), (px + pw, scy + 10)], end_dot=True)
        tag(draw, row["to_store"], (px + pw + sx) / 2, scy - 28, 190)
        tag(draw, row["from_store"], (px + pw + sx) / 2, scy + 28, 190)

        if row["staff"]:
            arrow(draw, [(staff_bus, staff_in_y), (px, staff_in_y)], start_dot=True, end_dot=True)
            tag(draw, row["staff_in"], (staff_bus + px) / 2, staff_in_y - 22, 190)
            arrow(draw, [(px, staff_out_y), (staff_bus, staff_out_y)], start_dot=True, end_dot=True)
            tag(draw, row["staff_out"], (staff_bus + px) / 2, staff_out_y + 22, 190)

        if row["admin"]:
            arrow(draw, [(admin_bus, admin_in_y), (admin_x, admin_in_y)], start_dot=True, end_dot=True)
            tag(draw, row["admin_in"], (sx + sw + admin_bus) / 2, admin_in_y - 22, 185)
            arrow(draw, [(admin_x, admin_out_y), (admin_bus, admin_out_y)], start_dot=True, end_dot=True)
            tag(draw, row["admin_out"], (sx + sw + admin_bus) / 2, admin_out_y + 22, 185)

    draw.rectangle([S(40), S(1504), S(1800), S(1648)], fill=SOFT, outline=INK, width=S(1.4))
    draw.text((S(60), S(1524)), "Data stores", font=font(16, True), fill=INK, anchor="lm")
    notes = [
        "D1 Users — accounts, departments, roles, and page / ability permissions",
        "D2 Items — catalog (Stock Materials / Office Materials), qty, price, AMC, FSN / ROP / MSL / RS Needed",
        "D3 Transactions — stock-in (add) and stock-out (use) history used by forecast, calendar, and reports",
        "D4 Procurement Requests — forecast or file submissions; pending / approved / denied / stock-entered",
        "Staff uses 1.0–5.0.  Only Admin uses 6.0 Manage User Account.  5.0 covers Dashboard, Reports / alerts, and Calendar.",
        "Naming: process = verb + noun; flow = unique singular noun; store = plural noun.",
    ]
    for i, text in enumerate(notes):
        draw.text((S(60), S(1552 + i * 16)), text, font=font(13), fill=INK, anchor="lm")

    img.save(OUT, "PNG", dpi=(300, 300))
    print(f"Wrote {OUT} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
