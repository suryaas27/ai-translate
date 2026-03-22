import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import uuid
import json
import tempfile
import base64
import io
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from gemini_translator import GeminiTranslator
from sarvam_translator import SarvamTranslator
from indic_translator import IndicTransTranslator
from openai_translator import OpenAITranslator
from anthropic_translator import AnthropicTranslator
from gemini_reviewer import GeminiReviewer
from openai_reviewer import OpenAIReviewer
from html_to_docx import html_to_docx
from html_to_pdf import html_to_pdf
from docx_converter import convert_docx_stream_to_html
from google.cloud import translate_v2 as translate
from google.api_core.client_options import ClientOptions

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Google Translate Client ---
translate_client = None
try:
    project_id = os.getenv("GCP_PROJECT_ID")
    if project_id:
        client_options = ClientOptions(quota_project_id=project_id)
        translate_client = translate.Client(client_options=client_options)
        print("DEBUG: Google Translate Client initialized")
    else:
        translate_client = translate.Client()
except Exception as e:
    print(f"WARNING: Google Translate not initialized: {e}")

# --- Provider Registry ---
translator_registry = {}
reviewer_registry = {}

# Initialize Translators
try:
    if os.getenv("GEMINI_API_KEY"):
        translator_registry["gemini"] = GeminiTranslator()
        print("DEBUG: Gemini Translator registered")
except Exception as e:
    print(f"WARNING: Gemini Translator failed: {e}")

try:
    if os.getenv("SARVAM_API_KEY"):
        translator_registry["sarvam"] = SarvamTranslator()
        print("DEBUG: Sarvam Translator registered")
except Exception as e:
    print(f"WARNING: Sarvam Translator failed: {e}")

try:
    if os.getenv("INDIC_TRANS2_API_URL"):
        translator_registry["indictrans2"] = IndicTransTranslator()
        print("DEBUG: IndicTrans2 Translator registered")
except Exception as e:
    print(f"WARNING: IndicTrans2 Translator failed: {e}")

try:
    if os.getenv("OPENAI_API_KEY"):
        translator_registry["openai"] = OpenAITranslator()
        print("DEBUG: OpenAI Translator registered")
except Exception as e:
    print(f"WARNING: OpenAI Translator failed: {e}")

try:
    if os.getenv("ANTHROPIC_API_KEY"):
        translator_registry["anthropic"] = AnthropicTranslator()
        print("DEBUG: Anthropic Translator registered")
except Exception as e:
    print(f"WARNING: Anthropic Translator failed: {e}")

# Initialize Reviewers
try:
    if os.getenv("GEMINI_API_KEY"):
        reviewer_registry["gemini"] = GeminiReviewer()
        print("DEBUG: Gemini Reviewer registered")
except Exception as e:
    print(f"WARNING: Gemini Reviewer failed: {e}")

try:
    if os.getenv("OPENAI_API_KEY"):
        reviewer_registry["openai"] = OpenAIReviewer()
        print("DEBUG: OpenAI Reviewer registered")
except Exception as e:
    print(f"WARNING: OpenAI Reviewer failed: {e}")


# --- Data Models ---
class EvaluationRequest(BaseModel):
    original_text: str
    translated_text: str
    target_language: str
    reviewer_provider: str = "gemini"


class TranslateURLRequest(BaseModel):
    url: str
    target_language: str = "hi"
    # None or "google" → Google Translate; any other value (e.g. "gemini") → LLM
    llm_provider: Optional[str] = None


class TranslateBase64Request(BaseModel):
    file_data: str    # base64-encoded file bytes
    filename: str     # used to detect file type (.pdf or .docx)
    target_language: str = "hi"
    # None or "google" → Google Translate; any other value → LLM
    llm_provider: Optional[str] = None


# --- Helper Functions ---
def extract_pdf_pages_html(file_bytes: bytes) -> list:
    """Extract each PDF page as its own HTML string using PyMuPDF."""
    import pymupdf
    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page in doc:
        page_html = page.get_text("html")
        pages.append(
            f'<div class="page" style="margin-bottom:2em;padding:1em;border-bottom:1px solid #eee;">'
            f'{page_html}</div>'
        )
    doc.close()
    return pages


def extract_pdf_to_html(file_bytes: bytes) -> str:
    """Extract all PDF pages and combine into a single HTML document."""
    pages = extract_pdf_pages_html(file_bytes)
    return (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
        'body{font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px;}'
        '.page{page-break-after:always;}'
        '</style></head><body>'
        + ''.join(pages)
        + '</body></html>'
    )


