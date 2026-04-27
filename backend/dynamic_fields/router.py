"""
Dynamic Fields router — template extraction, DOCX conversion, and contract ordering.

Provider registry follows the same pattern as translation/router.py:
  • TRANSLATION_FLOW=server  → Bedrock primary; falls back to OpenAI/Gemini if keys present
  • TRANSLATION_FLOW=direct  → OpenAI/Gemini from local API keys
"""

import logging
import mimetypes
import os
import subprocess
import tempfile
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response

from dynamic_fields.schemas import ContractOrderResponse, CreateOrderUploadRequest

logger = logging.getLogger(__name__)

router = APIRouter()

# ── AI service registry ────────────────────────────────────────────────────────

ai_service_registry: dict = {}

TRANSLATION_FLOW = os.getenv("TRANSLATION_FLOW", "direct")
logger.info("[DynamicFields] Translation flow: %s", TRANSLATION_FLOW)
print(f"[dynamic-fields] service starting | flow={TRANSLATION_FLOW}")

if TRANSLATION_FLOW == "server":
    try:
        from dynamic_fields.bedrock_ai_service import BedrockAIService
        ai_service_registry["bedrock"] = BedrockAIService()
        ai_service_registry["default"] = ai_service_registry["bedrock"]
        logger.info("[DynamicFields] Bedrock AI service registered as default")
        print(f"[dynamic-fields] BEDROCK registered as default | model={ai_service_registry['bedrock'].model_id}")
    except Exception as exc:
        logger.warning("[DynamicFields] Bedrock AI service failed to init: %s", exc)
        print(f"[dynamic-fields] WARNING: Bedrock init failed: {exc}")

    try:
        if os.getenv("OPENAI_API_KEY"):
            from dynamic_fields.openai_ai_service import OpenAIAIService
            ai_service_registry["openai"] = OpenAIAIService()
            if "default" not in ai_service_registry:
                ai_service_registry["default"] = ai_service_registry["openai"]
            logger.info("[DynamicFields] OpenAI AI service registered")
    except Exception as exc:
        logger.warning("[DynamicFields] OpenAI AI service failed: %s", exc)

    try:
        if os.getenv("GEMINI_API_KEY"):
            from dynamic_fields.gemini_ai_service import GeminiAIService
            ai_service_registry["gemini"] = GeminiAIService()
            if "default" not in ai_service_registry:
                ai_service_registry["default"] = ai_service_registry["gemini"]
            logger.info("[DynamicFields] Gemini AI service registered")
    except Exception as exc:
        logger.warning("[DynamicFields] Gemini AI service failed: %s", exc)

else:  # direct flow
    try:
        if os.getenv("OPENAI_API_KEY"):
            from dynamic_fields.openai_ai_service import OpenAIAIService
            ai_service_registry["openai"] = OpenAIAIService()
            if "default" not in ai_service_registry:
                ai_service_registry["default"] = ai_service_registry["openai"]
            logger.info("[DynamicFields] OpenAI AI service registered")
    except Exception as exc:
        logger.warning("[DynamicFields] OpenAI AI service failed: %s", exc)

    try:
        if os.getenv("GEMINI_API_KEY"):
            from dynamic_fields.gemini_ai_service import GeminiAIService
            ai_service_registry["gemini"] = GeminiAIService()
            if "default" not in ai_service_registry:
                ai_service_registry["default"] = ai_service_registry["gemini"]
            logger.info("[DynamicFields] Gemini AI service registered")
    except Exception as exc:
        logger.warning("[DynamicFields] Gemini AI service failed: %s", exc)

    try:
        if os.getenv("ANTHROPIC_API_KEY"):
            from dynamic_fields.bedrock_ai_service import BedrockAIService
            # In direct flow, if user has explicit Bedrock creds, allow it
            pass
    except Exception:
        pass


def _get_ai_service(provider: Optional[str] = None):
    """Return the AI service for the given provider name, or the default."""
    if provider and provider in ai_service_registry:
        return ai_service_registry[provider]
    if "default" in ai_service_registry:
        return ai_service_registry["default"]
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="No AI service available. Configure BEDROCK, OPENAI_API_KEY or GEMINI_API_KEY.",
    )


