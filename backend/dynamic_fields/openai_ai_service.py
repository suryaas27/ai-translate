"""OpenAI AI service for template field extraction and generation (fallback provider)."""

import base64
import logging
import os
from typing import Dict

from dynamic_fields.base_ai_service import (
    BaseAIService,
    DOCX_MIMES,
    TEMPLATE_EXTRACTION_PROMPT,
    extract_docx_text,
    extract_pdf_text_naive,
    parse_template_json,
    pdf_to_images,
)

logger = logging.getLogger(__name__)


class OpenAIAIService(BaseAIService):
    """Template extraction and generation via OpenAI (gpt-4o / gpt-4o-mini)."""

    def __init__(self):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
        self.vision_model = "gpt-4o"
        self.text_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.max_tokens = int(os.getenv("MAX_OUTPUT_TOKENS", "16000"))
        logger.info("[OpenAIAIService] Initialized: vision=%s, text=%s", self.vision_model, self.text_model)

    async def extract_template_fields(self, file_bytes: bytes, mime_type: str, filename: str = "") -> Dict:
        ext = (filename or "").lower().rsplit(".", 1)[-1]
        is_docx = mime_type in DOCX_MIMES or ext in ("docx", "doc")
        file_type = "DOCX" if is_docx else ("IMAGE" if mime_type.startswith("image/") else "PDF")
        model = self.text_model if is_docx else self.vision_model
        print(f"[OpenAIAIService] extract | file={filename} | type={file_type} | model={model}")

        if is_docx:
            text = extract_docx_text(file_bytes)
            if not text.strip():
                return {"fields": [], "template_text": ""}
            full_prompt = f"Document text:\n\n{text}\n\n---\n{TEMPLATE_EXTRACTION_PROMPT}"
            response = await self.client.chat.completions.create(
                model=self.text_model,
                messages=[
                    {"role": "system", "content": "You are a document template analyzer."},
                    {"role": "user", "content": full_prompt},
                ],
                max_tokens=self.max_tokens,
                temperature=0.1,
            )
            raw = response.choices[0].message.content or ""
            result = parse_template_json(raw, "openai_text")
            if not result["template_text"].strip() and text.strip():
                result["template_text"] = text
            return result

        is_image = mime_type.startswith("image/")
        if is_image:
            b64 = base64.b64encode(file_bytes).decode()
            messages = [{"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
                {"type": "text", "text": TEMPLATE_EXTRACTION_PROMPT},
            ]}]
        else:
            page_images = pdf_to_images(file_bytes)
            if page_images:
                content = []
                for img_bytes in page_images:
                    img_b64 = base64.b64encode(img_bytes).decode()
                    content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}})
                content.append({"type": "text", "text": TEMPLATE_EXTRACTION_PROMPT})
                messages = [{"role": "user", "content": content}]
            else:
                text = extract_pdf_text_naive(file_bytes)
                messages = [
                    {"role": "system", "content": "You are a document analysis assistant."},
                    {"role": "user", "content": f"{TEMPLATE_EXTRACTION_PROMPT}\n\nDocument text:\n{text[:8000]}"},
                ]

        response = await self.client.chat.completions.create(
            model=self.vision_model,
            messages=messages,
            max_tokens=self.max_tokens,
            temperature=0.1,
        )
        raw = response.choices[0].message.content or ""
        return parse_template_json(raw, "openai_vision")

    async def generate_template(self, description: str) -> Dict:
        print(f"[OpenAIAIService] generate-template | model={self.text_model}")
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
        response = await self.client.chat.completions.create(
            model=self.text_model,
            messages=[
                {"role": "system", "content": "You are an expert legal document drafter."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=self.max_tokens,
            temperature=0.1,
        )
        raw = response.choices[0].message.content or ""
        return parse_template_json(raw, "openai_generate")
