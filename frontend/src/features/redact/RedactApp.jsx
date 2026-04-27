import { useState } from 'react';
import { Shield, Upload, Download, Loader2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { FEATURE_URLS } from '../../config';

const ROLES = [
  { value: 'legal_ops',  label: 'Legal Operations',       desc: 'Privileged legal content, counsel notes' },
  { value: 'admin',      label: 'System Administrator',   desc: 'PII, credentials, access keys' },
  { value: 'hr',         label: 'Human Resources',        desc: 'Compensation, performance, personal data' },
  { value: 'finance',    label: 'Finance',                desc: 'Revenue figures, projections, account numbers' },
  { value: 'executive',  label: 'Executive / C-Suite',    desc: 'Minimal — only the most sensitive details' },
  { value: 'external',   label: 'External Party',         desc: 'Maximum — all internal/confidential info' },
];

const EMPTY_ROW = { page: '1', paragraph: '', lines: '' };

function parseLineSpec(spec) {
  const nums = new Set();
  String(spec).split(',').forEach(part => {
    part = part.trim();
    if (part.includes('-')) {
      const [s, e] = part.split('-').map(Number);
      for (let i = s; i <= e; i++) if (!isNaN(i)) nums.add(i);
    } else if (part && !isNaN(Number(part))) {
      nums.add(Number(part));
    }
  });
  return Array.from(nums).sort((a, b) => a - b);
}

function UploadZone({ file, setFile, drag, setDrag, onError }) {
  const accept = '.pdf,.doc,.docx';

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f && /\.(pdf|docx?)$/i.test(f.name)) {
      setFile(f);
      if (onError) onError(null);
    } else {
      if (onError) onError('Please upload a PDF or DOCX file.');
    }
  };

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className="relative cursor-pointer flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-all"
      style={drag
        ? { borderColor: 'var(--color-primary)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }
        : { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }
      }
    >
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files[0];
          if (f) { setFile(f); if (onError) onError(null); }
        }}
      />
      {file ? (
        <>
          <div className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
            <Shield size={24} style={{ color: 'var(--color-primary)' }} />
          </div>
          <p className="font-medium text-center" style={{ color: 'var(--color-textPrimary)' }}>{file.name}</p>
          <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>Click to change file</p>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <Upload size={24} className="text-gray-400" />
          </div>
          <div className="text-center">
            <p className="font-medium" style={{ color: 'var(--color-textPrimary)' }}>Drop your document here</p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-textSecondary)' }}>or click to browse</p>
          </div>
          <div className="flex gap-2">
            {['PDF', 'DOCX', 'DOC'].map(ext => (
              <span key={ext} className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded">{ext}</span>
            ))}
          </div>
        </>
      )}
    </label>
  );
}

