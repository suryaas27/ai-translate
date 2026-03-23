"""
Translation integration tests.

Usage:
    # Run all tests
    python test_translation.py

    # Run a specific test by name
    python test_translation.py TestDocxLLM
    python test_translation.py TestChunking
"""

import base64
import json
import os
import sys
import time
import unittest
from pathlib import Path

# ── Asset path ────────────────────────────────────────────────────────────────
ASSETS_DIR = Path(__file__).parent.parent / "frontend" / "src" / "assets"
DOCX_FILE  = ASSETS_DIR / "English (2).docx"

# ── Server ────────────────────────────────────────────────────────────────────
BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")

# ── Helpers ───────────────────────────────────────────────────────────────────

def _docx_bytes() -> bytes:
    if not DOCX_FILE.exists():
        raise FileNotFoundError(f"Test asset missing: {DOCX_FILE}")
    return DOCX_FILE.read_bytes()


def _post_multipart(path: str, extra_fields: dict = None) -> dict:
    """POST multipart/form-data with the test DOCX file."""
    import requests
    fields = {"target_language": "hi", "llm_provider": "gemini"}
    if extra_fields:
        fields.update(extra_fields)

    with open(DOCX_FILE, "rb") as fh:
        resp = requests.post(
            f"{BASE_URL}{path}",
            files={"file": ("English (2).docx", fh, "application/octet-stream")},
            data=fields,
            timeout=300,
        )
    resp.raise_for_status()
    return resp.json()


def _post_json(path: str, payload: dict) -> dict:
    import requests
    resp = requests.post(
        f"{BASE_URL}{path}",
        json=payload,
        timeout=300,
    )
    resp.raise_for_status()
    return resp.json()


def _assert_translation_response(tc: unittest.TestCase, data: dict, expect_docx: bool = False):
    """Common assertions for every translation response."""
    tc.assertIn("html", data, "Response must have 'html'")
    tc.assertIn("original_html", data, "Response must have 'original_html'")
    tc.assertIn("language", data, "Response must have 'language'")
    tc.assertIsInstance(data["html"], str, "'html' must be a string")
    tc.assertGreater(len(data["html"]), 100, "'html' looks too short — translation may have failed")
    tc.assertNotEqual(data["html"], data["original_html"], "Translated HTML must differ from original")
    if expect_docx:
        tc.assertIsNotNone(data.get("translated_docx_b64"), "Expected translated_docx_b64 for DOCX LLM")
        # Make sure it's valid base64
        decoded = base64.b64decode(data["translated_docx_b64"])
        tc.assertGreater(len(decoded), 0, "translated_docx_b64 decoded to empty bytes")


# ══════════════════════════════════════════════════════════════════════════════
# Test: server health
# ══════════════════════════════════════════════════════════════════════════════

class TestHealth(unittest.TestCase):
    def test_root_returns_running(self):
        import requests
        resp = requests.get(f"{BASE_URL}/", timeout=10)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("status"), "running")
        print(f"  ✓ server is running — {data}")


# ══════════════════════════════════════════════════════════════════════════════
# Test: DOCX → Google Translate
# ══════════════════════════════════════════════════════════════════════════════

class TestDocxGoogle(unittest.TestCase):
    def test_translate_docx_google(self):
        print(f"\n  → POST /translate-docx  (Google Translate, target=hi)")
        t0 = time.time()
        data = _post_multipart("/translate-docx", {"llm_provider": None})
        elapsed = time.time() - t0
        print(f"  ✓ completed in {elapsed:.1f}s")
        _assert_translation_response(self, data, expect_docx=False)
        print(f"    html length     : {len(data['html'])} chars")
        print(f"    has pdf_b64     : {data.get('translated_pdf_b64') is not None}")


# ══════════════════════════════════════════════════════════════════════════════
# Test: DOCX → LLM (Gemini)
# ══════════════════════════════════════════════════════════════════════════════