def _google_translate_html(html: str, target_language: str) -> str:
    """Run Google Translate on an HTML string, handling style/image placeholders."""
    import re

    if not translate_client:
        raise HTTPException(status_code=503, detail="Google Translate not configured")

    style_placeholders = {}

    def replace_style(match):
        placeholder = f"STYLE_PLACEHOLDER_{len(style_placeholders)}"
        style_placeholders[placeholder] = match.group(0)
        return f'<div class="{placeholder}"></div>'

    html_for_translation = re.sub(r'<style[^>]*>[\s\S]*?</style>', replace_style, html)

    image_placeholders = {}

    def replace_img(match):
        quote = match.group(1)
        content_val = match.group(2)
        placeholder = f"IMG_PLACEHOLDER_{len(image_placeholders)}"
        image_placeholders[placeholder] = content_val
        return f'src={quote}{placeholder}{quote}'

    html_for_translation = re.sub(r'src=(["\'])(data:image/[^"\']+)\1', replace_img, html_for_translation)

    result = translate_client.translate(html_for_translation, target_language=target_language, format_='html')
    translated_html = result['translatedText']
    translated_html = translated_html.replace('&#39;', "'").replace('&quot;', '"').replace('&amp;', '&')

    for placeholder, style_block in style_placeholders.items():
        translated_html = re.sub(rf'<div class="{placeholder}"\s*>\s*</div>', style_block, translated_html)
        if placeholder in translated_html:
            translated_html = translated_html.replace(placeholder, "")
            translated_html = style_block + translated_html

    for placeholder, img_content in image_placeholders.items():
        translated_html = translated_html.replace(placeholder, img_content)

    return translated_html


async def _do_translate_docx_google(content: bytes, target_language: str) -> dict:
    """Core DOCX → Google Translate processing (works on raw bytes)."""
    fileobj = io.BytesIO(content)
    html_output = convert_docx_stream_to_html(fileobj)

    if target_language.lower() == 'rajasthani':
        target_language = 'hi'

    translated_html = _google_translate_html(html_output, target_language)

    translated_docx_b64 = None
    translated_pdf_b64 = None
    try:
        docx_io = html_to_docx(translated_html)
        translated_docx_b64 = base64.b64encode(docx_io.getvalue()).decode('utf-8')
        pdf_io = html_to_pdf(translated_html)
        translated_pdf_b64 = base64.b64encode(pdf_io.getvalue()).decode('utf-8')
    except Exception as e:
        print(f"Warning: Failed to generate DOCX/PDF: {e}")

    return {
        "html": translated_html,
        "original_html": html_output,
        "language": target_language,
        "translated_docx_b64": translated_docx_b64,
        "translated_pdf_b64": translated_pdf_b64
    }


async def _do_translate_docx_llm(content: bytes, target_language: str, llm_provider: str) -> dict:
    """Core DOCX → LLM translation processing (works on raw bytes)."""
    import time as _time

    target_lang_code = 'hi' if target_language.lower() == 'rajasthani' else target_language

    fd_in, input_path = tempfile.mkstemp(suffix=".docx")
    fd_out, output_path = tempfile.mkstemp(suffix=".docx")
    os.close(fd_in)
    os.close(fd_out)

    try:
        with open(input_path, "wb") as f:
            f.write(content)

        original_fileobj = io.BytesIO(content)
        original_html = convert_docx_stream_to_html(original_fileobj)

        provider = translator_registry.get(llm_provider)
        if not provider:
            raise HTTPException(status_code=503, detail=f"Translator '{llm_provider}' not configured")

        _t_start = _time.time()
        print(f"[DOCX-LLM] Starting translation via {llm_provider} → {target_lang_code}")
        provider.translate_docx(input_path, target_lang_code, output_path)
        print(f"[DOCX-LLM] Done in {_time.time()-_t_start:.1f}s")

        with open(output_path, "rb") as f:
            translated_content = f.read()
            translated_docx_b64 = base64.b64encode(translated_content).decode('utf-8')
            translated_fileobj = io.BytesIO(translated_content)
            translated_html = convert_docx_stream_to_html(translated_fileobj)

            translated_pdf_b64 = None
            try:
                pdf_io = html_to_pdf(translated_html)
                translated_pdf_b64 = base64.b64encode(pdf_io.getvalue()).decode('utf-8')
            except Exception as pdf_err:
                print(f"Warning: PDF generation failed: {pdf_err}")

        return {
            "html": translated_html,
            "original_html": original_html,
            "language": target_language,
            "provider": llm_provider,
            "translated_docx_b64": translated_docx_b64,
            "translated_pdf_b64": translated_pdf_b64
        }
    finally:
        if os.path.exists(input_path): os.remove(input_path)
        if os.path.exists(output_path): os.remove(output_path)


