from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pipeline import run_pipeline_stream
import json
import os
import httpx
import asyncio
from google import genai
from google.genai import types
from dotenv import load_dotenv
from gemini_client import get_vertex_client, FAST_MODEL

DEFAULT_MODEL = FAST_MODEL

# Import SQLite Memory Store
from memory_store import (
    save_user_memory,
    get_user_memories,
    delete_user_memory,
    save_session_document,
    get_session_documents,
    get_user_documents
)

load_dotenv()

app = FastAPI(title="INSAAF OS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Resilient Gemini API Client & Model Fallbacks
def get_fallback_list(requested_model: str) -> list:
    if requested_model == DEFAULT_MODEL:
        return [DEFAULT_MODEL, DEFAULT_MODEL]
    else:
        return [DEFAULT_MODEL, DEFAULT_MODEL]

class QuotaResilientModels:
    def __init__(self, client):
        self.client = client

    def _execute_with_retry(self, fn, *args, **kwargs):
        """
        Executes a function with exponential backoff on transient quota/rate limit errors (429).
        Does up to 3 attempts with exponential delay (1s, 2s, 4s).
        """
        max_attempts = 3
        base_delay = 1.0  # seconds

        for attempt in range(max_attempts):
            try:
                return fn(*args, **kwargs)
            except Exception as e:
                err_str = str(e).lower()
                # Intercept rate limit, resource exhaustion, or transient quota errors
                if any(x in err_str for x in ["429", "resource_exhausted", "quota", "rate limit", "limit"]):
                    if attempt < max_attempts - 1:
                        delay = base_delay * (2 ** attempt)
                        print(f"[Vertex AI Retry System] ⚠️ Received 429 error. Retrying in {delay}s (Attempt {attempt + 1}/{max_attempts})...")
                        import time
                        time.sleep(delay)
                        continue
                # If it's a non-retryable error or we exhausted attempts, bubble it up so the model fallback loop catches it
                raise e

    def generate_content(self, model: str, contents, config=None, **kwargs):
        """
        Tries to call generate_content with the requested model and fallbacks, including exponential backoff.
        """
        fallback_models = get_fallback_list(model)
        for idx, current_model in enumerate(fallback_models):
            try:
                # Add retry layer on rate-limits
                return self._execute_with_retry(
                    self.client.models.generate_content,
                    model=current_model,
                    contents=contents,
                    config=config,
                    **kwargs
                )
            except Exception as e:
                err_str = str(e).lower()
                if any(x in err_str for x in ["429", "resource_exhausted", "quota", "limit", "not found", "404", "permission"]):
                    print(f"[Vertex AI Resilient System] ⚠️ Call failed for model '{current_model}': {e}. Trying next fallback...")
                    continue
                raise e
        raise RuntimeError("Vertex AI System exhausted all fallback models during execution.")

    def generate_content_stream(self, model: str, contents, config=None, **kwargs):
        """
        Tries to establish generate_content_stream with fallbacks and resumes streaming if rate limits are hit.
        """
        fallback_models = get_fallback_list(model)
        for idx, current_model in enumerate(fallback_models):
            try:
                # Set up the streaming generator with fallbacks
                def resilient_generator():
                    nonlocal contents, config, idx
                    model_list = fallback_models[idx:]
                    for next_model in model_list:
                        try:
                            # Add a retry to streaming initiation
                            stream = self._execute_with_retry(
                                self.client.models.generate_content_stream,
                                model=next_model,
                                contents=contents,
                                config=config,
                                **kwargs
                            )
                            for chunk in stream:
                                yield chunk
                            return  # stream finished successfully
                        except Exception as stream_err:
                            err_str = str(stream_err).lower()
                            if any(x in err_str for x in ["429", "resource_exhausted", "quota", "limit", "not found", "404", "permission"]):
                                print(f"[Vertex AI Resilient System] ⚠️ Stream interrupted for model '{next_model}'. Falling back...")
                                # Update index so we don't repeat this model on subsequent outer fallbacks
                                if next_model in fallback_models:
                                    idx = fallback_models.index(next_model) + 1
                                continue
                            raise stream_err
                            
                return resilient_generator()
            except Exception as e:
                err_str = str(e).lower()
                if any(x in err_str for x in ["429", "resource_exhausted", "quota", "limit", "not found", "404", "permission"]):
                    print(f"[Vertex AI Resilient System] ⚠️ Stream creation failed for model '{current_model}': {e}. Trying next fallback...")
                    continue
                raise e
        raise RuntimeError("Vertex AI System exhausted all fallback models during stream initialization.")

class GeminiClientWrapper:
    def __init__(self):
        self.raw_client = get_vertex_client()
        self.models = QuotaResilientModels(self.raw_client)
        print("[Gemini API Client] Successfully initialized.")

client = GeminiClientWrapper()

# Helper background task for memory extraction
def extract_and_save_memories_task(user_id: str, prompt: str, response_text: str, history: list):
    if not user_id:
        return
    try:
        # Build context from recent exchange
        history_context = ""
        for h in (history or [])[-4:]: # Use last few exchanges
            role = "user" if h.get("senderType") == "user" or h.get("role") == "user" else "assistant"
            history_context += f"{role}: {h.get('content') or h.get('text') or ''}\n"
            
        history_context += f"user: {prompt}\nassistant: {response_text}"
        
        system_instruction = (
            "You are a background personalization extraction assistant. "
            "Scan the provided conversation segment and extract any new, explicit personal facts about the user "
            "(such as their name, age, city/location, specific instructions they want followed, persistent goals, or legal preferences). "
            "Only extract clear, verified facts. Ignore emotional state, dynamic case events, or transient queries. "
            "Output strictly valid JSON with key-value pairs representing the facts to remember. "
            "If no long-term personalization facts are found, return exactly: {}"
        )
        
        # Call Gemini 2.5 Flash to parse the facts
        res = client.raw_client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=history_context,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
            )
        )
        
        if res.text:
            facts = json.loads(res.text.strip())
            if isinstance(facts, dict):
                for k, v in facts.items():
                    if k and v:
                        save_user_memory(user_id, str(k), str(v))
                        print(f"[Memory Store] 💾 Remembered fact: '{k}' = '{v}' for user {user_id}")
    except Exception as e:
        print(f"[Memory Store Error] Failed to extract memories: {e}")

