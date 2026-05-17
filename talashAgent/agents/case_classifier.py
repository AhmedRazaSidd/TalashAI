import json
import logging
from pydantic import BaseModel, Field
from gemini_client import run_agent_with_retry
from google import genai
import os

logger = logging.getLogger(__name__)

class CaseClassifierOutput(BaseModel):
    status: str = Field(description="success | partial | failed")
    primary_category: str
    secondary_category: str | None
    confidence: int
    needs_clarification: bool
    urgency_level: str = Field(description="critical|high|medium|low")
    time_sensitive: bool
    time_sensitivity_reason: str
    court_jurisdiction: str

system_prompt = """
You are INSAAF OS CaseClassifier.

Legal categories:
- inheritance (wirasat)
- property_dispute (zameen ka jhagra/kabza)
- family_law (khula, divorce, custody)
- criminal_fir (FIR, police complaint)
- labour_rights (salary, termination)
- government_services (NADRA, passport)
- tenancy (kiraya, eviction)
- consumer_rights (fraud, scam)

For every case:
1. Primary category
2. Secondary category if overlap
3. Confidence score 0-100
4. Is time-sensitive?
5. Which court has jurisdiction?

If confidence below 50: 
  set needs_clarification: true
  use general_civil as default
  continue pipeline — never stop

IMPORTANT: A `category_hint` might be provided by the user/frontend. If it exists, use it as a starting point to guide your classification, but you MUST still verify it against the actual facts provided by Agent 1. Do not blindly trust the hint if the facts contradict it.

Return ONLY valid JSON in English. Do not include markdown formatting.
If the language_detected is provided, ensure any explanatory text (like time_sensitivity_reason) matches that language.
"""

def _call_gemini(agent1_output: dict):
    client = genai.Client(vertexai=True, api_key=os.environ.get("VERTEX_API_KEY"))
    lang = agent1_output.get("language_detected", "English")
    prompt = f"Target Language: {lang}\nAgent 1 Output:\n{json.dumps(agent1_output)}"
    response = client.models.generate_content(
        model='gemini-2.5-pro',
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=CaseClassifierOutput,
        ),
    )
    return response.text

def run_case_classifier(agent1_output: dict) -> dict:
    try:
        result_str = run_agent_with_retry(_call_gemini, agent1_output)
        res = json.loads(result_str)
        res["language_detected"] = agent1_output.get("language_detected", "English")
        res["emotional_tone"] = agent1_output.get("emotional_tone", "calm")
        return res
    except Exception as e:
        logger.error(f"Agent 2 failed: {e}")
        return {
            "agent": "CaseClassifier",
            "status": "failed",
            "fallback_used": True,
            "partial_output": {},
            "reason": str(e),
            "instruction_to_next_agent": "use available data and proceed",
            "language_detected": agent1_output.get("language_detected", "English"),
            "emotional_tone": agent1_output.get("emotional_tone", "calm")
        }
