import json
import logging
from pydantic import BaseModel, Field
from gemini_client import get_vertex_client, DEEP_MODEL, make_config
import os

client = get_vertex_client()

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
    lang = combined_context.get("language_detected", "English")
    prompt = f"Target Language: {lang}\nContext:\n{json.dumps(combined_context)}"
    response = client.models.generate_content(
        model=DEEP_MODEL,
        contents=prompt,
        config=make_config(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=DocumentCheckerOutput,
        ),
    )
    return response.text

def run_document_checker(combined_context: dict, on_trace=None) -> dict:
    try:
        category = combined_context.get("category_hint", "General")
        
        # Check answers from MongoDB workflow state
        answers = combined_context.get("answers", {})
        doc_answers = answers.get("DocumentChecker", {})
        
        has_registry = doc_answers.get("has_registry")
        has_fard = doc_answers.get("has_fard")
        
        # We enforce document questions for property/land disputes or General classifications
        is_property_case = any(x in str(category).lower() for x in ["property", "dispute", "qabza", "land", "general"])
        
        if is_property_case:
            if has_registry is None:
                return {
                    "pause_for_user": True,
                    "question": "Aapke paas registry (Title deed) hai?",
                    "expected_input": "has_registry",
                    "agent": "DocumentChecker"
                }
            elif has_fard is None:
                return {
                    "pause_for_user": True,
                    "question": "Fard ya inteqal available hai?",
                    "expected_input": "has_fard",
                    "agent": "DocumentChecker"
                }

        result_str = _call_gemini(combined_context)
        res = json.loads(result_str)
        res["language_detected"] = combined_context.get("language_detected", "English")
        res["emotional_tone"] = combined_context.get("emotional_tone", "calm")
        
        # Enforce exact keys for missing documents requested in Step 5
        missing_docs = res.get("documents_missing", [])
        mapped_missing = []
        for doc in missing_docs:
            name = doc.get("name", "Document")
            where = doc.get("where_to_get", "Relevant Office")
            cost_str = str(doc.get("cost", "500"))
            time_str = str(doc.get("time_required", "2"))
            
            # Simple numeric extraction helper
            import re
            cost_nums = re.findall(r'\d+', cost_str)
            cost_pkr = int(cost_nums[0]) if cost_nums else 500
            
            time_nums = re.findall(r'\d+', time_str)
            days = int(time_nums[0]) if time_nums else 2
            
            mapped_missing.append({
                "name": name,
                "urgency": doc.get("urgency", "medium"),
                "where_to_get": where,
                "time_required": time_str,
                "cost": cost_str,
                "document": name,
                "location": where,
                "estimated_cost_pkr": cost_pkr,
                "estimated_days": days
            })
        res["documents_missing"] = mapped_missing
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
