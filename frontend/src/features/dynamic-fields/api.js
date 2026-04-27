/**
 * API client for the dynamic-fields feature.
 * Uses the ai-translate backend at /api/v1/dynamic-fields.
 */
import { FEATURE_URLS } from '../../config';

const BASE = FEATURE_URLS.dynamicFields;

// ── Template API ──────────────────────────────────────────────────────────────

export const templateApi = {
  /** Extract blank fields from an uploaded document (PDF / image / DOCX). */
  extractFields: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${BASE}/template/extract-fields`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw { response: { data: err } };
    }
    return { data: await res.json() };
  },

  /** Convert a DOCX file to PDF via LibreOffice on the backend. Returns a PDF Blob. */
  convertDocxToPdf: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${BASE}/template/docx-to-pdf`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('DOCX to PDF conversion failed');
    return res.blob();
  },

  /** Send resolved plain text to build + return PDF Blob. */
  filledTextToPdf: async (resolvedText, fileName) => {
    const fd = new FormData();
    fd.append('text', resolvedText);
    fd.append('file_name', fileName);
    const res = await fetch(`${BASE}/template/filled-text-to-pdf`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('PDF generation failed');
    return res.blob();
  },

  /** Generate a template from a plain-text description via AI. */
  generate: async (description) => {
    const fd = new FormData();
    fd.append('description', description);
    const res = await fetch(`${BASE}/template/generate`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw { response: { data: err } };
    }
    return { data: await res.json() };
  },
};

// ── Contracts API ─────────────────────────────────────────────────────────────

export const contractsApi = {
  getArticles: async (stateCode, page = 1) => {
    const params = new URLSearchParams({ state_code: stateCode, page: String(page) });
    const res = await fetch(`${BASE}/contracts/articles?${params}`);
    if (!res.ok) throw new Error('Failed to load articles');
    return { data: await res.json() };
  },

  createOrderFromPdf: async (payload) => {
    const res = await fetch(`${BASE}/contracts/orders/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw { response: { data: { detail: err } } };
    }
    return { data: await res.json() };
  },

  getStampTypes: async (stateCode, articleId, considerationAmount = 0) => {
    const params = new URLSearchParams({
      state_code: stateCode,
      article_id: String(articleId),
      consideration_amount: String(considerationAmount),
      sync: 'true',
    });
    const res = await fetch(`${BASE}/contracts/stamp-types?${params}`);
    if (!res.ok) throw new Error('Failed to load stamp types');
    return { data: await res.json() };
  },
};
