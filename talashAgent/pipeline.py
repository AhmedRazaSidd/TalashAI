import asyncio
import time
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
        from google import genai
        from gemini_client import get_vertex_client, FAST_MODEL
        client = get_vertex_client()
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
    except Exception:
        return question_text


async def call_agent_with_retry(agent_fn, *args, **kwargs):
    max_attempts = 2
    for attempt in range(max_attempts):
        try:
            res = await asyncio.to_thread(agent_fn, *args, **kwargs)
            if res and res.get("status") != "failed":
                return res
            if attempt < max_attempts - 1:
                print(f"[Pipeline Retry] ⚠️ {agent_fn.__name__} failed (attempt {attempt + 1}/{max_attempts}). Retrying in 1s...")
                await asyncio.sleep(1)
        except Exception as e:
            if attempt < max_attempts - 1:
                print(f"[Pipeline Retry] ⚠️ {agent_fn.__name__} raised exception: {e} (attempt {attempt + 1}/{max_attempts}). Retrying in 1s...")
                await asyncio.sleep(1)
            else:
                raise e
    # Final fallback attempt
    return await asyncio.to_thread(agent_fn, *args, **kwargs)


async def run_pipeline_stream(
    user_input: str,
    input_type: str,
    answer_callback=None,
    category_hint: str | None = None,
    prior_context: dict | None = None,
    target_agent: str | None = None,
):
    context = {"category_hint": category_hint} if category_hint else {}
    lang = "English"

    if prior_context:
        print(f"[Pipeline] Seeding {len(prior_context)} keys from prior_context: {list(prior_context.keys())}")
        context.update(prior_context)
        lang = normalize_lang(context.get("language_detected"))

    steps = {
        "CaseListener": {
            "msg_key": "agent1",
            "run": lambda callback: call_agent_with_retry(run_case_listener, user_input, input_type, on_trace=callback),
            "update": lambda res: context.update(res)
        },
        "CaseClassifier": {
            "msg_key": "agent2",
            "run": lambda callback: call_agent_with_retry(run_case_classifier, context, on_trace=callback),
            "update": lambda res: context.update(res)
        },
        "QuestioningAgent": {
            "msg_key": "agent3_check",
            "run": lambda callback: call_agent_with_retry(run_questioning_agent, context, on_trace=callback),
            "update": lambda res: context.update({
                "investigation_memory": res.get("investigation_memory", {}),
                "questions_from_agent3": res.get("questions_from_agent3", [])
            })
        },
        "RightsAnalyzer": {
            "msg_key": "agent4",
            "run": lambda callback: call_agent_with_retry(run_rights_analyzer, context, on_trace=callback),
            "update": lambda res: context.update({"rights_analysis": res})
        },
        "DocumentChecker": {
            "msg_key": "agent5",
            "run": lambda callback: call_agent_with_retry(run_document_checker, context, on_trace=callback),
            "update": lambda res: context.update({"document_check": res})
        },
        "ActionPlanner": {
            "msg_key": "agent6",
            "run": lambda callback: call_agent_with_retry(run_action_planner, context, on_trace=callback),
            "update": lambda res: context.update({"action_plan": res})
        },
        "MisguideDetector": {
            "msg_key": "agent7",
            "run": lambda callback: call_agent_with_retry(run_misguide_detector, context, on_trace=callback),
            "update": lambda res: context.update({"scam_protection": res})
        },
        "PdfFormatter": {
            "msg_key": "agent8",
            "run": lambda callback: call_agent_with_retry(run_pdf_formatter, context, on_trace=callback),
            "update": lambda res: context.update({"pdfs": res})
        }
    }

    if not target_agent or target_agent not in steps:
        yield {"type": "status", "message": f"❌ Error: target_agent '{target_agent}' not found."}
        yield {"type": "final", "data": {"error": f"Invalid agent: {target_agent}"}}
        return

    step = steps[target_agent]
    
    if target_agent == "CaseListener":
        yield {"type": "status", "message": "🎯 Agent 1: Understanding your problem / Aapka masla samajh rahe hain..."}
    else:
        yield {"type": "status", "message": MESSAGES[lang][step["msg_key"]]}

    # Set up thread-safe trace queue and callback
    trace_queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def on_trace(msg: str):
        loop.call_soon_threadsafe(trace_queue.put_nowait, msg)

    try:
        # Run agent concurrently with queue polling
        agent_task = asyncio.create_task(step["run"](on_trace))
        
        while not agent_task.done():
            try:
                trace_msg = await asyncio.wait_for(trace_queue.get(), timeout=0.1)
                yield {"type": "status", "message": trace_msg}
            except asyncio.TimeoutError:
                continue

        result = await agent_task

        # Drain remaining traces
        while not trace_queue.empty():
            trace_msg = trace_queue.get_nowait()
            yield {"type": "status", "message": trace_msg}
        
        # Check if the agent requested a pause
        if result.get("pause_for_user") == True:
            yield {"type": "status", "message": f"⏸️ {target_agent} paused for input..."}
            yield {"type": "final", "data": {
                "pause_for_user": True,
                "agent": target_agent,
                "question": result.get("question"),
                "expected_input": result.get("expected_input") or result.get("expected_information") or "generic_reply",
                "expected_information": result.get("expected_information"),
                "reason": result.get("reason"),
                "priority": result.get("priority"),
                "partial_output": context
            }}
            return

        # Otherwise, process the successful run
        step["update"](result)

        if target_agent == "CaseListener":
            lang = normalize_lang(context.get("language_detected"))
            yield {"type": "language", "language": lang}

    except Exception as e:
        print(f"Agent failed: {e}")
        yield {"type": "final", "data": {"status": "failed", "error": str(e), "agent": target_agent}}
        return

    # Agent completed successfully without pausing
    final_output = {
        "pipeline_status": "agent_complete",
        "agent": target_agent,
        "final_output": context,
        "pdf_files": context.get("pdfs", {}).get("pdf_files", []) if isinstance(context.get("pdfs"), dict) else []
    }
    
    yield {"type": "final", "data": final_output}
