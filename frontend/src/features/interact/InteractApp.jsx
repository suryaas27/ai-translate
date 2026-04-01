import { useState, useRef, useEffect } from 'react';
import { Upload, Loader2, AlertCircle, Send, FileText, Trash2 } from 'lucide-react';
import { FEATURE_URLS } from '../../config';

const InteractApp = () => {
  const [file, setFile] = useState(null);
  const [docId, setDocId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    const name = f?.name?.toLowerCase() || '';
    if (f && (name.endsWith('.pdf') || name.endsWith('.docx'))) {
      setFile(f);
      setError(null);
    } else {
      setError('Please select a valid .pdf or .docx file');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setDocId(null);
    setHistory([]);
    setUploadInfo(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${FEATURE_URLS.interact}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Upload failed');
      }
      const data = await res.json();
      setDocId(data.document_id);
      setUploadInfo(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim() || !docId || answering) return;
    const q = question.trim();
    setQuestion('');
    setAnswering(true);
    setError(null);

    const newHistory = [...history, { role: 'user', content: q }];
    setHistory(newHistory);

    try {
      const res = await fetch(`${FEATURE_URLS.interact}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: docId,
          question: q,
          history: history.slice(-6),
          llm_provider: 'anthropic',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Request failed');
      }
      const data = await res.json();
      setHistory([...newHistory, { role: 'assistant', content: data.answer }]);
    } catch (e) {
      setError(e.message);
      setHistory(newHistory); // keep user message
    } finally {
      setAnswering(false);
    }
  };

  const handleClear = () => {
    setHistory([]);
    setError(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-textPrimary)' }}>
          Interact with Document
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-textSecondary)' }}>
          Upload a document, then ask questions — AI answers from the content.
        </p>
      </div>

      {/* Upload section */}
      {!docId ? (
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-dashed p-8 text-center"
            style={{ borderColor: 'var(--color-primaryLight)', backgroundColor: 'var(--color-surface)' }}>
            <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
            <label className="cursor-pointer">
              <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                {file ? file.name : 'Click to upload PDF or DOCX'}
              </span>
              <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
            </label>
            {file && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-textSecondary)' }}>
                {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading & Indexing…
              </span>
            ) : 'Upload Document'}
          </button>
        </div>
      ) : (
        /* Chat section */
        <div className="space-y-4">
          {/* Doc info bar */}
          <div className="flex items-center justify-between rounded-lg px-4 py-2"
            style={{ backgroundColor: 'var(--color-primaryLight)' }}>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                {uploadInfo?.filename}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-textSecondary)' }}>
                ({(uploadInfo?.char_count || 0).toLocaleString()} chars)
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleClear} title="Clear chat"
                className="p-1 rounded hover:opacity-70" style={{ color: 'var(--color-textSecondary)' }}>
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => { setDocId(null); setFile(null); setHistory([]); setUploadInfo(null); }}
                className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-primary)' }}>
                Change document
              </button>
            </div>
          </div>

          {/* Chat history */}
          <div className="rounded-xl overflow-hidden flex flex-col"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid #e5e7eb', minHeight: '360px', maxHeight: '480px' }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>
                    Ask anything about your document
                  </p>
                </div>
              )}
              {history.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm"
                    style={msg.role === 'user'
                      ? { backgroundColor: 'var(--color-primary)', color: 'white' }
                      : { backgroundColor: 'var(--color-bg)', color: 'var(--color-textPrimary)', border: '1px solid #e5e7eb' }}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {answering && (
                <div className="flex justify-start">
                  <div className="rounded-xl px-4 py-2.5" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid #e5e7eb' }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--color-primary)' }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t p-3 flex gap-2" style={{ borderColor: '#e5e7eb' }}>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAsk()}
                placeholder="Ask a question about the document…"
                disabled={answering}
                className="flex-1 text-sm px-3 py-2 rounded-lg border outline-none"
                style={{ borderColor: '#e5e7eb', backgroundColor: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
              />
              <button
                onClick={handleAsk}
                disabled={!question.trim() || answering}
                className="px-3 py-2 rounded-lg disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InteractApp;
