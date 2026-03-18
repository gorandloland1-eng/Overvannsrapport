import os
from datetime import datetime
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib import colors

def generate_calc_pdf(data, kibler_resultat=None) -> str:
    safe_name = data.project_name.strip() or "Ukjent_prosjekt"
    output_path = os.path.join("output", safe_name)
    os.makedirs(output_path, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(output_path, f"utregninger_{timestamp}.pdf")

    doc = SimpleDocTemplate(filepath)
    styles = getSampleStyleSheet()
    elements = []

    # --- Tittel --- #
    elements.append(Paragraph(f"Utregninger – {data.project_name}", styles["Heading1"]))
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

        dim_varighet = kibler_resultat["dim_varighet_min"]

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