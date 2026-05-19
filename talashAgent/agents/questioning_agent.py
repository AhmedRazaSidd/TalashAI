import json
import logging
from pydantic import BaseModel, Field
from gemini_client import get_vertex_client, FAST_MODEL, make_config
import os

client = get_vertex_client()
logger = logging.getLogger(__name__)

class DynamicInvestigationDecision(BaseModel):
    confidence_score: float = Field(description="Confidence score from 0.0 to 1.0 on whether we have enough details to analyze and build a legal defense.")
    confidence_threshold_reached: bool = Field(description="True if confidence is >= 0.80 or if all major details are present. Otherwise False.")
    missing_information: list[str] = Field(description="List of key missing topics or details still needed for this case.")
    answered_topics: dict[str, str] = Field(description="A mapping of topics that have been answered so far to their summarized answers.")
    
    pause_for_user: bool = Field(description="True if we must pause and ask the user a question. False if we can proceed.")
    question: str | None = Field(description="The friendly, conversational question in the user's language. Use simple everyday words, no legal jargon.")
    reason: str | None = Field(description="Why this question is legally important for the defense.")
    expected_information: str | None = Field(description="A clean snake_case slug representing the topic (e.g. sale_deed_registration).")
    priority: str | None = Field(description="high | medium | low")

system_prompt = """
You are INSAAF OS Dynamic Investigation Engine (QuestioningAgent). 
Your task is to conduct a highly professional, empathetic, and intelligent legal investigation of a Pakistani legal case. 
You act like a supportive legal advisor and a trusted friend, NOT like a generic form.

Your primary objective is to dynamically gather critical facts needed to build a strong legal defense, analyze rights, and design an actionable step-by-step resolution.

---

### CATEGORY-SPECIFIC INVESTIGATION FOCUS:
1. **Property Dispute**:
   - Possession details (Who is currently on the land? Since when?)
   - Written deeds (Is there an registry/inteqal/fard? Is it registered?)
   - Boundaries (Are boundary markers disputed?)
   - Inheritance (Is it inherited? Are other heirs claiming parts?)
2. **Family Law**:
   - Nikahnama (Is it registered or informal?)
   - Dower (Is the Mehr amount written? Paid or pending?)
   - Children (Are minors involved? Custody or maintenance issues?)
   - Divorce (Is there written talaq, khula file, or notice to union council?)
3. **Cybercrime**:
   - Platform/Medium (Whatsapp, Facebook, email?)
   - Monetary Loss (Bank transfers, easy-paisa records?)
   - Suspect Identity (Known person or anonymous?)
   - Authority Contacted (Has FIA cybercrime portal been reported?)
4. **Harassment**:
   - Location (Workplace, educational institution, public place?)
   - Evidence (Do messages, voice notes, call records, or videos exist?)
   - Witnesses (Was anyone else present?)
   - Relationship (Is it a supervisor, colleague, stranger?)
5. **Fraud**:
   - Money Trail (How was money paid? Bank transfer, cheque, or cash?)
   - Written Contract (Is there an agreement on stamp paper or a verbal pact?)
   - Guarantees (Are there bounce cheques or promissory notes?)

---

### STRATEGY & RULES:
1. **Memory & Repetition Prevention**:
   - Analyze `user_problem` and `answers` already provided by the user.
   - Do NOT ask a question if the answer is already stated or implied.
   - Update `answered_topics` to map completed items.
   - List key missing items in `missing_information`.

2. **Stopping Criteria / Confidence**:
   - Evaluate your `confidence_score` (0.0 to 1.0) of having enough details to formulate an action plan and legal defense.
   - If confidence is >= 0.80 or there are no more 'high' or 'medium' priority missing items, set `confidence_threshold_reached: True`, `pause_for_user: False`, and let the pipeline proceed!
   - Continue asking follow-up questions sequentially (one question per pause) until confidence is satisfied or max follow-ups reached.

3. **Conversational Urdu/English Formulation**:
   - Detect the user's language (Roman Urdu, Urdu script, or English) from their problem description and previous messages. Respond in the EXACT same language/style.
   - Ask only ONE single question at a time.
   - Keep questions extremely simple, conversational, and direct. Avoid court vocabulary (e.g. instead of 'Title Deed', ask 'Zameen ke kagzat ya registry').

Return ONLY valid JSON matching the schema.
"""

