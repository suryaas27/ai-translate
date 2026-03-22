# AI Translate — API Integration Guide

**Base URL:** `http://<host>:<port>`
**Default port:** `8000`
**All endpoints accept and return JSON unless noted otherwise.**

---

## Reference

### Supported Languages

| Code | Language |
|------|----------|
| `hi` | Hindi |
| `te` | Telugu |
| `mr` | Marathi |
| `bn` | Bengali |
| `kn` | Kannada |
| `ta` | Tamil |
| `gu` | Gujarati |
| `or` | Odia |
| `ml` | Malayalam |
| `pa` | Punjabi |
| `as` | Assamese |
| `rajasthani` | Rajasthani *(mapped to Hindi internally)* |

### Translation Providers

| `llm_provider` value | Engine |
|----------------------|--------|
| `"gemini"` | Google Gemini 2.0 Flash |
| `"openai"` | OpenAI GPT-4o |
| `"anthropic"` | Anthropic Claude Sonnet |
| `"sarvam"` | Sarvam-1 (Indian languages) |
| `"indictrans2"` | IndicTrans2 by AI4Bharat |
| `"google"` / `null` | Google Cloud Translate v2 |

### Standard Translation Response

All translation endpoints return this shape:

```json
{
  "html": "<translated HTML string>",
  "original_html": "<original HTML string>",
  "language": "hi",
  "provider": "gemini",
  "translated_docx_b64": "<base64 string | null>",
  "translated_pdf_b64": "<base64 string | null>"
}
```

> `translated_docx_b64` is only present for DOCX LLM translations.
> `translated_pdf_b64` may be `null` if PDF rendering failed.

---

## Endpoints

### `GET /`

Health check.

**Response**
```json
{ "status": "running", "service": "ai-translate", "version": "1.0.0" }
```

---

### `POST /translate-docx`

Translate a `.docx` file using **Google Translate**.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | `.docx` file |
| `target_language` | string | No | Language code. Default: `"hi"` |

**Example**
```bash
curl -X POST http://localhost:8000/translate-docx \
  -F "file=@contract.docx" \
  -F "target_language=hi"
```

---

### `POST /translate-docx-llm`

Translate a `.docx` file using an **LLM provider**. Preserves layout, tables, and images natively via python-docx.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | `.docx` file |
| `target_language` | string | No | Language code. Default: `"hi"` |
| `llm_provider` | string | No | Provider key. Default: `"gemini"` |

**Example**
```bash
curl -X POST http://localhost:8000/translate-docx-llm \
  -F "file=@contract.docx" \
  -F "target_language=te" \
  -F "llm_provider=gemini"
```

---

### `POST /translate-pdf`

Translate a `.pdf` file using **Google Translate**.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | `.pdf` file |
| `target_language` | string | No | Language code. Default: `"hi"` |

> `translated_docx_b64` will always be `null` for PDF endpoints.

---

### `POST /translate-pdf-llm`

Translate a `.pdf` file using a **single LLM call**.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | `.pdf` file |
| `target_language` | string | No | Language code. Default: `"hi"` |
| `llm_provider` | string | No | Provider key. Default: `"gemini"` |

---

### `POST /translate-pdf-llm/stream`

Translate a `.pdf` file via LLM and receive the result as a **Server-Sent Event (SSE)** stream. Emits one `done` event when the full translation is complete.

**Request** — `multipart/form-data` (same fields as `/translate-pdf-llm`)

**Response** — `text/event-stream`

Each SSE message is a `data:` line containing a JSON object:

**`done` event**
```json
{
  "type": "done",
  "html": "<full translated HTML>",
  "original_html": "<original HTML>",
  "language": "hi",
  "provider": "gemini",
  "translated_pdf_b64": "<base64 | null>"
}
```

**Example (JavaScript)**
```js
const form = new FormData();
form.append('file', pdfFile);
form.append('target_language', 'hi');
form.append('llm_provider', 'gemini');

const res = await fetch('/translate-pdf-llm/stream', { method: 'POST', body: form });
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  for (const line of buf.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const ev = JSON.parse(line.slice(5).trim());
    if (ev.type === 'done') {
      console.log('Translated HTML:', ev.html);
    }
  }
}
```

---

### `POST /translate-url`

Download a document from a **URL** and translate it. File type is auto-detected from the URL path or `Content-Type` header.