async def async_extract_and_save_memories(user_id: str, prompt: str, response_text: str, history: list):
    await asyncio.to_thread(extract_and_save_memories_task, user_id, prompt, response_text, history)

# Models and schemas
class AnalyzeRequest(BaseModel):
    user_input: str
    input_type: str = "text"
    category_hint: str | None = None
    collected_context: dict = {}  # Prior answers from MongoDB workflow state
    target_agent: str | None = None

class ChatRequest(BaseModel):
    prompt: str
    history: list = []
    system_prompt: str | None = None
    attachments: list = []
    stream: bool = True
    session_id: str | None = None
    user_id: str | None = None

class VoiceRequest(BaseModel):
    audioUrl: str
    history: list = []
    system_prompt: str | None = None
    attachments: list = []
    responseMode: str = "text"
    stream: bool = True
    session_id: str | None = None
    user_id: str | None = None

class ClassifyRequest(BaseModel):
    text: str

class DocRequest(BaseModel):
    file_url: str
    session_id: str | None = None
    user_id: str | None = None
    file_name: str | None = None

class SummarizeRequest(BaseModel):
    messages: list

class MemoryUpdate(BaseModel):
    user_id: str
    key: str
    value: str

class MemoryDelete(BaseModel):
    user_id: str
    key: str | None = None

@app.get("/health")
def health_check():
    return {"status": "ok"}

