const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const prodUrl = 'https://ocr-backend-6195437887.asia-south1.run.app';
const localUrl = 'http://localhost:8000';

export const API_BASE_URL = import.meta.env.VITE_API_URL || (isLocal ? localUrl : prodUrl);
