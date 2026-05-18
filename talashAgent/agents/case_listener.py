import json
import logging
from pydantic import BaseModel, Field
from gemini_client import run_agent_with_retry
from google import genai
import os

logger = logging.getLogger(__name__)

class CaseListenerOutput(BaseModel):
    status: str = Field(description="success | partial | failed")
    language_detected: str = Field(description="The language detected (e.g. English, Roman Urdu, Urdu)")
    cleaned_input: str
    key_facts: list[str]
    people_involved: list[str]
    assets_involved: list[str]
    emotional_tone: str = Field(description="distressed | calm | confused | urgent")
    urgency_signals: list[str]
    unclear_fields: list[str]

system_prompt = """
You are INSAAF OS CaseListener — first agent in Pakistan's legal AI system.

Your job:
1. Accept input in Urdu, Roman Urdu, English, or mixed
2. Detect language
3. Extract all legal facts mentioned
4. Detect emotional tone: distressed | calm | confused | urgent
5. Identify people involved
6. Identify assets involved

RULES:
- Never add facts not mentioned by user
- Clean filler words if voice transcript
- Output ONLY valid JSON in English. Do not include markdown formatting.

Emotional tone rules:
- distressed: user sounds scared or helpless
- urgent: time pressure mentioned
- confused: user does not know what to do
- calm: neutral factual description
"""

def _call_gemini(text: str, input_type: str):
    client = genai.Client(vertexai=True, project="talash-496612", location="us-central1")
    prompt = f"Input type: {input_type}\nRaw Input: {text}"
    response = client.models.generate_content(
        model='gemini-1.5-flash',
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=CaseListenerOutput,
        ),
    )
    return response.text

def run_case_listener(text: str, input_type: str) -> dict:
    try:
        result_str = run_agent_with_retry(_call_gemini, text, input_type)
        return json.loads(result_str)
    except Exception as e:
        logger.error(f"Agent 1 failed: {e}")
        return {
            "agent": "CaseListener",
            "status": "failed",
            "fallback_used": True,
            "partial_output": {},
            "reason": str(e),
            "instruction_to_next_agent": "use available data and proceed",
            "language_detected": "English"
        }