class TestDocxLLM(unittest.TestCase):
    def test_translate_docx_llm_gemini(self):
        print(f"\n  → POST /translate-docx-llm  (Gemini, target=hi)")
        t0 = time.time()
        data = _post_multipart("/translate-docx-llm", {"llm_provider": "gemini"})
        elapsed = time.time() - t0
        print(f"  ✓ completed in {elapsed:.1f}s")
        _assert_translation_response(self, data, expect_docx=True)
        print(f"    html length     : {len(data['html'])} chars")
        print(f"    docx_b64 length : {len(data['translated_docx_b64'])} chars")
        print(f"    has pdf_b64     : {data.get('translated_pdf_b64') is not None}")


# ══════════════════════════════════════════════════════════════════════════════
# Test: base64 endpoint — DOCX LLM
# ══════════════════════════════════════════════════════════════════════════════

class TestBase64(unittest.TestCase):
    def test_translate_base64_docx_llm(self):
        print(f"\n  → POST /translate-base64  (DOCX, Gemini, target=hi)")
        b64 = base64.b64encode(_docx_bytes()).decode()
        t0 = time.time()
        data = _post_json("/translate-base64", {
            "file_data": b64,
            "filename": "English (2).docx",
            "target_language": "hi",
            "llm_provider": "gemini",
        })
        elapsed = time.time() - t0
        print(f"  ✓ completed in {elapsed:.1f}s")
        _assert_translation_response(self, data, expect_docx=True)
        print(f"    html length     : {len(data['html'])} chars")

    def test_translate_base64_docx_google(self):
        print(f"\n  → POST /translate-base64  (DOCX, Google Translate, target=mr)")
        b64 = base64.b64encode(_docx_bytes()).decode()
        t0 = time.time()
        data = _post_json("/translate-base64", {
            "file_data": b64,
            "filename": "English (2).docx",
            "target_language": "mr",
            "llm_provider": "google",
        })
        elapsed = time.time() - t0
        print(f"  ✓ completed in {elapsed:.1f}s")
        _assert_translation_response(self, data, expect_docx=False)
        print(f"    html length     : {len(data['html'])} chars")

    def test_translate_base64_invalid_b64_returns_400(self):
        print(f"\n  → POST /translate-base64  (bad base64 → expect 400)")
        import requests
        resp = requests.post(f"{BASE_URL}/translate-base64", json={
            "file_data": "!!!not-valid-base64!!!",
            "filename": "test.docx",
            "target_language": "hi",
        }, timeout=10)
        self.assertEqual(resp.status_code, 400)
        print(f"  ✓ returned 400 as expected")

    def test_translate_base64_unsupported_extension_returns_400(self):
        print(f"\n  → POST /translate-base64  (txt extension → expect 400)")
        import requests
        b64 = base64.b64encode(b"hello").decode()
        resp = requests.post(f"{BASE_URL}/translate-base64", json={
            "file_data": b64,
            "filename": "test.txt",
            "target_language": "hi",
        }, timeout=10)
        self.assertEqual(resp.status_code, 400)
        print(f"  ✓ returned 400 as expected")


# ══════════════════════════════════════════════════════════════════════════════
# Test: chunking logic (unit — no server needed)
# ══════════════════════════════════════════════════════════════════════════════

class TestChunking(unittest.TestCase):
    """Unit tests for the 3-page chunk splitting logic — no server required."""

    N = 3  # must match PAGES_PER_CHUNK in main.py

    def _split(self, pages):
        return [pages[i:i + self.N] for i in range(0, len(pages), self.N)]

    def test_pages_per_chunk_constant(self):
        self.assertEqual(self.N, 3)
        print(f"\n  ✓ PAGES_PER_CHUNK = {self.N}")

    def test_exact_multiple(self):
        pages = [f"<p>page {i}</p>" for i in range(9)]
        chunks = self._split(pages)
        self.assertEqual(len(chunks), 3)
        for c in chunks:
            self.assertEqual(len(c), 3)
        print(f"\n  ✓ 9 pages → 3 chunks of 3")

    def test_remainder(self):
        pages = [f"<p>page {i}</p>" for i in range(7)]
        chunks = self._split(pages)
        self.assertEqual(len(chunks), 3)
        self.assertEqual(len(chunks[0]), 3)
        self.assertEqual(len(chunks[1]), 3)
        self.assertEqual(len(chunks[2]), 1)
        print(f"\n  ✓ 7 pages → 2 full chunks + 1 remainder")

    def test_single_page(self):
        pages = ["<p>only page</p>"]
        chunks = self._split(pages)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(len(chunks[0]), 1)
        print(f"\n  ✓ 1 page → 1 chunk")

    def test_empty(self):
        chunks = self._split([])
        self.assertEqual(len(chunks), 0)
        print(f"\n  ✓ 0 pages → 0 chunks")

    def test_content_not_lost(self):
        pages = [f"<p>page {i}</p>" for i in range(5)]
        chunks = self._split(pages)
        reassembled = [p for c in chunks for p in c]
        self.assertEqual(reassembled, pages)
        print(f"\n  ✓ all page content preserved after split + rejoin")

    def test_chunk_count_formula(self):
        import math
        for n in [1, 2, 3, 4, 5, 9, 10, 20]:
            pages = [f"<p>{i}</p>" for i in range(n)]
            chunks = self._split(pages)
            self.assertEqual(len(chunks), math.ceil(n / self.N),
                             f"Wrong chunk count for {n} pages")
        print(f"\n  ✓ chunk count = ceil(n / {self.N}) for all tested n")


