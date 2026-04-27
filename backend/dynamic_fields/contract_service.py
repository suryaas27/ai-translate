"""Contract service — wraps the Contract API client and adds execution metadata."""

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from dynamic_fields.contract_client import contract_client


class ContractService:

    def generate_execution_id(self) -> str:
        date_str = datetime.now().strftime('%Y%m%d')
        unique_id = uuid.uuid4().hex[:5].upper()
        return f"CTR-{date_str}-{unique_id}"

    def generate_reference_id(self) -> str:
        date_str = datetime.now().strftime('%Y%m%d')
        unique_id = uuid.uuid4().hex[:8].upper()
        return f"DFP-{date_str}-{unique_id}"

    def get_timestamp(self) -> str:
        return datetime.now().strftime("%d-%b-%Y, %I:%M %p IST")

    def _wrap_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "execution_id": self.generate_execution_id(),
            "timestamp": self.get_timestamp(),
            "data": data,
        }

    async def create_order_from_pdf(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        for detail in payload.get("order_details", []):
            detail["referance_id"] = self.generate_reference_id()
        data = await contract_client.create_order_from_pdf(payload)
        return self._wrap_response(data)

    async def get_articles(self, page: int = 1, state_code: Optional[str] = None) -> Dict[str, Any]:
        data = await contract_client.get_articles(page=page, state_code=state_code)
        return self._wrap_response(data)

    async def get_stamp_types(
        self,
        state_code: str,
        article_id: int,
        consideration_amount: float,
        account_id: int,
        sync: bool = True,
    ) -> Dict[str, Any]:
        data = await contract_client.get_stamp_types(
            state_code=state_code,
            article_id=article_id,
            consideration_amount=consideration_amount,
            account_id=account_id,
            sync=sync,
        )
        return self._wrap_response(data)

    async def get_branches(self, branch_ids: str) -> Dict[str, Any]:
        data = await contract_client.get_branches(branch_ids)
        return self._wrap_response(data)

    async def get_orders(self, order_ids: Optional[str], detail: int = 1, page_number: int = 1) -> Dict[str, Any]:
        data = await contract_client.get_orders(order_ids, detail, page_number)
        return self._wrap_response(data)

    async def get_order_documents(self, order_id: int) -> Dict[str, Any]:
        data = await contract_client.get_order_documents(order_id)
        return self._wrap_response(data)


contract_service = ContractService()
