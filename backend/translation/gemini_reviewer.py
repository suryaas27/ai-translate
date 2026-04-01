from google import genai
import os
import json
from typing import Dict, List
from base_reviewer import BaseReviewer

class GeminiReviewer(BaseReviewer):
    def __init__(self):
        """Initialize Gemini reviewer with API key from environment"""
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        self.client = genai.Client(api_key=api_key)
        self.model = "gemini-flash-latest"

    def evaluate_translation(self, original_text: str, translated_text: str, target_language: str) -> Dict:
        """
        Evaluate the quality of a translation using Gemini.
        """
        prompt = f"""You are a professional linguistic judge. Evaluate the following translation from English to {target_language}.

Original Text:
{original_text}

Translated Text:
{translated_text}

Provide your evaluation in the following JSON format:
{{
    "score": (a number from 1 to 10),
    "accuracy": (brief assessment of meaning preservation),
    "tone": (assessment of tone and style),
    "issues": [
        "list of specific overarching linguistic issues"
    ],
    "suggestion": "how the translation could be improved overall",
    "corrections": [
        {{
            "incorrect_snippet": "the exact portion of translated_text that is wrong",
            "suggested_fix": "the corrected version of ONLY that snippet",
            "reason": "brief explanation for this specific fix"
        }}
    ]
}}

Rules:
- Focus on linguistic accuracy, grammar, and natural flow in {target_language}.
- Identify as many specific corrections as possible.
- IMPORTANT: The 'Translated Text' you see contains HTML tags. Your 'incorrect_snippet' MUST be an EXACT SUBSTRING of the 'Translated Text' PROVIDED, including any HTML tags and exact whitespace if they are present within the snippet.
- If a correction involves text spanned across tags, include the tags in the 'incorrect_snippet'.
- Return ONLY the JSON object.
"""

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt
            )
            
            # Clean up response text in case of markdown blocks
            text = response.text.strip()
            if text.startswith("```"):
                lines = text.split('\n')
                text = '\n'.join(lines[1:-1]).strip()
            
            return json.loads(text)
        except Exception as e:
            print(f"Gemini Judge Error: {e}")
            return {
                "score": 0,
                "error": str(e),
                "suggestion": "Evaluation failed. Please check backend logs."
            }
