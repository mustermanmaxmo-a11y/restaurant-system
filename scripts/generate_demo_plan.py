from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER

OUTPUT = "Restaurant_Demo_Ablaufplan.pdf"

# Colors
DARK = colors.HexColor("#0f0f0f")
ACCENT = colors.HexColor("#ff6b35")
SURFACE = colors.HexColor("#1a1a1a")
MUTED = colors.HexColor("#888888")
WHITE = colors.HexColor("#ffffff")
GREEN = colors.HexColor("#10b981")
YELLOW = colors.HexColor("#f59e0b")

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=20*mm,
    rightMargin=20*mm,
    topMargin=20*mm,
    bottomMargin=20*mm,
)

styles = getSampleStyleSheet()

def style(name, **kwargs):
    return ParagraphStyle(name, **kwargs)

H1 = style("H1", fontSize=22, textColor=DARK, fontName="Helvetica-Bold", spaceAfter=4)
H2 = style("H2", fontSize=14, textColor=ACCENT, fontName="Helvetica-Bold", spaceAfter=4, spaceBefore=10)
H3 = style("H3", fontSize=11, textColor=DARK, fontName="Helvetica-Bold", spaceAfter=3, spaceBefore=6)
BODY = style("BODY", fontSize=9.5, textColor=DARK, fontName="Helvetica", spaceAfter=3, leading=14)
MUTED_S = style("MUTED", fontSize=8.5, textColor=MUTED, fontName="Helvetica", spaceAfter=2)
QUOTE = style("QUOTE", fontSize=9.5, textColor=colors.HexColor("#444444"), fontName="Helvetica-Oblique",
              spaceAfter=4, leftIndent=12, borderPad=8,
              backColor=colors.HexColor("#fff7f3"), borderColor=ACCENT,
              borderWidth=0, leading=14)
BADGE = style("BADGE", fontSize=8, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_CENTER)
SUBTITLE = style("SUBTITLE", fontSize=11, textColor=MUTED, fontName="Helvetica", spaceAfter=12)

story = []

# ── HEADER ──────────────────────────────────────────────────────────────────
story.append(Spacer(1, 4*mm))
story.append(Paragraph("Restaurant Demo — Ablaufplan", H1))
story.append(Paragraph("Persönliche Vorstellung vor Ort · Ziel: Folgetermin sichern", SUBTITLE))
story.append(HRFlowable(width="100%", thickness=2, color=ACCENT, spaceAfter=10))

# ── SECTION 1 ────────────────────────────────────────────────────────────────
story.append(Paragraph("01 — Vorbereitung (zuhause, vor dem Termin)", H2))

story.append(Paragraph("<b>Links bereithalten</b>", H3))

link_data = [
    ["Was", "URL"],
    ["Gast-Bestellseite", "/bestellen/[demo-slug]"],
    ["QR-Code Tisch-Ansicht", "/order/[token]"],
    ["Personal Kanban", "/dashboard  →  slug + PIN"],
    ["Owner Dashboard", "/admin/orders"],
    ["Registrierung (Follow-up)", "/register"],
    ["Preisseite", "/pricing  oder  WordPress"],
]
link_table = Table(link_data, colWidths=[55*mm, 110*mm])
link_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), DARK),
    ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#fafafa"), WHITE]),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e5e5")),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
]))
story.append(link_table)
story.append(Spacer(1, 4*mm))

story.append(Paragraph("<b>Demo-Restaurant checken</b>", H3))
checks = [
    "Speisekarte: mind. 8–10 Gerichte mit Preisen und Fotos",
    "Mind. 3 Tische angelegt, QR-Tokens vorhanden",
    "Admin-Dashboard leer (keine alten Test-Bestellungen)",
    "Realtime testen: Bestellung aufgeben → erscheint sofort in /admin/orders?",
    "Handy: Chrome offen, QR-Scanner bereit (Kamera-App)",
    "Laptop + Handy im selben WLAN — oder Hotspot vom Handy",
    "Optional: QR-Code PDF ausdrucken (Tisch 1) — zeigt Profi-Eindruck",
]
for c in checks:
    story.append(Paragraph(f"&#9744;  {c}", BODY))