# 1. Base endpoint: POST /
@app.post("/")
async def chat(req: ChatRequest):
    if req.stream:
        async def event_generator():
            try:
                # Retrieve saved personalization facts and document memories
                personal_facts = get_user_memories(req.user_id) if req.user_id else {}
                doc_summaries = get_session_documents(req.session_id) if req.session_id else []
                
                memory_context = ""
                if personal_facts:
                    memory_context += "\n[Remembered User Personalization Facts]\n"
                    for k, v in personal_facts.items():
                        memory_context += f"- {k}: {v}\n"
                if doc_summaries:
                    memory_context += "\n[Remembered Uploaded Documents in this Session]\n"
                    for d in doc_summaries:
                        memory_context += f"- File: {d['file_name']}\n  Summary: {d['summary']}\n"
                
                system_instruction = req.system_prompt or "You are Talash AI, a helpful legal assistant."
                if memory_context:
                    system_instruction += "\n\n" + "=== COGNITIVE SYSTEM MEMORY ===" + memory_context + "==============================="
                
                # Format history for Gemini API
                contents = []
                for h in req.history:
                    content_str = h.get("content") or h.get("text")
                    if not content_str or not isinstance(content_str, str) or not content_str.strip():
                        continue  # Skip empty or non-string history items
                    
                    role = "user" if h.get("senderType") == "user" or h.get("role") == "user" else "model"
                    contents.append(
                        types.Content(
                            role=role,
                            parts=[types.Part.from_text(text=content_str.strip())]
                        )
                    )
                
                # Append attachments context if present
                attachment_prompt = ""
                if req.attachments:
                    attachment_prompt = "\n\nAttached Documents:\n" + "\n".join(req.attachments)
                
                contents.append(
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=req.prompt + attachment_prompt)]
                    )
                )

                response_stream = client.models.generate_content_stream(
                    model=DEFAULT_MODEL,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                    )
                )

                full_text = ""
                for chunk in response_stream:
                    if chunk.text:
                        full_text += chunk.text
                        yield json.dumps({'chunk': chunk.text})
                
                # Trigger memory extraction task in the background
                if req.user_id:
                    asyncio.create_task(async_extract_and_save_memories(req.user_id, req.prompt, full_text, req.history))
                
                yield "[DONE]"
            except Exception as e:
                yield json.dumps({'chunk': f'Error: {str(e)}'})
                yield "[DONE]"

        return EventSourceResponse(event_generator())
    else:
        try:
            # Non-streaming context build
            personal_facts = get_user_memories(req.user_id) if req.user_id else {}
            doc_summaries = get_session_documents(req.session_id) if req.session_id else []
            
            memory_context = ""
            if personal_facts:
                memory_context += "\n[Remembered User Personalization Facts]\n"
                for k, v in personal_facts.items():
                    memory_context += f"- {k}: {v}\n"
            if doc_summaries:
                memory_context += "\n[Remembered Uploaded Documents in this Session]\n"
                for d in doc_summaries:
                    memory_context += f"- File: {d['file_name']}\n  Summary: {d['summary']}\n"
                    
            system_instruction = req.system_prompt or "You are Talash AI, a helpful legal assistant."
            if memory_context:
                system_instruction += "\n\n" + "=== COGNITIVE SYSTEM MEMORY ===" + memory_context + "==============================="

            response = client.models.generate_content(
                model=DEFAULT_MODEL,
                contents=req.prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                )
            )
            
            # Trigger memory extraction task in background
            if req.user_id:
                asyncio.create_task(async_extract_and_save_memories(req.user_id, req.prompt, response.text, req.history))
                
            return {"text": response.text}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

