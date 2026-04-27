"""Gemini AI service for template field extraction and generation (fallback provider)."""

import logging
import os
from typing import Dict

from dynamic_fields.base_ai_service import (
    BaseAIService,
    DOCX_MIMES,
    TEMPLATE_EXTRACTION_PROMPT,
    extract_docx_text,
    parse_template_json,
)

logger = logging.getLogger(__name__)


class GeminiAIService(BaseAIService):
    """Template extraction and generation via Google Gemini."""

    def __init__(self):
        from google import genai
        self.genai = genai
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        self.api_key = os.environ["GEMINI_API_KEY"]
        self.max_tokens = int(os.getenv("MAX_OUTPUT_TOKENS", "16000"))
        logger.info("[GeminiAIService] Initialized: model=%s", self.model)

    async def extract_template_fields(self, file_bytes: bytes, mime_type: str, filename: str = "") -> Dict:
        from google.genai import types

        client = self.genai.Client(api_key=self.api_key)
        ext = (filename or "").lower().rsplit(".", 1)[-1]
        is_docx = mime_type in DOCX_MIMES or ext in ("docx", "doc")
        file_type = "DOCX" if is_docx else ("IMAGE" if mime_type.startswith("image/") else "PDF")
        print(f"[GeminiAIService] extract | file={filename} | type={file_type} | model={self.model}")

        if is_docx:
            text = extract_docx_text(file_bytes)
            if not text.strip():
                return {"fields": [], "template_text": ""}
            full_prompt = f"Document text:\n\n{text}\n\n---\n{TEMPLATE_EXTRACTION_PROMPT}"
            contents = [types.Content(role="user", parts=[types.Part(text=full_prompt)])]
        else:
            contents = [types.Content(role="user", parts=[
                types.Part(inline_data=types.Blob(mime_type=mime_type, data=file_bytes)),
                types.Part(text=TEMPLATE_EXTRACTION_PROMPT),
            ])]

        response = await client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                max_output_tokens=self.max_tokens,
                temperature=0.1,
            ),
        )
        raw = response.text or ""
        result = parse_template_json(raw, "gemini_extract")
        if is_docx:
            text = extract_docx_text(file_bytes)
            if not result["template_text"].strip() and text.strip():
                result["template_text"] = text
        return result

    async def generate_template(self, description: str) -> Dict:
        print(f"[GeminiAIService] generate-template | model={self.model}")
        from google.genai import types

        client = self.genai.Client(api_key=self.api_key)
        prompt = (
            f"Create a professional document template for: {description}\n\n"
            "Requirements:\n"
            "1. Write complete, professional document text.\n"
            "2. Use {{field_N}} markers (starting from field_0) for every blank the user must fill in.\n"
            "3. Infer meaningful labels for each field from context.\n"
            "4. Include all standard sections for this document type.\n\n"
            "Return ONLY valid JSON, no markdown fences:\n"
            '{"fields":[{"id":"field_0","label":"Party Name"},...],'
            '"template_text":"Full document text with {{field_N}} markers."}'
        )
        contents = [types.Content(role="user", parts=[
            types.Part(text=f"You are an expert legal document drafter.\n\n{prompt}")
        ])]
        response = await client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                max_output_tokens=self.max_tokens,
                temperature=0.1,
            ),
        )
        raw = response.text or ""
        return parse_template_json(raw, "gemini_generate")
