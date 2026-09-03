"""Nawad IMS process-flow diagram in the BAICS flowchart style."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1760, 2360
SCALE = 2

INK = (20, 24, 32)
MUTED = (90, 96, 108)
WHITE = (255, 255, 255)
START = (255, 183, 77)
PROCESS = (30, 136, 229)
DECISION = (255, 234, 88)
END = (239, 83, 80)
CARD = (248, 250, 252)

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "process-flow.png"
FONT_REG = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")


def S(v: float) -> int:
    return int(round(v * SCALE))


def xy(p: tuple[float, float]) -> tuple[int, int]:
    return S(p[0]), S(p[1])


def font(size: float, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REG), S(size))


def wrap(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, max_w: float) -> list[str]:
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
    return lines or [""]


def head(draw: ImageDraw.ImageDraw, a: tuple[float, float], b: tuple[float, float], size: float = 10) -> None:
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    left = (b[0] - size * math.cos(ang - 0.4), b[1] - size * math.sin(ang - 0.4))
    right = (b[0] - size * math.cos(ang + 0.4), b[1] - size * math.sin(ang + 0.4))
    draw.polygon([xy(b), xy(left), xy(right)], fill=INK)


def stroke(draw: ImageDraw.ImageDraw, pts: list[tuple[float, float]], width: float = 1.8) -> None:
    draw.line([xy(p) for p in pts], fill=INK, width=max(2, S(width)))


def arrow(draw: ImageDraw.ImageDraw, pts: list[tuple[float, float]]) -> None:
    stroke(draw, pts)
    head(draw, pts[-2], pts[-1])


def tag(draw: ImageDraw.ImageDraw, text: str, x: float, y: float) -> None:
    f = font(11, True)
    tw = draw.textbbox((0, 0), text, font=f)[2]
    pad = S(4)
    draw.rectangle(
        [S(x) - tw // 2 - pad, S(y) - S(9), S(x) + tw // 2 + pad, S(y) + S(9)],
        fill=WHITE,
        outline=INK,
        width=S(1),
    )
    draw.text((S(x), S(y)), text, font=f, fill=INK, anchor="mm")


def draw_oval(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], fill: tuple[int, int, int], title: str) -> None:
    x, y, w, h = box
    draw.ellipse([S(x), S(y), S(x + w), S(y + h)], fill=fill, outline=INK, width=S(2.4))
    draw.text((S(x + w / 2), S(y + h / 2)), title, font=font(16, True), fill=INK, anchor="mm")


def draw_process(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], num: str, title: str, bullets: list[str]) -> None:
    x, y, w, h = box
    draw.rounded_rectangle([S(x), S(y), S(x + w), S(y + h)], radius=S(8), fill=PROCESS, outline=INK, width=S(2.2))
    draw.ellipse([S(x + 12), S(y + 10), S(x + 46), S(y + 38)], fill=WHITE, outline=INK, width=S(1.6))
    draw.text((S(x + 29), S(y + 24)), num, font=font(12, True), fill=INK, anchor="mm")
    draw.text((S(x + 56), S(y + 24)), title, font=font(14, True), fill=WHITE, anchor="lm")
    f = font(11)
    ty = y + 48
    for bullet in bullets:
        for line in wrap(draw, "• " + bullet, f, w - 32):
            draw.text((S(x + 16), S(ty)), line, font=f, fill=WHITE, anchor="lm")
            ty += 15


def draw_diamond(draw: ImageDraw.ImageDraw, cx: float, cy: float, w: float, h: float, title: str) -> None:
    pts = [(cx, cy - h / 2), (cx + w / 2, cy), (cx, cy + h / 2), (cx - w / 2, cy)]
    draw.polygon([xy(p) for p in pts], fill=DECISION, outline=INK)
    stroke(draw, pts + [pts[0]], 2.2)
    f = font(12, True)
    lines = wrap(draw, title, f, w * 0.62)
    start = cy - (len(lines) - 1) * 8
    for i, ln in enumerate(lines):
        draw.text((S(cx), S(start + i * 16)), ln, font=f, fill=INK, anchor="mm")


def mid(box: tuple[float, float, float, float]) -> tuple[float, float]:
    x, y, w, h = box
    return x + w / 2, y + h / 2


def bottom(box: tuple[float, float, float, float]) -> tuple[float, float]:
    x, y, w, h = box
    return x + w / 2, y + h


def top(box: tuple[float, float, float, float]) -> tuple[float, float]:
    x, y, w, h = box
    return x + w / 2, y


def left(box: tuple[float, float, float, float]) -> tuple[float, float]:
    x, y, w, h = box
    return x, y + h / 2


def right(box: tuple[float, float, float, float]) -> tuple[float, float]:
    x, y, w, h = box
    return x + w, y + h / 2


def main() -> None:
    img = Image.new("RGB", (S(W), S(H)), WHITE)
    draw = ImageDraw.Draw(img)

    draw.text((S(W / 2), S(26)), "NAWAD INVENTORY MANAGEMENT SYSTEM", font=font(22, True), fill=INK, anchor="mm")
    draw.text((S(W / 2), S(54)), "PROCESS FLOW", font=font(18, True), fill=MUTED, anchor="mm")

    # Legend
    draw_oval(draw, (70, 78, 120, 36), START, "Start / End")
    draw.rounded_rectangle([S(220), S(82), S(330), S(110)], radius=S(5), fill=PROCESS, outline=INK, width=S(1.6))
    draw.text((S(275), S(96)), "Process", font=font(12, True), fill=WHITE, anchor="mm")
    draw_diamond(draw, 430, 96, 90, 42, "Decision")
    arrow(draw, [(500, 96), (570, 96)])
    draw.text((S(588), S(96)), "Flow direction", font=font(12), fill=INK, anchor="lm")

    c1, c2, c3 = 60, 620, 1180
    bw = 500

    start = (c1 + 160, 140, 180, 46)
    p1 = (c1, 214, bw, 86)
    d1 = (c1 + 250, 380)
    p2 = (c1, 470, bw, 92)
    p3 = (c1, 590, bw, 108)
    p4 = (c1, 726, bw, 108)
    d2 = (c1 + 250, 916)
    p5 = (c1, 1000, bw, 86)
    p6 = (c1, 1116, bw, 86)

    p7 = (c2, 214, bw, 108)
    d3 = (c2 + 250, 404)
    p8 = (c2, 488, bw, 108)
    p9 = (c2, 624, bw, 108)
    d4 = (c2 + 250, 814)
    p10 = (c2, 898, bw, 100)
    p11 = (c2, 1028, bw, 86)

    p12 = (c3, 214, bw, 108)
    p13 = (c3, 350, bw, 108)
    d5 = (c3 + 250, 540)
    p14 = (c3, 624, bw, 86)
    p15 = (c3, 738, bw, 86)
    d6 = (c3 + 250, 906)
    p16 = (c3, 996, bw, 72)
    end = (c3 + 160, 1100, 180, 46)

    draw_oval(draw, start, START, "START")
    draw_process(draw, p1, "1", "Login User", ["Enter username and password", "Load role and page permissions"])
    draw_diamond(draw, d1[0], d1[1], 210, 108, "Valid credentials?")
    draw_process(draw, p2, "2", "Open Dashboard", ["Show KPIs, value, and RS Needed cost", "Show low-stock alerts"])
    draw_process(draw, p3, "3", "Maintain User", ["Admin creates, edits, or deletes accounts", "Assign department, role, and RBAC"])
    draw_process(draw, p4, "4", "Maintain Item", ["Add, edit, or delete item", "Add or use stock", "Compute FSN, ROP, MSL, RS Needed"])
    draw_diamond(draw, d2[0], d2[1], 210, 108, "Stock below ROP?")
    draw_process(draw, p5, "5", "Flag Shortage", ["Mark RS Needed", "Show alert on Dashboard and Reports"])
    draw_process(draw, p6, "6", "Select Dataset", ["Switch Stock or Office Materials", "Filter by FSN or trigger"])

    draw_process(draw, p7, "7", "Forecast Demand", ["WMA for regular usage", "Croston for intermittent usage", "Project 3 / 6 / 12 months"])
    draw_diamond(draw, d3[0], d3[1], 220, 108, "Send to procurement?")
    draw_process(draw, p8, "8", "Submit Request", ["Send forecast or upload file", "Create pending request"])
    draw_process(draw, p9, "9", "Review Request", ["Approve, deny, or enter stock", "Denial requires a reason"])
    draw_diamond(draw, d4[0], d4[1], 200, 108, "Request denied?")
    draw_process(draw, p10, "10", "Apply Stock", ["Add approved or entered quantity", "Write stock-in transaction"])
    draw_process(draw, p11, "11", "Record Activity", ["Log who changed what", "Open details on Activity page"])

    draw_process(draw, p12, "12", "Produce Report", ["Inventory, forecast, and alert export", "PDF or Excel"])
    draw_process(draw, p13, "13", "Maintain Calendar", ["Daily add / use by item", "Notes and monthly report download"])
    draw_diamond(draw, d5[0], d5[1], 210, 108, "Results reviewed?")
    draw_process(draw, p14, "14", "Notify User", ["Low-stock alerts", "Calendar due and shared notes"])
    draw_process(draw, p15, "15", "Configure Setting", ["Profile, password, picture", "Session timeout / logout"])
    draw_diamond(draw, d6[0], d6[1], 230, 118, "Continue using system?")
    draw_process(draw, p16, "16", "Logout User", ["End session and clear access"])
    draw_oval(draw, end, END, "END")

    # Column 1 arrows
    arrow(draw, [bottom(start), top(p1)])
    arrow(draw, [bottom(p1), (d1[0], d1[1] - 54)])
    arrow(draw, [(d1[0], d1[1] + 54), top(p2)])
    tag(draw, "Yes", d1[0] + 28, d1[1] + 70)
    # No loop back to login
    arrow(draw, [(d1[0] - 105, d1[1]), (c1 - 8, d1[1]), (c1 - 8, mid(p1)[1]), left(p1)])
    tag(draw, "No", d1[0] - 130, d1[1] - 16)
    arrow(draw, [bottom(p2), top(p3)])
    arrow(draw, [bottom(p3), top(p4)])
    arrow(draw, [bottom(p4), (d2[0], d2[1] - 54)])
    arrow(draw, [(d2[0], d2[1] + 54), top(p5)])
    tag(draw, "Yes", d2[0] + 28, d2[1] + 70)
    arrow(draw, [(d2[0] - 105, d2[1]), (c1 - 8, d2[1]), (c1 - 8, mid(p6)[1]), left(p6)])
    tag(draw, "No", d2[0] - 130, d2[1] - 16)
    arrow(draw, [bottom(p5), top(p6)])

    # col1 -> col2
    arrow(draw, [right(p6), (c2, mid(p7)[1] + 80), left(p7)])

    # Column 2
    arrow(draw, [bottom(p7), (d3[0], d3[1] - 54)])
    arrow(draw, [(d3[0], d3[1] + 54), top(p8)])
    tag(draw, "Yes", d3[0] + 28, d3[1] + 70)
    arrow(draw, [(d3[0] - 110, d3[1]), (c2 - 8, d3[1]), (c2 - 8, 180), (c3 + 250, 180)])
    tag(draw, "No", d3[0] - 136, d3[1] - 16)
    arrow(draw, [bottom(p8), top(p9)])
    arrow(draw, [bottom(p9), (d4[0], d4[1] - 54)])
    arrow(draw, [(d4[0], d4[1] + 54), top(p10)])
    tag(draw, "No", d4[0] + 24, d4[1] + 70)
    arrow(draw, [(d4[0] - 100, d4[1]), (c2 - 8, d4[1]), (c2 - 8, mid(p8)[1]), left(p8)])
    tag(draw, "Yes", d4[0] - 128, d4[1] - 16)
    arrow(draw, [bottom(p10), top(p11)])
    arrow(draw, [right(p11), left(p14)])

    # Column 3
    arrow(draw, [bottom(p12), top(p13)])
    arrow(draw, [bottom(p13), (d5[0], d5[1] - 54)])
    arrow(draw, [(d5[0], d5[1] + 54), top(p14)])
    tag(draw, "Yes", d5[0] + 28, d5[1] + 70)
    arrow(draw, [(d5[0] - 105, d5[1]), (c3 - 8, d5[1]), (c3 - 8, mid(p12)[1]), left(p12)])
    tag(draw, "No", d5[0] - 130, d5[1] - 16)
    arrow(draw, [bottom(p14), top(p15)])
    arrow(draw, [bottom(p15), (d6[0], d6[1] - 59)])
    arrow(draw, [(d6[0], d6[1] + 59), top(p16)])
    tag(draw, "No", d6[0] + 26, d6[1] + 76)
    arrow(draw, [(d6[0] - 115, d6[1]), (c3 - 8, d6[1]), (c3 - 8, 168), (mid(start)[0], 168), bottom(start)])
    tag(draw, "Yes", d6[0] - 148, d6[1] - 16)
    arrow(draw, [bottom(p16), top(end)])

    # No-forecast shortcut lands on Produce Report
    # already drawn to (c3+250, 180) — connect down to p12 top
    arrow(draw, [(c3 + 250, 180), top(p12)])

    draw.rounded_rectangle([S(60), S(1230), S(1700), S(1488)], radius=S(10), fill=CARD, outline=INK, width=S(1.4))
    draw.text((S(80), S(1254)), "Roles", font=font(15, True), fill=INK, anchor="lm")
    roles = [
        "Administrator — users, inventory, forecast, procurement review, reports, calendar, activity",
        "Branch / Department Manager — inventory, forecast, procurement approve / deny / stock entry, reports, calendar",
        "Inventory Clerk — inventory, stock add/use, forecast, submit procurement (no Users, no Reports)",
        "Warehouse Staff — view dashboard and inventory only",
    ]
    for i, text in enumerate(roles):
        draw.text((S(80), S(1280 + i * 22)), "• " + text, font=font(12), fill=INK, anchor="lm")
    draw.text((S(80), S(1378)), "Notes", font=font(15, True), fill=INK, anchor="lm")
    notes = [
        "Process names use verb + noun (Login User, Maintain Item, Forecast Demand, Produce Report).",
        "If credentials fail, flow returns to Login User. If a request is denied, flow returns to Submit Request.",
        "If stock is not below ROP, skip Flag Shortage and continue to Select Dataset.",
        "If forecast is not sent to procurement, skip request review and go to Produce Report.",
    ]
    for i, text in enumerate(notes):
        draw.text((S(80), S(1402 + i * 20)), "• " + text, font=font(12), fill=INK, anchor="lm")

    img.save(OUT, "PNG", dpi=(300, 300))
    print(f"Wrote {OUT} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
