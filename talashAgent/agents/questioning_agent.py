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
Your task is to conduct a professional, empathetic legal investigation of a Pakistani legal case.
You act like a supportive legal advisor — NOT like a generic form.

Your primary objective: gather the 4 most critical missing facts needed to build a strong legal defense.

---

### CATEGORY-SPECIFIC INVESTIGATION FOCUS:
1. **Property Dispute / Kabza**:
   - Possession details (Who is on the land? Since when?)
   - Written deeds (Registry / Inteqal / Fard available?)
   - Boundaries (Disputed boundary markers?)
   - Inheritance (Inherited land? Other heirs claiming?)
2. **Family Law**:
   - Nikahnama (Registered or informal?)
   - Dower (Mehr amount written? Paid or pending?)
   - Children (Minors involved? Custody or maintenance?)
   - Divorce (Written talaq, khula file, union council notice?)
3. **Criminal / FIR**:
   - Incident details (When, where, how?)
   - Evidence (Photos, videos, medical reports?)
   - Witnesses (Names available?)
   - Police action (FIR filed? Police response?)
4. **Labour Rights**:
   - Employment contract (Written or verbal?)
   - Salary proof (Slips, bank statements?)
   - Termination (Written notice? Reason given?)
   - Dues (Unpaid salary, gratuity, EOBI?)
5. **Fraud / Scam**:
   - Money trail (Bank transfer, cheque, cash?)
   - Written contract (Stamp paper or verbal?)
   - Suspect identity (Known or anonymous?)
   - Evidence collected (Receipts, messages, screenshots?)

---

### STRICT RULES:
1. **Ask EXACTLY 4 questions total** across all turns — no more, no less.
   - Track how many questions have been asked in `already_asked_questions`.
   - If fewer than 4 questions have been asked AND missing_information still exists → ALWAYS set pause_for_user: true.
   - Only set confidence_threshold_reached: true after at minimum 3 questions have been answered.
2. **Memory & Repetition Prevention**:
   - NEVER repeat a question already in `already_asked_questions`.
   - Mark answered topics in `answered_topics`.
3. **One question at a time** — ask the MOST CRITICAL missing piece first.
4. **Simple language** — no legal jargon. Use everyday words.
   - Instead of "Title Deed" say "Zameen ki registry ya kagzat"
   - Instead of "Registered instrument" say "Kya yeh kisi office mein darj hai?"
5. **Confidence scoring**:
   - Start at 0.0. Add 0.25 per good answer received.
   - Only set confidence_threshold_reached: true if score >= 0.75 AND at least 3 questions answered.
6. Respond in the EXACT language detected (Roman Urdu, Urdu script, or English).

