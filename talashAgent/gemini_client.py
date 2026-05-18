from google.oauth2 import service_account
from google import genai

def get_vertex_client():
    credentials = service_account.Credentials.from_service_account_file(
        "./service-account.json",
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    return genai.Client(
        vertexai=True,
        project="talash-496613",
        location="us-central1",
        credentials=credentials
    )

FAST_MODEL = "gemini-2.5-flash"
DEEP_MODEL = "gemini-2.5-pro"
EMBEDDING_MODEL = "gemini-embedding-001"
