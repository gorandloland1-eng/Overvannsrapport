def generate_project_pdf(data) -> str:
    os.makedirs(data.project_name, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(data.project_name, f"terreng_{timestamp}.pdf")
    
    # bygg PDF
    elements.append(Paragraph(f"Høydeforskjell: {data.hoyde_m} m", styles["Normal"]))
    elements.append(Paragraph(f"Lengde: {data.lengde_m} m", styles["Normal"]))
    elements.append(Paragraph(f"Konsentrasjonstid: {data.konsentrasjonstid_min} min", styles["Normal"]))