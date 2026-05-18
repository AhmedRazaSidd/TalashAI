import json
import logging
from pydantic import BaseModel, Field
from gemini_client import run_agent_with_retry
from google import genai
import os
from tools.search_legal_docs import search_legal_docs

logger = logging.getLogger(__name__)

class RightItem(BaseModel):
    right: str = Field(description="The right in the user's matched language")
    explanation: str = Field(description="Plain language explanation in the user's matched language")
    law_reference: str = Field(description="Act name, Section X")
    strength: str = Field(description="strong|moderate|weak")
    risk: str | None

class RightsAnalyzerOutput(BaseModel):
    status: str = Field(description="success | partial | failed")
    rights: list[RightItem]
    key_risks: list[str] = Field(description="Risks in the user's matched language")
    disclaimer: str = Field(description="Disclaimer in the user's matched language")

system_prompt = """
You are INSAAF OS RightsAnalyzer.

You have access to legal context from a search_legal_docs tool.
Laws you know:
- Muslim Family Laws Ordinance 1961
- Transfer of Property Act 1882
- Succession Act 1925
- Pakistan Penal Code 1860
- Code of Criminal Procedure (CrPC)
- Civil Procedure Code (CPC)
- Industrial Relations Act 2012
- Payment of Wages Act 1936
- Sindh/Punjab/KPK Tenancy Acts
- NADRA Ordinance 2000
- Qanoon-e-Shahadat Order 1984

Rules:
- List maximum 5 applicable rights based on the provided context
- Cite exact law and section number
- Mention risks honestly
- NEVER guarantee outcomes
- NEVER say "you will win"
- Match user language: Ensure the `right`, `explanation`, `key_risks`, and `disclaimer` are in the Target Language (Urdu script, Roman Urdu, or English).
- Match emotional tone in response:
  distressed → add empathy before rights
  urgent → put most critical right first
- Always include disclaimer at end
- Return ONLY valid JSON in the requested schema. Do not include markdown formatting.
"""

def _call_gemini(combined_context: dict, search_context: str):
    client = genai.Client(vertexai=True, project="talash-496612", location="us-central1")
    lang = combined_context.get("language_detected", "English")
    tone = combined_context.get("emotional_tone", "calm")
    prompt = f"Target Language: {lang}\nEmotional Tone: {tone}\n\nSearch Context:\n{search_context}\n\nAgent Context:\n{json.dumps(combined_context)}"
    response = client.models.generate_content(
        model='gemini-1.5-flash',
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=RightsAnalyzerOutput,
        ),
    )
    return response.text

def run_rights_analyzer(combined_context: dict) -> dict:
    try:
        query = combined_context.get("cleaned_input", "") or " ".join(combined_context.get("key_facts", []))
        search_context = search_legal_docs(query)
        result_str = run_agent_with_retry(_call_gemini, combined_context, search_context)
        res = json.loads(result_str)
        res["language_detected"] = combined_context.get("language_detected", "English")
        res["emotional_tone"] = combined_context.get("emotional_tone", "calm")
        return res
    except Exception as e:
        logger.error(f"Agent 4 failed: {e}")
        return {
            "agent": "RightsAnalyzer",
            "status": "failed",
            "fallback_used": True,
            "partial_output": {},
            "reason": str(e),
            "instruction_to_next_agent": "use available data and proceed",
            "language_detected": combined_context.get("language_detected", "English"),
            "emotional_tone": combined_context.get("emotional_tone", "calm"),
            "rights": [],
            "key_risks": [],
            "disclaimer": ""
        }