# ── Contract service (lazy init — skips if no credentials) ────────────────────

_contract_service = None

def _get_contract_service():
    global _contract_service
    if _contract_service is None:
        try:
            from dynamic_fields.contract_service import contract_service
            _contract_service = contract_service
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Contract service unavailable: {exc}",
            )
    return _contract_service


DOQFY_ACCOUNT_ID = int(os.getenv("DOQFY_ACCOUNT_ID", "1034"))
ALLOWED_ARTICLE_CODES = {"Article 5(J)", "Article 41(h)", "Article 6(2)"}

# ── Template routes ────────────────────────────────────────────────────────────

@router.post("/template/extract-fields")
async def extract_template_fields(
    file: UploadFile = File(..., description="Document (PDF / image / DOCX) to extract blank fields from"),
    llm_provider: Optional[str] = Query(None, description="AI provider: bedrock | openai | gemini"),
):
    """Analyze an uploaded document for blank fields."""
    mime_type = file.content_type
    if not mime_type or mime_type == "application/octet-stream":
        guessed, _ = mimetypes.guess_type(file.filename or "")
        mime_type = guessed or "image/jpeg"

    ai_service = _get_ai_service(llm_provider)
    provider_name = type(ai_service).__name__
    flow_label = "BEDROCK" if "Bedrock" in provider_name else "DIRECT"
    print(f"[dynamic-fields] extract-fields | file={file.filename} | provider={provider_name} | flow={flow_label}")
    try:
        file_bytes = await file.read()
        result = await ai_service.extract_template_fields(file_bytes, mime_type, file.filename or "")
        field_count = len(result.get("fields", []))
        print(f"[dynamic-fields] extract-fields DONE | fields_found={field_count} | provider={provider_name}")
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        logger.error("extract_template_fields error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Field extraction failed: {exc}",
        )


@router.post("/template/docx-to-pdf")
async def convert_docx_to_pdf(
    file: UploadFile = File(..., description="DOCX file to convert to PDF"),
):
    """Convert an uploaded DOCX file to PDF using LibreOffice headless."""
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

    with tempfile.TemporaryDirectory() as tmpdir:
        docx_path = os.path.join(tmpdir, "input.docx")
        pdf_path  = os.path.join(tmpdir, "input.pdf")

        with open(docx_path, "wb") as f:
            f.write(file_bytes)

        try:
            result = subprocess.run(
                ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", tmpdir, docx_path],
                capture_output=True,
                timeout=60,
            )
        except FileNotFoundError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LibreOffice is not installed on the server")
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="DOCX to PDF conversion timed out")

        if result.returncode != 0 or not os.path.exists(pdf_path):
            logger.error("LibreOffice conversion failed: %s", result.stderr.decode())
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to convert DOCX to PDF")

        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

    return Response(content=pdf_bytes, media_type="application/pdf")


@router.post("/template/filled-text-to-pdf")
async def filled_text_to_pdf(
    text: str = Form(..., description="Resolved template text (all {{field_N}} already replaced)"),
    file_name: str = Form("document", description="Base name for the output PDF"),
):
    """Accept resolved plain text, build a DOCX in memory, convert to PDF via LibreOffice."""
    from docx import Document as DocxDocument
    from docx.shared import Cm, Mm, Pt
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    if not text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="text must not be empty")

    parsed_text = text.replace("\\n", "\n")

    doc = DocxDocument()
    section = doc.sections[0]
    section.page_width    = Mm(210)
    section.page_height   = Mm(297)
    section.left_margin   = Cm(2.5)
    section.right_margin  = Cm(2.5)
    section.top_margin    = Cm(2.5)
    section.bottom_margin = Cm(2.5)

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)

    for line in parsed_text.splitlines():
        para = doc.add_paragraph(line)
        para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    with tempfile.TemporaryDirectory() as tmpdir:
        docx_path = os.path.join(tmpdir, "filled.docx")
        pdf_path  = os.path.join(tmpdir, "filled.pdf")
        doc.save(docx_path)

        try:
            result = subprocess.run(
                ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", tmpdir, docx_path],
                capture_output=True,
                timeout=60,
            )
        except FileNotFoundError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LibreOffice is not installed on the server")
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="PDF conversion timed out")

        if result.returncode != 0 or not os.path.exists(pdf_path):
            logger.error("LibreOffice conversion failed: %s", result.stderr.decode())
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to convert filled template to PDF")

        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

    safe_name = file_name.replace("/", "_").replace("\\", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )


