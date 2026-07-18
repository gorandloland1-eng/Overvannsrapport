from fastapi import Depends, HTTPException, Request
from firebase_admin import auth as firebase_auth

from app.services.firebase import ensure_firebase_app


def require_firebase_user(request: Request) -> dict:
    ensure_firebase_app()

    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")

    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Mangler autentisering")

    try:
        return firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Ugyldig autentisering")


RequireFirebaseUser = Depends(require_firebase_user)