# 2. Voice endpoint: POST /voice
@app.post("/voice")
async def voice(req: VoiceRequest):
    async def event_generator():
        try:
            transcript = "[Processing audio message]"
            audio_part = None
            
            async with httpx.AsyncClient() as http_client:
                response = await http_client.get(req.audioUrl)
                if response.status_code == 200:
                    audio_bytes = response.content
                    # Use standard generic audio mime type if mp3
                    audio_part = types.Part.from_bytes(data=audio_bytes, mime_type="audio/mp3")

            if audio_part:
                transcribe_res = client.models.generate_content(
                    model=DEFAULT_MODEL,
                    contents=[audio_part, "Transcribe this audio exactly into Urdu/English text. Return ONLY the transcript."],
                )
                transcript = transcribe_res.text or "[Audio transcript empty]"
                yield f"data: {json.dumps({'transcriptChunk': transcript})}\n\n"

            # Personalization and document recall
            personal_facts = get_user_memories(req.user_id) if req.user_id else {}
            doc_summaries = get_session_documents(req.session_id) if req.session_id else []
            
            memory_context = ""
            if personal_facts:
                memory_context += "\n[Remembered User Personalization Facts]\n"
                for k, v in personal_facts.items():
                    memory_context += f"- {k}: {v}\n"
            if doc_summaries:
                memory_context += "\n[Remembered Uploaded Documents in this Session]\n"
                for d in doc_summaries:
                    memory_context += f"- File: {d['file_name']}\n  Summary: {d['summary']}\n"
            
            system_instruction = req.system_prompt or "You are Talash AI, a helpful legal assistant."
            if memory_context:
                system_instruction += "\n\n" + "=== COGNITIVE SYSTEM MEMORY ===" + memory_context + "==============================="
                
            contents = []
            for h in req.history:
                content_str = h.get("content") or h.get("text")
                if not content_str or not isinstance(content_str, str) or not content_str.strip():
                    continue  # Skip empty or non-string history items
                
                role = "user" if h.get("senderType") == "user" or h.get("role") == "user" else "model"
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=content_str.strip())]
                    )
                )

            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=transcript)]
                )
            )

            response_stream = client.models.generate_content_stream(
                model=DEFAULT_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                )
            )

            full_voice_text = ""
            for chunk in response_stream:
                if chunk.text:
                    full_voice_text += chunk.text
                    yield json.dumps({'chunk': chunk.text})

            # Trigger memory extraction task
            if req.user_id:
                asyncio.create_task(async_extract_and_save_memories(req.user_id, transcript, full_voice_text, req.history))

            yield "[DONE]"
        except Exception as e:
            yield json.dumps({'chunk': f'Error: {str(e)}'})
            yield "[DONE]"

    return EventSourceResponse(event_generator())

# 3. Classify endpoint: POST /classify
@app.post("/classify")
async def classify(req: ClassifyRequest):
    try:
        system_instruction = (
            "You are a legal expert in Pakistani Law. Classify this case description into one of these exact categories: "
            "'Property', 'Family', 'Criminal', 'Labor', 'Corporate', or 'General'. "
            "Return ONLY the category name."
        )
        response = client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=req.text,
            config=types.GenerateContentConfig(system_instruction=system_instruction)
        )
        category = response.text.strip()
        category = category.replace("'", "").replace('"', "").replace(".", "").strip()
        return {"category": category}
    except Exception as e:
        return {"category": "General", "error": str(e)}

