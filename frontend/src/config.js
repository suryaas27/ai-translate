const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const PROD_URLS = {
  translation:     import.meta.env.VITE_TRANSLATION_URL     || 'https://ai-translate-translation-6195437887.us-central1.run.app',
  transliteration: import.meta.env.VITE_TRANSLITERATION_URL || 'https://ai-translate-transliteration-6195437887.us-central1.run.app',
  comparison:      import.meta.env.VITE_COMPARISON_URL      || 'https://ai-translate-comparison-6195437887.us-central1.run.app',
  summary:         import.meta.env.VITE_SUMMARY_URL         || 'https://ai-translate-summary-6195437887.us-central1.run.app',
  interact:        import.meta.env.VITE_INTERACT_URL        || 'https://ai-translate-interact-6195437887.us-central1.run.app',
  extract:         import.meta.env.VITE_EXTRACT_URL         || 'https://ai-translate-extract-6195437887.us-central1.run.app',
};

const LOCAL_URLS = {
  translation:     import.meta.env.VITE_API_URL || 'http://localhost:8001',
  transliteration: 'http://localhost:8002',
  comparison:      'http://localhost:8003',
  summary:         'http://localhost:8004',
  interact:        'http://localhost:8005',
  extract:         'http://localhost:8006',
};

export const FEATURE_URLS = isLocal ? LOCAL_URLS : PROD_URLS;

// Backward compat: existing code using API_BASE_URL continues to work
export const API_BASE_URL = FEATURE_URLS.translation;
