import os
from datetime import datetime
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch


def generate_project_pdf(project_name: str, output_folder: str = "output") -> str:

    os.makedirs(output_folder, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{project_name}_{timestamp}.pdf"
    filepath = os.path.join(output_folder, filename)

    doc = SimpleDocTemplate(filepath)
    elements = []
    styles = getSampleStyleSheet()

    # --- Title --- #
    elements.append(Paragraph(f"Overvannsrapport - {project_name}", styles["Heading1"]))
    elements.append(Spacer(1, 0.5 * inch))

    # --- Hardcoded test values --- #
    elements.append(Paragraph("Eiendom: 123/45", styles["Normal"]))
    elements.append(Paragraph("Areal: 1.2 ha", styles["Normal"]))
    elements.append(Paragraph("Dimensjonerende volum: 45.6 m3", styles["Normal"]))
    elements.append(Spacer(1, 0.5 * inch))

    data = [
        ["Varighet (min)", "Intensitet (l/s/ha)"],
        ["10", "215.5"],
        ["15", "175.3"],
    ]

    table = Table(data)
    elements.append(table)

    doc.build(elements)

    return filepath