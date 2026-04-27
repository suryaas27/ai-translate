const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const AI_SERVICE_BASE = isLocal
  ? (import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8080')
  : (import.meta.env.VITE_AI_SERVICE_URL || 'https://ai-translate-backend-vmq73kpwua-uc.a.run.app');

export const FEATURE_URLS = {
  translation:     `${AI_SERVICE_BASE}/api/v1/translation`,
  transliteration: `${AI_SERVICE_BASE}/api/v1/transliteration`,
  comparison:      `${AI_SERVICE_BASE}/api/v1/comparison`,
  summary:         `${AI_SERVICE_BASE}/api/v1/summary`,
  interact:        `${AI_SERVICE_BASE}/api/v1/interact`,
  extract:         `${AI_SERVICE_BASE}/api/v1/extract`,
  dynamicFields:   `${AI_SERVICE_BASE}/api/v1/dynamic-fields`,
  redact:          `${AI_SERVICE_BASE}/api/v1/redact`,
};

// Backward compat: TranslationApp uses API_BASE_URL directly
export const API_BASE_URL = FEATURE_URLS.translation;