export default function RedactApp() {
  const [tab, setTab] = useState('role');         // 'role' | 'custom'
  const [customTab, setCustomTab] = useState('color'); // 'color' | 'position'

  // Role mode
  const [roleFile, setRoleFile] = useState(null);
  const [role, setRole] = useState('legal_ops');
  const [roleDrag, setRoleDrag] = useState(false);

  // Color mode
  const [colorFile, setColorFile] = useState(null);
  const [hexColor, setHexColor] = useState('#FFFF00');
  const [colorDrag, setColorDrag] = useState(false);

  // Position mode
  const [posFile, setPosFile] = useState(null);
  const [posRows, setPosRows] = useState([{ ...EMPTY_ROW }]);
  const [posDrag, setPosDrag] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { url, filename }

  const clearResult = () => setResult(null);

  const triggerDownload = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRedact = async () => {
    setError(null);
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    setLoading(true);

    const formData = new FormData();
    let apiUrl, fileRef;

    try {
      if (tab === 'role') {
        if (!roleFile) throw new Error('Please upload a document first.');
        formData.append('file', roleFile);
        formData.append('role', role);
        apiUrl = `${FEATURE_URLS.redact}/redact-by-role`;
        fileRef = roleFile;
      } else if (customTab === 'color') {
        if (!colorFile) throw new Error('Please upload a document first.');
        if (!hexColor || hexColor.trim() === '#') throw new Error('Please enter a valid hex color.');
        formData.append('file', colorFile);
        formData.append('mode', 'color');
        formData.append('hex_color', hexColor.trim());
        apiUrl = `${FEATURE_URLS.redact}/redact-custom`;
        fileRef = colorFile;
      } else {
        // position mode
        if (!posFile) throw new Error('Please upload a document first.');
        const isPdf = posFile.name.toLowerCase().endsWith('.pdf');
        const positions = posRows
          .filter(r => r.page || r.paragraph || r.lines)
          .map(r => {
            const spec = {};
            if (isPdf && r.page) spec.page = parseInt(r.page, 10);
            if (r.paragraph) spec.paragraph = parseInt(r.paragraph, 10);
            if (r.lines) spec.lines = parseLineSpec(r.lines);
            return spec;
          })
          .filter(s => Object.keys(s).length > 0);

        if (positions.length === 0) throw new Error('Please add at least one position to redact.');
        formData.append('file', posFile);
        formData.append('mode', 'position');
        formData.append('positions_json', JSON.stringify(positions));
        apiUrl = `${FEATURE_URLS.redact}/redact-custom`;
        fileRef = posFile;
      }

      const res = await fetch(apiUrl, { method: 'POST', body: formData });

      if (!res.ok) {
        let detail = `Request failed (${res.status})`;
        try { detail = (await res.json()).detail || detail; } catch {}
        throw new Error(detail);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^";\n]+)"?/);
      const ext = fileRef.name.toLowerCase().endsWith('.pdf') ? '.pdf' : '.docx';
      const filename = match ? match[1] : `${fileRef.name.replace(/\.[^.]+$/, '')}_redacted${ext}`;

      setResult({ url: objectUrl, filename });
      triggerDownload(objectUrl, filename);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const tabStyle = (active) =>
    active
      ? { backgroundColor: 'var(--color-primary)', color: 'white' }
      : { color: 'var(--color-textSecondary)' };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-textPrimary)' }}>
          Document Redaction
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-textSecondary)' }}>
          Remove sensitive information from documents using AI role awareness or precise targeting.
        </p>
      </div>

      {/* Main tab switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-gray-100">
        {[
          { id: 'role',   label: 'Role-Based' },
          { id: 'custom', label: 'Custom' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); clearResult(); setError(null); }}
            className="flex-1 py-2 text-sm font-medium rounded-md transition"
            style={tabStyle(tab === t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Role-based tab ──────────────────────────────────────── */}
      {tab === 'role' && (
        <div className="space-y-4">
          <p className="text-sm p-3 rounded-lg border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-textSecondary)', backgroundColor: 'var(--color-surface)' }}>
            AI analyses your document and automatically redacts content that should be hidden from the selected role.
          </p>

          <UploadZone
            file={roleFile} setFile={setRoleFile}
            drag={roleDrag} setDrag={setRoleDrag}
            onError={setError}
          />

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-textPrimary)' }}>
              Viewer Role
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-textPrimary)' }}
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Custom tab ──────────────────────────────────────────── */}
      {tab === 'custom' && (
        <div className="space-y-4">
          {/* Custom sub-tabs */}
          <div className="flex gap-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            {[
              { id: 'color',    label: 'By Highlight Color' },
              { id: 'position', label: 'By Position' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { setCustomTab(t.id); clearResult(); setError(null); }}
                className="pb-2 text-sm font-medium border-b-2 transition"
                style={customTab === t.id
                  ? { color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }
                  : { color: 'var(--color-textSecondary)', borderColor: 'transparent' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Color sub-tab */}
          {customTab === 'color' && (
            <div className="space-y-4">
              <p className="text-sm p-3 rounded-lg border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-textSecondary)', backgroundColor: 'var(--color-surface)' }}>
                Redact all text highlighted with a specific colour. Works with PDF highlight annotations and DOCX text highlights.
              </p>

              <UploadZone
                file={colorFile} setFile={setColorFile}
                drag={colorDrag} setDrag={setColorDrag}
                onError={setError}
              />

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-textPrimary)' }}>
                  Highlight Colour
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={hexColor}
                    onChange={e => setHexColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer border flex-shrink-0"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  <input
                    type="text"
                    value={hexColor}
                    onChange={e => setHexColor(e.target.value)}
                    placeholder="#FFFF00"
                    className="flex-1 px-3 py-2 text-sm border rounded-lg font-mono focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-textPrimary)' }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-textSecondary)' }}>
                  Common: #FFFF00 yellow · #00FF00 green · #FF00FF magenta · #00FFFF cyan
                </p>
              </div>
            </div>
          )}

          {/* Position sub-tab */}
          {customTab === 'position' && (
            <div className="space-y-4">
              <p className="text-sm p-3 rounded-lg border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-textSecondary)', backgroundColor: 'var(--color-surface)' }}>
                Specify exact locations to redact.{' '}
                <strong>PDF:</strong> Page + line numbers on that page.{' '}
                <strong>DOCX:</strong> Paragraph number from the document (page is ignored).
              </p>

              <UploadZone
                file={posFile} setFile={setPosFile}
                drag={posDrag} setDrag={setPosDrag}
                onError={setError}
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-textPrimary)' }}>
                    Redact Positions
                  </label>
                  <button
                    onClick={() => setPosRows(r => [...r, { ...EMPTY_ROW }])}
                    className="flex items-center gap-1 text-sm px-2 py-1 rounded hover:bg-gray-100 transition"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>

                {/* Column headers */}
                {(() => {
                  const showPage = !posFile || posFile.name.toLowerCase().endsWith('.pdf');
                  return (
                    <div className={`flex gap-2 mb-1 px-1 text-xs font-medium ${posRows.length > 1 ? 'pr-9' : ''}`}
                      style={{ color: 'var(--color-textSecondary)' }}>
                      {showPage && <span className="flex-1">Page</span>}
                      <span className="flex-1">Paragraph</span>
                      <span className="flex-[2]">Lines (e.g. 1,3-5)</span>
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  {posRows.map((row, idx) => {
                    // Show page field unless a DOCX is explicitly selected
                    const isPdf = !posFile || posFile.name.toLowerCase().endsWith('.pdf');
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        {isPdf && (
                          <input
                            type="number" min="1"
                            placeholder="1"
                            value={row.page}
                            onChange={e => setPosRows(rows =>
                              rows.map((r, i) => i === idx ? { ...r, page: e.target.value } : r)
                            )}
                            className="flex-1 px-2 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-textPrimary)' }}
                          />
                        )}
                        <input
                          type="number" min="1"
                          placeholder="#"
                          value={row.paragraph}
                          onChange={e => setPosRows(rows =>
                            rows.map((r, i) => i === idx ? { ...r, paragraph: e.target.value } : r)
                          )}
                          className="flex-1 px-2 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-textPrimary)' }}
                        />
                        <input
                          type="text"
                          placeholder="1,3-5"
                          value={row.lines}
                          onChange={e => setPosRows(rows =>
                            rows.map((r, i) => i === idx ? { ...r, lines: e.target.value } : r)
                          )}
                          className="flex-[2] px-2 py-2 text-sm border rounded-lg font-mono focus:outline-none focus:ring-2"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-textPrimary)' }}
                        />
                        {posRows.length > 1 && (
                          <button
                            onClick={() => setPosRows(rows => rows.filter((_, i) => i !== idx))}
                            className="p-2 rounded hover:bg-red-50 transition flex-shrink-0"
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
          <Shield size={20} className="text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">Redaction complete</p>
            <p className="text-xs text-green-600 truncate">{result.filename}</p>
          </div>
          <button
            onClick={() => triggerDownload(result.url, result.filename)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition flex-shrink-0"
            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
          >
            <Download size={15} /> Download
          </button>
        </div>
      )}

      {/* Redact button */}
      <button
        onClick={handleRedact}
        disabled={loading}
        className="w-full py-3 text-sm font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
      >
        {loading
          ? <><Loader2 size={18} className="animate-spin" /> Redacting document…</>
          : <><Shield size={18} /> Redact Document</>
        }
      </button>
    </div>
  );
}
