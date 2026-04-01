import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import json
import re
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from llm_client import LLMClient
from doc_reader import extract_text

app = FastAPI(title="AI Compare")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = LLMClient()

LANGUAGE_NAMES = {
    'hi': 'Hindi', 'te': 'Telugu', 'mr': 'Marathi', 'kn': 'Kannada',
    'ta': 'Tamil', 'bn': 'Bengali', 'gu': 'Gujarati', 'en': 'English',
}


def _text_diff(text_a: str, text_b: str) -> dict:
    """Simple line-level diff."""
    lines_a = set(text_a.splitlines())
    lines_b = set(text_b.splitlines())
    only_in_a = [l for l in lines_a - lines_b if l.strip()]
    only_in_b = [l for l in lines_b - lines_a if l.strip()]
    common = len(lines_a & lines_b)
    return {
        "only_in_a": only_in_a[:50],
        "only_in_b": only_in_b[:50],
        "common_lines": common,
    }


@app.get("/")
def root():
    return {"status": "running", "service": "ai-compare", "version": "1.0.0"}


@app.post("/compare")
async def compare_documents(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    mode: str = Body("semantic"),
    llm_provider: Optional[str] = Body("anthropic"),
):
    """
    Compare two documents.
    mode='text'     → line-level diff (no LLM)
    mode='semantic' → AI-powered semantic difference analysis
    """
    content_a = await file_a.read()
    content_b = await file_b.read()

    try:
        text_a = extract_text(content_a, file_a.filename)
        text_b = extract_text(content_b, file_b.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if mode == "text":
        diff = _text_diff(text_a, text_b)
        return {
            "mode": "text",
            "file_a": file_a.filename,
            "file_b": file_b.filename,
            "diff": diff,
        }

    # Semantic mode — use LLM
    system = (
        "You are an expert legal and document analyst. Compare two documents and identify "
        "meaningful differences. Focus on: changed clauses, added/removed sections, numerical changes, "
        "changed parties or terms. Ignore formatting differences. Output valid JSON only."
    )
    user = (
        f"Compare these two documents and return a JSON object with:\n"
        f'  "summary": "<2-3 sentence overall comparison>",\n'
        f'  "differences": [<list of specific differences, each as a string>],\n'
        f'  "additions_in_b": [<content present in B but not A>],\n'
        f'  "removals_from_a": [<content present in A but not B>],\n'
        f'  "similarity_score": <0-100 integer>\n\n'
        f"Return ONLY the JSON object — no markdown, no explanation.\n\n"
        f"=== DOCUMENT A ({file_a.filename}) ===\n{text_a[:6000]}\n\n"
        f"=== DOCUMENT B ({file_b.filename}) ===\n{text_b[:6000]}"
    )

    try:
        raw = llm.call(system, user, provider=llm_provider or "anthropic")
        raw = raw.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw).rstrip("`").strip()
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="LLM returned invalid JSON.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {e}")

    return {
        "mode": "semantic",
        "file_a": file_a.filename,
        "file_b": file_b.filename,
        "result": result,
        "provider": llm_provider,
    }


@app.post("/compare-versions")
async def compare_versions(
    original: UploadFile = File(...),
    translated: UploadFile = File(...),
    source_language: str = Body("en"),
    target_language: str = Body("hi"),
):
    """Compare original and translated document — check translation quality."""
    content_orig = await original.read()
    content_trans = await translated.read()

    try:
        text_orig = extract_text(content_orig, original.filename)
        text_trans = extract_text(content_trans, translated.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    src_lang = LANGUAGE_NAMES.get(source_language, source_language)
    tgt_lang = LANGUAGE_NAMES.get(target_language, target_language)

    system = (
        "You are an expert bilingual document reviewer. Evaluate translation quality "
        "and identify any missing content, mistranslations, or omissions. Output valid JSON only."
    )
    user = (
        f"Review the {tgt_lang} translation of this {src_lang} document.\n\n"
        f"Return a JSON object with:\n"
        f'  "quality_score": <0-100>,\n'
        f'  "missing_content": [<list of sections/clauses from original not present in translation>],\n'
        f'  "mistranslations": [<list of suspected mistranslations>],\n'
        f'  "overall_assessment": "<brief assessment>"\n\n'
        f"Return ONLY the JSON object — no markdown, no explanation.\n\n"
        f"=== ORIGINAL ({src_lang}) ===\n{text_orig[:6000]}\n\n"
        f"=== TRANSLATION ({tgt_lang}) ===\n{text_trans[:6000]}"
    )

    try:
        raw = llm.call(system, user, provider="anthropic")
        raw = raw.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw).rstrip("`").strip()
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="LLM returned invalid JSON.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {e}")

    return {
        "original": original.filename,
        "translated": translated.filename,
        "source_language": source_language,
        "target_language": target_language,
        "result": result,
    }
