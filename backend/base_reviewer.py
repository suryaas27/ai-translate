from abc import ABC, abstractmethod
from typing import Dict

class BaseReviewer(ABC):
    @abstractmethod
    def evaluate_translation(self, original_text: str, translated_text: str, target_language: str) -> Dict:
        """
        Evaluate the quality of a translation.
        
        Args:
            original_text: The original text in source language
            translated_text: The translated text in target language
            target_language: The name of the target language
            
        Returns:
            Dict with score, accuracy, tone, issues, and 'corrections' list.
            'corrections' is a list of objects with {incorrect_snippet, suggested_fix, reason}.
        """
        pass
