"""
AWS Bedrock AI service for template field extraction and generation.
Primary provider in 'server' flow — uses Claude models via Bedrock converse API.
"""

import asyncio
import functools
import logging
import os
import time
from typing import Dict

import boto3
import botocore.config
import botocore.exceptions

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


class BedrockAIService(BaseAIService):
    """Template extraction and generation via AWS Bedrock (Claude models)."""

    def __init__(self):
        region = os.getenv("AWS_DEFAULT_REGION", "ap-south-1")
        self.model_id = os.getenv("BEDROCK_MODEL", "global.anthropic.claude-haiku-4-5-20251001-v1:0")
        self.max_tokens = int(os.getenv("MAX_OUTPUT_TOKENS", "16000"))
        self.max_retries = 3
        self.client = boto3.client(
            "bedrock-runtime",
            region_name=region,
            config=botocore.config.Config(
                read_timeout=300,
                connect_timeout=10,
                retries={"max_attempts": 0},
            ),
        )
        logger.info("[BedrockAIService] Initialized: model=%s, region=%s", self.model_id, region)

    # ── Internal sync helpers ──────────────────────────────────────────────────

    def _call_bedrock(self, system_prompt: str, content: list, max_tokens: int) -> str:
        """Synchronous Bedrock converse call with retry logic."""
        for attempt in range(self.max_retries):
            try:
                response = self.client.converse(
                    modelId=self.model_id,
                    system=[{"text": system_prompt}],
                    messages=[{"role": "user", "content": content}],
                    inferenceConfig={"maxTokens": max_tokens, "temperature": 0.1},
                )
                if response.get("stopReason") == "max_tokens":
                    logger.warning("[BedrockAIService] Hit max_tokens (%d), output may be truncated", max_tokens)
                return response["output"]["message"]["content"][0]["text"]
            except botocore.exceptions.ClientError as e:
                code = e.response["Error"]["Code"]
                if code in ("ThrottlingException", "ServiceUnavailableException") and attempt < self.max_retries - 1:
                    wait = 2 ** attempt
                    logger.warning("[BedrockAIService] %s, retrying in %ds (attempt %d/%d)", code, wait, attempt + 1, self.max_retries)
                    time.sleep(wait)
                else:
                    raise
        raise RuntimeError(f"[BedrockAIService] API failed after {self.max_retries} retries")

    def _extract_sync(self, file_bytes: bytes, mime_type: str, filename: str) -> Dict:
        """Synchronous extraction — called via run_in_executor."""
        ext = (filename or "").lower().rsplit(".", 1)[-1]
        is_docx = mime_type in DOCX_MIMES or ext in ("docx", "doc")
        file_type = "DOCX" if is_docx else ("IMAGE" if mime_type.startswith("image/") else "PDF")
        print(f"[BedrockAIService] extract | file={filename} | type={file_type} | model={self.model_id}")

        if is_docx:
            text = extract_docx_text(file_bytes)
            if not text.strip():
                return {"fields": [], "template_text": ""}
            full_prompt = f"Document text:\n\n{text}\n\n---\n{TEMPLATE_EXTRACTION_PROMPT}"
            content = [{"text": full_prompt}]
            raw = self._call_bedrock("You are a document template analyzer.", content, self.max_tokens)
            result = parse_template_json(raw, "bedrock_text")
            if not result["template_text"].strip() and text.strip():
                result["template_text"] = text
            return result

        # Vision path: PDF or image
        is_image = mime_type.startswith("image/")
        if is_image:
            fmt = mime_type.split("/")[1].lower()
            if fmt not in ("jpeg", "png", "gif", "webp"):
                fmt = "jpeg"
            content = [
                {"image": {"format": fmt, "source": {"bytes": file_bytes}}},
                {"text": TEMPLATE_EXTRACTION_PROMPT},
            ]
        else:
            # PDF: try native document block first, fall back to image pages
            try:
                content = [
                    {"document": {"format": "pdf", "name": "document", "source": {"bytes": file_bytes}}},
                    {"text": TEMPLATE_EXTRACTION_PROMPT},
                ]
                raw = self._call_bedrock("You are a document template analyzer.", content, self.max_tokens)
                return parse_template_json(raw, "bedrock_pdf_doc")
            except Exception as exc:
                logger.warning("[BedrockAIService] PDF document block failed (%s) — trying image pages", exc)

            page_images = pdf_to_images(file_bytes)
            if page_images:
                content = [
                    {"image": {"format": "jpeg", "source": {"bytes": img}}}
                    for img in page_images
                ]
                content.append({"text": TEMPLATE_EXTRACTION_PROMPT})
            else:
                text = extract_pdf_text_naive(file_bytes)
                content = [{"text": f"{TEMPLATE_EXTRACTION_PROMPT}\n\nDocument text:\n{text[:8000]}"}]

        raw = self._call_bedrock("You are a document template analyzer.", content, self.max_tokens)
        return parse_template_json(raw, "bedrock_vision")

    def _generate_sync(self, description: str) -> Dict:
        """Synchronous template generation — called via run_in_executor."""
        print(f"[BedrockAIService] generate-template | model={self.model_id}")
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
        content = [{"text": prompt}]
        raw = self._call_bedrock("You are an expert legal document drafter.", content, self.max_tokens)
        return parse_template_json(raw, "bedrock_generate")

    # ── Public async interface ─────────────────────────────────────────────────

    async def extract_template_fields(self, file_bytes: bytes, mime_type: str, filename: str = "") -> Dict:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            functools.partial(self._extract_sync, file_bytes, mime_type, filename),
        )

    async def generate_template(self, description: str) -> Dict:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            functools.partial(self._generate_sync, description),
        )