**Request** — `application/json`

```json
{
  "url": "https://example.com/document.pdf",
  "target_language": "hi",
  "llm_provider": "gemini"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Public URL pointing to a `.pdf` or `.docx` file |
| `target_language` | string | No | Language code. Default: `"hi"` |
| `llm_provider` | string/null | No | `null` or `"google"` → Google Translate; any other value → LLM |

**Example**
```bash
curl -X POST http://localhost:8000/translate-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/doc.pdf", "target_language": "mr", "llm_provider": "gemini"}'
```

---

### `POST /translate-base64`

Translate a **base64-encoded** document. File type is detected from the `filename` field.

**Request** — `application/json`

```json
{
  "file_data": "<base64 encoded bytes>",
  "filename": "document.pdf",
  "target_language": "hi",
  "llm_provider": "gemini"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file_data` | string | Yes | Base64-encoded file content |
| `filename` | string | Yes | Must end with `.pdf` or `.docx` — used for type detection only |
| `target_language` | string | No | Language code. Default: `"hi"` |
| `llm_provider` | string/null | No | `null` or `"google"` → Google Translate; any other value → LLM |

**Example (Python)**
```python
import base64, requests

with open("document.docx", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

resp = requests.post("http://localhost:8000/translate-base64", json={
    "file_data": b64,
    "filename": "document.docx",
    "target_language": "hi",
    "llm_provider": "gemini"
})
data = resp.json()
# data["translated_docx_b64"] → base64 of translated .docx
# data["translated_pdf_b64"] → base64 of translated .pdf
```

---

### `POST /evaluate-translation`

Evaluate translation quality using an LLM reviewer/judge.

**Request** — `application/json`

```json
{
  "original_text": "The borrower agrees to repay the loan...",
  "translated_text": "उधारकर्ता ऋण चुकाने के लिए सहमत है...",
  "target_language": "Hindi",
  "reviewer_provider": "gemini"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `original_text` | string | Yes | Source text (plain text) |
| `translated_text` | string | Yes | Translated text to evaluate |
| `target_language` | string | Yes | Language name (e.g. `"Hindi"`) |
| `reviewer_provider` | string | No | `"gemini"` or `"openai"`. Default: `"gemini"` |

**Response**
```json
{
  "score": 8,
  "issues": ["Minor grammatical issue in paragraph 2"],
  "corrections": [
    {
      "incorrect_snippet": "ऋण चुकाने",
      "suggested_fix": "ऋण की अदायगी",
      "reason": "More formal register for legal documents"
    }
  ],
  "suggestion": "Overall accurate. Improve formality of financial terms."
}
```

---

### `POST /save-correction`

Save a human-corrected translation for future fine-tuning. Appends to `data/corrections.jsonl`.

**Request** — `application/json`

```json
{
  "original_text": "...",
  "translated_text": "...",
  "corrected_text": "...",
  "target_language": "hi",
  "provider": "gemini"
}
```

**Response**
```json
{ "status": "success", "message": "Correction saved for future training" }
```

---

### `POST /download-docx`

Convert an HTML string to a `.docx` file and stream it as a download.

**Request** — `application/json`

```json
{
  "html_content": "<html>...</html>",
  "filename": "translated_document.docx"
}
```

**Response** — `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (binary stream)

---

### `POST /download-pdf`

Convert an HTML string to a `.pdf` file and stream it as a download.

**Request** — `application/json`

```json
{
  "html_content": "<html>...</html>",
  "filename": "translated_document.pdf"
}
```

**Response** — `application/pdf` (binary stream)

---

## Error Responses

All errors return:

```json
{ "detail": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request — wrong file type, invalid base64, undetectable URL type |
| `503` | Provider not configured — missing API key in environment |
| `500` | Internal server error — translation or conversion failed |

---

## Environment Variables

| Variable | Required for |
|----------|-------------|
| `GEMINI_API_KEY` | Gemini translator + reviewer |
| `OPENAI_API_KEY` | OpenAI translator + reviewer |
| `ANTHROPIC_API_KEY` | Anthropic translator |
| `SARVAM_API_KEY` | Sarvam translator |
| `INDIC_TRANS2_API_URL` | IndicTrans2 translator |
| `GCP_PROJECT_ID` | Google Cloud Translate (quota project) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud auth (path to service account JSON) |
