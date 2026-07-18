import os
from datetime import datetime
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib import colors
from app.utils.safe_paths import safe_folder_name


def _txt(value) -> str:
    return escape(str(value or ""))

def _fmt(value, decimals=2):
    if value is None:
        return "-"
    try:
        return f"{float(value):.{decimals}f}".rstrip("0").rstrip(".")
    except (TypeError, ValueError):
        return str(value)

def _paragraph_table(rows, styles, col_widths=None):
    return Table(
        [[Paragraph(str(left), styles["Normal"]), Paragraph(str(right), styles["Normal"])] for left, right in rows],
        colWidths=col_widths,
        hAlign="LEFT",
    )

def generate_calc_pdf(data, kibler_resultat=None) -> str:
    safe_name = safe_folder_name(data.project_name)
    output_path = os.path.join("output", safe_name)
    os.makedirs(output_path, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(output_path, f"utregninger_{timestamp}.pdf")

    doc = SimpleDocTemplate(filepath)
    styles = getSampleStyleSheet()
    elements = []

    # --- Tittel --- #
    elements.append(Paragraph(f"Utregninger – {_txt(data.project_name)}", styles["Heading1"]))
    elements.append(Paragraph(f"Dato: {datetime.now().strftime('%d.%m.%Y')}", styles["Normal"]))
    elements.append(Spacer(1, 0.3 * inch))

    # --- Inndata --- #
    elements.append(Paragraph("Inndata", styles["Heading2"]))
    elements.append(Paragraph(f"Areal: {data.areal} m²", styles["Normal"]))
    elements.append(Paragraph(f"Avrenningsfaktor (φ): {data.phi}", styles["Normal"]))
    elements.append(Paragraph(f"Returperiode: {data.returperiode} år", styles["Normal"]))
    elements.append(Paragraph(f"Klimafaktor: {data.klimafaktor}", styles["Normal"]))
    elements.append(Paragraph(f"Maks påslipp: {data.maks_paslipp} l/s", styles["Normal"]))
    elements.append(Paragraph(f"Infiltrasjonskapasitet (Q_inf): {data.infiltrasjonskapasitet} l/s", styles["Normal"]))
    elements.append(Paragraph(f"Konsentrasjonstid: {data.time_of_concentration} min", styles["Normal"]))
    elements.append(Spacer(1, 0.3 * inch))

    # --- Aron Kibler tabell --- #
    if kibler_resultat:
        area_ha = kibler_resultat.get("areal_ha", data.areal / 10000)
        phi = kibler_resultat.get("phi", data.phi)
        klimafaktor = kibler_resultat.get("klimafaktor", data.klimafaktor)
        maks_paslipp = kibler_resultat.get("maks_paslipp_l_s", data.maks_paslipp)
        infiltrasjon = kibler_resultat.get("infiltrasjonskapasitet_l_s", data.infiltrasjonskapasitet)
        dim_varighet = kibler_resultat["dim_varighet_min"]
        dim_intensitet = kibler_resultat["dim_intensitet_l_s_ha"]
        dim_q_inn = kibler_resultat["dim_Q_inn_l_s"]
        dim_v_utj = kibler_resultat["dim_utjevningsvolum_m3"]
        dim_rad = next(
            (rad for rad in kibler_resultat["tabell"] if rad["varighet_min"] == dim_varighet),
            None,
        )
        dim_v_inn = dim_rad["V_inn_m3"] if dim_rad else None
        dim_v_ut = dim_rad["V_ut_m3"] if dim_rad else None

        elements.append(Paragraph("Formler brukt i beregningen", styles["Heading2"]))
        elements.append(Paragraph(
            "Formlene under er hentet ut fra beregningsoppsettet og speiler prinsippene i Excel-arket: "
            "overvannsmengde beregnes fra areal, avrenningsfaktor, IVF-intensitet og klimafaktor, "
            "mens nødvendig fordrøyning er differansen mellom innløps- og utløpsvolum.",
            styles["Normal"],
        ))
        elements.append(Spacer(1, 0.15 * inch))

        formula_rows = [
            ("Areal i hektar", "A_ha = A_m2 / 10 000"),
            ("Innløpsvannføring", "Q_inn = phi * i(t,T) * A_ha * Kf"),
            ("Innløpsvolum", "V_inn = Q_inn * t * 60 / 1000"),
            ("Utløpsvolum", "V_ut = (Q_ut + Q_inf) * t * 60 / 1000"),
            ("Nødvendig fordrøyningsvolum", "V_utj = max(0, V_inn - V_ut)"),
            ("Dimensjonerende varighet", "t_dim = varigheten som gir størst V_utj"),
            ("Fordrøyningsprosent", "Fordrøyning % = V_utj / V_inn * 100"),
            ("Påslippsintensitet", "q_ut = Q_ut / (phi * A_ha)"),
        ]
        formulas = _paragraph_table(formula_rows, styles, col_widths=[2.2 * inch, 4.3 * inch])
        formulas.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F6F8FF")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D8DEE9")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(formulas)
        elements.append(Spacer(1, 0.25 * inch))

        elements.append(Paragraph("Beregningseksempel for dimensjonerende rad", styles["Heading3"]))
        example_rows = [
            ("A_ha", f"{_fmt(data.areal, 0)} / 10 000 = {_fmt(area_ha, 4)} ha"),
            ("Q_inn", f"{_fmt(phi)} * {_fmt(dim_intensitet, 1)} * {_fmt(area_ha, 4)} * {_fmt(klimafaktor)} = {_fmt(dim_q_inn)} l/s"),
            ("V_inn", f"{_fmt(dim_q_inn)} * {_fmt(dim_varighet, 0)} * 60 / 1000 = {_fmt(dim_v_inn)} m³"),
            ("V_ut", f"({_fmt(maks_paslipp)} + {_fmt(infiltrasjon)}) * {_fmt(dim_varighet, 0)} * 60 / 1000 = {_fmt(dim_v_ut)} m³"),
            ("V_utj", f"max(0, {_fmt(dim_v_inn)} - {_fmt(dim_v_ut)}) = {_fmt(dim_v_utj)} m³"),
        ]
        examples = _paragraph_table(example_rows, styles, col_widths=[1.0 * inch, 5.5 * inch])
        examples.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D8DEE9")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EEF2F7")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(examples)
        elements.append(Spacer(1, 0.3 * inch))

        elements.append(Paragraph("Aron Kibler – detaljert beregningstabell", styles["Heading2"]))
        elements.append(Spacer(1, 0.15 * inch))

        # Tabelloverskrifter
        table_data = [[
            "Varighet (min)",
            "Intensitet (l/s/ha)",
            "Q_inn (l/s)",
            "V_inn (m³)",
            "V_ut (m³)",
            "Utjevning (m³)",
        ]]

        for rad in kibler_resultat["tabell"]:
            row = [
                str(rad["varighet_min"]),
                f"{rad['intensitet_l_s_ha']:.1f}",
                f"{rad['Q_inn_l_s']:.2f}",
                f"{rad['V_inn_m3']:.2f}",
                f"{rad['V_ut_m3']:.2f}",
                f"{rad['utjevningsvolum_m3']:.2f}",
            ]
            table_data.append(row)

        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#213F53")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F0F4F8")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))

        # Marker dimensjonerende rad
        for i, rad in enumerate(kibler_resultat["tabell"], start=1):
            if rad["varighet_min"] == dim_varighet:
                table.setStyle(TableStyle([
                    ("BACKGROUND", (0, i), (-1, i), colors.HexColor("#D4EDDA")),
                    ("FONTNAME", (0, i), (-1, i), "Helvetica-Bold"),
                ]))

        elements.append(table)
        elements.append(Spacer(1, 0.3 * inch))

        # --- Oppsummering --- #
        elements.append(Paragraph("Oppsummering", styles["Heading2"]))
        elements.append(Paragraph(f"Dimensjonerende varighet: {kibler_resultat['dim_varighet_min']} min", styles["Normal"]))
        elements.append(Paragraph(f"Dimensjonerende intensitet: {kibler_resultat['dim_intensitet_l_s_ha']} l/s/ha", styles["Normal"]))
        elements.append(Paragraph(f"Innløpsflow (Q_inn): {kibler_resultat['dim_Q_inn_l_s']:.2f} l/s", styles["Normal"]))
        elements.append(Paragraph(f"Nødvendig utjevningsvolum: {kibler_resultat['dim_utjevningsvolum_m3']:.2f} m³", styles["Normal"]))
        elements.append(Paragraph(f"Fordrøyningsprosent: {kibler_resultat['fordroeyningsprosent']*100:.1f} %", styles["Normal"]))

    doc.build(elements)
    return filepath
