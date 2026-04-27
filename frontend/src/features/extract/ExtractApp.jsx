import { useState } from 'react';
import { Upload, Loader2, AlertCircle, Plus, X, Table } from 'lucide-react';
import { FEATURE_URLS } from '../../config';

const PRESET_FIELDS = [
  'borrower_name', 'loan_amount', 'interest_rate', 'emi', 'tenure',
  'lender_name', 'date', 'pan_number', 'property_address', 'guarantor_name',
];

const ExtractApp = () => {
  const [file, setFile] = useState(null);
  const [fields, setFields] = useState(['borrower_name', 'loan_amount', 'date']);
  const [newField, setNewField] = useState('');
  const [mode, setMode] = useState('fields'); // 'fields' | 'tables'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    const name = f?.name?.toLowerCase() || '';
    if (f && (name.endsWith('.pdf') || name.endsWith('.docx'))) {
      setFile(f);
      setError(null);
      setResult(null);
    } else {
      setError('Please select a valid .pdf or .docx file');
      setFile(null);
    }
  };

  const addField = (field) => {
    const f = field.trim().toLowerCase().replace(/\s+/g, '_');
    if (f && !fields.includes(f)) setFields([...fields, f]);
    setNewField('');
  };

  const removeField = (f) => setFields(fields.filter((x) => x !== f));

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('llm_provider', 'anthropic');

    let endpoint = '/extract-table';
    if (mode === 'fields') {
      formData.append('fields', JSON.stringify(fields));
      endpoint = '/extract';
    }

    try {
      const res = await fetch(`${FEATURE_URLS.extract}${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Request failed');
      }
      const data = await res.json();
      setResult(data);
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
          Extract Data
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-textSecondary)' }}>
          Extract structured fields or tables from PDF and DOCX documents.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        {[{ id: 'fields', label: 'Extract Fields' }, { id: 'tables', label: 'Extract Tables' }].map((m) => (
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

      {/* Field configuration */}
      {mode === 'fields' && (
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid #e5e7eb' }}>
          <h3 className="font-medium text-sm" style={{ color: 'var(--color-textPrimary)' }}>Fields to Extract</h3>

          {/* Current fields */}
          <div className="flex flex-wrap gap-2">
            {fields.map((f) => (
              <span key={f} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: 'var(--color-primaryLight)', color: 'var(--color-primary)' }}>
                {f}
                <button onClick={() => removeField(f)} className="hover:opacity-60">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Add custom field */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newField}
              onChange={(e) => setNewField(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addField(newField)}
              placeholder="Add custom field (e.g. loan_amount)"
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
              style={{ borderColor: '#e5e7eb', backgroundColor: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
            />
            <button
              onClick={() => addField(newField)}
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Presets */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--color-textSecondary)' }}>Common fields:</p>
            <div className="flex flex-wrap gap-1">
              {PRESET_FIELDS.filter((f) => !fields.includes(f)).map((f) => (
                <button key={f} onClick={() => addField(f)}
                  className="px-2 py-1 rounded text-xs border transition hover:opacity-70"
                  style={{ borderColor: '#e5e7eb', color: 'var(--color-textSecondary)' }}>
                  + {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!file || loading || (mode === 'fields' && fields.length === 0)}
        className="w-full py-3 rounded-xl font-semibold text-white transition disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Extracting…
          </span>
        ) : mode === 'tables' ? 'Extract Tables' : 'Extract Fields'}
      </button>

      {/* Field results */}
      {result?.extracted && typeof result.extracted === 'object' && !Array.isArray(result.extracted) && (
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #e5e7eb' }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--color-primaryLight)' }}>
              <tr>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-primary)' }}>Field</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-primary)' }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.extracted).map(([key, val], i) => (
                <tr key={key} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-textPrimary)' }}>
                    {key.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3" style={{ color: val ? 'var(--color-textPrimary)' : 'var(--color-textSecondary)' }}>
                    {val ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Table results */}
      {result?.tables && result.tables.map((tbl, ti) => (
        <div key={ti} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
          {tbl.title && (
            <div className="px-4 py-2 font-medium text-sm flex items-center gap-2"
              style={{ backgroundColor: 'var(--color-primaryLight)', color: 'var(--color-primary)' }}>
              <Table className="w-4 h-4" />
              {tbl.title}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {tbl.headers?.length > 0 && (
                <thead style={{ backgroundColor: 'var(--color-bg)' }}>
                  <tr>
                    {tbl.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-semibold border-b"
                        style={{ color: 'var(--color-textPrimary)', borderColor: '#e5e7eb' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {tbl.rows?.map((row, ri) => (
                  <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)' }}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 border-b"
                        style={{ color: 'var(--color-textPrimary)', borderColor: '#f3f4f6' }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ExtractApp;