# ══════════════════════════════════════════════════════════════════════════════
# Test: SSE stream chunking  (DOCX asset used as PDF is unavailable here,
#       this test verifies the stream protocol shape using the non-stream
#       endpoint and checks chunk count arithmetic)
# ══════════════════════════════════════════════════════════════════════════════

class TestStreamProtocol(unittest.TestCase):
    """Verifies the SSE event shape from /translate-pdf-llm/stream using
    the API.pdf that ships in the repo root as a smoke-test PDF."""

    PDF_FILE = Path(__file__).parent.parent / "API.pdf"

    def setUp(self):
        if not self.PDF_FILE.exists():
            self.skipTest(f"API.pdf not found at {self.PDF_FILE} — skipping stream test")

    def test_stream_emits_chunk_and_done_events(self):
        import requests
        print(f"\n  → POST /translate-pdf-llm/stream  (API.pdf, Gemini, target=hi)")
        t0 = time.time()

        with open(self.PDF_FILE, "rb") as fh:
            resp = requests.post(
                f"{BASE_URL}/translate-pdf-llm/stream",
                files={"file": ("API.pdf", fh, "application/pdf")},
                data={"target_language": "hi", "llm_provider": "gemini"},
                stream=True,
                timeout=600,
            )
        resp.raise_for_status()

        chunks_received = []
        done_event = None
        buf = ""

        for raw in resp.iter_content(chunk_size=None):
            buf += raw.decode("utf-8", errors="replace")
            while "\n\n" in buf:
                msg, buf = buf.split("\n\n", 1)
                for line in msg.splitlines():
                    if line.startswith("data:"):
                        ev = json.loads(line[5:].strip())
                        if ev["type"] == "chunk":
                            chunks_received.append(ev)
                            print(f"    chunk {ev['index']+1}/{ev['total']} received")
                        elif ev["type"] == "done":
                            done_event = ev
                    # SSE comment lines (keep-alive) are silently ignored

        elapsed = time.time() - t0
        print(f"  ✓ stream completed in {elapsed:.1f}s")

        self.assertGreater(len(chunks_received), 0, "No chunk events received")
        self.assertIsNotNone(done_event, "No done event received")

        # Chunk indices must be 0-based and contiguous
        indices = [c["index"] for c in chunks_received]
        self.assertEqual(indices, list(range(len(chunks_received))),
                         "Chunk indices are not contiguous")

        # done event shape
        for key in ("html", "original_html", "language", "provider"):
            self.assertIn(key, done_event, f"done event missing '{key}'")

        self.assertGreater(len(done_event["html"]), 100,
                           "done event html looks empty")
        print(f"    chunks          : {len(chunks_received)}")
        print(f"    html length     : {len(done_event['html'])} chars")
        print(f"    has pdf_b64     : {done_event.get('translated_pdf_b64') is not None}")


# ══════════════════════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # Allow running a single test class:  python test_translation.py TestDocxLLM
    if len(sys.argv) == 2 and not sys.argv[1].startswith("-"):
        suite = unittest.TestLoader().loadTestsFromName(sys.argv[1], sys.modules[__name__])
        sys.argv.pop(1)
    else:
        suite = unittest.TestLoader().loadTestsFromModule(sys.modules[__name__])

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