Return ONLY valid JSON matching the schema.
"""

def _call_gemini(combined_context: dict) -> str:
    lang = combined_context.get("language_detected", "English")
    memory = combined_context.get("investigation_memory", {})
    questions_asked = len(memory.get("already_asked_questions", []))
    
    # Clean and streamline payload for Gemini
    compact_payload = {
        "user_problem": combined_context.get("user_problem") or combined_context.get("cleaned_input", ""),
        "category": combined_context.get("category") or combined_context.get("primary_category") or combined_context.get("category_hint", "General"),
        "language_detected": lang,
        "questions_asked_so_far": questions_asked,
        "max_questions": 4,
        "answers": combined_context.get("answers", {}).get("QuestioningAgent", {}),
        "investigation_memory": memory,
    }
    
    prompt = f"Target Language: {lang}\nQuestions asked so far: {questions_asked} / 4 (max)\nContext:\n{json.dumps(compact_payload, indent=2)}"
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
        logger.info("[QuestioningAgent START] Running dynamic investigation...")
        if on_trace:
            on_trace("Agent 3: Analyzing what information is still needed...")

        # Load or initialize investigation memory
        memory = combined_context.get("investigation_memory") or {
            "already_asked_questions": [],
            "answered_topics": {},
            "missing_information": [],
            "confidence_score": 0.0,
        }

        # Sync latest answers into answered_topics
        agent_answers = combined_context.get("answers", {}).get("QuestioningAgent", {})
        if not isinstance(agent_answers, dict):
            agent_answers = {}
            
        logger.info(f"[QuestioningAgent RESUMING] Agent answers so far: {agent_answers}")
        # Ensure required keys exist (MongoDB might drop empty dicts/lists)
        memory.setdefault("already_asked_questions", [])
        memory.setdefault("answered_topics", {})
        memory.setdefault("missing_information", [])
        memory.setdefault("confidence_score", 0.0)

        print(f"[QUESTION_STATE_RESTORED] QuestioningAgent state loaded: {len(memory.get('already_asked_questions', []))} questions asked previously.")
        print(f"[MEMORY_KEYS] investigation_memory keys: {list(memory.keys())}")

        for k, v in agent_answers.items():
            if k not in ("investigation_memory", "last_expected_input") and k not in memory["answered_topics"]:
                memory["answered_topics"][k] = v
                if isinstance(memory.get("missing_information"), list) and k in memory["missing_information"]:
                    memory["missing_information"].remove(k)

        combined_context["investigation_memory"] = memory
        questions_asked = len(memory.get("already_asked_questions", []))

        # ── Hard enforcement: if we've asked 4 questions already, always proceed ──
        if questions_asked >= 4:
            if on_trace:
                on_trace("Agent 3: 4 questions answered. Proceeding to rights analysis...")
            memory["confidence_score"] = 1.0
            logger.info("[QuestioningAgent COMPLETED] Reached max questions.")
            return {
                "agent": "QuestioningAgent",
                "pause_for_user": False,
                "confidence_threshold_reached": True,
                "confidence_score": 1.0,
                "investigation_memory": memory,
                "questions_from_agent3": memory["already_asked_questions"],
                "status": "success",
            }

        result_str = _call_gemini(combined_context)
        res = json.loads(result_str)

        # Merge LLM memory updates safely handling nulls
        memory["confidence_score"] = res.get("confidence_score") or 0.0
        memory["missing_information"] = res.get("missing_information") or []
        
        answered_topics = res.get("answered_topics") or {}
        for k, v in answered_topics.items():
            memory["answered_topics"][k] = v

        # ── Enforce: if fewer than 3 questions asked, ALWAYS pause ──────────────
        missing_info = res.get("missing_information") or []
        if questions_asked < 3 and missing_info:
            # Override any early confidence_threshold_reached
            res["confidence_threshold_reached"] = False
            res["pause_for_user"] = True
            # Generate a question if the LLM didn't
            if not res.get("question") and missing_info:
                topic = missing_info[0]
                res["question"] = f"Can you tell me about: {topic}?"
                res["expected_information"] = str(topic).lower().replace(" ", "_")
                res["priority"] = "high"

        # Track question in memory
        if res.get("pause_for_user") and res.get("question"):
            q_text = res["question"]
            logger.info(f"[QuestioningAgent QUESTION GENERATED] {q_text}")
            logger.info("[QuestioningAgent WAITING FOR USER]")
            if q_text not in memory["already_asked_questions"]:
                memory["already_asked_questions"].append(q_text)
            if on_trace:
                on_trace(f"Agent 3: Asking question {len(memory['already_asked_questions'])}/4 — {res.get('reason', '')}")
        else:
            logger.info("[QuestioningAgent COMPLETED] LLM decided no more questions needed.")

        res["investigation_memory"] = memory
        res["agent"] = "QuestioningAgent"
        res["questions_from_agent3"] = memory["already_asked_questions"]
        return res

    except Exception as e:
        logger.error(f"Agent 3 dynamic questioning failed: {e}")
        fallback_memory = combined_context.get("investigation_memory", {
            "already_asked_questions": [],
            "answered_topics": {},
            "missing_information": [],
            "confidence_score": 1.0,
        })
        return {
            "agent": "QuestioningAgent",
            "pause_for_user": False,
            "status": "failed",
            "fallback_used": True,
            "reason": str(e),
            "investigation_memory": fallback_memory,
            "questions_from_agent3": fallback_memory.get("already_asked_questions", []),
        }
