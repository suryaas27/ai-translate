import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

from llm_client import LLMClient
from doc_reader import extract_text

app = FastAPI(title="AI Interact")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = LLMClient()

# In-memory document store: {doc_id: {"text": str, "filename": str}}
_doc_store: dict = {}


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    document_id: str
    question: str
    history: List[ChatMessage] = []
    llm_provider: Optional[str] = "anthropic"


@app.get("/")
def root():
    return {"status": "running", "service": "ai-interact", "version": "1.0.0"}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Ingest a document for Q&A. Returns a document_id to use in /chat."""
    content = await file.read()
    try:
        text = extract_text(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract any text from the document.")

    doc_id = str(uuid.uuid4())
    _doc_store[doc_id] = {"text": text, "filename": file.filename}
    print(f"[Interact] Stored doc_id={doc_id}, filename={file.filename}, chars={len(text)}")
    return {"document_id": doc_id, "filename": file.filename, "char_count": len(text)}


@app.post("/chat")
async def chat_with_document(request: ChatRequest):
    """Ask a question about a previously uploaded document."""
    doc = _doc_store.get(request.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{request.document_id}' not found. Upload it first.")

    # Build conversation history string
    history_str = ""
    if request.history:
        lines = []
        for msg in request.history[-6:]:  # last 6 turns for context
            role = "User" if msg.role == "user" else "Assistant"
            lines.append(f"{role}: {msg.content}")
        history_str = "\n".join(lines) + "\n"

    system = (
        "You are an expert document analyst. Answer questions based ONLY on the provided document. "
        "If the answer is not in the document, say so clearly. Be concise and accurate."
    )
    user = (
        f"Document:\n{doc['text'][:10000]}\n\n"
        f"{history_str}"
        f"User: {request.question}\nAssistant:"
    )

    try:
        answer = llm.call(system, user, provider=request.llm_provider or "anthropic")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {e}")

    return {
        "answer": answer.strip(),
        "document_id": request.document_id,
        "provider": request.llm_provider,
    }


@app.delete("/document/{document_id}")
async def delete_document(document_id: str):
    """Remove an ingested document from the store."""
    if document_id not in _doc_store:
        raise HTTPException(status_code=404, detail=f"Document '{document_id}' not found.")
    del _doc_store[document_id]
    return {"deleted": document_id}
