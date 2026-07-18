from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import ivf, calculation, terrain, pdf, uploads
from app import matrikkel_api
from app.security import RequireFirebaseUser
import os

app = FastAPI()


def get_allowed_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]

# --- CORS --- #
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers --- #
app.include_router(ivf.router, prefix="/ivf", dependencies=[RequireFirebaseUser])
app.include_router(calculation.router, prefix="/calculation", dependencies=[RequireFirebaseUser])
app.include_router(terrain.router, dependencies=[RequireFirebaseUser])
app.include_router(pdf.router, prefix="/pdf", dependencies=[RequireFirebaseUser])
app.include_router(matrikkel_api.router, dependencies=[RequireFirebaseUser])
app.include_router(uploads.router, dependencies=[RequireFirebaseUser])