def _call_gemini(combined_context: dict) -> str:
    lang = combined_context.get("language_detected", "English")
    
    # Clean and streamline payload for Gemini to focus on investigation
    compact_payload = {
        "user_problem": combined_context.get("user_problem"),
        "category": combined_context.get("category") or combined_context.get("category_hint", "General"),
        "language_detected": lang,
        "answers": combined_context.get("answers", {}).get("QuestioningAgent", {}),
        "investigation_memory": combined_context.get("investigation_memory", {
            "already_asked_questions": [],
            "answered_topics": {},
            "missing_information": [],
            "confidence_score": 0.0
        })
    }
    
    prompt = f"Target Language: {lang}\nContext:\n{json.dumps(compact_payload, indent=2)}"
    response = client.models.generate_content(
        model=FAST_MODEL,
        contents=prompt,
        config=make_config(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=DynamicInvestigationDecision,
        ),
    )
    return response.text

def run_questioning_agent(combined_context: dict, on_trace=None) -> dict:
    try:
        if on_trace:
            on_trace("❓ Agent 3: Upgrading to dynamic AI-driven legal investigation...")
        
        # Load or initialize investigation memory
        memory = combined_context.get("investigation_memory")
        if not memory:
            memory = {
                "already_asked_questions": [],
                "answered_topics": {},
                "missing_information": [],
                "confidence_score": 0.0
            }
        
        # Sync latest dynamic answers from gateway into answered_topics
        agent_answers = combined_context.get("answers", {}).get("QuestioningAgent", {})
        for k, v in agent_answers.items():
            if k not in ["investigation_memory", "last_expected_input"] and k not in memory["answered_topics"]:
                memory["answered_topics"][k] = v
                if k in memory["missing_information"]:
                    memory["missing_information"].remove(k)

        combined_context["investigation_memory"] = memory

        result_str = _call_gemini(combined_context)
        res = json.loads(result_str)
        
        # Merge LLM updates into investigation memory
        memory["confidence_score"] = res.get("confidence_score", 0.0)
        memory["missing_information"] = res.get("missing_information", [])
        
        # Sync any newly matched topics
        for k, v in res.get("answered_topics", {}).items():
            memory["answered_topics"][k] = v

        # If a question was generated, append to already_asked_questions
        if res.get("pause_for_user") and res.get("question"):
            q_text = res.get("question")
            if q_text not in memory["already_asked_questions"]:
                memory["already_asked_questions"].append(q_text)
                
            if on_trace:
                on_trace(f"❓ Questioning details: {res.get('reason')} [Expected: {res.get('expected_information')}]")

        res["investigation_memory"] = memory
        res["agent"] = "QuestioningAgent"
        
        # Map questions_from_agent3 array to preserve compatibility with existing UI/tests if needed
        res["questions_from_agent3"] = memory["already_asked_questions"]
        
        return res
        
    except Exception as e:
        logger.error(f"Agent 3 dynamic questioning failed: {e}")
        fallback_memory = combined_context.get("investigation_memory", {
            "already_asked_questions": [],
            "answered_topics": {},
            "missing_information": [],
            "confidence_score": 1.0
        })
        return {
            "agent": "QuestioningAgent",
            "pause_for_user": False,
            "status": "failed",
            "fallback_used": True,
            "reason": str(e),
            "investigation_memory": fallback_memory,
            "questions_from_agent3": fallback_memory.get("already_asked_questions", [])
        }
