from abc import ABC, abstractmethod
from typing import Dict

class BaseTranslator(ABC):
    @abstractmethod
    def translate_html(self, html_content: str, target_language: str) -> Dict:
        """
        Translate HTML content while preserving formatting.
        
        Args:
            html_content: The HTML string to translate
            target_language: Target language code
        
        Returns:
            Dict with translated_html and language
        """
        pass
