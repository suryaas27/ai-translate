"""Pydantic models for dynamic field plugin — template and contract/order creation."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# ── Template ──────────────────────────────────────────────────────────────────

class TemplateField(BaseModel):
    id: str      # e.g. "field_0"
    label: str   # e.g. "Employee Name"


class TemplateResult(BaseModel):
    fields: List[TemplateField]
    template_text: str


# ── Contract / eStamp / eSign ─────────────────────────────────────────────────

class EStampDetail(BaseModel):
    first_party_name: str
    second_party_name: str
    consideration_amount: Optional[float] = None
    stamp_duty_amount: int
    stamp_duty_paid_by: str
    article_id: int
    description: str
    execution_date: int             # unix milliseconds
    process_type: Optional[str] = None


class ESignPartyUser(BaseModel):
    email: str
    name: str
    contact_number: str
    sign_position: str
    method: str
    position_details: Optional[Dict[str, Any]] = None
    pages: str
    signatory_sequence: int
    send_document: bool
    send_notification: bool
    remark: str
    reminder: int
    schedule_timestamp: str
    esign_otp: bool
    additional_fields: Optional[Dict[str, Any]] = None
    aadhaar_digits: Optional[str] = None
    server_side_siganture: bool
    cc_emails: List[str]
    sign_mode: str


class ESignConfig(BaseModel):
    party_users: List[ESignPartyUser]
    witness_users: List[ESignPartyUser]


class OrderDetail(BaseModel):
    branch_id: str
    account_id: Optional[int] = None
    referance_id: Optional[str] = None
    contract_expiry_date: Optional[str] = None
    estamps: Optional[List[EStampDetail]] = None
    esigns: Optional[ESignConfig] = None
    general_fields: Optional[Dict[str, Any]] = None


class CreateOrderUploadRequest(BaseModel):
    document: str                   # base64-encoded PDF data URL
    file_name: str
    is_bulk: bool = False
    multi_document: Optional[str] = None
    order_details: List[OrderDetail]
    workflow_execution_id: Optional[str] = None


class ContractOrderResponse(BaseModel):
    execution_id: str
    timestamp: str
    data: Any
