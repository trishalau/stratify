import unittest
import urllib.error
from unittest.mock import patch

from app.ai_provider import AIIntegrationError, GeminiScenarioAI


class GeminiProviderTests(unittest.TestCase):
    def test_403_has_actionable_guidance_without_exposing_key(self):
        provider = GeminiScenarioAI(api_key="test-secret-key")
        forbidden = urllib.error.HTTPError(
            "https://generativelanguage.googleapis.com/test-model:generateContent",
            403,
            "Forbidden",
            {},
            None,
        )
        with patch("app.ai_provider.urllib.request.urlopen", side_effect=forbidden):
            with self.assertRaises(AIIntegrationError) as caught:
                provider._structured_response(
                    name="test",
                    schema={"type": "object", "properties": {}, "required": []},
                    instructions="Test request",
                    input_data=[],
                )

        self.assertIn("Gemini denied access (403)", caught.exception.public_message)
        self.assertIn("Google AI Studio", caught.exception.public_message)
        self.assertNotIn("test-secret-key", caught.exception.public_message)

    def test_404_message_points_to_model_configuration(self):
        self.assertIn("GEMINI_MODEL", GeminiScenarioAI._http_error_message(404))


if __name__ == "__main__":
    unittest.main()
