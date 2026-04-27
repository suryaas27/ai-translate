import React, { useState, useEffect } from 'react';
import { FileText, Languages, Loader2, Upload, AlertCircle, Download, FileDown, Eye, Edit3 } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import SyncfusionView from '../../components/SyncfusionView';

const TranslationApp = () => {
    const [file, setFile] = useState(null);
    const [html, setHtml] = useState('');
    const [originalHtml, setOriginalHtml] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [language, setLanguage] = useState('hi');
    const [translatedLang, setTranslatedLang] = useState('');
    const [evaluation, setEvaluation] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [savingCorrection, setSavingCorrection] = useState(false);
    const [evaluating, setEvaluating] = useState(false);
    const [translationProvider] = useState('anthropic');
    const [nativeDocxB64, setNativeDocxB64] = useState(null);
    const [translatedPdfB64, setTranslatedPdfB64] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [progress, setProgress] = useState(null); // { done, total } during streaming

    // Convert base64 PDF to blob URL — Chrome blocks data: URI iframes for PDFs
    useEffect(() => {
        if (!translatedPdfB64) { setPdfUrl(null); return; }
        const bytes = atob(translatedPdfB64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
        setPdfUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [translatedPdfB64]);

    const languages = [
        { code: 'hi', name: 'Hindi' },
        { code: 'te', name: 'Telugu' },
        { code: 'mr', name: 'Marathi' },
        { code: 'bn', name: 'Bengali' },
        { code: 'kn', name: 'Kannada' },
        { code: 'ta', name: 'Tamil' },
        { code: 'rajasthani', name: 'Rajasthani (Experimental)' },
        { code: 'gu', name: 'Gujarati' },
        { code: 'or', name: 'Odia' },
        { code: 'ml', name: 'Malayalam' },
        { code: 'pa', name: 'Punjabi' },
        { code: 'as', name: 'Assamese' },
    ];


    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        const name = selectedFile?.name?.toLowerCase() || '';
        if (selectedFile && (name.endsWith('.docx') || name.endsWith('.pdf'))) {
            setFile(selectedFile);
            setError(null);
            setHtml('');
            setNativeDocxB64(null);
            setTranslatedPdfB64(null);
        } else {
            setError('Please select a valid .docx or .pdf file');
            setFile(null);
        }
    };

    const handleTranslate = async () => {
        if (!file) return;

        setLoading(true);
        setError(null);
        setProgress(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('target_language', language);

        const isLLM = ['gemini', 'openai', 'anthropic'].includes(translationProvider);
        if (isLLM) formData.append('llm_provider', translationProvider);

        const isPdf = file.name.toLowerCase().endsWith('.pdf');

        try {
            // PDF + LLM → use streaming endpoint
            if (isPdf && isLLM) {
                const response = await fetch(`${API_BASE_URL}/translate-pdf-llm/stream`, {
                    method: 'POST',
                    body: formData,
                });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.detail || 'Translation failed');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                const chunks = [];
                let buf = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    const lines = buf.split('\n');
                    buf = lines.pop(); // keep incomplete line in buffer
                    for (const line of lines) {
                        if (!line.startsWith('data:')) continue;
                        const ev = JSON.parse(line.slice(5).trim());
                        if (ev.type === 'chunk') {
                            chunks[ev.index] = ev.html;
                            setProgress({ done: ev.done, total: ev.total });
                            // Show accumulated partial HTML as batches arrive
                            const partial = chunks.filter(Boolean).join('');
                            setHtml(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${partial}</body></html>`);
                        } else if (ev.type === 'done') {
                            setHtml(ev.html);
                            setOriginalHtml(ev.original_html || '');
                            setTranslatedPdfB64(ev.translated_pdf_b64 || null);
                            setTranslatedLang(languages.find(l => l.code === ev.language)?.name || ev.language);
                            setProgress(null);
                        }
                    }
                }
                return;
            }

            // All other paths (DOCX+LLM, PDF+Google, DOCX+Google) — standard JSON response
            let endpoint;
            if (isPdf && !isLLM) endpoint = '/translate-pdf';
            else if (!isPdf && isLLM) endpoint = '/translate-docx-llm';
            else endpoint = '/translate-docx';

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Translation failed');
            }

            const data = await response.json();
            setHtml(data.html);
            setOriginalHtml(data.original_html || '');
            setNativeDocxB64(data.translated_docx_b64 || null);
            setTranslatedPdfB64(data.translated_pdf_b64 || null);
            setTranslatedLang(languages.find(l => l.code === data.language)?.name || data.language);
        } catch (err) {
            console.error(err);
            setError(err.message || 'An error occurred during translation');
        } finally {
            setLoading(false);
            setProgress(null);
        }
    };

    const handleEvaluate = async () => {
        if (!html) return;
        setEvaluating(true);
        try {
            const response = await fetch(`${API_BASE_URL}/evaluate-translation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original_text: originalHtml.replace(/<[^>]*>?/gm, ' '),
                    translated_text: html.replace(/<[^>]*>?/gm, ' '),
                    target_language: translatedLang,
                    reviewer_provider: 'gemini'
                }),
            });
            const data = await response.json();
            setEvaluation(data);
        } catch (err) {
            console.error(err);
            setError('Failed to evaluate translation');
        } finally {
            setEvaluating(false);
        }
    };

    const handleSaveCorrection = async () => {
        if (!html) return;
        setSavingCorrection(true);
        try {
            const response = await fetch(`${API_BASE_URL}/save-correction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original_text: originalHtml,
                    translated_text: html, // This is the corrected version (Human + AI edits)
                    corrected_text: html,
                    target_language: translatedLang,
                    provider: translationProvider
                }),
            });
            if (response.ok) {
                alert('Success! Final document version saved for future training.');
                setIsEditing(false);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to save correction');
        } finally {
            setSavingCorrection(false);
        }
    };

    const applyFix = (incorrect, suggested) => {
        if (!incorrect || !suggested) return;

        // 1. Try exact match first (Best for preserving structure)
        if (html.includes(incorrect)) {
            setHtml(html.replace(incorrect, suggested));
            return;
        }

        // 2. Fallback: Fuzzy matching for text snippets
        // This handles cases where the AI suggests a text-only fix but the HTML has nested tags
        // or slightly different whitespace (like &nbsp;).

        // Only attempt fuzzy if incorrect doesn't have complex HTML tags itself
        if (!incorrect.includes('<') || (incorrect.startsWith('<') && incorrect.endsWith('>'))) {
            try {
                // Escape special regex chars except spaces
                const escaped = incorrect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // Build a pattern that allows HTML tags and flexible whitespace between characters
                const fuzzyPattern = escaped.split('').map(char => {
                    if (char === ' ') return '[\\s\\n\\r&nbsp;]+';
                    return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                }).join('(?:<[^>]+>)*');

                const regex = new RegExp(fuzzyPattern, 'g');
                const newHtml = html.replace(regex, suggested);

                if (newHtml !== html) {
                    setHtml(newHtml);
                    return;
                }
            } catch (err) {
                console.error("Fuzzy match error:", err);
            }
        }

        alert("Could not find exact text in document. It might have been edited manually or contains complex formatting.");
    };

    const getBaseName = () =>
        file?.name?.replace(/\.(docx|pdf)$/i, '') || 'document';

    const downloadHtml = () => {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `translated_${getBaseName()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const downloadDocx = async () => {
        try {
            let blob;
            if (nativeDocxB64 && !isEditing) {
                // If we have a native DOCX from LLM and no edits have been made, use it directly!
                const byteCharacters = atob(nativeDocxB64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                console.log("Downloading Native DOCX (High Fidelity)");
            } else {
                // Fallback to HTML conversion if edited or native not available
                const response = await fetch(`${API_BASE_URL}/download-docx`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        html_content: html,
                        filename: `translated_${getBaseName()}.docx`
                    }),
                });

                if (!response.ok) throw new Error('DOCX download failed');
                blob = await response.blob();
                console.log("Downloading Reconstructed DOCX from HTML");
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `translated_${getBaseName()}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Failed to download DOCX');
        }
    };

    const downloadPdf = async () => {
        try {
            let blob;
            if (translatedPdfB64 && !isEditing) {
                // If we have a native PDF from backend and no edits, use it!
                const byteCharacters = atob(translatedPdfB64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                blob = new Blob([byteArray], { type: 'application/pdf' });
                console.log("Downloading Native PDF (High Fidelity)");
            } else {
                // Fallback to HTML-to-PDF conversion for edited content
                const response = await fetch(`${API_BASE_URL}/download-pdf`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        html_content: html,
                        filename: `translated_${getBaseName()}.pdf`
                    }),
                });

                if (!response.ok) throw new Error('PDF download failed');
                blob = await response.blob();
                console.log("Downloading Reconstructed PDF from HTML");
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `translated_${getBaseName()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Failed to download PDF');
        }
    };


    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
                <div className="flex items-start gap-3 mb-6">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                        <Languages className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Document Transliteration / Translation</h2>
                        <p className="text-sm text-gray-500">Translate DOCX/PDF content to Indic languages while preserving layout</p>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left: Input Section */}
                    <div className="lg:col-span-1 space-y-5">
                        {/* File Upload */}
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 sm:p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                accept=".docx,.pdf"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                                    <Upload className="w-6 h-6" />
                                </div>
                                <div className="text-sm font-medium text-gray-700">
                                    {file ? file.name : 'Click to Upload .docx or .pdf'}
                                </div>
                                <div className="text-xs text-gray-400">
                                    Supports .docx and .pdf
                                </div>
                            </div>
                        </div>

                        {/* Language Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Target Language</label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {languages.map((lang) => (
                                    <option key={lang.code} value={lang.code}>
                                        {lang.name}
                                    </option>
                                ))}
                            </select>
                            {language === 'rajasthani' && (
                                <p className="text-xs text-amber-600 mt-1">
                                    * Mapped to Hindi (Standard translation not available for Rajasthani)
                                </p>
                            )}
                        </div>


                        {/* Action Button */}
                        <button
                            onClick={handleTranslate}
                            disabled={!file || loading}
                            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Translating...
                                </>
                            ) : (
                                <>
                                    <Languages className="w-5 h-5" />
                                    Translate Document
                                </>
                            )}
                        </button>

                        {progress && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Translating page batches…</span>
                                    <span>{progress.done}/{progress.total}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${(progress.done / progress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Right: Output Section */}
                    <div className="lg:col-span-2 flex flex-col min-h-[300px] lg:min-h-[600px]">
                        {html ? (
                            <div className="h-full flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b bg-gray-50">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            Translated to {translatedLang}
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setIsEditing(!isEditing)}
                                                className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold transition-all ${isEditing
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Languages className="w-3.5 h-3.5" />}
                                                {isEditing ? 'PDF Preview' : 'Edit Mode'}
                                            </button>
                                            <button
                                                onClick={handleEvaluate}
                                                disabled={evaluating}
                                                className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 flex items-center gap-2 font-bold disabled:opacity-50 border border-indigo-100"
                                            >
                                                {evaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '⚖️'}
                                                {evaluating ? 'Judging...' : 'Review Quality'}
                                            </button>
                                            {isEditing && (
                                                <button
                                                    onClick={handleSaveCorrection}
                                                    disabled={savingCorrection}
                                                    className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    {savingCorrection ? '💾 Saving...' : '🎯 Save for Training'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={downloadHtml}
                                            className="text-xs flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium px-2 py-1 hover:bg-white rounded transition-colors"
                                            title="Download as HTML"
                                        >
                                            <Download className="w-4 h-4" />
                                            HTML
                                        </button>
                                        <button
                                            onClick={downloadDocx}
                                            className="text-xs flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium px-2 py-1 hover:bg-white rounded transition-colors"
                                            title="Download as Word"
                                        >
                                            <FileDown className="w-4 h-4" />
                                            Word
                                        </button>
                                        <button
                                            onClick={downloadPdf}
                                            className="text-xs flex items-center gap-1 text-slate-600 hover:text-red-600 font-medium px-2 py-1 hover:bg-white rounded transition-colors"
                                            title="Download as PDF"
                                        >
                                            <FileText className="w-4 h-4" />
                                            PDF
                                        </button>
                                    </div>
                                </div>

                                {/* LLM Evaluation / Feedback Section */}
                                {evaluation && (
                                    <div className={`px-4 py-3 border-b transition-all animate-in fade-in slide-in-from-top-2 ${evaluation.score >= 8 ? 'bg-emerald-50 border-emerald-100' :
                                        evaluation.score >= 5 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'
                                        }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-800">Judge Feedback (Gemini)</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${evaluation.score >= 8 ? 'bg-emerald-100 text-emerald-700' :
                                                    evaluation.score >= 5 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    Quality Score: {evaluation.score}/10
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEvaluation(null)}
                                                    className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 hover:bg-slate-200 rounded"
                                                >
                                                    Dismiss All
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <div>
                                                <p className="font-semibold text-slate-700 mb-1 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3 text-slate-500" /> Issues Identified:
                                                </p>
                                                <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                                                    {evaluation.issues?.map((issue, i) => <li key={i}>{issue}</li>)}
                                                </ul>
                                            </div>

                                            {evaluation.corrections?.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="font-semibold text-slate-700">Specific Corrections:</p>
                                                    <div className="flex flex-col gap-2">
                                                        {evaluation.corrections.map((corr, i) => (
                                                            <div key={i} className="bg-white/80 p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2 transition-all hover:shadow-md">
                                                                <div className="flex justify-between items-start gap-4">
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Change</span>
                                                                            <code className="text-[11px] text-red-700 line-through decoration-red-300">"{corr.incorrect_snippet}"</code>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">To</span>
                                                                            <code className="text-[11px] text-emerald-700 font-bold">"{corr.suggested_fix}"</code>
                                                                        </div>
                                                                        {corr.reason && (
                                                                            <p className="mt-2 text-[10px] text-slate-500 italic">Why: {corr.reason}</p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex gap-1 shrink-0">
                                                                        <button
                                                                            onClick={() => applyFix(corr.incorrect_snippet, corr.suggested_fix)}
                                                                            className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold hover:bg-indigo-700 transition-colors"
                                                                        >
                                                                            Apply
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const newCorrs = evaluation.corrections.filter((_, idx) => idx !== i);
                                                                                setEvaluation({ ...evaluation, corrections: newCorrs });
                                                                            }}
                                                                            className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-200 transition-colors"
                                                                        >
                                                                            Ignore
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <p className="font-semibold text-slate-700 mb-1">💡 Key Suggestion:</p>
                                                <p className="text-slate-600 bg-white/60 p-2 rounded border border-slate-200/50 italic">
                                                    "{evaluation.suggestion}"
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Preview / Editor Area */}
                                <div className="flex-1 overflow-hidden bg-slate-200/50 flex flex-col">
                                    {isEditing ? (
                                        <div className="flex-1 overflow-auto p-6 flex justify-center quill-word-editor">
                                            <ReactQuill
                                                theme="snow"
                                                value={html}
                                                onChange={setHtml}
                                                modules={{
                                                    toolbar: [
                                                        [{ 'header': [1, 2, 3, false] }],
                                                        ['bold', 'italic', 'underline', 'strike'],
                                                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                        ['clean']
                                                    ]
                                                }}
                                                className="editing-active"
                                            />
                                        </div>
                                    ) : (
                                        nativeDocxB64 ? (
                                            <div style={{ height: 'clamp(400px, 60vh, 800px)', width: '100%' }}>
                                                <SyncfusionView
                                                    docxB64={nativeDocxB64}
                                                    height="clamp(400px, 60vh, 800px)"
                                                />
                                            </div>
                                        ) : pdfUrl ? (
                                            <iframe
                                                src={pdfUrl}
                                                className="w-full border-none"
                                                style={{ height: 'clamp(350px, 60vh, 800px)' }}
                                                title="PDF Preview"
                                            />
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-gray-400">
                                                <p className="text-sm">No preview available</p>
                                            </div>
                                        )
                                    )}
                                </div>

                                <style>{`
                                    .quill-word-editor .ql-toolbar.ql-snow {
                                        position: sticky;
                                        top: 0;
                                        z-index: 10;
                                        background: white;
                                        border: none !important;
                                        border-bottom: 1px solid #e2e8f0 !important;
                                        display: flex;
                                        justify-content: center;
                                        padding: 8px;
                                    }
                                    .quill-word-editor .ql-container.ql-snow {
                                        border: none !important;
                                        display: flex;
                                        justify-content: center;
                                    }
                                    .quill-word-editor .ql-editor {
                                        background-color: white;
                                        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                                        margin: 1rem auto 2rem;
                                        padding: 1.5cm !important;
                                        width: min(21cm, 100%);
                                        min-height: min(29.7cm, 400px);
                                        font-family: 'Calibri', 'Inter', 'Segoe UI', sans-serif;
                                        font-size: 11pt;
                                        line-height: 1.5;
                                        color: #2b2b2b;
                                    }
                                    .quill-word-editor .ql-editor h1 { font-size: 16pt; color: #2E74B5; font-weight: normal; margin-bottom: 0.5rem; }
                                    .quill-word-editor .ql-editor h2 { font-size: 13pt; color: #2E74B5; font-weight: normal; margin-top: 1rem; border-bottom: 1px solid #BDD7EE; }
                                    .quill-word-editor .ql-editor h3 { font-size: 11pt; color: #1F4D78; font-weight: bold; }
                                    .quill-word-editor .ql-editor p { margin-bottom: 8pt; }
                                    .quill-word-editor .ql-editor table { 
                                        border-collapse: collapse; 
                                        width: 100%; 
                                        margin: 1rem 0; 
                                    }
                                    .quill-word-editor .ql-editor table td, 
                                    .quill-word-editor .ql-editor table th { 
                                        border: 1px solid #bfbfbf; 
                                        padding: 5pt; 
                                    }
                                    .quill-word-editor .editing-active .ql-editor {
                                        outline: 2px solid #3b82f6;
                                        outline-offset: 4px;
                                    }
                                    /* Hide toolbar when not editing */
                                    .quill-word-editor .ql-toolbar {
                                        display: ${isEditing ? 'flex' : 'none'} !important;
                                    }
                                `}</style>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 min-h-[250px] lg:min-h-[600px]">
                                <Languages className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-lg font-medium text-gray-400">Translation Preview</p>
                                <p className="text-sm opacity-60">Upload a document to see the result here</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TranslationApp;
