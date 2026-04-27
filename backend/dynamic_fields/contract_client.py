"""HTTP client for the Doqfy Contract Execution API."""

import asyncio
import logging
import os
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


class ContractClient:
    """Client for Doqfy Contract Execution API."""

    def __init__(self):
        self.base_url = os.getenv("CONTRACT_API_BASE_URL", "https://uat-api.doqfy.in")
        self.api_key = os.environ["CONTRACT_API_KEY"]
        self.secret_key = os.environ["CONTRACT_SECRET_KEY"]
        self.max_retries = 3
        self.retry_delay = 2
        timeout = int(os.getenv("CONTRACT_API_TIMEOUT", "30"))

        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=5.0),
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=50),
        )

    async def close(self):
        await self.client.aclose()

    def _get_headers(self) -> Dict[str, str]:
        return {
            "api-key": self.api_key,
            "secret-key": self.secret_key,
            "Content-Type": "application/json",
        }

    async def _make_request(
        self,
        endpoint: str,
        payload: Optional[Dict[str, Any]] = None,
        method: str = "POST",
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers()
        logger.info("Contract API %s %s", method, endpoint)

        for attempt in range(self.max_retries):
            try:
                if method == "POST":
                    response = await self.client.post(url, json=payload or {}, headers=headers)
                elif method == "GET":
                    response = await self.client.get(url, headers=headers, params=params or {})
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")

                if response.status_code in (200, 201):
                    return response.json()

                if response.status_code == 401:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Contract API authentication failed — check API credentials",
                    )

                if response.status_code == 429:
                    if attempt < self.max_retries - 1:
                        await asyncio.sleep(self.retry_delay * (attempt + 1))
                        continue
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Rate limit exceeded — please try again later",
                    )

                try:
                    error_data = response.json()
                    if response.status_code == 400:
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_data)
                    error_msg = error_data.get("message", "Contract API request failed")
                except HTTPException:
                    raise
                except Exception:
                    error_msg = f"API error with status {response.status_code}"

                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay)
                    continue

                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=error_msg)

            except httpx.TimeoutException:
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay)
                    continue
                raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Contract service timeout")

            except httpx.NetworkError:
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay)
                    continue
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unable to reach contract service")

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Contract API request failed after {self.max_retries} attempts",
        )

    # ── API methods ────────────────────────────────────────────────────────────

    async def create_order_from_pdf(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return await self._make_request("/order/cat/upload/", payload)

    async def get_articles(self, page: int = 1, state_code: Optional[str] = None) -> Dict[str, Any]:
        params: Dict[str, Any] = {"page": page}
        if state_code:
            params["state_code"] = state_code
        return await self._make_request("/articles/", method="GET", params=params)

    async def get_stamp_types(
        self,
        state_code: str,
        article_id: int,
        consideration_amount: float,
        account_id: int,
        sync: bool = True,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "state_code": state_code,
            "article_id": article_id,
            "consideration_amount": consideration_amount,
            "sync": str(sync).lower(),
            "account_id": account_id,
        }
        return await self._make_request("/estamp/state-stamp-type/", method="GET", params=params)

    async def get_branches(self, branch_ids: Optional[str] = None) -> Dict[str, Any]:
        params: Dict[str, Any] = {}
        if branch_ids:
            params["branch_id"] = branch_ids
        return await self._make_request("/account/branch/", method="GET", params=params)

    async def get_orders(self, order_ids: Optional[str], detail: int = 1, page_number: int = 1) -> Dict[str, Any]:
        params: Dict[str, Any] = {"detail": detail, "page_number": page_number}
        if order_ids:
            params["order_ids"] = order_ids
        return await self._make_request("/order/orders/", method="GET", params=params)

    async def get_order_documents(self, order_id: int) -> Dict[str, Any]:
        return await self._make_request("/order/order_document/", method="GET", params={"order_id": order_id})


contract_client = ContractClient()
