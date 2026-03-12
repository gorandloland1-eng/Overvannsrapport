from fastapi import APIRouter
from fastapi.responses import FileResponse
from app.schemas.schemas import PDFRequest
from app.pdf_generator import generate_project_pdf
from app.services.firebase import upload_pdf_to_firebase
import os

router = APIRouter()

@router.post("/generate-pdf")
def generate_pdf(data: PDFRequest):
    filepath = generate_project_pdf(data)
    print(f"{'='*30}")
    print(f"  PDF generert: {filepath}")
    
    try:
        url = upload_pdf_to_firebase(filepath, data.project_name)
        print(f"  Firebase URL: {url}")
        print(f"{'='*30}")
        return {"filepath": filepath, "firebase_url": url}
    except Exception as e:
        print(f"  Firebase feil: {e}")
        print(f"{'='*30}")
        # Fallback til lokal fil hvis Firebase feiler
        return FileResponse(
            filepath,
            media_type="application/pdf",
            filename=os.path.basename(filepath)
        )