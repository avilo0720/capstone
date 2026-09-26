"""Level-1 DFD for Nabua Water Inventory, including issuance."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1720, 1320
SCALE = 2

INK = (18, 18, 18)
MUTED = (80, 80, 80)
WHITE = (255, 255, 255)
ENTITY = (198, 224, 180)
PROCESS = (168, 210, 236)
STORE = (255, 236, 153)

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


def label(draw: ImageDraw.ImageDraw, text: str, x: float, y: float) -> None:
    f = font(12, True)
    bbox = draw.textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad = S(3)
    left, top = S(x) - tw // 2 - pad, S(y) - th // 2 - pad
    draw.rectangle([left, top, left + tw + pad * 2, top + th + pad * 2], fill=WHITE)
    draw.text((S(x), S(y)), text, font=f, fill=INK, anchor="mm")


def entity(draw: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, title: str) -> None:
    draw.rectangle([S(x), S(y), S(x + w), S(y + h)], fill=ENTITY, outline=INK, width=S(2.4))
    lines = title.split("\n")
    f = font(15, True)
    gap = S(18)
    block = gap * (len(lines) - 1)
    for i, line in enumerate(lines):
        draw.text((S(x + w / 2), S(y + h / 2) - block / 2 + gap * i), line, font=f, fill=INK, anchor="mm")


def process_box(draw: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, code: str, title: str) -> None:
    draw.rounded_rectangle([S(x), S(y), S(x + w), S(y + h)], radius=S(7), fill=PROCESS, outline=INK, width=S(2.6))
    draw.text((S(x + w / 2), S(y + 24)), code, font=font(18, True), fill=INK, anchor="mm")
    f = font(14, True)
    lines = title.split("\n")
    if len(lines) == 1 and draw.textbbox((0, 0), title, font=f)[2] > S(w - 22):
        words = title.split()
        mid = math.ceil(len(words) / 2)
        lines = [" ".join(words[:mid]), " ".join(words[mid:])]
    top = S(y + 46) if len(lines) > 1 else S(y + 58)
    for i, line in enumerate(lines):
        draw.text((S(x + w / 2), top + S(18) * i), line, font=f, fill=INK, anchor="mm")


def store_box(draw: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, code: str, name: str, note: str = "") -> None:
    x0, y0, x1, y1 = S(x), S(y), S(x + w), S(y + h)
    split = x0 + S(46)
    draw.rectangle([x0, y0, x1, y1], fill=STORE, outline=INK, width=S(2.2))
    draw.line([(split, y0), (split, y1)], fill=INK, width=S(2.2))
    draw.text(((x0 + split) / 2, (y0 + y1) / 2), code, font=font(13, True), fill=INK, anchor="mm")
    if note:
        draw.text(((split + x1) / 2, (y0 + y1) / 2 - S(9)), name, font=font(13, True), fill=INK, anchor="mm")
        draw.text(((split + x1) / 2, (y0 + y1) / 2 + S(10)), note, font=font(10), fill=INK, anchor="mm")
    else:
        draw.text(((split + x1) / 2, (y0 + y1) / 2), name, font=font(14, True), fill=INK, anchor="mm")


def legend_chip(draw: ImageDraw.ImageDraw, x: float, y: float, kind: str, caption: str) -> None:
    if kind == "entity":
        draw.rectangle([S(x), S(y), S(x + 28), S(y + 16)], fill=ENTITY, outline=INK, width=S(1.4))
    elif kind == "process":
        draw.rounded_rectangle([S(x), S(y), S(x + 28), S(y + 16)], radius=S(3), fill=PROCESS, outline=INK, width=S(1.4))
    elif kind == "flow":
        draw.line([S(x), S(y + 8), S(x + 28), S(y + 8)], fill=INK, width=S(1.6))
        head(draw, (x + 16, y + 8), (x + 28, y + 8), 7)
    else:
        draw.rectangle([S(x), S(y), S(x + 28), S(y + 16)], fill=STORE, outline=INK, width=S(1.4))
    draw.text((S(x + 36), S(y + 8)), caption, font=font(12), fill=INK, anchor="lm")


def flow(draw: ImageDraw.ImageDraw, pts: list[tuple[float, float]], text: str, tx: float, ty: float) -> None:
    arrow(draw, pts)
    label(draw, text, tx, ty)


def main() -> None:
    img = Image.new("RGB", (S(W), S(H)), WHITE)
    draw = ImageDraw.Draw(img)

    # Layout matches the existing level-1 figure and adds issuance (7.0 / D5).
    pw, ph = 230, 96
    px = 690
    sw, sh = 250, 64
    sx = 1040
    left_rail = 250
    right_rail = 1460

    staff = (40, 560, 170, 96)
    admin = (1510, 300, 180, 100)

    boxes = {
        "1.0": (px, 28, "AUTHENTICATE\nUSER"),
        "6.0": (px, 168, "MANAGE USER\nACCOUNT"),
        "2.0": (px, 340, "MAINTAIN\nINVENTORY CATALOG"),
        "5.0": (px, 500, "PRODUCE\nDASHBOARD REPORT"),
        "3.0": (px, 680, "FORECAST\nMATERIAL DEMAND"),
        "4.0": (px, 900, "PROCESS\nPROCUREMENT"),
        "7.0": (px, 1120, "PROCESS\nISSUANCE"),
    }

    def mid_y(code: str, frac: float = 0.5) -> float:
        return boxes[code][1] + ph * frac

    def right(code: str) -> float:
        return boxes[code][0] + pw

    def left(code: str) -> float:
        return boxes[code][0]

    # External rails. D1 sits above the staff rail.
    stroke(draw, [(left_rail, 150), (left_rail, 1240)])
    stroke(draw, [(right_rail, 70), (right_rail, 1240)])
    stroke(draw, [(staff[0] + staff[2], staff[1] + staff[3] / 2), (left_rail, staff[1] + staff[3] / 2)])
    stroke(draw, [(right_rail, admin[1] + admin[3] / 2), (admin[0], admin[1] + admin[3] / 2)])
    dot(draw, left_rail, staff[1] + staff[3] / 2)
    dot(draw, right_rail, admin[1] + admin[3] / 2)

    # 1.0 Authenticate User
    flow(draw, [(left_rail, mid_y("1.0", 0.32)), (left("1.0"), mid_y("1.0", 0.32))], "Credential", 460, mid_y("1.0", 0.32) - 14)
    flow(draw, [(left("1.0"), mid_y("1.0", 0.72)), (left_rail, mid_y("1.0", 0.72))], "Session", 460, mid_y("1.0", 0.72) + 14)
    flow(draw, [(right_rail, mid_y("1.0", 0.32)), (right("1.0"), mid_y("1.0", 0.32))], "Login Key", 1240, mid_y("1.0", 0.32) - 14)
    flow(draw, [(right("1.0"), mid_y("1.0", 0.72)), (right_rail, mid_y("1.0", 0.72))], "Access Grant", 1240, mid_y("1.0", 0.72) + 14)

    # 6.0 Manage User Account (admin only)
    flow(draw, [(right_rail, mid_y("6.0", 0.32)), (right("6.0"), mid_y("6.0", 0.32))], "User Account", 1240, mid_y("6.0", 0.32) - 14)
    flow(draw, [(right("6.0"), mid_y("6.0", 0.72)), (right_rail, mid_y("6.0", 0.72))], "Account Confirmation", 1240, mid_y("6.0", 0.72) + 14)

    # D1 is above Staff so login and account flows do not cross the catalog arrows.
    d1 = (40, 24, 250, 72)
    flow(
        draw,
        [(left("1.0"), mid_y("1.0", 0.5)), (left_rail - 28, mid_y("1.0", 0.5)), (left_rail - 28, d1[1] + 22), (d1[0] + d1[2], d1[1] + 22)],
        "Verification",
        430,
        78,
    )
    flow(
        draw,
        [(d1[0] + d1[2] / 2, d1[1] + d1[3]), (d1[0] + d1[2] / 2, 136), (left("1.0"), 136)],
        "Permission",
        500,
        148,
    )
    flow(
        draw,
        [(left("6.0"), mid_y("6.0", 0.32)), (d1[0] + d1[2] / 2, mid_y("6.0", 0.32)), (d1[0] + d1[2] / 2, d1[1] + d1[3])],
        "Account Entry",
        500,
        mid_y("6.0", 0.32) - 14,
    )
    flow(
        draw,
        [(d1[0] + 40, d1[1] + d1[3]), (d1[0] + 40, mid_y("6.0", 0.72)), (left("6.0"), mid_y("6.0", 0.72))],
        "Account Record",
        460,
        mid_y("6.0", 0.72) + 14,
    )

    # 2.0 Maintain Inventory Catalog
    flow(draw, [(left_rail, mid_y("2.0", 0.32)), (left("2.0"), mid_y("2.0", 0.32))], "Catalog Item", 470, mid_y("2.0", 0.32) - 14)
    flow(draw, [(left("2.0"), mid_y("2.0", 0.72)), (left_rail, mid_y("2.0", 0.72))], "Catalog Status", 470, mid_y("2.0", 0.72) + 14)
    flow(draw, [(right_rail, boxes["2.0"][1] + 8), (right("2.0"), boxes["2.0"][1] + 8)], "Item Details", 1375, boxes["2.0"][1] - 8)
    flow(draw, [(right("2.0"), boxes["2.0"][1] + ph - 8), (right_rail, boxes["2.0"][1] + ph - 8)], "Update Result", 1375, boxes["2.0"][1] + ph + 12)

    # 5.0 Produce Dashboard Report — reads D2
    flow(draw, [(left_rail, mid_y("5.0", 0.32)), (left("5.0"), mid_y("5.0", 0.32))], "Report Inquiry", 470, mid_y("5.0", 0.32) - 14)
    flow(draw, [(left("5.0"), mid_y("5.0", 0.72)), (left_rail, mid_y("5.0", 0.72))], "Stock Report", 470, mid_y("5.0", 0.72) + 14)
    flow(draw, [(right_rail, mid_y("5.0", 0.32)), (right("5.0"), mid_y("5.0", 0.32))], "Report Inquiry", 1260, mid_y("5.0", 0.32) - 14)
    flow(draw, [(right("5.0"), mid_y("5.0", 0.72)), (right_rail, mid_y("5.0", 0.72))], "Operational Output", 1260, mid_y("5.0", 0.72) + 14)

    # 3.0 Forecast Material Demand
    flow(draw, [(left_rail, mid_y("3.0", 0.32)), (left("3.0"), mid_y("3.0", 0.32))], "Forecast Inquiry", 470, mid_y("3.0", 0.32) - 14)
    flow(draw, [(left("3.0"), mid_y("3.0", 0.72)), (left_rail, mid_y("3.0", 0.72))], "AMC Projection", 470, mid_y("3.0", 0.72) + 14)
    flow(draw, [(right_rail, boxes["3.0"][1] + 8), (right("3.0"), boxes["3.0"][1] + 8)], "Demand Inquiry", 1375, boxes["3.0"][1] - 8)
    flow(draw, [(right("3.0"), boxes["3.0"][1] + ph - 8), (right_rail, boxes["3.0"][1] + ph - 8)], "Restock Needed", 1375, boxes["3.0"][1] + ph + 12)

    # Forecast can be sent to procurement or issuance
    flow(
        draw,
        [(px + pw / 2, boxes["3.0"][1] + ph), (px + pw / 2, boxes["4.0"][1])],
        "Procurement Send",
        px + pw / 2 + 78,
        (boxes["3.0"][1] + ph + boxes["4.0"][1]) / 2,
    )
    flow(
        draw,
        [(left("3.0"), boxes["3.0"][1] + ph - 8), (left("3.0") - 36, boxes["3.0"][1] + ph - 8), (left("7.0") - 36, boxes["7.0"][1] + 16), (left("7.0"), boxes["7.0"][1] + 16)],
        "Issuance Send",
        left("3.0") - 110,
        1020,
    )

    # 4.0 Process Procurement
    flow(draw, [(left_rail, mid_y("4.0", 0.32)), (left("4.0"), mid_y("4.0", 0.32))], "Procurement Submission", 470, mid_y("4.0", 0.32) - 14)
    flow(draw, [(left("4.0"), mid_y("4.0", 0.72)), (left_rail, mid_y("4.0", 0.72))], "Submission Status", 470, mid_y("4.0", 0.72) + 14)
    flow(draw, [(right_rail, boxes["4.0"][1] + 8), (right("4.0"), boxes["4.0"][1] + 8)], "Review Decision", 1375, boxes["4.0"][1] - 8)
    flow(draw, [(right("4.0"), boxes["4.0"][1] + ph - 8), (right_rail, boxes["4.0"][1] + ph - 8)], "Decision Status", 1375, boxes["4.0"][1] + ph + 12)

    # 7.0 Process Issuance
    flow(draw, [(left_rail, mid_y("7.0", 0.42)), (left("7.0"), mid_y("7.0", 0.42))], "Issuance Submission", 470, mid_y("7.0", 0.42) - 14)
    flow(draw, [(left("7.0"), mid_y("7.0", 0.78)), (left_rail, mid_y("7.0", 0.78))], "Issue Status", 470, mid_y("7.0", 0.78) + 14)
    flow(draw, [(right_rail, boxes["7.0"][1] + 8), (right("7.0"), boxes["7.0"][1] + 8)], "Issue Decision", 1375, boxes["7.0"][1] - 8)
    flow(draw, [(right("7.0"), boxes["7.0"][1] + ph - 8), (right_rail, boxes["7.0"][1] + ph - 8)], "Issue Result", 1375, boxes["7.0"][1] + ph + 12)

    # Boxes on top of arrow ends
    entity(draw, *staff, "Nabua Water\nStaff")
    entity(draw, *admin, "Nabua Water\nAdmin")
    for code, (x, y, title) in boxes.items():
        process_box(draw, x, y, pw, ph, code, title)

    store_box(draw, *d1, "D1", "Users", "(Users, Roles, Permissions)")
    store_box(draw, sx, boxes["2.0"][1] + (ph - sh) / 2, sw, sh, "D2", "Items")
    store_box(draw, sx, boxes["3.0"][1] + (ph - sh) / 2, sw, sh, "D3", "Transactions")
    store_box(draw, sx, boxes["4.0"][1] + (ph - sh) / 2, sw, sh, "D4", "Procurement Requests")
    store_box(draw, sx, boxes["7.0"][1] + (ph - sh) / 2, sw, sh, "D5", "Issuance Requests")

    def store_flows(code: str, to_name: str, from_name: str) -> None:
        sy = boxes[code][1] + (ph - sh) / 2
        scy = sy + sh / 2
        arrow(draw, [(right(code), scy - 8), (sx, scy - 8)])
        arrow(draw, [(sx, scy + 8), (right(code), scy + 8)])
        label(draw, to_name, (right(code) + sx) / 2, scy - 20)
        label(draw, from_name, (right(code) + sx) / 2, scy + 22)

    store_flows("2.0", "Entry Item", "Item Records")
    # 5.0 reads D2, which sits beside 2.0. Route the pair up the gap.
    d2_bottom = boxes["2.0"][1] + (ph - sh) / 2 + sh
    gap_y = (d2_bottom + boxes["5.0"][1]) / 2
    flow(draw, [(sx + 36, d2_bottom), (sx + 36, boxes["5.0"][1])], "Stock Metric", sx + 110, gap_y - 12)
    flow(draw, [(right("5.0"), boxes["5.0"][1] + 14), (sx + 70, boxes["5.0"][1] + 14), (sx + 70, d2_bottom)], "Report Inquiry", sx + 150, gap_y + 14)
    store_flows("3.0", "Usage Inquiry", "Usage History")
    store_flows("4.0", "Procurement Request", "Request Status")
    store_flows("7.0", "Issuance Request", "Issue Record")

    # Approved issuance deducts stock; stock entry on a procurement adds it.
    flow(
        draw,
        [(sx + sw, boxes["7.0"][1] + sh / 2), (right_rail - 28, boxes["7.0"][1] + sh / 2), (right_rail - 28, boxes["3.0"][1] + sh), (sx + sw, boxes["3.0"][1] + sh)],
        "Stock Issue",
        right_rail - 70,
        1040,
    )

    legend_x, legend_y, legend_w, legend_h = 1488, 28, 200, 132
    draw.rectangle(
        [S(legend_x), S(legend_y), S(legend_x + legend_w), S(legend_y + legend_h)],
        fill=WHITE,
        outline=INK,
        width=S(1.6),
    )
    draw.text((S(legend_x + legend_w / 2), S(legend_y + 16)), "LEGEND", font=font(12, True), fill=INK, anchor="mm")
    legend_chip(draw, legend_x + 12, legend_y + 32, "entity", "External Entity")
    legend_chip(draw, legend_x + 12, legend_y + 54, "process", "Process")
    legend_chip(draw, legend_x + 12, legend_y + 76, "store", "Data Store")
    legend_chip(draw, legend_x + 12, legend_y + 98, "flow", "Data Flow")

    img.save(OUT, "PNG", dpi=(300, 300))
    print(f"Wrote {OUT} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
