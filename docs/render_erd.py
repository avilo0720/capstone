"""Render docs/schema.dbml as a dbdiagram-style ERD image."""

from PIL import Image, ImageDraw, ImageFont

OUT = r"c:\Users\jewar\OneDrive\Documents\scool\github\capstone\docs\figure-9-erd.png"

S = 2  # render scale
FONT = r"C:\Windows\Fonts\segoeui.ttf"
FONT_B = r"C:\Windows\Fonts\segoeuib.ttf"

GROUPS = {
    "auth": ("#166534", "#f0fdf4"),
    "inventory": ("#1d4ed8", "#eff6ff"),
    "procurement": ("#c2410c", "#fff7ed"),
    "issuance": ("#0f766e", "#f0fdfa"),
    "calendar": ("#0e7490", "#ecfeff"),
    "alert": ("#be185d", "#fdf2f8"),
    "audit": ("#6d28d9", "#f5f3ff"),
}

TABLES = {
    "departments": ("auth", [
        ("id", "bigint", "pk"),
        ("name", "varchar(100)", ""),
        ("description", "text", ""),
        ("created", "datetime", ""),
        ("updated", "datetime", ""),
    ]),
    "users": ("auth", [
        ("id", "bigint", "pk"),
        ("first_name", "varchar(100)", ""),
        ("last_name", "varchar(100)", ""),
        ("username", "varchar(100)", ""),
        ("birthday", "date", ""),
        ("profile_picture", "varchar(255)", ""),
        ("password", "varchar(255)", ""),
        ("role", "varchar(100)", ""),
        ("department_id", "bigint", "fk"),
        ("use_custom_permissions", "boolean", ""),
        ("created", "datetime", ""),
        ("updated", "datetime", ""),
    ]),
    "department_permissions": ("auth", [
        ("id", "bigint", "pk"),
        ("department_id", "bigint", "fk"),
        ("page", "varchar(50)", ""),
        ("ability", "varchar(50)", ""),
    ]),
    "user_permissions": ("auth", [
        ("id", "bigint", "pk"),
        ("user_id", "bigint", "fk"),
        ("page", "varchar(50)", ""),
        ("ability", "varchar(50)", ""),
    ]),
    "inventories": ("inventory", [
        ("id", "bigint", "pk"),
        ("slug", "varchar(255)", ""),
        ("name", "varchar(255)", ""),
    ]),
    "categories": ("inventory", [
        ("id", "bigint", "pk"),
        ("title", "varchar(255)", ""),
        ("description", "text", ""),
        ("updated", "datetime", ""),
    ]),
    "items": ("inventory", [
        ("id", "bigint", "pk"),
        ("inventory_id", "bigint", "fk"),
        ("itemCode", "varchar(255)", ""),
        ("title", "varchar(255)", ""),
        ("size", "varchar(255)", ""),
        ("category", "varchar(255)", ""),
        ("quantity", "int", ""),
        ("price", "decimal(10,2)", ""),
        ("monthlyDemand", "int", ""),
        ("updated", "datetime", ""),
    ]),
    "transactions": ("inventory", [
        ("id", "bigint", "pk"),
        ("itemId", "bigint", "fk"),
        ("action", "varchar(10)", ""),
        ("quantity", "int", ""),
        ("transactionDate", "datetime", ""),
        ("created_at", "datetime", ""),
    ]),
    "procurement_requests": ("procurement", [
        ("id", "bigint", "pk"),
        ("rs_number", "varchar(40)", ""),
        ("inventory_id", "bigint", "fk"),
        ("department_id", "bigint", "fk"),
        ("status", "varchar(32)", ""),
        ("source", "varchar(32)", ""),
        ("original_filename", "varchar(255)", ""),
        ("amc_mode", "varchar(255)", ""),
        ("destination", "varchar(255)", ""),
        ("purpose", "text", ""),
        ("date_needed", "date", ""),
        ("uploaded_by", "bigint", "fk"),
        ("requested_signature", "varchar(255)", ""),
        ("attachment_image", "varchar(255)", ""),
        ("assigned_to", "bigint", "fk"),
        ("reviewed_by", "bigint", "fk"),
        ("reviewed_at", "datetime", ""),
        ("noted_by", "bigint", "fk"),
        ("noted_at", "datetime", ""),
        ("noted_signature", "varchar(255)", ""),
        ("checked_by", "bigint", "fk"),
        ("checked_at", "datetime", ""),
        ("checked_signature", "varchar(255)", ""),
        ("approved_by", "bigint", "fk"),
        ("approved_at", "datetime", ""),
        ("approved_signature", "varchar(255)", ""),
        ("printed_at", "datetime", ""),
        ("rejection_reason", "text", ""),
        ("previous_rejection_reason", "text", ""),
        ("stock_applied_at", "datetime", ""),
        ("created_at", "timestamp", ""),
        ("updated_at", "timestamp", ""),
    ]),
    "procurement_request_items": ("procurement", [
        ("id", "bigint", "pk"),
        ("procurement_request_id", "bigint", "fk"),
        ("item_id", "bigint", "fk"),
        ("item_code", "varchar(255)", ""),
        ("title", "varchar(255)", ""),
        ("size", "varchar(255)", ""),
        ("current_qty", "int", ""),
        ("amc", "decimal(12,2)", ""),
        ("need_3m", "int", ""),
        ("need_6m", "int", ""),
        ("need_1y", "int", ""),
        ("method", "varchar(255)", ""),
        ("requested_qty", "int", ""),
        ("applied_qty", "int", ""),
        ("created_at", "timestamp", ""),
        ("updated_at", "timestamp", ""),
    ]),
    "issuance_requests": ("issuance", [
        ("id", "bigint", "pk"),
        ("inventory_id", "bigint", "fk"),
        ("status", "varchar(32)", ""),
        ("source", "varchar(32)", ""),
        ("original_filename", "varchar(255)", ""),
        ("amc_mode", "varchar(255)", ""),
        ("uploaded_by", "bigint", "fk"),
        ("reviewed_by", "bigint", "fk"),
        ("reviewed_at", "datetime", ""),
        ("rejection_reason", "text", ""),
        ("previous_rejection_reason", "text", ""),
        ("stock_applied_at", "datetime", ""),
        ("created_at", "timestamp", ""),
        ("updated_at", "timestamp", ""),
    ]),
    "issuance_request_items": ("issuance", [
        ("id", "bigint", "pk"),
        ("issuance_request_id", "bigint", "fk"),
        ("item_id", "bigint", "fk"),
        ("item_code", "varchar(255)", ""),
        ("title", "varchar(255)", ""),
        ("size", "varchar(255)", ""),
        ("current_qty", "int", ""),
        ("amc", "decimal(12,2)", ""),
        ("need_3m", "int", ""),
        ("need_6m", "int", ""),
        ("need_1y", "int", ""),
        ("method", "varchar(255)", ""),
        ("requested_qty", "int", ""),
        ("applied_qty", "int", ""),
        ("created_at", "timestamp", ""),
        ("updated_at", "timestamp", ""),
    ]),
    "calendar_notes": ("calendar", [
        ("id", "bigint", "pk"),
        ("created_by", "bigint", "fk"),
        ("title", "varchar(150)", ""),
        ("body", "text", ""),
        ("color", "varchar(20)", ""),
        ("note_date", "date", ""),
        ("end_date", "date", ""),
        ("created_at", "timestamp", ""),
        ("updated_at", "timestamp", ""),
    ]),
    "calendar_note_departments": ("calendar", [
        ("id", "bigint", "pk"),
        ("calendar_note_id", "bigint", "fk"),
        ("department_id", "bigint", "fk"),
    ]),
    "calendar_note_users": ("calendar", [
        ("id", "bigint", "pk"),
        ("calendar_note_id", "bigint", "fk"),
        ("user_id", "bigint", "fk"),
    ]),
    "notification_reads": ("alert", [
        ("id", "bigint", "pk"),
        ("user_id", "bigint", "fk"),
        ("notification_key", "varchar(100)", ""),
        ("read_at", "timestamp", ""),
    ]),
    "activity_logs": ("audit", [
        ("id", "bigint", "pk"),
        ("user_id", "bigint", "fk"),
        ("action", "varchar(50)", ""),
        ("entity_type", "varchar(50)", ""),
        ("entity_id", "bigint", ""),
        ("description", "varchar(255)", ""),
        ("meta", "json", ""),
        ("created_at", "timestamp", ""),
    ]),
}

