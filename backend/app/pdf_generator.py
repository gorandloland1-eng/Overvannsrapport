import os
from datetime import datetime
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from app.utils.safe_paths import safe_folder_name


def _txt(value) -> str:
    return escape(str(value or ""))

def generate_project_pdf(data, kibler_resultat=None) -> str:
    safe_name = safe_folder_name(data.project_name)
    output_path = os.path.join("output", safe_name)
    os.makedirs(output_path, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(output_path, f"rapport_{timestamp}.pdf")

    doc = SimpleDocTemplate(filepath)
    styles = getSampleStyleSheet()
    elements = []

    # --- Tittel --- #
    elements.append(Paragraph(f"Overvannsrapport – {_txt(data.project_name)}", styles["Heading1"]))
    elements.append(Paragraph(f"Dato: {datetime.now().strftime('%d.%m.%Y')}", styles["Normal"]))
    elements.append(Spacer(1, 0.3 * inch))

    # --- Eiendomsdata --- #
    elements.append(Paragraph("Eiendomsdata", styles["Heading2"]))
    elements.append(Paragraph(f"Adresse: {_txt(data.eiendom_adresse or 'Ikke angitt')}", styles["Normal"]))
    if data.eiendom_gnr and data.eiendom_bnr:
        elements.append(Paragraph(f"Gårdsnummer / Bruksnummer: {data.eiendom_gnr} / {data.eiendom_bnr}", styles["Normal"]))
    elements.append(Spacer(1, 0.3 * inch))

    # --- Værstasjon --- #
    elements.append(Paragraph("Værstasjon", styles["Heading2"]))
    elements.append(Paragraph(f"Valgt værstasjon: {_txt(data.selected_weather_station_name or data.selected_weather_station)}", styles["Normal"]))
    elements.append(Spacer(1, 0.3 * inch))

    # --- Inndata / Parametere --- #
    elements.append(Paragraph("Inndata og parametere", styles["Heading2"]))
    elements.append(Paragraph(f"Areal: {data.areal} m²", styles["Normal"]))
    elements.append(Paragraph(f"Returperiode: {data.returperiode} år", styles["Normal"]))
    elements.append(Paragraph(f"Klimafaktor: {data.klimafaktor}", styles["Normal"]))
    elements.append(Paragraph(f"Maks påslipp: {data.maks_paslipp} l/s", styles["Normal"]))
    elements.append(Paragraph(f"Infiltrasjonskapasitet (Q_inf): {data.infiltrasjonskapasitet} l/s", styles["Normal"]))
    elements.append(Spacer(1, 0.3 * inch))

    # --- Terrengdata --- #
    elements.append(Paragraph("Terrengdata", styles["Heading2"]))
    elements.append(Paragraph(f"Høydeforskjell: {data.height} m", styles["Normal"]))
    elements.append(Paragraph(f"Lengde: {round(data.length, 1)} m", styles["Normal"]))
    elements.append(Paragraph(f"Konsentrasjonstid: {data.time_of_concentration} min", styles["Normal"]))
    elements.append(Spacer(1, 0.3 * inch))

    # --- Aron Kibler --- #
    if kibler_resultat:
        elements.append(Paragraph("Aron Kibler-beregning", styles["Heading2"]))
        elements.append(Paragraph(f"Dimensjonerende varighet: {kibler_resultat['dim_varighet_min']} min", styles["Normal"]))
        elements.append(Paragraph(f"Dimensjonerende intensitet: {kibler_resultat['dim_intensitet_l_s_ha']} l/s/ha", styles["Normal"]))
        elements.append(Paragraph(f"Innløpsflow (Q_inn): {kibler_resultat['dim_Q_inn_l_s']:.2f} l/s", styles["Normal"]))
        elements.append(Paragraph(f"Nødvendig utjevningsvolum: {kibler_resultat['dim_utjevningsvolum_m3']:.2f} m³", styles["Normal"]))
        elements.append(Paragraph(f"Fordrøyningsprosent: {kibler_resultat['fordroeyningsprosent']*100:.1f} %", styles["Normal"]))

    doc.build(elements)
    return filepath