story.append(Spacer(1, 4*mm))
story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e5e5"), spaceAfter=6))

# ── SECTION 2 ────────────────────────────────────────────────────────────────
story.append(Paragraph("02 — Das Gespräch (~20–30 Min)", H2))

phases = [
    {
        "num": "Phase 1", "title": "Ankommen & Rapport", "time": "2–3 Min",
        "color": YELLOW,
        "body": "Kein Laptop, kein Handy. Erst Smalltalk. Lass den Inhaber reden — merke dir was er sagt.",
        "quote": '"Wie läuft\'s aktuell? Haben Sie viel Service-Personal oder eher klein?"',
    },
    {
        "num": "Phase 2", "title": "Zwei Problem-Fragen", "time": "3–5 Min",
        "color": ACCENT,
        "body": "Immer noch kein Laptop. Wenn sie ein Problem nennen — merken, nicht sofort pitchen. Nur nicken.",
        "quote": '"Passiert es, dass Bestellungen durcheinandergeraten oder zu spät in der Küche ankommen?"\n\nDann: "Wie machen das Ihre Gäste gerade — rufen sie den Kellner, oder haben Sie schon etwas Digitales?"',
    },
    {
        "num": "Phase 3", "title": "Übergang", "time": "10 Sek",
        "color": colors.HexColor("#6c63ff"),
        "body": "Laptop aufklappen, /admin/orders geöffnet (leer, bereit).",
        "quote": '"Ich zeige Ihnen mal kurz wie wir das gelöst haben — darf ich?"',
    },
    {
        "num": "Phase 4", "title": "Hands-on Demo", "time": "8–10 Min",
        "color": GREEN,
        "body": None,
        "steps": [
            ("Handy in die Hand geben", '"Scannen Sie mal kurz diesen Code — als wären Sie Ihr Gast."'),
            ("Sie bestellen selbst", "Lass sie 1–2 Gerichte wählen und auf Bestellen tippen. Sag nichts."),
            ("Laptop zeigen", '"Das ist gerade in Echtzeit reingekommen — keine App, kein Reload."'),
            ("Status ändern", 'Auf "In Zubereitung" klicken → ihr Handy zeigt Statusänderung. "Der Gast sieht das sofort."'),
            ("Personal-Ansicht zeigen", '/dashboard auf Laptop öffnen. "Das ist was Ihre Küche sieht — Tablet an der Wand, fertig."'),
        ],
    },
    {
        "num": "Phase 5", "title": "Preise nennen", "time": "2 Min",
        "color": YELLOW,
        "body": "Direkt nach dem Aha-Moment. Danach: Stille. Nicht weiterpitchen.",
        "quote": '"29€ im Monat für bis zu 15 Tische. Kein Einrichten durch uns — Sie machen das in 20 Minuten. Erste 14 Tage kostenlos."',
    },
    {
        "num": "Phase 6", "title": "Folgetermin sichern", "time": "2 Min",
        "color": GREEN,
        "body": "Wenn Ja: Handynummer tauschen oder Termin direkt im Kalender.",
        "quote": '"Ich richte Ihnen eine Demo mit Ihrem Menü und Ihren Tischen ein. Darf ich mich in zwei Tagen melden?"',
    },
]

