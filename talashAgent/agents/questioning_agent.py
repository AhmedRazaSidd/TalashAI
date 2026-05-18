import json
import logging
from pydantic import BaseModel, Field
from gemini_client import get_vertex_client, FAST_MODEL
from google import genai
import os

client = get_vertex_client()
logger = logging.getLogger(__name__)

class QuestionItem(BaseModel):
    id: int
    question: str = Field(description="The question in the matched language")
    why_important: str

class QuestioningAgentOutput(BaseModel):
    status: str = Field(description="success | partial | failed")
    questions: list[QuestionItem]
    skip_reason: str | None

system_prompt = """
You are INSAAF OS QuestioningAgent. You behave like a helpful, intelligent friend—not a form to fill.

Generate MAXIMUM 4 questions to fill critical missing information gaps.

Rules:
1. Language Detection & Consistency:
   - Respond in the exact same language (e.g., Roman Urdu, Urdu script, or English).
   
2. Simple & Friendly Communication:
   - Ask questions in extremely simple, everyday language. Act like you are talking to a friend who has never been to a court in their life.
   - Strictly avoid legal terms or jargon. If a legal term is absolutely necessary, explain it in the simplest possible terms in the same sentence.

3. Questioning Rules:
   - MAX 4 questions — never exceed.
   - Yes/No or short answer questions only.
   - Do not repeat already known facts.
   - If all info available: return empty array for questions and provide skip_reason.

Question priorities by category:
- property: sale deed registered, death certificate available, other heirs involved, CNICs available.
- family: nikah registered, children involved, mehr amount documented, written talaq.
- criminal: incident date, witnesses, police contacted, injuries or evidence.
- general: when it happened, documents available, opposing party known.

Return ONLY valid JSON in the requested schema. Do not include markdown formatting.
"""

def _call_gemini(combined_context: dict):
    lang = combined_context.get("language_detected", "English")
    prompt = f"Target Language: {lang}\nContext:\n{json.dumps(combined_context)}"
    response = client.models.generate_content(
        model=FAST_MODEL,
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=QuestioningAgentOutput,
        ),
    )
    return response.text

def rephrase_question_gemini(question_text: str, user_confused_answer: str, lang: str) -> str:
    try:
        system_instruction = (
            "You are a helpful, extremely friendly legal assistant. "
            f"The user is confused by the question: '{question_text}'. "
            f"Their confused response was: '{user_confused_answer}'. "
            f"Rephrase this question in much simpler, everyday, conversational words. "
            f"Do NOT ask a different question. Rephrase the same question. "
            f"Respond ONLY with the rephrased question in the user's language ({lang}). "
            "Do not include any extra text, introduction, or explanation."
        )
        response = client.models.generate_content(
            model=FAST_MODEL,
            contents=f"Rephrase: {question_text}",
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,
            ),
        )
        return response.text.strip()
    except Exception as e:
        logger.error(f"Failed to rephrase question: {e}")
        return question_text

def check_confusion(user_response: str, question: str) -> bool:
    if not user_response:
        return False
    user_response_lower = str(user_response).lower().strip()
    
    # Check basic Roman Urdu, Urdu script, and English confusion keywords
    confusion_keywords = [
        "what", "kya", "samajh nahi", "samaj nahi", "explain", "clarify", "matlab", "matlb",
        "kia", "rephrase", "confused", "meaning", "nahin pata", "pata nahi", "pata nahin",
        "سمجھ نہیں", "کیا", "مطلب", "وضاحت"
    ]
    if any(kw in user_response_lower for kw in confusion_keywords):
        return True
        
    try:
        system_instruction = (
            "Determine if the user's response indicates confusion, lack of understanding, or asks for clarification "
            "about the question asked. Reply with exactly 'TRUE' or 'FALSE'.\n"
            f"Question: {question}\n"
            f"User Response: {user_response}"
        )
        response = client.models.generate_content(
            model=FAST_MODEL,
            contents="Is the user confused?",
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,
            ),
        )
        return "true" in response.text.strip().lower()
    except Exception:
        return False

def run_questioning_agent(combined_context: dict, on_trace=None) -> dict:
    try:
        lang = combined_context.get("language_detected", "English")
        qa_state = combined_context.get("answers", {}).get("QuestioningAgent", {})
        
        # Ensure we always treat qa_state as a dict
        if not isinstance(qa_state, dict):
            qa_state = {}
        
        # 1. Generate questions if not already exists in state
        if "questions_list" not in qa_state:
            if on_trace:
                on_trace("❓ Formulating simple, friendly clarification questions for your case...")
            
            result_str = _call_gemini(combined_context)
            res = json.loads(result_str)
            
            questions = [q.get("question") if isinstance(q, dict) else str(q) for q in res.get("questions", [])]
            
            # Strict limit: max 4 questions
            questions = questions[:4]
            
            if not questions:
                # Friendly fallback questions
                questions = [
                    "Aapke paas is property ke registry papers ya Inteqal available hai?",
                    "Kya is incident ke koi gawah (witnesses) majood hain?",
                    "Aapne pehle is maslay ke liye police ya adalat se rabta kiya hai?"
                ] if "urdu" in lang.lower() or "roman" in lang.lower() else [
                    "Do you have the registered deed or property documents with you?",
                    "Are there any witnesses who can support your case?",
                    "Have you already reported this to the police or any court?"
                ]
            
            first_q = questions[0]
            
            return {
                "pause_for_user": True,
                "question": first_q,
                "expected_input": "q1",
                "questions_list": questions,
                "current_index": 0,
                "last_question": first_q,
                "rephrase_count": 0,
                "last_expected_input": "q1"
            }
            
        # 2. Check the answer to the current question
        questions_list = qa_state.get("questions_list", [])
        current_index = qa_state.get("current_index", 0)
        last_question = qa_state.get("last_question", "")
        rephrase_count = qa_state.get("rephrase_count", 0)
        
        latest_expected_key = f"q{current_index + 1}"
        user_response = qa_state.get(latest_expected_key, "")
        
        # Check if user indicates confusion
        is_confused = check_confusion(user_response, last_question)
        
        if is_confused:
            if on_trace:
                on_trace("🤝 Confusion detected! Rephrasing question into much simpler terms...")
            
            rephrased_q = rephrase_question_gemini(last_question, user_response, lang)
            
            return {
                "pause_for_user": True,
                "question": rephrased_q,
                "expected_input": latest_expected_key,
                "questions_list": questions_list,
                "current_index": current_index,
                "last_question": rephrased_q,
                "rephrase_count": rephrase_count + 1,
                "last_expected_input": latest_expected_key
            }
            
        # No confusion! Move to the next question
        next_index = current_index + 1
        
        if next_index < len(questions_list):
            next_q = questions_list[next_index]
            next_expected_key = f"q{next_index + 1}"
            
            return {
                "pause_for_user": True,
                "question": next_q,
                "expected_input": next_expected_key,
                "questions_list": questions_list,
                "current_index": next_index,
                "last_question": next_q,
                "rephrase_count": 0,
                "last_expected_input": next_expected_key
            }
            
        # 3. All questions answered! Proceed to next agent
        if on_trace:
            on_trace("✅ All clarification questions answered successfully.")
            
        return {
            "status": "success",
            "questions_list": questions_list,
            "current_index": next_index,
            "last_expected_input": "complete"
        }
        
    except Exception as e:
        logger.error(f"Agent 3 failed: {e}")
        return {
            "agent": "QuestioningAgent",
            "status": "failed",
            "reason": str(e)
        }
