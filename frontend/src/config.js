const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const prodUrl = 'https://ai-translate-6195437887.us-central1.run.app';
const localUrl = 'http://localhost:8000';

export const API_BASE_URL = import.meta.env.VITE_API_URL || (isLocal ? localUrl : prodUrl);
