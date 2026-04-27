import { useState } from 'react';
import { FileText, Loader2, Upload, AlertCircle } from 'lucide-react';
import { FEATURE_URLS } from '../../config';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'te', name: 'Telugu' },
  { code: 'mr', name: 'Marathi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ta', name: 'Tamil' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'pa', name: 'Punjabi' },
];

const LENGTH_OPTIONS = [
  { value: 'short',  label: 'Short',  desc: '2–3 sentences' },
  { value: 'medium', label: 'Medium', desc: '3–5 paragraphs' },
  { value: 'long',   label: 'Long',   desc: 'Detailed' },
];

const SummaryApp = () => {
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState('en');
  const [length, setLength] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [sections, setSections] = useState(null);
  const [mode, setMode] = useState('summary'); // 'summary' | 'sections'

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    const name = f?.name?.toLowerCase() || '';
    if (f && (name.endsWith('.pdf') || name.endsWith('.docx'))) {
      setFile(f);
      setError(null);
      setSummary(null);
      setSections(null);
    } else {
      setError('Please select a valid .pdf or .docx file');
      setFile(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    setSections(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);
    formData.append('llm_provider', 'anthropic');

    const endpoint = mode === 'sections' ? '/summarize-sections' : '/summarize';
    if (mode === 'summary') formData.append('length', length);

    try {
      const res = await fetch(`${FEATURE_URLS.summary}${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Request failed');
      }
      const data = await res.json();
      if (mode === 'sections') {
        setSections(data.sections);
      } else {
        setSummary(data.summary);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-textPrimary)' }}>
          Document Summary
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-textSecondary)' }}>
          Generate AI-powered summaries of PDF and DOCX documents.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        {['summary', 'sections'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition"
            style={mode === m
              ? { backgroundColor: 'var(--color-primary)', color: 'white' }
              : { backgroundColor: 'var(--color-surface)', color: 'var(--color-textSecondary)', border: '1px solid #e5e7eb' }}
          >
            {m === 'summary' ? 'Full Summary' : 'Section Summaries'}
          </button>
        ))}
      </div>

      {/* Upload */}
      <div className="rounded-xl border-2 border-dashed p-5 sm:p-8 text-center" style={{ borderColor: 'var(--color-primaryLight)', backgroundColor: 'var(--color-surface)' }}>
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

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-textPrimary)' }}>
            Output Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            style={{ borderColor: '#e5e7eb', backgroundColor: 'var(--color-surface)', color: 'var(--color-textPrimary)' }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </div>

        {mode === 'summary' && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-textPrimary)' }}>
              Summary Length
            </label>
            <div className="flex gap-2">
              {LENGTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLength(opt.value)}
                  title={opt.desc}
                  className="flex-1 py-2 rounded-lg text-xs font-medium border transition"
                  style={length === opt.value
                    ? { backgroundColor: 'var(--color-primary)', color: 'white', borderColor: 'var(--color-primary)' }
                    : { backgroundColor: 'var(--color-surface)', color: 'var(--color-textSecondary)', borderColor: '#e5e7eb' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!file || loading}
        className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Summarizing…
          </span>
        ) : (
          mode === 'sections' ? 'Generate Section Summaries' : 'Generate Summary'
        )}
      </button>

      {/* Results */}
      {summary && (
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid #e5e7eb' }}>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--color-textPrimary)' }}>Summary</h3>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-textPrimary)' }}>
            {summary}
          </p>
        </div>
      )}

      {sections && (
        <div className="space-y-4">
          {sections.map((section, i) => (
            <div key={i} className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid #e5e7eb' }}>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--color-primary)' }}>
                {section.heading}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-textPrimary)' }}>
                {section.summary}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SummaryApp;
