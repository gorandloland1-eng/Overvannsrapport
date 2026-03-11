from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from app.routers import ivf, calculation, terrain, pdf
from app.pdf_generator import generate_project_pdf
import os

app = FastAPI()

# --- CORS --- #
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers --- #
app.include_router(ivf.router, prefix="/ivf")
app.include_router(calculation.router, prefix="/calculation")
app.include_router(terrain.router)
app.include_router(pdf.router, prefix="/pdf")