for phase in phases:
    header_data = [[
        Paragraph(f"<b>{phase['num']}</b>", ParagraphStyle("ph", fontSize=8, textColor=WHITE, fontName="Helvetica-Bold")),
        Paragraph(f"<b>{phase['title']}</b>", ParagraphStyle("pt", fontSize=9, textColor=WHITE, fontName="Helvetica-Bold")),
        Paragraph(phase['time'], ParagraphStyle("pm", fontSize=8, textColor=WHITE, fontName="Helvetica", alignment=2)),
    ]]
    header_table = Table(header_data, colWidths=[20*mm, 120*mm, 25*mm])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), phase['color']),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROUNDEDCORNERS", [4, 4, 0, 0]),
    ]))
    story.append(header_table)

    content = []
    if phase.get("body"):
        content.append(Paragraph(phase["body"], BODY))
    if phase.get("quote"):
        for line in phase["quote"].split("\n\n"):
            content.append(Paragraph(f'<i>"{line.strip(chr(34))}"</i>', QUOTE))
    if phase.get("steps"):
        for i, (step_title, step_body) in enumerate(phase["steps"], 1):
            content.append(Paragraph(f"<b>{i}. {step_title}</b>", H3))
            content.append(Paragraph(step_body, BODY))

    content_table = Table([[content]], colWidths=[165*mm])
    content_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafafa")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e5e5")),
    ]))
    story.append(content_table)
    story.append(Spacer(1, 4*mm))

story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e5e5"), spaceAfter=6))

# ── SECTION 3 ────────────────────────────────────────────────────────────────
story.append(Paragraph("03 — Follow-up (nach dem Gespräch)", H2))

story.append(Paragraph("<b>Gleicher Tag — kurze Nachricht</b>", H3))
story.append(Paragraph('WhatsApp oder SMS:', BODY))
story.append(Paragraph('"Schön, dass wir uns kurz austauschen konnten. Ich melde mich übermorgen wie besprochen. Bei Fragen einfach schreiben."', QUOTE))
story.append(Spacer(1, 3*mm))

story.append(Paragraph("<b>2 Tage später — Demo einrichten, dann anrufen</b>", H3))
steps2 = [
    "Neuen Account unter ihrer E-Mail anlegen: /register",
    "Slug mit ihrem Restaurantnamen anlegen",
    "5–8 echte Gerichte aus ihrer Karte eintragen (von ihrer Website)",
    "3–4 Tische anlegen, QR-Codes generieren",
    "1 Mitarbeiter-PIN anlegen (z.B. 'Chef' / PIN 1234)",
]
for s in steps2:
    story.append(Paragraph(f"&#9744;  {s}", BODY))
story.append(Spacer(1, 3*mm))
story.append(Paragraph("Dann anrufen und sagen:", BODY))
story.append(Paragraph('"Ich habe Ihnen eine Demo fertig gemacht — mit Ihrem Menü. Ich schicke Ihnen den Link, Sie können das direkt auf Ihrem Handy ausprobieren."', QUOTE))
story.append(Spacer(1, 3*mm))

story.append(Paragraph("Links die du sendest:", BODY))
send_data = [
    ["Gast-Ansicht", "/bestellen/[ihr-slug]"],
    ["Personal-Kanban", "/dashboard  →  slug + PIN"],
]
send_table = Table(send_data, colWidths=[55*mm, 110*mm])
send_table.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
    ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#fff7f3"), WHITE]),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e5e5")),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("TEXTCOLOR", (0, 0), (-1, -1), DARK),
]))
story.append(send_table)
story.append(Spacer(1, 4*mm))

story.append(Paragraph("<b>Wenn kein Interesse</b>", H3))
story.append(Paragraph('"Kein Problem. Darf ich fragen, was der Hauptgrund ist? Zu teuer, falscher Zeitpunkt, oder passt das Konzept nicht?"', QUOTE))
story.append(Paragraph("Eine Frage reicht. Nicht drängen.", MUTED_S))

story.append(Spacer(1, 6*mm))
story.append(HRFlowable(width="100%", thickness=2, color=ACCENT, spaceAfter=6))
story.append(Paragraph("Viel Erfolg beim Gespräch.", ParagraphStyle("footer", fontSize=10, textColor=MUTED, fontName="Helvetica-Oblique", alignment=TA_CENTER)))

doc.build(story)
print(f"PDF erstellt: {OUTPUT}")
