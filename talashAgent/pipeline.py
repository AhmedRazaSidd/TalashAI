import asyncio
from agents.case_listener import run_case_listener
from agents.case_classifier import run_case_classifier
from agents.questioning_agent import run_questioning_agent
from agents.rights_analyzer import run_rights_analyzer
from agents.document_checker import run_document_checker
from agents.action_planner import run_action_planner
from agents.misguide_detector import run_misguide_detector
from agents.pdf_formatter import run_pdf_formatter

MESSAGES = {
    "English": {
        "agent1": "🎯 Agent 1: Understanding your problem...",
        "agent2": "✅ Agent 2: Case has been classified...",
        "agent3_check": "❓ Agent 3: Checking if questions are needed...",
        "agent3_questions": "❓ Agent 3: We have some questions...",
        "agent4": "🔍 Agent 4: Finding applicable laws... [Tool Call: search_legal_docs]",
        "agent5": "📋 Agent 5: Checking documents...",
        "agent6": "🗺️ Agent 6: Creating action plan... [Tool Call: search_legal_docs]",
        "agent7": "🛡️ Agent 7: Scam protection check...",
        "agent8": "📄 Agent 8: Formatting PDFs...\n               [Generating: Case Summary]\n               [Generating: Legal Draft]\n               [Generating: Legal Aid Letter]",
        "complete": "✅ Complete! Displaying results.",
        "api_limit": "API limit reached. Please try again after some time."
    },
    "Roman Urdu": {
        "agent1": "🎯 Agent 1: Aapka masla samajh rahe hain...",
        "agent2": "✅ Agent 2: Case classify ho gaya hai...",
        "agent3_check": "❓ Agent 3: Check kar rahe hain agar mazeed sawaalat ki zaroorat hai...",
        "agent3_questions": "❓ Agent 3: Kuch sawaalaat hain...",
        "agent4": "🔍 Agent 4: Mutalqa qawaneen dhoond rahe hain... [Tool Call: search_legal_docs]",
        "agent5": "📋 Agent 5: Documents check kar rahe hain...",
        "agent6": "🗺️ Agent 6: Action plan bana rahe hain... [Tool Call: search_legal_docs]",
        "agent7": "🛡️ Agent 7: Dhoka dahi se bachao ka check kar rahe hain...",
        "agent8": "📄 Agent 8: PDFs bana rahe hain...\n               [Bana rahe hain: Case Summary]\n               [Bana rahe hain: Legal Draft]\n               [Bana rahe hain: Legal Aid Letter]",
        "complete": "✅ Mukammal! Jawab dekhayein.",
        "api_limit": "API limit khatam ho gayi. Thodi der baad dobara try karein."
    },
    "Urdu": {
        "agent1": "🎯 ایجنٹ 1: آپ کا مسئلہ سمجھ رہے ہیں...",
        "agent2": "✅ ایجنٹ 2: کیس کی درجہ بندی ہو گئی ہے...",
        "agent3_check": "❓ ایجنٹ 3: چیک کر رہے ہیں کہ آیا مزید سوالات کی ضرورت ہے...",
        "agent3_questions": "❓ ایجنٹ 3: کچھ سوالات ہیں...",
        "agent4": "🔍 ایجنٹ 4: متعلقہ قوانین تلاش کر رہے ہیں... [Tool Call: search_legal_docs]",
        "agent5": "📋 ایجنٹ 5: دستاویزات چیک کر رہے ہیں...",
        "agent6": "🗺️ ایجنٹ 6: ایکشن پلان تیار کر رہے ہیں... [Tool Call: search_legal_docs]",
        "agent7": "🛡️ ایجنٹ 7: دھوکہ دہی سے بچاؤ کا چیک کر رہے ہیں...",
        "agent8": "📄 ایجنٹ 8: پی ڈی ایف فائلیں تیار کر رہے ہیں...\n               [تیار کر رہے ہیں: کیس کا خلاصہ]\n               [تیار کر رہے ہیں: قانونی ڈرافٹ]\n               [تیار کر رہے ہیں: قانونی امداد کا خط]",
        "complete": "✅ مکمل! جواب دکھایا جا رہا ہے۔",
        "api_limit": "API کی حد ختم ہو گئی ہے۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔"
    }
}

def normalize_lang(lang_str):
    if not lang_str:
        return "English"
    lang_str = str(lang_str).lower().strip()
    if "roman" in lang_str:
        return "Roman Urdu"
    if "urdu" in lang_str:
        return "Urdu"
    return "English"

def rephrase_question_gemini(question_text: str, user_confused_answer: str, lang: str) -> str:
    try:
        import os
        from google import genai
        client = genai.Client(vertexai=True, project="talash-496612", location="us-central1")
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
            model='gemini-1.5-flash',
            contents=f"Rephrase: {question_text}",
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,
            ),
        )
        return response.text.strip()
    except Exception:
        return question_text


