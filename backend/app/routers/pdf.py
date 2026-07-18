from fastapi import APIRouter, HTTPException
from urllib.parse import urlparse
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from app.schemas.schemas import PDFRequest
from app.pdf_generator import generate_project_pdf
from app.pdf_calc_generator import generate_calc_pdf
from app.services.firebase import upload_pdf_to_firebase
from app.services.calculations.aron_kibler import aron_kibler_beregning
from app.routers.ivf import get_ivf
from app.services.calculations.models import IVFData
from app.services.calculations.ivf import lag_ivf_data
import os
import tempfile
import requests
from app.utils.safe_paths import safe_download_filename, safe_folder_name


ALLOWED_DOWNLOAD_HOSTS = {
    "firebasestorage.googleapis.com",
    "storage.googleapis.com",
}
MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024


def _is_allowed_download_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_DOWNLOAD_HOSTS:
        return False

    bucket = os.getenv("FIREBASE_STORAGE_BUCKET", "")
    if parsed.hostname == "firebasestorage.googleapis.com":
        return f"/b/{bucket}/" in parsed.path

    if parsed.hostname == "storage.googleapis.com":
        return parsed.path.startswith(f"/{bucket}/")

    return False


def build_ivf_data_from_response(ivf_response: dict, station_id: str) -> IVFData:
    ls_ha = ivf_response["ls_ha"]
    tabell = {}

    for dur_str, periods in ls_ha.items():
        dur = int(dur_str)
        for period_str, value in periods.items():
            period = int(period_str)
            if period not in tabell:
                tabell[period] = {}
            tabell[period][dur] = value

    return lag_ivf_data(
        stasjon=station_id,
        periode="Frost API",
        tabell=tabell
    )


router = APIRouter()


def calculate_kibler_if_possible(data: PDFRequest):
    kibler_resultat = None

    if data.selected_weather_station and data.time_of_concentration > 0:
        try:
            ivf_response = get_ivf(data.selected_weather_station)
            ivf_data = build_ivf_data_from_response(
                ivf_response,
                data.selected_weather_station
            )

            kibler_resultat = aron_kibler_beregning(
                areal_ha=data.areal / 10000,
                phi=data.phi,
                konsentrasjonstid_min=data.time_of_concentration,
                returperiode_ar=data.returperiode,
                klimafaktor=data.klimafaktor,
                ivf_data=ivf_data,
                maks_paslipp_l_s=data.maks_paslipp,
                infiltrasjonskapasitet_l_s=data.infiltrasjonskapasitet,
            )
        except Exception as e:
            print(f"Kibler-beregning feilet: {e}")

    return kibler_resultat


@router.post("/generate-pdf")
def generate_pdf(data: PDFRequest):
    kibler_resultat = calculate_kibler_if_possible(data)

    filepath = generate_project_pdf(data, kibler_resultat)
    filepath_calc = generate_calc_pdf(data, kibler_resultat)

    print(f"{'=' * 30}")
    print(f"  PDF generert: {filepath}")
    print(f"  Calc PDF generert: {filepath_calc}")

    try:
        safe_project_name = safe_folder_name(data.project_name)
        url = upload_pdf_to_firebase(filepath, safe_project_name)
        url_calc = upload_pdf_to_firebase(filepath_calc, safe_project_name)

        print(f"  Firebase URL: {url}")
        print(f"  Firebase Calc URL: {url_calc}")
        print(f"{'=' * 30}")

        return {
            "filepath": filepath,
            "filename": os.path.basename(filepath),
            "firebase_url": url,
            "calc_firebase_url": url_calc
        }

    except Exception as e:
        print(f"  Firebase feil: {e}")
        print(f"{'=' * 30}")
        raise HTTPException(
            status_code=500,
            detail=f"Firebase-opplasting feilet: {str(e)}"
        )


@router.post("/download-pdf")
def download_pdf(data: PDFRequest):
    kibler_resultat = calculate_kibler_if_possible(data)

    filepath = generate_project_pdf(data, kibler_resultat)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="PDF ble ikke funnet")

    filename = os.path.basename(filepath)

    return FileResponse(
        path=filepath,
        media_type="application/pdf",
        filename=filename,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/download-from-url")
def download_from_url(url: str, filename: str = "fil"):
    if not _is_allowed_download_url(url):
        raise HTTPException(status_code=400, detail="Ugyldig fil-URL")

    filename = safe_download_filename(filename)
    tmp_name = None

    try:
        response = requests.get(url, timeout=60, stream=True)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Kunne ikke hente filen")

        content_type = response.headers.get("Content-Type", "application/octet-stream")

        tmp = tempfile.NamedTemporaryFile(delete=False)
        tmp_name = tmp.name
        total = 0

        with tmp:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if not chunk:
                    continue
                total += len(chunk)
                if total > MAX_DOWNLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Filen er for stor")
                tmp.write(chunk)

        return FileResponse(
            path=tmp_name,
            media_type=content_type,
            filename=filename,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            background=BackgroundTask(lambda path: os.path.exists(path) and os.unlink(path), tmp_name),
        )
    except HTTPException:
        if tmp_name and os.path.exists(tmp_name):
            os.unlink(tmp_name)
        raise
    except Exception as e:
        if tmp_name and os.path.exists(tmp_name):
            os.unlink(tmp_name)
        raise HTTPException(status_code=500, detail=f"Nedlasting feilet: {str(e)}")
