from google.oauth2 import service_account
from google import genai
from google.genai import types

# ─── Singleton client (created once, reused everywhere) ───────────────────────
_client = None

import json
import os

def get_vertex_client():
    global _client
    if _client is None:
        # 1. Try to load credentials directly from environment variables (JSON string in memory)
        service_account_json = (
            os.getenv("SERVICE_ACCOUNT_JSON") or 
            os.getenv("GOOGLE_CREDENTIALS") or 
            os.getenv("GCP_SERVICE_ACCOUNT")
        )
        
        credentials = None
        if service_account_json:
            try:
                info = json.loads(service_account_json)
                credentials = service_account.Credentials.from_service_account_info(
                    info,
                    scopes=["https://www.googleapis.com/auth/cloud-platform"]
                )
                print("[GeminiClient] Vertex AI credentials successfully loaded in-memory from environment variable.")
            except Exception as env_err:
                print(f"[GeminiClient] Failed to load credentials from environment variable: {env_err}")

        # 2. Fallback to local files if no env variable is configured
        if credentials is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            possible_paths = [
                "./service-account.json",
                os.path.join(current_dir, "service-account.json"),
                "service-account.json"
            ]
            
            filepath = None
            for p in possible_paths:
                if os.path.exists(p):
                    filepath = p
                    break
            
            if filepath:
                try:
                    credentials = service_account.Credentials.from_service_account_file(
                        filepath,
                        scopes=["https://www.googleapis.com/auth/cloud-platform"]
                    )
                    print(f"[GeminiClient] Vertex AI credentials successfully loaded from file: {filepath}")
                except Exception as file_err:
                    raise RuntimeError(f"Failed to load service-account.json file at {filepath}: {file_err}")
            else:
                raise FileNotFoundError(
                    "Google Cloud Service Account credentials not found! "
                    "Please configure 'SERVICE_ACCOUNT_JSON' as an Environment Variable in the Render dashboard, "
                    "or place a 'service-account.json' file in your project directory."
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