async def run_pipeline_stream(user_input: str, input_type: str, answer_callback=None, category_hint: str | None = None):
    context = {"category_hint": category_hint} if category_hint else {}
    agents_succeeded = []
    agents_failed = []
    
    def check_rate_limit(res):
        return "RATE_LIMIT_429" in str(res.get("reason", ""))

    # First agent, language not known yet, show bilingual
    yield {"type": "status", "message": "🎯 Agent 1: Understanding your problem / Aapka masla samajh rahe hain..."}
    res1 = await asyncio.to_thread(run_case_listener, user_input, input_type)
    if check_rate_limit(res1):
        yield {"type": "error", "message": MESSAGES["English"]["api_limit"]}
        return
    if res1.get("status") == "failed": 
        agents_failed.append("Agent 1")
    else: 
        agents_succeeded.append("Agent 1")
    context.update(res1)
    
    lang = normalize_lang(context.get("language_detected"))
    yield {"type": "language", "language": lang}
    
    yield {"type": "status", "message": MESSAGES[lang]["agent2"]}
    res2 = await asyncio.to_thread(run_case_classifier, context)
    if check_rate_limit(res2):
        yield {"type": "error", "message": MESSAGES[lang]["api_limit"]}
        return
    if res2.get("status") == "failed": agents_failed.append("Agent 2")
    else: agents_succeeded.append("Agent 2")
    context.update(res2)

    yield {"type": "status", "message": MESSAGES[lang]["agent3_check"]}
    res3 = await asyncio.to_thread(run_questioning_agent, context)
    if check_rate_limit(res3):
        yield {"type": "error", "message": MESSAGES[lang]["api_limit"]}
        return
    if res3.get("status") == "failed": agents_failed.append("Agent 3")
    else: agents_succeeded.append("Agent 3")
    context.update({"questions_from_agent3": res3.get("questions", [])})

    questions = res3.get("questions", [])
    context["user_answers"] = []
    if questions and answer_callback:
        yield {"type": "status", "message": MESSAGES[lang]["agent3_questions"]}
        for q in questions:
            q_to_ask = q.copy()
            while True:
                ans_list = await answer_callback([q_to_ask])
                if not ans_list:
                    break
                user_ans = ans_list[0].get("answer", "")
                
                # Check if confusing
                ans_clean = user_ans.strip().lower()
                confused = False
                if not ans_clean:
                    confused = True
                else:
                    confusing_keywords = ["matlb", "samaj", "kya", "?"]
                    for kw in confusing_keywords:
                        if kw in ans_clean:
                            confused = True
                            break
                    if len([w for w in ans_clean.split() if w]) < 3:
                        confused = True
                
                if confused:
                    simplify_msg = {
                        "English": "Simplifying question...",
                        "Roman Urdu": "Sawaal aasan kar rahe hain...",
                        "Urdu": "سوال آسان کر رہے ہیں..."
                    }.get(lang, "Simplifying question...")
                    yield {"type": "status", "message": simplify_msg}
                    
                    rephrased = await asyncio.to_thread(rephrase_question_gemini, q_to_ask.get("question"), user_ans, lang)
                    q_to_ask["question"] = rephrased
                else:
                    context["user_answers"].append({
                        "question_id": q.get("id"),
                        "answer": user_ans
                    })
                    break

    yield {"type": "status", "message": MESSAGES[lang]["agent4"]}
    res4 = await asyncio.to_thread(run_rights_analyzer, context)
    if check_rate_limit(res4):
        yield {"type": "error", "message": MESSAGES[lang]["api_limit"]}
        return
    if res4.get("status") == "failed": agents_failed.append("Agent 4")
    else: agents_succeeded.append("Agent 4")
    context.update({"rights_analysis": res4})

    yield {"type": "status", "message": MESSAGES[lang]["agent5"]}
    res5 = await asyncio.to_thread(run_document_checker, context)
    if check_rate_limit(res5):
        yield {"type": "error", "message": MESSAGES[lang]["api_limit"]}
        return
    if res5.get("status") == "failed": agents_failed.append("Agent 5")
    else: agents_succeeded.append("Agent 5")
    context.update({"document_check": res5})

    yield {"type": "status", "message": MESSAGES[lang]["agent6"]}
    res6 = await asyncio.to_thread(run_action_planner, context)
    if check_rate_limit(res6):
        yield {"type": "error", "message": MESSAGES[lang]["api_limit"]}
        return
    if res6.get("status") == "failed": agents_failed.append("Agent 6")
    else: agents_succeeded.append("Agent 6")
    context.update({"action_plan": res6})

    yield {"type": "status", "message": MESSAGES[lang]["agent7"]}
    res7 = await asyncio.to_thread(run_misguide_detector, context)
    if check_rate_limit(res7):
        yield {"type": "error", "message": MESSAGES[lang]["api_limit"]}
        return
    if res7.get("status") == "failed": agents_failed.append("Agent 7")
    else: agents_succeeded.append("Agent 7")
    context.update({"scam_protection": res7})

    yield {"type": "status", "message": MESSAGES[lang]["agent8"]}
    res8 = await asyncio.to_thread(run_pdf_formatter, context)
    if check_rate_limit(res8):
        yield {"type": "error", "message": MESSAGES[lang]["api_limit"]}
        return
    if res8.get("status") == "failed": agents_failed.append("Agent 8")
    else: agents_succeeded.append("Agent 8")
    context.update({"pdfs": res8})

    yield {"type": "status", "message": MESSAGES[lang]["complete"]}

    final_output = {
        "pipeline_status": "complete" if not agents_failed else "partial",
        "agents_succeeded": agents_succeeded,
        "agents_failed": agents_failed,
        "emotional_tone": context.get("emotional_tone", "calm"),
        "final_output": context,
        "pdf_files": res8.get("pdf_files", [])
    }
    
    yield {"type": "final", "data": final_output}