# 4. Analyze document: POST /analyze_document
@app.post("/analyze_document")
async def analyze_document(req: DocRequest):
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(req.file_url)
            if response.status_code != 200:
                return {"analysis": "Could not download document from Cloudinary URL."}
            doc_bytes = response.content

        mime_type = "application/pdf" if req.file_url.endswith(".pdf") else "image/jpeg"
        doc_part = types.Part.from_bytes(data=doc_bytes, mime_type=mime_type)

        system_instruction = (
            "You are a Pakistani legal document analyzer. Scan this document, extract all key details (names, dates, clauses, case number, assets), "
            "and explain their implications under Pakistani Law in simple English or Urdu. Provide a structured analysis."
        )
        
        response = client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=[doc_part, "Analyze this document."],
            config=types.GenerateContentConfig(system_instruction=system_instruction)
        )
        
        analysis_text = response.text or "No text could be extracted."
        
        # Save document summary to memory if session_id is provided
        if req.session_id:
            try:
                summary_instruction = (
                    "Summarize this document analysis into a concise list of key facts, legal issues, "
                    "and parties involved that can be remembered by a legal assistant chatbot."
                )
                summary_response = client.models.generate_content(
                    model=DEFAULT_MODEL,
                    contents=analysis_text,
                    config=types.GenerateContentConfig(system_instruction=summary_instruction)
                )
                summary_text = summary_response.text or "Key document details."
                
                save_session_document(
                    session_id=req.session_id,
                    user_id=req.user_id,
                    file_name=req.file_name or "Uploaded Document",
                    file_url=req.file_url,
                    summary=summary_text,
                    extracted_text=analysis_text
                )
                print(f"[Memory Store] 💾 Saved session document summary: '{req.file_name}' for session {req.session_id}")
            except Exception as doc_err:
                print(f"[Memory Store Error] Failed to save document memory: {doc_err}")
                
        return {"analysis": analysis_text}
    except Exception as e:
        return {"analysis": f"Error analyzing document: {str(e)}"}

# 5. Summarize endpoint: POST /summarize
@app.post("/summarize")
async def summarize(req: SummarizeRequest):
    try:
        chat_history = ""
        for msg in req.messages:
            role = msg.get("senderType", "user")
            content = msg.get("content", "")
            chat_history += f"{role.upper()}: {content}\n"

        system_instruction = (
            "Summarize this legal consultation chat history into a professional, concise legal summary. "
            "Include key facts, the legal issue, and next steps recommended by the AI."
        )
        
        response = client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=chat_history,
            config=types.GenerateContentConfig(system_instruction=system_instruction)
        )
        return {"summary": response.text or "Summary empty."}
    except Exception as e:
        return {"summary": f"Error generating summary: {str(e)}"}

# 6. Privacy & Control Endpoints
@app.get("/memory")
def get_memory(user_id: str):
    try:
        memories = get_user_memories(user_id)
        docs = get_user_documents(user_id)
        return {
            "success": True,
            "user_id": user_id,
            "memories": memories,
            "documents": docs
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/memory")
def update_memory(req: MemoryUpdate):
    try:
        save_user_memory(req.user_id, req.key, req.value)
        return {"success": True, "message": f"Memory '{req.key}' updated successfully."}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.delete("/memory")
def delete_memory(req: MemoryDelete):
    try:
        delete_user_memory(req.user_id, req.key)
        return {"success": True, "message": f"Memory for key '{req.key}' deleted successfully." if req.key else "All personalization memories deleted."}
    except Exception as e:
        return {"success": False, "error": str(e)}

# Original agentic pipeline
@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    async def event_generator():
        async def dummy_answer_callback(questions):
            return []

        # Log whether this is a fresh run or a resume
        if req.collected_context:
            print(f"[Pipeline] Resuming with collected_context keys: {list(req.collected_context.keys())}")
        else:
            print("[Pipeline] Starting fresh pipeline run.")

        async for event in run_pipeline_stream(
            req.user_input,
            req.input_type,
            dummy_answer_callback,
            req.category_hint,
            req.collected_context,  # pass prior answers to seed pipeline context
            req.target_agent,       # agent to run
        ):
            if event["type"] == "status":
                yield {"event": "status", "data": event["message"]}
            elif event["type"] == "final":
                yield {"event": "final", "data": json.dumps(event["data"])}

    return EventSourceResponse(event_generator())

@app.get("/pdf/{filename}")
async def serve_pdf(filename: str):
    from fastapi.responses import FileResponse
    import os
    pdf_path = f"./outputs/{filename}"
    if os.path.exists(pdf_path):
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=filename
        )
    return {"error": "PDF not found"}
