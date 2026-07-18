import firebase_admin
from firebase_admin import credentials, storage
import os
import uuid
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

def ensure_firebase_app():
    if firebase_admin._apps:
        return firebase_admin.get_app()

    service_account = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET")

    if not service_account or not storage_bucket:
        raise RuntimeError("Firebase-konfigurasjon mangler")

    cred = credentials.Certificate(service_account)
    return firebase_admin.initialize_app(cred, {
        "storageBucket": storage_bucket
    })


ensure_firebase_app()

def upload_pdf_to_firebase(filepath: str, project_name: str) -> str:
    bucket = storage.bucket()
    blob = bucket.blob(f"rapporter/{project_name}/{os.path.basename(filepath)}")
    download_token = str(uuid.uuid4())
    blob.metadata = {"firebaseStorageDownloadTokens": download_token}
    blob.upload_from_filename(filepath, content_type="application/pdf")

    encoded_name = quote(blob.name, safe="")
    return (
        f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/"
        f"{encoded_name}?alt=media&token={download_token}"
    )
