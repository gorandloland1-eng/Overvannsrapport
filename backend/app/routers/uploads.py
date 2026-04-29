import os
import re
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _safe_folder_name(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return "Ukjent_prosjekt"

    value = re.sub(r'[<>:"/\\|?*]+', "_", value)
    value = re.sub(r"\s+", "_", value)
    return value[:100]


@router.post("/screenshot")
async def upload_screenshot(
    project_name: str = Form(...),
    image: UploadFile = File(...),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Filen må være et bilde")

    safe_name = _safe_folder_name(project_name)
    output_path = os.path.join("output", safe_name, "images")
    os.makedirs(output_path, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    extension = ".png"

    if image.filename and "." in image.filename:
        ext = os.path.splitext(image.filename)[1].lower()
        if ext in [".png", ".jpg", ".jpeg", ".webp"]:
            extension = ext

    filename = f"map_{timestamp}{extension}"
    filepath = os.path.join(output_path, filename)

    try:
        content = await image.read()
        with open(filepath, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kunne ikke lagre bilde: {str(e)}")

    return {
        "message": "Skjermbilde lagret",
        "filepath": filepath,
        "filename": filename,
    }
