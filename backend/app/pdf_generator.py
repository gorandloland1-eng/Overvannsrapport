import os
from datetime import datetime
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch

def generate_project_pdf(data) -> str:
    os.makedirs(data.project_name, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(data.project_name, f"terreng_{timestamp}.pdf")

    doc = SimpleDocTemplate(filepath)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph(f"Overvannsrapport - {data.project_name}", styles["Heading1"]))
    elements.append(Spacer(1, 0.3 * inch))
    elements.append(Paragraph("Terrengdata", styles["Heading2"]))
    elements.append(Paragraph(f"Høyde punkt A: {data.elev1} m", styles["Normal"]))
    elements.append(Paragraph(f"Høyde punkt B: {data.elev2} m", styles["Normal"]))
    elements.append(Paragraph(f"Høydeforskjell: {data.height} m", styles["Normal"]))
    elements.append(Paragraph(f"Lengde: {data.length} m", styles["Normal"]))
    elements.append(Paragraph(f"Konsentrasjonstid: {data.time_of_concentration} min", styles["Normal"]))

    elements.append(Spacer(1, 0.3 * inch))
    elements.append(Paragraph(f"Dato: {timestamp}", styles["Normal"]))

    doc.build(elements)
    return filepath