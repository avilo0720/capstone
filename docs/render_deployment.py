"""UML-style deployment diagram for the Nawad inventory system."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 2700, 2380
SCALE = 2
ROOT = Path(__file__).resolve().parent
OUT = ROOT / "deployment-diagram.png"
FONT_REG = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")

INK = (32, 41, 57)
MUTED = (71, 84, 103)
WHITE = (255, 255, 255)
LINE = (152, 162, 179)


def S(v: float) -> int:
    return int(round(v * SCALE))


def font(size: float, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REG), S(size))


def rrect(draw, box, radius, fill, outline, width=1.6):
    draw.rounded_rectangle(
        [S(box[0]), S(box[1]), S(box[2]), S(box[3])],
        radius=S(radius),
        fill=fill,
        outline=outline,
        width=max(2, S(width)),
    )


def text(draw, s, xy, size, fill=INK, bold=False, anchor="lt"):
    draw.text((S(xy[0]), S(xy[1])), s, font=font(size, bold), fill=fill, anchor=anchor)


def center(draw, lines, cx, y, size, fill=INK, bold=False, gap=4):
    f = font(size, bold)
    for i, line in enumerate(lines):
        draw.text((S(cx), S(y + i * (size + gap))), line, font=f, fill=fill, anchor="mt")


def arrow(draw, pts, color=INK, width=2.0):
    scaled = [(S(x), S(y)) for x, y in pts]
    draw.line(scaled, fill=color, width=max(2, S(width)))
    x1, y1 = pts[-2]
    x2, y2 = pts[-1]
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 9
    left = (x2 - size * math.cos(ang - 0.42), y2 - size * math.sin(ang - 0.42))
    right = (x2 - size * math.cos(ang + 0.42), y2 - size * math.sin(ang + 0.42))
    draw.polygon([(S(x2), S(y2)), (S(left[0]), S(left[1])), (S(right[0]), S(right[1]))], fill=color)


def dashed(draw, pts, color=INK, width=1.8, dash=8, gap=6):
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        dist = math.hypot(x2 - x1, y2 - y1)
        if dist == 0:
            continue
        ux, uy = (x2 - x1) / dist, (y2 - y1) / dist
        t = 0
        while t < dist:
            t2 = min(t + dash, dist)
            draw.line([(S(x1 + ux * t), S(y1 + uy * t)), (S(x1 + ux * t2), S(y1 + uy * t2))], fill=color, width=max(2, S(width)))
            t += dash + gap


def dashed_arrow(draw, pts, color=INK):
    dashed(draw, pts, color)
    x1, y1 = pts[-2]
    x2, y2 = pts[-1]
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 9
    left = (x2 - size * math.cos(ang - 0.42), y2 - size * math.sin(ang - 0.42))
    right = (x2 - size * math.cos(ang + 0.42), y2 - size * math.sin(ang + 0.42))
    draw.polygon([(S(x2), S(y2)), (S(left[0]), S(left[1])), (S(right[0]), S(right[1]))], fill=color)


def label(draw, s, x, y, fill=INK):
    f = font(42, True)
    tw = draw.textbbox((0, 0), s, font=f)[2]
    th = draw.textbbox((0, 0), s, font=f)[3]
    pad_x, pad_y = S(6), S(3)
    box = [S(x) - tw // 2 - pad_x, S(y) - th // 2 - pad_y, S(x) + tw // 2 + pad_x, S(y) + th // 2 + pad_y]
    draw.rounded_rectangle(box, radius=S(6), fill=WHITE, outline=LINE, width=S(1))
    draw.text((S(x), S(y)), s, font=f, fill=fill, anchor="mm")


def artifact(draw, box, title, body, accent):
    rrect(draw, box, 10, WHITE, accent, 1.8)
    text(draw, title, (box[0] + 22, box[1] + 20), 48, accent, True)
    text(draw, body, (box[0] + 22, box[1] + 84), 39, MUTED)


def main() -> None:
    img = Image.new("RGB", (S(W), S(H)), WHITE)
    draw = ImageDraw.Draw(img)

    center(draw, ["Deployment Diagram"], W / 2, 16, 90, bold=True, gap=0)
    center(draw, ["Nawad Inventory Management System"], W / 2, 118, 51, MUTED)

    # Environment boundaries
    rrect(draw, (16, 190, 1324, 1540), 18, (244, 248, 252), (21, 112, 239), 2.2)
    text(draw, "OFFICE LOCAL AREA NETWORK", (44, 210), 42, (21, 112, 239), True)

    rrect(draw, (1376, 190, 2684, 1540), 18, (243, 250, 249), (15, 118, 110), 2.2)
    text(draw, "MICROSOFT AZURE", (1404, 210), 42, (15, 118, 110), True)

    # Clients
    rrect(draw, (44, 270, 700, 500), 16, (232, 245, 233), (46, 125, 50), 2.2)
    text(draw, "«device»", (72, 292), 39, (46, 125, 50), True)
    text(draw, "Staff / Admin PC", (72, 346), 54, bold=True)
    text(draw, "Web browser", (72, 416), 42, MUTED)

    rrect(draw, (1404, 270, 2060, 500), 16, (232, 245, 233), (46, 125, 50), 2.2)
    text(draw, "«device»", (1432, 292), 39, (46, 125, 50), True)
    text(draw, "Internet client", (1432, 346), 54, bold=True)
    text(draw, "Web browser", (1432, 416), 42, MUTED)

    arrow(draw, [(372, 500), (372, 590)], (46, 125, 50))
    label(draw, "HTTP :8000", 530, 544, (46, 125, 50))

    arrow(draw, [(1732, 500), (1732, 590)], (46, 125, 50))
    label(draw, "HTTPS :443", 1900, 544, (46, 125, 50))

    # Office server node
    rrect(draw, (44, 590, 1296, 1500), 16, WHITE, (21, 112, 239), 2.2)
    text(draw, "«executionEnvironment»", (72, 612), 39, (21, 112, 239), True)
    text(draw, "Windows Server 2012 R2", (72, 662), 60, bold=True)
    text(draw, "Virtual machine  ·  192.168.1.50", (72, 740), 42, MUTED)

    artifact(draw, (72, 810, 660, 990), "PHP 8.2 built-in server", "Listens on 0.0.0.0:8000", (21, 112, 239))
    artifact(draw, (680, 810, 1268, 990), "Laravel application", "C:\\nawad", (21, 112, 239))
    artifact(draw, (72, 1010, 660, 1190), "MariaDB 10.4", "Database inventory_db", (180, 83, 9))
    artifact(draw, (680, 1010, 1268, 1190), "XAMPP", "MySQL service and PHP", (21, 112, 239))
    artifact(draw, (72, 1210, 1268, 1390), "Task Scheduler  ·  Nawad Inventory", "Starts the site at boot after MySQL is up", (71, 84, 103))
    text(draw, "Office PCs on the same Wi-Fi open http://192.168.1.50:8000", (72, 1420), 36, MUTED)

    # Azure node
    rrect(draw, (1404, 590, 2656, 1500), 16, WHITE, (15, 118, 110), 2.2)
    text(draw, "«executionEnvironment»", (1432, 612), 39, (15, 118, 110), True)
    text(draw, "Ubuntu virtual machine", (1432, 662), 60, bold=True)
    text(draw, "nabuawaterinv.me  ·  20.89.65.31", (1432, 740), 42, MUTED)

    artifact(draw, (1432, 810, 2020, 990), "Nginx", "HTTPS on port 443", (15, 118, 110))
    artifact(draw, (2040, 810, 2628, 990), "PHP 8.3-FPM", "Runs Laravel for Nginx", (15, 118, 110))
    artifact(draw, (1432, 1010, 2020, 1190), "Laravel application", "/var/www/nawad", (15, 118, 110))
    artifact(draw, (2040, 1010, 2628, 1190), "MySQL", "Database inventory_db", (180, 83, 9))
    artifact(draw, (1432, 1210, 2628, 1390), "Deploy", "git pull, then config, route, and view cache", (71, 84, 103))
    text(draw, "Live site is served over HTTPS. The server .env stays on the machine.", (1432, 1420), 36, MUTED)

    # Developer and GitHub
    rrect(draw, (16, 1640, 820, 2220), 16, (248, 250, 252), (71, 84, 103), 2)
    text(draw, "«device»", (44, 1664), 39, MUTED, True)
    text(draw, "Developer PC", (44, 1716), 60, bold=True)
    text(draw, "Windows workstation", (44, 1792), 42, MUTED)
    artifact(draw, (40, 1860, 410, 2040), "Local site", "127.0.0.1:8000", (71, 84, 103))
    artifact(draw, (426, 1860, 796, 2040), "Local MySQL", "inventory_db", (180, 83, 9))
    text(draw, "Git working copy of the application", (44, 2070), 36, MUTED)

    rrect(draw, (1060, 1640, 1800, 2220), 16, (246, 248, 250), (36, 41, 47), 2)
    text(draw, "«node»", (1084, 1664), 39, (36, 41, 47), True)
    text(draw, "GitHub", (1084, 1716), 60, bold=True)
    text(draw, "github.com/avilo0720/capstone", (1084, 1792), 36, MUTED)
    artifact(draw, (1084, 1860, 1776, 2040), "main branch", "Pushed from the developer PC", (36, 41, 47))

    rrect(draw, (1820, 1680, 2684, 2180), 16, WHITE, LINE, 1.8)
    text(draw, "Communication", (1852, 1712), 51, bold=True)
    text(draw, "Solid arrow    user access", (1852, 1800), 42, MUTED)
    text(draw, "Dashed arrow   git push or pull", (1852, 1876), 42, MUTED)
    text(draw, "Each server keeps its own", (1852, 1952), 42, MUTED)
    text(draw, ".env and database.", (1852, 2012), 42, MUTED)

    # git push
    arrow(draw, [(820, 1950), (1060, 1950)], (36, 41, 47))
    label(draw, "git push", 940, 1896)

    # git pull into each server, arrowhead pointing up into the node
    dashed_arrow(draw, [(1180, 1640), (1180, 1590), (670, 1590), (670, 1488)], (36, 41, 47))
    label(draw, "git pull", 900, 1590)
    dashed_arrow(draw, [(1560, 1640), (1560, 1590), (2030, 1590), (2030, 1488)], (36, 41, 47))
    label(draw, "git pull", 1800, 1590)

    rrect(draw, (16, 2260, 2684, 2348), 8, (248, 250, 252), (208, 213, 221), 1.4)
    text(draw, "Figure. Deployment diagram of the Nawad Inventory Management System", (44, 2284), 42, bold=True)

    img.save(OUT, "PNG", dpi=(200, 200))
    print(f"Wrote {OUT} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
