import firebase_admin
from firebase_admin import credentials, storage
import os
from dotenv import load_dotenv

load_dotenv()

cred = credentials.Certificate(os.getenv("FIREBASE_SERVICE_ACCOUNT"))
firebase_admin.initialize_app(cred, {
    "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET")
})

def upload_pdf_to_firebase(filepath: str, project_name: str) -> str:
    bucket = storage.bucket()
    blob = bucket.blob(f"rapporter/{project_name}/{os.path.basename(filepath)}")
    blob.upload_from_filename(filepath)
    blob.make_public()
    return blob.public_url