def _do_translate_pdf_google(content: bytes, target_language: str) -> dict:
    """Core PDF → Google Translate processing (works on raw bytes)."""
    if target_language.lower() == 'rajasthani':
        target_language = 'hi'

    original_html = extract_pdf_to_html(content)
    translated_html = _google_translate_html(original_html, target_language)

    translated_pdf_b64 = None
    try:
        pdf_io = html_to_pdf(translated_html)
        translated_pdf_b64 = base64.b64encode(pdf_io.getvalue()).decode('utf-8')
    except Exception as pdf_err:
        print(f"Warning: PDF generation failed: {pdf_err}")

    return {
        "html": translated_html,
        "original_html": original_html,
        "language": target_language,
        "translated_docx_b64": None,
        "translated_pdf_b64": translated_pdf_b64
    }


async def _do_translate_pdf_llm(content: bytes, target_language: str, llm_provider: str) -> dict:
    """Core PDF → LLM translation processing (single call, no batching)."""
    target_lang_code = 'hi' if target_language.lower() == 'rajasthani' else target_language

    original_html = extract_pdf_to_html(content)

    provider = translator_registry.get(llm_provider)
    if not provider:
        raise HTTPException(status_code=503, detail=f"Translator '{llm_provider}' not configured")

    print(f"[PDF-LLM] Translating via {llm_provider} → {target_lang_code}")
    result = await asyncio.to_thread(provider.translate_html, original_html, target_lang_code)
    translated_html = result["translated_html"]

    translated_pdf_b64 = None
    try:
        pdf_io = html_to_pdf(translated_html)
        translated_pdf_b64 = base64.b64encode(pdf_io.getvalue()).decode('utf-8')
    except Exception as pdf_err:
        print(f"Warning: PDF generation failed: {pdf_err}")

    return {
        "html": translated_html,
        "original_html": original_html,
        "language": target_language,
        "provider": llm_provider,
        "translated_docx_b64": None,
        "translated_pdf_b64": translated_pdf_b64
    }


# --- Endpoints ---
@app.get("/")
def read_root():
    return {"status": "running", "service": "ai-translate", "version": "1.0.0"}


@app.post("/translate-docx")
async def translate_docx_google(
    file: UploadFile = File(...),
    target_language: str = Body("hi")
):
    """Translate DOCX using Google Translate (HTML mode)"""
    if not file.filename.lower().endswith('.docx'):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    try:
        content = await file.read()
        return await _do_translate_docx_google(content, target_language)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@app.post("/translate-docx-llm")
async def translate_docx_llm(
    file: UploadFile = File(...),
    target_language: str = Body("hi"),
    llm_provider: str = Body("gemini")
):
    """Translate DOCX natively using an LLM provider (preserves layout, images, tables)"""
    if not file.filename.lower().endswith('.docx'):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    try:
        content = await file.read()
        return await _do_translate_docx_llm(content, target_language, llm_provider)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@app.post("/translate-pdf-llm")
async def translate_pdf_llm(
    file: UploadFile = File(...),
    target_language: str = Body("hi"),
    llm_provider: str = Body("gemini")
):
    """Translate PDF using a single LLM call"""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only .pdf files are supported")

    try:
        content = await file.read()
        return await _do_translate_pdf_llm(content, target_language, llm_provider)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF Translation failed: {str(e)}")


@app.post("/translate-pdf-llm/stream")
async def translate_pdf_llm_stream(
    file: UploadFile = File(...),
    target_language: str = Body("hi"),
    llm_provider: str = Body("gemini")
):
    """SSE endpoint — single LLM call, emits one done event when complete"""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only .pdf files are supported")

    content = await file.read()
    target_lang_code = 'hi' if target_language.lower() == 'rajasthani' else target_language

    original_html = extract_pdf_to_html(content)

    provider = translator_registry.get(llm_provider)
    if not provider:
        raise HTTPException(status_code=503, detail=f"Translator '{llm_provider}' not configured")

    async def event_gen():
        print(f"[PDF-Stream] Translating via {llm_provider} → {target_lang_code}")
        try:
            result = await asyncio.to_thread(provider.translate_html, original_html, target_lang_code)
            full_html = result["translated_html"]
        except Exception as e:
            print(f"[PDF-Stream] Translation failed ({e}), keeping original")
            full_html = original_html

        translated_pdf_b64 = None
        try:
            pdf_io = html_to_pdf(full_html)
            translated_pdf_b64 = base64.b64encode(pdf_io.getvalue()).decode('utf-8')
        except Exception as pdf_err:
            print(f"Warning: PDF generation failed: {pdf_err}")

        done_payload = json.dumps({
            "type": "done",
            "html": full_html,
            "original_html": original_html,
            "language": target_language,
            "provider": llm_provider,
            "translated_pdf_b64": translated_pdf_b64,
        })
        yield f"data: {done_payload}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@app.post("/translate-pdf")
async def translate_pdf_google(
    file: UploadFile = File(...),
    target_language: str = Body("hi")
):
    """Translate PDF using Google Translate"""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only .pdf files are supported")

    try:
        content = await file.read()
        return _do_translate_pdf_google(content, target_language)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF Translation failed: {str(e)}")