ROWS = [
    ("1  ·  Auth / Access Control", ["department_permissions", "departments", "users", "user_permissions"]),
    ("2  ·  Inventory", ["categories", "inventories", "items", "transactions"]),
    ("3  ·  Procurement", ["procurement_requests", "procurement_request_items"]),
    ("4  ·  Issuance", ["issuance_requests", "issuance_request_items"]),
    ("5  ·  Calendar, alerts, and audit", ["calendar_note_departments", "calendar_notes", "calendar_note_users", "notification_reads", "activity_logs"]),
]

# (from_table, to_table) drawn as 1 — N after layout
LINKS = [
    ("departments", "users"),
    ("departments", "department_permissions"),
    ("users", "user_permissions"),
    ("inventories", "items"),
    ("items", "transactions"),
    ("procurement_requests", "procurement_request_items"),
    ("issuance_requests", "issuance_request_items"),
    ("calendar_notes", "calendar_note_departments"),
    ("calendar_notes", "calendar_note_users"),
]


def font(path, size):
    return ImageFont.truetype(path, size * S)


def text_width(draw, value, fnt):
    return draw.textlength(value, font=fnt)


def card_size(draw, name, fields, name_f, field_f, type_f):
    header_h = 30 * S
    row_h = 18 * S
    pad = 12 * S
    name_w = text_width(draw, name, name_f)
    longest = name_w
    for field, typ, _flag in fields:
        longest = max(longest, text_width(draw, field, field_f) + text_width(draw, typ, type_f) + 36 * S)
    width = int(max(250 * S, longest + pad * 2 + 28 * S))
    height = header_h + row_h * len(fields) + 8 * S
    return width, height


