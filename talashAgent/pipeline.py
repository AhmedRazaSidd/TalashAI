import asyncio
import time
import os
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

# Load server/.env to get Cloudinary credentials
load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

def upload_pdf_to_cloudinary(file_path: str) -> str:
    result = cloudinary.uploader.upload(
        file_path,
        resource_type="raw",
        type="upload",
        folder="legal_docs",
        access_mode="public"
    )
    return result["secure_url"]
from agents.case_listener import run_case_listener
from agents.case_classifier import run_case_classifier
from agents.questioning_agent import run_questioning_agent
from agents.rights_analyzer import run_rights_analyzer
from agents.document_checker import run_document_checker
from agents.action_planner import run_action_planner
from agents.misguide_detector import run_misguide_detector
from agents.pdf_formatter import run_pdf_formatter

# ─── Status messages shown to the user while each agent runs ──────────────────
MESSAGES = {
    "English": {
        "agent1":        "Agent 1: Understanding your problem...",
        "agent2":        "Agent 2: Classifying your case type...",
        "agent3_check":  "Agent 3: Investigating your case details...",
        "agent4":        "Agent 4: Searching Pakistani law database...",
        "agent5":        "Agent 5: Checking your document readiness...",
        "agent6":        "Agent 6: Building your step-by-step action plan...",
        "agent7":        "Agent 7: Running scam & misguide protection check...",
        "agent8":        "Agent 8: Generating your 3 legal PDF documents...",
        "complete":      "Complete! All 8 steps done. Your full legal report is ready.",
        "api_limit":     "API limit reached. Please try again after some time.",
    },
    "Roman Urdu": {
        "agent1":        "Agent 1: Aapka masla samajh rahe hain...",
        "agent2":        "Agent 2: Aapke case ki type classify kar rahe hain...",
        "agent3_check":  "Agent 3: Aapke case ki tafseel investigate kar rahe hain...",
        "agent4":        "Agent 4: Pakistani qanoon database search kar rahe hain...",
        "agent5":        "Agent 5: Documents ki tayyari check kar rahe hain...",
        "agent6":        "Agent 6: Step-by-step action plan bana rahe hain...",
        "agent7":        "Agent 7: Scam aur dhoka dahi protection check kar rahe hain...",
        "agent8":        "Agent 8: Aapke 3 qanooni PDF documents bana rahe hain...",
        "complete":      "Mukammal! Tamam 8 steps ho gaye. Aapki poori qanooni report tayyar hai.",
        "api_limit":     "API limit khatam. Thodi der baad dobara koshish karein.",
    },
    "Urdu": {
        "agent1":        "ایجنٹ 1: آپ کا مسئلہ سمجھ رہے ہیں...",
        "agent2":        "ایجنٹ 2: آپ کے کیس کی قسم درجہ بند کر رہے ہیں...",
        "agent3_check":  "ایجنٹ 3: کیس کی تفصیلات کی تحقیق کر رہے ہیں...",
        "agent4":        "ایجنٹ 4: پاکستانی قانون کا ڈیٹا بیس تلاش کر رہے ہیں...",
        "agent5":        "ایجنٹ 5: دستاویزات کی تیاری چیک کر رہے ہیں...",
        "agent6":        "ایجنٹ 6: مرحلہ وار ایکشن پلان بنا رہے ہیں...",
        "agent7":        "ایجنٹ 7: دھوکہ دہی سے بچاؤ کا چیک کر رہے ہیں...",
        "agent8":        "ایجنٹ 8: آپ کے 3 قانونی PDF دستاویزات بنا رہے ہیں...",
        "complete":      "مکمل! تمام 8 مراحل مکمل۔ آپ کی قانونی رپورٹ تیار ہے۔",
        "api_limit":     "API کی حد ختم ہو گئی۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔",
    },
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

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
        from gemini_client import get_vertex_client, FAST_MODEL, make_config
        client = get_vertex_client()
        system_instruction = (
            "You are a helpful, extremely friendly legal assistant. "
            f"The user is confused by the question: '{question_text}'. "
            f"Their confused response was: '{user_confused_answer}'. "
            "Rephrase this question in much simpler, everyday, conversational words. "
            "Do NOT ask a different question. Rephrase the same question. "
            f"Respond ONLY with the rephrased question in the user's language ({lang}). "
            "Do not include any extra text, introduction, or explanation."
        )
        response = client.models.generate_content(
            model=FAST_MODEL,
            contents=f"Rephrase: {question_text}",
            config=make_config(system_instruction=system_instruction),
        )
        return response.text.strip()
    except Exception:
        return question_text


async def call_agent_with_retry(agent_fn, *args, **kwargs):
    """Run an agent in a thread with one retry on failure."""
    max_attempts = 2
    for attempt in range(max_attempts):
        try:
            print(f"[DEBUG] Entering {agent_fn.__name__} (Attempt {attempt+1})")
            start_time = time.time()
            
            coro = asyncio.to_thread(agent_fn, *args, **kwargs)
            res = await asyncio.wait_for(coro, timeout=60.0)
            
            duration = time.time() - start_time
            print(f"[DEBUG] {agent_fn.__name__} Completed in {duration:.2f}s")

            # pause_for_user responses are always valid — never retry them
            if res and res.get("pause_for_user"):
                return res
            if res and res.get("status") != "failed":
                return res
            
            if attempt < max_attempts - 1:
                print(f"[Pipeline Retry] {agent_fn.__name__} failed (attempt {attempt+1}). Retrying...")
                await asyncio.sleep(1)
            else:
                return {"status": "failed", "error": f"{agent_fn.__name__} failed on all attempts"}
                
        except asyncio.TimeoutError:
            duration = time.time() - start_time
            print(f"[Pipeline Timeout] {agent_fn.__name__} exceeded 60s timeout (Duration: {duration:.2f}s).")
            if attempt < max_attempts - 1:
                await asyncio.sleep(1)
            else:
                import traceback
                print("=== TIMEOUT TRACE ===")
                traceback.print_exc()
                print("Payload dump:")
                if args:
                    import json
                    print(json.dumps(args[0], default=str)[:1000] + " ... [TRUNCATED]")
                print("=====================")
                return {"status": "failed", "error": f"{agent_fn.__name__} timed out after 60s"}
                
        except Exception as e:
            duration = time.time() - start_time
            print(f"[DEBUG] {agent_fn.__name__} Raised Exception in {duration:.2f}s")
            if attempt < max_attempts - 1:
                print(f"[Pipeline Retry] {agent_fn.__name__} raised: {e}. Retrying...")
                await asyncio.sleep(1)
            else:
                return {"status": "failed", "error": str(e)}
                
    return {"status": "failed", "error": "Max retries exceeded"}


# ─── Thread-safe streaming helper ─────────────────────────────────────────────

async def _run_agent_streaming(agent_task_coro, on_trace_queue):
    """
    Runs agent_task_coro as an asyncio Task while draining on_trace_queue
    and yielding status messages in real-time.
    """
    trace_queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def on_trace(msg: str):
        loop.call_soon_threadsafe(trace_queue.put_nowait, msg)

    agent_task = asyncio.create_task(agent_task_coro(on_trace))

    while not agent_task.done():
        try:
            trace_msg = await asyncio.wait_for(trace_queue.get(), timeout=0.1)
            yield trace_msg
        except asyncio.TimeoutError:
            continue

    result = await agent_task

    # Drain any remaining trace messages
    while not trace_queue.empty():
        yield trace_queue.get_nowait()

    yield result
    return


# ─── Main Pipeline ────────────────────────────────────────────────────────────

async def run_pipeline_stream(
    user_input: str,
    input_type: str,
    answer_callback=None,
    category_hint: str | None = None,
    prior_context: dict | None = None,
    target_agent: str | None = None,
):
    """
    Single-agent execution endpoint.
    The NestJS gateway calls this once per agent, passing:
      - target_agent  : which agent to run this turn
      - prior_context : the full collected_context from MongoDB (seeds state)

    Each call yields SSE events:
      {"type": "status",   "message": "..."}     — progress trace
      {"type": "language", "language": "..."}    — detected language (CaseListener only)
      {"type": "final",    "data": {...}}        — structured result or pause

    The final data is one of:
      - pause_for_user: true   → agent needs more input, gateway halts pipeline
      - pipeline_status: "agent_complete"  → agent done, gateway advances to next
      - pipeline_status: "skipped"         → agent was intentionally skipped
      - status: "failed"                   → hard error
    """

    # ── Bootstrap context from prior run ──────────────────────────────────────
    context: dict = {}
    if category_hint:
        context["category_hint"] = category_hint

    if prior_context:
        print(f"[Pipeline] Seeding {len(prior_context)} keys from prior_context")
        context.update(prior_context)
        # Always reset generated_pdfs for fresh run
        context['generated_pdfs'] = []

    lang = normalize_lang(context.get("language_detected", "English"))

    # ── Agent definitions ──────────────────────────────────────────────────────
    AGENT_DEFS = {
        "CaseListener": {
            "msg_key": "agent1",
            "run": lambda cb: call_agent_with_retry(run_case_listener, user_input, input_type, on_trace=cb),
            "update": lambda res: context.update(res),
        },
        "CaseClassifier": {
            "msg_key": "agent2",
            "run": lambda cb: call_agent_with_retry(run_case_classifier, context, on_trace=cb),
            "update": lambda res: context.update(res),
        },
        "QuestioningAgent": {
            "msg_key": "agent3_check",
            "run": lambda cb: call_agent_with_retry(run_questioning_agent, context, on_trace=cb),
            "update": lambda res: context.update({
                "investigation_memory": res.get("investigation_memory", {}),
                "questions_from_agent3": res.get("questions_from_agent3", []),
            }),
        },
        "RightsAnalyzer": {
            "msg_key": "agent4",
            "run": lambda cb: call_agent_with_retry(run_rights_analyzer, context, on_trace=cb),
            "update": lambda res: context.update({"rights_analysis": res}),
        },
        "DocumentChecker": {
            "msg_key": "agent5",
            "run": lambda cb: call_agent_with_retry(run_document_checker, context, on_trace=cb),
            "update": lambda res: context.update({"document_check": res}),
        },
        "ActionPlanner": {
            "msg_key": "agent6",
            "run": lambda cb: call_agent_with_retry(run_action_planner, context, on_trace=cb),
            "update": lambda res: context.update({"action_plan": res}),
        },
        "MisguideDetector": {
            "msg_key": "agent7",
            "run": lambda cb: call_agent_with_retry(run_misguide_detector, context, on_trace=cb),
            "update": lambda res: context.update({"scam_protection": res}),
        },
        "PdfFormatter": {
            "msg_key": "agent8",
            "run": lambda cb: call_agent_with_retry(run_pdf_formatter, context, on_trace=cb),
            "update": lambda res: context.update({"pdfs": res}),
        },
    }

    # ── Validate target agent ──────────────────────────────────────────────────
    if not target_agent or target_agent not in AGENT_DEFS:
        yield {"type": "status", "message": f"Error: Unknown agent '{target_agent}'."}
        yield {"type": "final", "data": {"status": "failed", "error": f"Invalid agent: {target_agent}"}}
        return

    # ── Special-case: MisguideDetector — skip if user hasn't consulted a lawyer ─
    if target_agent == "MisguideDetector":
        # Check if the user already answered the lawyer consultation question
        lawyer_answers = (context.get("answers") or {}).get("MisguideDetector", {})
        consulted_lawyer = lawyer_answers.get("consulted_lawyer")

        if consulted_lawyer is None:
            # Ask the user first
            yield {"type": "status", "message": MESSAGES[lang]["agent7"]}
            question_text = {
                "English":    "Have you already consulted a lawyer about this case?",
                "Roman Urdu": "Kya aap ne is case ke liye pehle kisi wakeel se baat ki hai?",
                "Urdu":       "کیا آپ نے اس کیس کے لیے پہلے کسی وکیل سے بات کی ہے؟",
            }.get(lang, "Have you already consulted a lawyer about this case?")

            yield {"type": "final", "data": {
                "pause_for_user":      True,
                "agent":               "MisguideDetector",
                "question":            question_text,
                "expected_input":      "consulted_lawyer",
                "expected_information":"consulted_lawyer",
                "reason":              "MisguideDetector only runs if user consulted a lawyer",
                "priority":            "medium",
                "partial_output":      context,
            }}
            return

        # If user said NO — skip this agent entirely
        no_answers = {"no", "nahi", "nahi hai", "nai", "nahin", "n", "نہیں", "نہیں ہے"}
        if str(consulted_lawyer).strip().lower() in no_answers:
            yield {"type": "status", "message": "Agent 7: Skipped (no lawyer consultation). Proceeding..."}
            yield {"type": "final", "data": {
                "pipeline_status": "skipped",
                "agent":           "MisguideDetector",
                "final_output":    context,
                "pdf_files":       [],
            }}
            return

        # User said YES — run the agent normally with lawyer_said context
        lawyer_said = lawyer_answers.get("lawyer_said", "")
        if lawyer_said:
            context["lawyer_consultation"] = {
                "consulted": True,
                "lawyer_said": lawyer_said,
            }
        else:
            # Ask what the lawyer said
            yield {"type": "status", "message": MESSAGES[lang]["agent7"]}
            question_text = {
                "English":    "What did the lawyer say about your case? (Briefly describe their advice)",
                "Roman Urdu": "Wakeel ne aapke case ke baare mein kya kaha? (Mukhtasaran bataein)",
                "Urdu":       "وکیل نے آپ کے کیس کے بارے میں کیا کہا؟ (مختصراً بتائیں)",
            }.get(lang, "What did the lawyer say about your case?")
            yield {"type": "final", "data": {
                "pause_for_user":      True,
                "agent":               "MisguideDetector",
                "question":            question_text,
                "expected_input":      "lawyer_said",
                "expected_information":"lawyer_said",
                "reason":              "Need to know what the lawyer advised to detect red flags",
                "priority":            "high",
                "partial_output":      context,
            }}
            return

    # ── Emit agent start status ────────────────────────────────────────────────
    step = AGENT_DEFS[target_agent]
    if target_agent == "CaseListener":
        yield {"type": "status", "message": "Agent 1: Understanding your problem..."}
    else:
        yield {"type": "status", "message": MESSAGES[lang][step["msg_key"]]}

    # ── Set up thread-safe trace queue ────────────────────────────────────────
    trace_queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def on_trace(msg: str):
        loop.call_soon_threadsafe(trace_queue.put_nowait, msg)

    try:
        agent_task = asyncio.create_task(step["run"](on_trace))

        while not agent_task.done():
            try:
                trace_msg = await asyncio.wait_for(trace_queue.get(), timeout=0.1)
                yield {"type": "status", "message": trace_msg}
            except asyncio.TimeoutError:
                continue

        result = await agent_task

        if target_agent == "PdfFormatter" and result and "pdf_files" in result:
            pdf_files = result.get("pdf_files") or []
            uploaded_pdfs = []
            for pdf_path in pdf_files:
                try:
                    url = upload_pdf_to_cloudinary(pdf_path)
                    uploaded_pdfs.append(url)
                except Exception as upload_err:
                    print(f"[Cloudinary Upload Error] Failed to upload {pdf_path}: {upload_err}")
                    uploaded_pdfs.append(pdf_path)
            result["pdf_files"] = uploaded_pdfs

        # Drain remaining traces
        while not trace_queue.empty():
            yield {"type": "status", "message": trace_queue.get_nowait()}

    except Exception as e:
        print(f"[Pipeline] Agent {target_agent} raised unhandled exception: {e}")
        yield {"type": "final", "data": {"pipeline_status": "failed", "status": "failed", "error": str(e), "agent": target_agent}}
        return

    # ── Handle pause-for-user ──────────────────────────────────────────────────
    if result.get("pause_for_user") is True:
        print("[PIPELINE_PAUSED_SUCCESSFULLY] Agent paused waiting for user input.")
        yield {"type": "status", "message": f"Paused — waiting for your answer..."}
        yield {"type": "final", "data": {
            "pause_for_user":       True,
            "pipeline_status":      "paused",
            "agent":                target_agent,
            "question":             result.get("question"),
            "expected_input":       result.get("expected_input") or result.get("expected_information") or "generic_reply",
            "expected_information": result.get("expected_information"),
            "reason":               result.get("reason"),
            "priority":             result.get("priority"),
            "partial_output":       context,
        }}
        print("[STREAM_TERMINATED_CLEANLY] Stream terminated cleanly for agent pause.")
        return
        
    # ── Handle agent failure ───────────────────────────────────────────────────
    if result.get("status") == "failed":
        print(f"[Pipeline] Agent {target_agent} returned failed status: {result.get('error')}")
        yield {"type": "final", "data": {
            "pipeline_status": "failed",
            "status":          "failed",
            "error":           result.get("error", "Unknown agent failure"),
            "agent":           target_agent
        }}
        return

    # ── Update shared context with agent result ────────────────────────────────
    step["update"](result)

    # Propagate language after CaseListener
    if target_agent == "CaseListener":
        lang = normalize_lang(context.get("language_detected"))
        yield {"type": "language", "language": lang}

    # ── Emit agent-complete final payload ──────────────────────────────────────
    yield {"type": "final", "data": {
        "pipeline_status": "agent_complete",
        "agent":           target_agent,
        "final_output":    context,
        "pdf_files":       (
            context.get("pdfs", {}).get("pdf_files", [])
            if isinstance(context.get("pdfs"), dict) else []
        ),
    }}
    print("[STREAM_TERMINATED_CLEANLY] Stream finished for agent complete.")