@app.post("/translate-url")
async def translate_from_url(request: TranslateURLRequest):
    """
    Download a document from a URL and translate it.

    - Supports .pdf and .docx files (detected from URL path or Content-Type header).
    - llm_provider=null / "google"  → Google Translate
    - llm_provider="gemini" / "openai" / etc. → LLM-based translation
    """
    import requests as req_lib

    try:
        resp = await asyncio.to_thread(
            lambda: req_lib.get(request.url, timeout=60, allow_redirects=True)
        )
        resp.raise_for_status()
        content = resp.content

        # Detect file type from URL path first, then Content-Type
        url_path = request.url.lower().split('?')[0]
        content_type = resp.headers.get('Content-Type', '').lower()

        if url_path.endswith('.pdf') or 'pdf' in content_type:
            file_type = 'pdf'
        elif url_path.endswith('.docx') or 'officedocument.wordprocessingml' in content_type:
            file_type = 'docx'
        else:
            raise HTTPException(
                status_code=400,
                detail="Cannot detect file type. URL must point to a .pdf or .docx file."
            )

        use_llm = bool(request.llm_provider and request.llm_provider.lower() != 'google')

        if file_type == 'pdf':
            if use_llm:
                return await _do_translate_pdf_llm(content, request.target_language, request.llm_provider)
            else:
                return _do_translate_pdf_google(content, request.target_language)
        else:
            if use_llm:
                return await _do_translate_docx_llm(content, request.target_language, request.llm_provider)
            else:
                return await _do_translate_docx_google(content, request.target_language)

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@app.post("/translate-base64")
async def translate_from_base64(request: TranslateBase64Request):
    """
    Translate a base64-encoded document file.

    - filename is used to detect the file type (.pdf or .docx).
    - llm_provider=null / "google"  → Google Translate
    - llm_provider="gemini" / "openai" / etc. → LLM-based translation
    """
    try:
        try:
            content = base64.b64decode(request.file_data)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 data")

        filename_lower = request.filename.lower()
        if filename_lower.endswith('.pdf'):
            file_type = 'pdf'
        elif filename_lower.endswith('.docx'):
            file_type = 'docx'
        else:
            raise HTTPException(
                status_code=400,
                detail="filename must end with .pdf or .docx"
            )

        use_llm = bool(request.llm_provider and request.llm_provider.lower() != 'google')

        if file_type == 'pdf':
            if use_llm:
                return await _do_translate_pdf_llm(content, request.target_language, request.llm_provider)
            else:
                return _do_translate_pdf_google(content, request.target_language)
        else:
            if use_llm:
                return await _do_translate_docx_llm(content, request.target_language, request.llm_provider)
            else:
                return await _do_translate_docx_google(content, request.target_language)

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@app.post("/evaluate-translation")
async def evaluate_translation(request: EvaluationRequest):
    """Evaluate translation quality using a reviewer model"""
    try:
        reviewer = reviewer_registry.get(request.reviewer_provider)
        if not reviewer:
            raise HTTPException(status_code=503, detail=f"Reviewer '{request.reviewer_provider}' not configured")

        evaluation = reviewer.evaluate_translation(
            request.original_text,
            request.translated_text,
            request.target_language
        )
        return evaluation
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/save-correction")
async def save_correction(
    original_text: str = Body(...),
    translated_text: str = Body(...),
    corrected_text: str = Body(...),
    target_language: str = Body(...),
    provider: str = Body(...)
):
    """Save human corrections for future fine-tuning"""
    try:
        data_dir = os.path.join(os.path.dirname(__file__), "data")
        os.makedirs(data_dir, exist_ok=True)
        filename = os.path.join(data_dir, "corrections.jsonl")

        entry = {
            "timestamp": uuid.uuid4().hex,
            "original_text": original_text,
            "llm_output": translated_text,
            "human_correction": corrected_text,
            "language": target_language,
            "provider": provider
        }

        with open(filename, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        return {"status": "success", "message": "Correction saved for future training"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/download-docx")
async def download_docx(
    html_content: str = Body(..., embed=True),
    filename: str = Body("translated_document.docx", embed=True)
):
    """Convert HTML to DOCX and stream as download"""
    try:
        docx_io = html_to_docx(html_content)
        return StreamingResponse(
            docx_io,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DOCX conversion failed: {str(e)}")


@app.post("/download-pdf")
async def download_pdf(
    html_content: str = Body(..., embed=True),
    filename: str = Body("translated_document.pdf", embed=True)
):
    """Convert HTML to PDF and stream as download"""
    try:
        pdf_io = html_to_pdf(html_content)
        return StreamingResponse(
            pdf_io,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF conversion failed: {str(e)}")