@router.post("/template/generate")
async def generate_template(
    description: str = Form(..., description="Plain-text description of the document to generate"),
    llm_provider: Optional[str] = Query(None, description="AI provider: bedrock | openai | gemini"),
):
    """Generate a document template from a natural-language description."""
    if not description.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="description must not be empty")

    ai_service = _get_ai_service(llm_provider)
    provider_name = type(ai_service).__name__
    flow_label = "BEDROCK" if "Bedrock" in provider_name else "DIRECT"
    print(f"[dynamic-fields] generate-template | provider={provider_name} | flow={flow_label}")
    try:
        result = await ai_service.generate_template(description.strip())
        field_count = len(result.get("fields", []))
        print(f"[dynamic-fields] generate-template DONE | fields_generated={field_count} | provider={provider_name}")
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        logger.error("generate_template error: %s", exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Template generation failed: {exc}")


# ── Contract routes ────────────────────────────────────────────────────────────

@router.post("/contracts/orders/upload", response_model=ContractOrderResponse)
async def create_order_from_pdf(request: CreateOrderUploadRequest):
    """Create a contract order from an uploaded PDF with eStamp and eSign configuration."""
    svc = _get_contract_service()
    try:
        result = await svc.create_order_from_pdf(request.model_dump())
        return ContractOrderResponse(**result)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Create order from PDF error: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Order creation failed: {e}")


@router.get("/contracts/stamp-types", response_model=ContractOrderResponse)
async def get_stamp_types(
    state_code: str = Query(..., description="State code, e.g. KA"),
    article_id: int = Query(..., description="Article ID"),
    consideration_amount: float = Query(default=0, description="Consideration amount"),
    sync: bool = Query(default=True),
):
    """Get available stamp duty values for a state + article combination."""
    svc = _get_contract_service()
    try:
        result = await svc.get_stamp_types(
            state_code=state_code,
            article_id=article_id,
            consideration_amount=consideration_amount,
            account_id=DOQFY_ACCOUNT_ID,
            sync=sync,
        )
        return ContractOrderResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get stamp types error: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch stamp types: {e}")


@router.get("/contracts/articles", response_model=ContractOrderResponse)
async def get_articles(
    page: int = Query(default=1, ge=1),
    state_code: Optional[str] = Query(None, description="State code filter, e.g. KA"),
):
    """List stamp duty articles (filtered to allowed article codes only)."""
    svc = _get_contract_service()
    try:
        result = await svc.get_articles(page=page, state_code=state_code)
        raw_data = result.get("data", {})
        if isinstance(raw_data, dict) and isinstance(raw_data.get("content"), list):
            raw_data["content"] = [
                a for a in raw_data["content"]
                if a.get("article_code") in ALLOWED_ARTICLE_CODES
            ]
        return ContractOrderResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get articles error: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch articles: {e}")


@router.get("/contracts/branches", response_model=ContractOrderResponse)
async def get_branches(
    branch_ids: Optional[str] = Query(None, description="Comma-separated branch IDs"),
):
    """Get branch details by branch IDs."""
    svc = _get_contract_service()
    try:
        result = await svc.get_branches(branch_ids)
        return ContractOrderResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get branches error: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch branches: {e}")


@router.get("/contracts/orders", response_model=ContractOrderResponse)
async def get_orders(
    order_ids: Optional[str] = Query(None),
    detail: int = Query(default=1, ge=0, le=1),
    page_number: int = Query(default=1, ge=1),
):
    """List/query orders by order IDs."""
    svc = _get_contract_service()
    try:
        result = await svc.get_orders(order_ids, detail, page_number)
        return ContractOrderResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get orders error: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch orders: {e}")


@router.get("/contracts/orders/{order_id}/documents", response_model=ContractOrderResponse)
async def get_order_documents(order_id: int):
    """Get documents for a specific order."""
    svc = _get_contract_service()
    try:
        result = await svc.get_order_documents(order_id)
        return ContractOrderResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get order documents error: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch order documents: {e}")
