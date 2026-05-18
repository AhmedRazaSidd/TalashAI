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
   - Detect the user's language automatically from the conversation context and respond in the exact same language (e.g., Roman Urdu, Urdu script, or English).
   
2. Simple & Friendly Communication:
   - Ask questions in extremely simple, everyday language. Act like you are talking to a friend who has never been to a court in their life.
   - Strictly avoid legal terms or jargon. If a legal term is absolutely necessary, explain it in the simplest possible terms in the same sentence.

3. Handling Confusion & Irrelevant Answers:
   - If the user seems confused by a question, does not understand, asks for clarification (e.g., saying "matlb?", "samaj nahi", "kya", or similar), or gives an irrelevant answer:
     - DO NOT move to the next question.
     - Understand their confusion and explain the same question differently using simpler words.
     - Never move to the next question until the current question has been properly and clearly answered.

4. Questioning Rules:
   - MAX 4 questions — never exceed.
   - Yes/No or short answer questions only.
   - Do not repeat already known facts.
   - If all info available: return empty array for questions and provide skip_reason.

Question priorities by category:

inheritance/property:
  1. Is sale deed registered?
  2. Is death certificate available?
  3. Are other heirs involved?
  4. Are CNICs available?

family_law:
  1. Is nikah registered?
  2. Are children involved?
  3. Is mehr amount documented?
  4. Is there written talaq?

criminal_fir:
  1. When did incident happen?
  2. Are there witnesses?
  3. Was police already contacted?
  4. Are there injuries or evidence?

labour_rights:
  1. Is there written contract?
  2. How long employed?
  3. Was termination in writing?
  4. Are salary slips available?

Return ONLY valid JSON. Do not include markdown formatting.
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

def run_questioning_agent(combined_context: dict, on_trace=None) -> dict:
    try:
        result_str = _call_gemini(combined_context)
        res = json.loads(result_str)
        res["language_detected"] = combined_context.get("language_detected", "English")
        res["emotional_tone"] = combined_context.get("emotional_tone", "calm")
        return res
    except Exception as e:
        logger.error(f"Agent 3 failed: {e}")
        return {
            "agent": "QuestioningAgent",
            "status": "failed",
            "fallback_used": True,
            "partial_output": {},
            "reason": str(e),
            "instruction_to_next_agent": "use available data and proceed",
            "language_detected": combined_context.get("language_detected", "English"),
            "emotional_tone": combined_context.get("emotional_tone", "calm"),
            "questions": [],
            "skip_reason": "Error generating questions"
        }
