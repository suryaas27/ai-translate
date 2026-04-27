import sys, os

# Add backend/ to path so feature packages (translation, summary, etc.) are importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from translation.router import router as translation_router
from summary.router import router as summary_router
from extract.router import router as extract_router
from interact.router import router as interact_router
from comparison.router import router as comparison_router
from transliteration.router import router as transliteration_router
from dynamic_fields.router import router as dynamic_fields_router
from redact.router import router as redact_router

app = FastAPI(title="AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(translation_router,     prefix="/api/v1/translation",     tags=["translation"])
app.include_router(summary_router,         prefix="/api/v1/summary",         tags=["summary"])
app.include_router(extract_router,         prefix="/api/v1/extract",         tags=["extract"])
app.include_router(interact_router,        prefix="/api/v1/interact",        tags=["interact"])
app.include_router(comparison_router,      prefix="/api/v1/comparison",      tags=["comparison"])
app.include_router(transliteration_router, prefix="/api/v1/transliteration", tags=["transliteration"])
app.include_router(dynamic_fields_router,  prefix="/api/v1/dynamic-fields",  tags=["dynamic-fields"])
app.include_router(redact_router,          prefix="/api/v1/redact",           tags=["redact"])


@app.get("/")
def root():
    return {"status": "running", "service": "aiService", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
