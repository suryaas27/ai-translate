import { useState } from 'react';
import { Upload, Loader2, AlertCircle, FileText } from 'lucide-react';
import { FEATURE_URLS } from '../../config';

const ComparisonApp = () => {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [mode, setMode] = useState('semantic'); // 'semantic' | 'text'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFile = (setter) => (e) => {
    const f = e.target.files[0];
    const name = f?.name?.toLowerCase() || '';
    if (f && (name.endsWith('.pdf') || name.endsWith('.docx'))) {
      setter(f);
      setError(null);
      setResult(null);
    } else {
      setError('Please select a valid .pdf or .docx file');
    }
  };

  const handleCompare = async () => {
    if (!fileA || !fileB) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file_a', fileA);
    formData.append('file_b', fileB);
    formData.append('mode', mode);
    formData.append('llm_provider', 'anthropic');

    try {
      const res = await fetch(`${FEATURE_URLS.comparison}/compare`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Request failed');
      }
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const FileDropZone = ({ label, file, onChange }) => (
    <div className="rounded-xl border-2 border-dashed p-6 text-center flex-1"
      style={{ borderColor: 'var(--color-primaryLight)', backgroundColor: 'var(--color-surface)' }}>
      <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-textSecondary)' }}>{label}</p>
      <label className="cursor-pointer">
        <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
          {file ? file.name : 'Click to upload'}
        </span>
        <input type="file" accept=".pdf,.docx" className="hidden" onChange={onChange} />
      </label>
      {file && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-textSecondary)' }}>
          {(file.size / 1024).toFixed(1)} KB
        </p>
      )}
    </div>
  );

  const semantic = result?.result;
  const textDiff = result?.diff;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-textPrimary)' }}>
          Document Comparison
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-textSecondary)' }}>
          Compare two documents — text diff or AI-powered semantic analysis.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        {[{ id: 'semantic', label: 'Semantic (AI)' }, { id: 'text', label: 'Text Diff' }].map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setResult(null); }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition"
            style={mode === m.id
              ? { backgroundColor: 'var(--color-primary)', color: 'white' }
              : { backgroundColor: 'var(--color-surface)', color: 'var(--color-textSecondary)', border: '1px solid #e5e7eb' }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Upload two files */}
      <div className="flex flex-col sm:flex-row gap-4">
        <FileDropZone label="Document A" file={fileA} onChange={handleFile(setFileA)} />
        <FileDropZone label="Document B" file={fileB} onChange={handleFile(setFileB)} />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleCompare}
        disabled={!fileA || !fileB || loading}
        className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Comparing…
          </span>
        ) : 'Compare Documents'}
      </button>

      {/* Semantic Results */}
      {semantic && (
        <div className="space-y-4">
          {/* Summary + score */}
          <div className="rounded-xl p-5 flex items-start gap-4"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid #e5e7eb' }}>
            <div className="text-center min-w-[72px]">
              <div className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {semantic.similarity_score ?? '—'}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-textSecondary)' }}>similarity</div>
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--color-textPrimary)' }}>Overall</h3>
              <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>{semantic.summary}</p>
            </div>
          </div>

          {/* Differences */}
          {semantic.differences?.length > 0 && (
            <Section title="Key Differences" color="var(--color-primary)">
              <ul className="space-y-1">
                {semantic.differences.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-textPrimary)' }}>
                    <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }} />
                    {d}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {semantic.additions_in_b?.length > 0 && (
              <Section title="Added in B" color="#16a34a">
                <ul className="space-y-1">
                  {semantic.additions_in_b.map((d, i) => (
                    <li key={i} className="text-sm text-green-700">+ {d}</li>
                  ))}
                </ul>
              </Section>
            )}
            {semantic.removals_from_a?.length > 0 && (
              <Section title="Removed from A" color="#dc2626">
                <ul className="space-y-1">
                  {semantic.removals_from_a.map((d, i) => (
                    <li key={i} className="text-sm text-red-700">− {d}</li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>
      )}

      {/* Text Diff Results */}
      {textDiff && (
        <div className="grid grid-cols-2 gap-4">
          <Section title={`Only in ${result.file_a}`} color="#dc2626">
            {textDiff.only_in_a.length === 0
              ? <p className="text-sm text-gray-400">No unique lines</p>
              : textDiff.only_in_a.map((l, i) => (
                  <p key={i} className="text-xs font-mono py-0.5 text-red-700 border-l-2 pl-2 border-red-300">{l}</p>
                ))}
          </Section>
          <Section title={`Only in ${result.file_b}`} color="#16a34a">
            {textDiff.only_in_b.length === 0
              ? <p className="text-sm text-gray-400">No unique lines</p>
              : textDiff.only_in_b.map((l, i) => (
                  <p key={i} className="text-xs font-mono py-0.5 text-green-700 border-l-2 pl-2 border-green-300">{l}</p>
                ))}
          </Section>
        </div>
      )}
    </div>
  );
};

const Section = ({ title, color, children }) => (
  <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid #e5e7eb' }}>
    <h3 className="font-semibold text-sm mb-3" style={{ color }}>
      <FileText className="w-4 h-4 inline mr-1" />
      {title}
    </h3>
    {children}
  </div>
);

export default ComparisonApp;
