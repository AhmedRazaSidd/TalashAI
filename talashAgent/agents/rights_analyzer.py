import json
import logging
from pydantic import BaseModel, Field
from gemini_client import get_vertex_client, DEEP_MODEL, make_config
import os
from tools.legal_tools import search_legal_docs, search_court_procedures

client = get_vertex_client()

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
- Specific Relief Act 1877 (e.g. Section 8, Section 9 for possession)
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
    lang = combined_context.get("language_detected", "English")
    tone = combined_context.get("emotional_tone", "calm")
    prompt = f"Target Language: {lang}\nEmotional Tone: {tone}\n\nSearch Context:\n{search_context}\n\nAgent Context:\n{json.dumps(combined_context)}"
    response = client.models.generate_content(
        model=DEEP_MODEL,
        contents=prompt,
        config=make_config(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=RightsAnalyzerOutput,
        ),
    )
    return response.text

def run_rights_analyzer(combined_context: dict, on_trace=None) -> dict:
    try:
        query = combined_context.get("cleaned_input", "") or " ".join(combined_context.get("key_facts", []))
        
        # Dynamic tool execution & streaming traces
        docs_results = search_legal_docs(query, on_trace=on_trace)
        procedures_results = search_court_procedures(query, on_trace=on_trace)
        
        # Format the RAG context for the model
        search_context = "--- APPLICABLE LAWS AND CITATIONS ---\n"
        for doc in docs_results:
            search_context += f"- Law: {doc['law_name']} | Section: {doc['section']} | Source: {doc['source']}\n  Summary: {doc['summary']}\n\n"
        
        search_context += "--- COURT JURISDICTION & GUIDANCE ---\n"
        search_context += f"Steps: {procedures_results['procedural_steps']}\n"
        search_context += f"Guidance: {procedures_results['guidance']}\n"
        search_context += f"Timelines: {procedures_results['timelines']}\n"
        
        # Store in collected_context.tool_outputs
        combined_context.setdefault("tool_outputs", {})
        combined_context["tool_outputs"]["RightsAnalyzer"] = {
            "laws_retrieved": docs_results,
            "procedure_retrieved": procedures_results
        }
        
        result_str = _call_gemini(combined_context, search_context)
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
