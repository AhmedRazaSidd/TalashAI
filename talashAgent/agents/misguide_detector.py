import json
import logging
from pydantic import BaseModel, Field
from gemini_client import run_agent_with_retry
from google import genai
import os

logger = logging.getLogger(__name__)

class RedFlag(BaseModel):
    flag: str = Field(description="Flag in the matched language")
    example: str = Field(description="Example in the matched language")
    what_to_do: str = Field(description="Action in the matched language")

class MisguideDetectorOutput(BaseModel):
    status: str = Field(description="success | partial | failed")
    red_flags: list[RedFlag]
    smart_questions: list[str] = Field(description="Questions in the matched language")
    your_rights: list[str] = Field(description="Rights in the matched language")
    case_specific_warnings: list[str] = Field(description="Warnings in the matched language")
    bar_council_complaint: str = Field(description="Complaint info in the matched language")

system_prompt = """
You are INSAAF OS MisguideDetector — Pakistan's legal consumer protection agent.

Protect users from:
1. Lawyer overcharging and scams
2. Fake legal guarantees
3. Unnecessary court filings
4. Exploitation of uneducated users

Pakistan-specific scams to detect:
- "Pehle paisa do phir result guarantee"
- "Main judge ko jaanta hun"
- "Yeh case 1 month mein pakka khatam"
- Court filing fee overcharging
- Fake Power of Attorney demands
- Fake court date delays
- "Settlement baher karo" pressure

Rules:
- Minimum 3 red flags always
- 5 smart questions always
- Match user language: Ensure the red_flags, smart_questions, your_rights, warnings, and bar_council_complaint are in the target language (Urdu script, Roman Urdu, or English).
- Tone: protective not fear-inducing
- This agent NEVER fails completely — always return at minimum the 5 questions and basic rights even if all else fails.
- Return ONLY valid JSON. Do not include markdown formatting.
"""

def _call_gemini(combined_context: dict):
    client = genai.Client(vertexai=True, project="talash-496612", location="us-central1")
    lang = combined_context.get("language_detected", "English")
    prompt = f"Target Language: {lang}\nContext:\n{json.dumps(combined_context)}"
    response = client.models.generate_content(
        model='gemini-1.5-flash',
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=MisguideDetectorOutput,
        ),
    )
    return response.text

def run_misguide_detector(combined_context: dict) -> dict:
    try:
        result_str = run_agent_with_retry(_call_gemini, combined_context)
        res = json.loads(result_str)
        res["language_detected"] = combined_context.get("language_detected", "English")
        res["emotional_tone"] = combined_context.get("emotional_tone", "calm")
        return res
    except Exception as e:
        logger.error(f"Agent 7 failed: {e}")
        lang = combined_context.get("language_detected", "English")
        return {
            "agent": "MisguideDetector",
            "status": "failed",
            "fallback_used": True,
            "partial_output": {},
            "reason": str(e),
            "instruction_to_next_agent": "use available data and proceed",
            "language_detected": lang,
            "emotional_tone": combined_context.get("emotional_tone", "calm"),
            "red_flags": [],
            "smart_questions": [
                "What is the total fee in writing?",
                "Which court will this be filed in?",
                "Can you give a receipt for the fees?",
                "What are the next 3 steps?",
                "Are there any hidden charges?"
            ],
            "your_rights": ["You have the right to ask for a written fee agreement."],
            "case_specific_warnings": ["Always double check the lawyer's credentials."],
            "bar_council_complaint": "Contact the Provincial Bar Council for complaints."
        }
