from google.oauth2 import service_account
from google import genai
from google.genai import types

# ─── Singleton client (created once, reused everywhere) ───────────────────────
_client = None

def get_vertex_client():
    global _client
    if _client is None:
        credentials = service_account.Credentials.from_service_account_file(
            "./service-account.json",
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        _client = genai.Client(
            vertexai=True,
            project="talash-496613",
            location="us-central1",
            credentials=credentials
        )
        print("[GeminiClient] Vertex AI client initialised (singleton).")
    return _client

# ─── Model aliases ─────────────────────────────────────────────────────────────
FAST_MODEL  = "gemini-2.5-flash"
DEEP_MODEL  = "gemini-2.5-flash"        # Use Flash for both to avoid Pro's slow thinking
EMBEDDING_MODEL = "gemini-embedding-001"

# ─── Shared thinking config (disables extended thinking so we never hang) ─────
NO_THINKING = types.ThinkingConfig(thinking_budget=0)

def make_config(system_instruction=None, response_mime_type=None, response_schema=None):
    """
    Returns a GenerateContentConfig with thinking disabled.
    Pass any subset of the optional args you need.
    """
    kwargs = {"thinking_config": NO_THINKING}
    if system_instruction is not None:
        kwargs["system_instruction"] = system_instruction
    if response_mime_type is not None:
        kwargs["response_mime_type"] = response_mime_type
    if response_schema is not None:
        kwargs["response_schema"] = response_schema
    return types.GenerateContentConfig(**kwargs)
