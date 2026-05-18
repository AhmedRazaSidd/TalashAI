import json
import logging
from pydantic import BaseModel, Field
from gemini_client import run_agent_with_retry
from google import genai
import os

logger = logging.getLogger(__name__)

class DocumentFound(BaseModel):
    name: str
    status: str = Field(description="verified|claimed")

class DocumentMissing(BaseModel):
    name: str = Field(description="Name in the matched language")
    urgency: str = Field(description="critical|high|medium")
    where_to_get: str = Field(description="In matched language")
    time_required: str = Field(description="In matched language")
    cost: str = Field(description="In matched language")

class ScoreBreakdown(BaseModel):
    documents: int
    witnesses: int
    urgency_penalty: int
    total: int

class DocumentCheckerOutput(BaseModel):
    status: str = Field(description="success | partial | failed")
    readiness_score: int
    readiness_label: str = Field(description="Ready|Mostly Ready|Partially Ready|Not Ready")
    documents_found: list[DocumentFound]
    documents_missing: list[DocumentMissing]
    score_breakdown: ScoreBreakdown
    fraud_risk: str = Field(description="high|medium|low|none")
    fraud_risk_reason: str | None

system_prompt = """
You are INSAAF OS DocumentChecker.

Calculate Case Readiness Score (0-100):
- Documents available: 60% weight
- Witnesses available: 20% weight
- Urgency penalty: -20% if time critical

Document checklists:

inheritance:
  Critical: CNIC, Death Certificate, Succession Certificate
  Important: Land records, Witness affidavits
  Optional: Will, Property photos

property_dispute/kabza:
  Critical: CNIC, Title deed, Land record (fard)
  Important: Witness statements, Photos/video
  Optional: Previous court orders, Tax receipts

family_law:
  Critical: CNIC, Nikah Nama
  Important: Children CNICs, Mehr proof
  Optional: Property records, Income proof

criminal_fir:
  Critical: CNIC, Written complaint
  Important: Medical report, Witness names
  Optional: Photos, Call records, Evidence

labour_rights:
  Critical: CNIC, Employment contract
  Important: Salary slips, Termination letter
  Optional: Witness colleagues, Bank statements

For each missing document:
  - What it is (simple explanation)
  - Where to get it
  - Time required
  - Cost (free or Rs. amount)

Flag fraud_risk if suspicious patterns found.
Match user language: the explanations for missing documents (name, where_to_get, time_required, cost) MUST be in the target language (Urdu script, Roman Urdu, or English).
Return ONLY valid JSON. Do not include markdown formatting.
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
            response_schema=DocumentCheckerOutput,
        ),
    )
    return response.text

def run_document_checker(combined_context: dict) -> dict:
    try:
        result_str = run_agent_with_retry(_call_gemini, combined_context)
        res = json.loads(result_str)
        res["language_detected"] = combined_context.get("language_detected", "English")
        res["emotional_tone"] = combined_context.get("emotional_tone", "calm")
        return res
    except Exception as e:
        logger.error(f"Agent 5 failed: {e}")
        return {
            "agent": "DocumentChecker",
            "status": "failed",
            "fallback_used": True,
            "partial_output": {},
            "reason": str(e),
            "instruction_to_next_agent": "use available data and proceed",
            "language_detected": combined_context.get("language_detected", "English"),
            "emotional_tone": combined_context.get("emotional_tone", "calm"),
            "readiness_score": 0,
            "readiness_label": "Not Ready",
            "documents_found": [],
            "documents_missing": [],
            "score_breakdown": {"documents": 0, "witnesses": 0, "urgency_penalty": 0, "total": 0},
            "fraud_risk": "none",
            "fraud_risk_reason": None
        }
