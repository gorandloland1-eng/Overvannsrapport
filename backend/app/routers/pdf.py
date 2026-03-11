from fastapi import APIRouter
from fastapi.responses import FileResponse
from app.schemas.schemas import PDFRequest
from app.pdf_generator import generate_project_pdf
import os

router = APIRouter()

@router.post("/generate-pdf")
def generate_pdf(data: PDFRequest):
    filepath = generate_project_pdf(data)
    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=os.path.basename(filepath)
    )