def main():
    probe = Image.new("RGB", (10, 10), "white")
    draw = ImageDraw.Draw(probe)
    name_f = font(FONT_B, 15)
    field_f = font(FONT, 12)
    type_f = font(FONT, 11)
    title_f = font(FONT_B, 26)
    sub_f = font(FONT, 14)
    label_f = font(FONT_B, 13)
    badge_f = font(FONT_B, 9)
    legend_f = font(FONT, 12)

    sizes = {name: card_size(draw, name, fields, name_f, field_f, type_f) for name, (_g, fields) in TABLES.items()}

    margin = 36 * S
    gap_x = 46 * S
    gap_y = 18 * S
    label_h = 28 * S
    title_block = 78 * S

    row_layouts = []
    content_w = 0
    y = title_block
    for label, names in ROWS:
        width = sum(sizes[n][0] for n in names) + gap_x * (len(names) - 1)
        height = max(sizes[n][1] for n in names)
        content_w = max(content_w, width)
        row_layouts.append((label, names, width, height, y))
        y += label_h + height + gap_y

    legend_h = 64 * S
    canvas_w = content_w + margin * 2
    canvas_h = y + legend_h + margin

    image = Image.new("RGB", (canvas_w, canvas_h), "#f8fafc")
    draw = ImageDraw.Draw(image)

    title = "Entity-Relationship Diagram (ERD)"
    subtitle = "Nabua Water Inventory"
    draw.text(((canvas_w - text_width(draw, title, title_f)) / 2, 18 * S), title, fill="#0f172a", font=title_f)
    draw.text(((canvas_w - text_width(draw, subtitle, sub_f)) / 2, 52 * S), subtitle, fill="#64748b", font=sub_f)

    boxes = {}
    for label, names, width, height, top in row_layouts:
        x0 = (canvas_w - width) / 2
        draw.text((margin, top), label, fill="#334155", font=label_f)
        band_top = top + label_h - 6 * S
        draw.rounded_rectangle(
            [margin / 2, band_top, canvas_w - margin / 2, band_top + height + 16 * S],
            radius=12 * S,
            fill="#ffffff",
            outline="#e2e8f0",
            width=S,
        )
        x = x0
        card_top = top + label_h
        for name in names:
            w, h = sizes[name]
            boxes[name] = (x, card_top, x + w, card_top + h)
            x += w + gap_x

    for name, (group, fields) in TABLES.items():
        x1, y1, x2, y2 = boxes[name]
        color, _tint = GROUPS[group]
        draw.rounded_rectangle([x1, y1, x2, y2], radius=8 * S, fill="#ffffff", outline="#cbd5e1", width=max(1, S))
        draw.rectangle([x1, y1, x2, y1 + 6 * S], fill=color)
        header_bottom = y1 + 30 * S
        draw.line([(x1, header_bottom), (x2, header_bottom)], fill="#e2e8f0", width=S)
        draw.text((x1 + 12 * S, y1 + 8 * S), name, fill="#0f172a", font=name_f)
        row_h = 18 * S
        for index, (field, typ, flag) in enumerate(fields):
            ry = header_bottom + index * row_h
            if flag == "pk":
                draw.rectangle([x1 + S, ry, x2 - S, ry + row_h], fill="#f8fafc")
            badge = "PK" if flag == "pk" else ("FK" if flag == "fk" else "")
            text_x = x1 + 12 * S
            if badge:
                bw = 22 * S
                bh = 14 * S
                by = ry + (row_h - bh) / 2
                draw.rounded_rectangle([text_x, by, text_x + bw, by + bh], radius=3 * S, fill=color if flag == "pk" else "#e2e8f0")
                bf = badge_f
                bw_text = text_width(draw, badge, bf)
                draw.text((text_x + (bw - bw_text) / 2, by + 1 * S), badge, fill="#ffffff" if flag == "pk" else "#334155", font=bf)
                text_x += bw + 6 * S
            draw.text((text_x, ry + 3 * S), field, fill="#0f172a", font=field_f)
            tw = text_width(draw, typ, type_f)
            draw.text((x2 - 12 * S - tw, ry + 4 * S), typ, fill="#94a3b8", font=type_f)

    for src, dst in LINKS:
        if abs(boxes[src][1] - boxes[dst][1]) > 4 * S:
            continue
        color = GROUPS[TABLES[src][0]][0]
        src_left = boxes[src][0] < boxes[dst][0]
        y_line = boxes[src][1] + 46 * S
        x1 = boxes[src][2] if src_left else boxes[src][0]
        x2 = boxes[dst][0] if src_left else boxes[dst][2]
        if abs(x1 - x2) < 8 * S:
            continue
        draw.line([(x1, y_line), (x2, y_line)], fill=color, width=2 * S)
        draw.ellipse([x1 - 3 * S, y_line - 3 * S, x1 + 3 * S, y_line + 3 * S], fill=color)
        tip = 8 * S
        if src_left:
            draw.polygon([(x2, y_line), (x2 - tip, y_line - tip / 2), (x2 - tip, y_line + tip / 2)], fill=color)
        else:
            draw.polygon([(x2, y_line), (x2 + tip, y_line - tip / 2), (x2 + tip, y_line + tip / 2)], fill=color)
        label = "1:N"
        lw = text_width(draw, label, badge_f)
        draw.text(((x1 + x2) / 2 - lw / 2, y_line - 16 * S), label, fill=color, font=badge_f)

    legend_y = canvas_h - legend_h - 8 * S
    draw.rounded_rectangle([margin, legend_y, canvas_w - margin, canvas_h - margin / 2], radius=8 * S, fill="#ffffff", outline="#e2e8f0", width=S)
    draw.text((margin + 14 * S, legend_y + 10 * S), "PK  primary key      FK  foreign key      1:N  one-to-many", fill="#334155", font=legend_f)
    note = "User links on requests: uploaded_by, assigned_to, reviewed_by, noted_by, checked_by, approved_by.  categories.title matches items.category with no foreign key."
    draw.text((margin + 14 * S, legend_y + 32 * S), note, fill="#64748b", font=legend_f)

    image.save(OUT, "PNG", dpi=(200, 200))
    print(OUT, image.size)


if __name__ == "__main__":
    main()
