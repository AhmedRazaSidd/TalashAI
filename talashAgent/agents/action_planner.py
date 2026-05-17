import json
import logging
from pydantic import BaseModel, Field
from gemini_client import run_agent_with_retry
from google import genai
import os
from tools.search_legal_docs import search_legal_docs

logger = logging.getLogger(__name__)

class ActionStep(BaseModel):
    step: int
    title: str = Field(description="Step title in the matched language")
    action: str = Field(description="Action description in the matched language")
    location: str = Field(description="Location in the matched language")
    documents_needed: list[str] = Field(description="List of documents in the matched language")
    estimated_time: str = Field(description="Time estimate in the matched language")
    cost: str = Field(description="Cost estimate in the matched language")
    escalation: str = Field(description="Escalation path in the matched language")
    is_immediate: bool

class ActionPlannerOutput(BaseModel):
    status: str = Field(description="success | partial | failed")
    emotional_note: str | None = Field(description="Emotional note in the matched language")
    action_plan: list[ActionStep]
    total_estimated_time: str
    total_estimated_cost: str
    free_legal_aid_available: bool
    nearest_free_aid: str

system_prompt = """
You are INSAAF OS ActionPlanner.

You have access to legal context from the search_legal_docs tool to verify correct legal sequence before planning.

Free legal aid resources in Pakistan:
- DLEC: All major districts
- Pakistan Bar Council Legal Aid
- Sindh Bar Council: Karachi
- Punjab Bar Council: Lahore
- AGHS Legal Aid Cell: Lahore
- Legal Aid Society: Karachi
- Shirkat Gah: Women's rights
- Rozan: Family/domestic violence
- SPARC: Child rights

Rules:
- FREE options always first
- Maximum 6 steps
- Each step: action + location + documents + time + cost + escalation
- At least one step immediately actionable
- Correct legal sequence — mandatory
- If distressed/urgent tone: add emotional support note at start
- Match user language: Ensure the textual descriptions (title, action, location, etc.) are in the target language (Urdu script, Roman Urdu, or English).
- Return ONLY valid JSON. Do not include markdown formatting.
"""

def _call_gemini(combined_context: dict, search_context: str):
    client = genai.Client(vertexai=True, api_key=os.environ.get("VERTEX_API_KEY"))
    lang = combined_context.get("language_detected", "English")
    tone = combined_context.get("emotional_tone", "calm")
    prompt = f"Target Language: {lang}\nEmotional Tone: {tone}\n\nSearch Context:\n{search_context}\n\nAgent Context:\n{json.dumps(combined_context)}"
    response = client.models.generate_content(
        model='gemini-2.5-pro',
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=ActionPlannerOutput,
        ),
    )
    return response.text

def run_action_planner(combined_context: dict) -> dict:
    try:
        query = combined_context.get("cleaned_input", "") or " ".join(combined_context.get("key_facts", []))
        search_context = search_legal_docs(query)
        result_str = run_agent_with_retry(_call_gemini, combined_context, search_context)
        res = json.loads(result_str)
        res["language_detected"] = combined_context.get("language_detected", "English")
        res["emotional_tone"] = combined_context.get("emotional_tone", "calm")
        return res
    except Exception as e:
        logger.error(f"Agent 6 failed: {e}")
        return {
            "agent": "ActionPlanner",
            "status": "failed",
            "fallback_used": True,
            "partial_output": {},
            "reason": str(e),
            "instruction_to_next_agent": "use available data and proceed",
            "language_detected": combined_context.get("language_detected", "English"),
            "emotional_tone": combined_context.get("emotional_tone", "calm"),
            "action_plan": [],
            "total_estimated_time": "Unknown",
            "total_estimated_cost": "Unknown",
            "free_legal_aid_available": False,
            "nearest_free_aid": "Unknown"
        }
