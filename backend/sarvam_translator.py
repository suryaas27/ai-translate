from docx import Document
import requests
import os
from typing import Dict, Optional
from base_translator import BaseTranslator

class SarvamTranslator(BaseTranslator):
    def __init__(self):
        """Initialize Sarvam client with API key from environment"""
        self.api_key = os.getenv("SARVAM_API_KEY")
        self.api_url = "https://api.sarvam.ai/translate"
    
    def translate_html(self, html_content: str, target_language: str) -> Dict:
        """
        Translate HTML content while preserving formatting using Sarvam AI.
        Handles Sarvam's 2000-character limit by chunking.
        """
        if not self.api_key:
            raise ValueError("SARVAM_API_KEY environment variable not set")

        # Sarvam language mapping
        target_lang_code = f"{target_language}-IN" if '-' not in target_language else target_language
        
        # Sarvam has a 2000-character limit for sarvam-translate:v1
        MAX_CHARS = 1800 # Safe margin
        
        if len(html_content) <= MAX_CHARS:
            return self._send_request(html_content, target_lang_code)
        
        # Chunking logic for large HTML
        print(f"DEBUG: HTML length {len(html_content)} exceeds {MAX_CHARS}. Chunking...")
        chunks = self._chunk_html(html_content, MAX_CHARS)
        translated_chunks = []
        
        for i, chunk in enumerate(chunks):
            print(f"DEBUG: Translating chunk {i+1}/{len(chunks)} ({len(chunk)} chars)")
            result = self._send_request(chunk, target_lang_code)
            translated_chunks.append(result["translated_html"])
            
        return {
            "translated_html": "".join(translated_chunks),
            "language": target_language
        }

    def _send_request(self, text: str, target_lang_code: str) -> Dict:
        data = {
            "input": text,
            "source_language_code": "en-IN",
            "target_language_code": target_lang_code,
            "speaker_gender": "Female",
            "model": "sarvam-translate:v1"
        }

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }

        response = requests.post(self.api_url, json=data, headers=headers)
        response.raise_for_status()
        result = response.json()
        
        return {
            "translated_html": result.get("translated_text", ""),
            "language": target_lang_code
        }

    def _chunk_html(self, html: str, max_size: int) -> list:
        """Very basic HTML chunking - splits by closing tags or newlines"""
        chunks = []
        current_chunk = ""
        
        # Try to split by common closing tags to avoid breaking tags
        # Scaling this for robustness would require a parser, but for now we use split
        potential_split_points = html.replace(">", ">\n").split("\n")
        
        for part in potential_split_points:
            if len(current_chunk) + len(part) < max_size:
                current_chunk += part
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = part
                
        if current_chunk:
            chunks.append(current_chunk)
            
        return chunks
    def translate_docx(self, docx_path: str, target_language: str, output_path: str) -> str:
        """Translate DOCX natively using Sarvam API"""
        if not self.api_key:
            raise ValueError("SARVAM_API_KEY environment variable not set")
            
        doc = Document(docx_path)
        blocks = []
        for para in doc.paragraphs:
            if para.text.strip():
                blocks.append(para.text)
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        blocks.append(cell.text)

        target_lang_code = f"{target_language}-IN" if '-' not in target_language else target_language
        batch_size = 10
        translated_map = {}
        
        for i in range(0, len(blocks), batch_size):
            batch = blocks[i:i+batch_size]
            data = {
                "input": batch,
                "source_language_code": "en-IN",
                "target_language_code": target_lang_code,
                "speaker_gender": "Female",
                "model": "sarvam-translate:v1"
            }
            try:
                response = requests.post(self.api_url + "/v1" if not self.api_url.endswith("/v1") else self.api_url, 
                                         json=data, 
                                         headers={"api-subscription-key": self.api_key, "Content-Type": "application/json"})
                if response.ok:
                    batch_translated = response.json().get("translated_texts", [])
                    for original, translated in zip(batch, batch_translated):
                        translated_map[original] = translated
            except Exception as e:
                print(f"Sarvam Batch Error: {e}")

        for para in doc.paragraphs:
            if para.text in translated_map:
                translated_text = translated_map[para.text]
                if para.runs:
                    first_run = para.runs[0]
                    first_run.text = translated_text
                    for i in range(1, len(para.runs)):
                        para.runs[i].text = ""
                else:
                    para.text = translated_text

        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text in translated_map:
                        translated_text = translated_map[cell.text]
                        if cell.paragraphs and cell.paragraphs[0].runs:
                            first_run = cell.paragraphs[0].runs[0]
                            first_run.text = translated_text
                            for i in range(1, len(cell.paragraphs[0].runs)):
                                cell.paragraphs[0].runs[i].text = ""
                        else:
                            cell.text = translated_text

        doc.save(output_path)
        return output_path
