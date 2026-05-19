import os
# Clear environment keys that might interfere with Service Account authentication
os.environ.pop("GOOGLE_API_KEY", None)
os.environ.pop("GEMINI_API_KEY", None)

from google.oauth2 import service_account
from google import genai

credentials = service_account.Credentials.from_service_account_file(
    "./service-account.json",
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)

client = genai.Client(
    vertexai=True,
    project="talash-496613",
    location="us-central1",
    credentials=credentials
)

print("--- TESTING MODELS WITH ENVIRONMENT KEYS CLEARED ---")
for model in ["gemini-1.5-flash-001", "gemini-1.5-flash"]:
    try:
        print(f"Testing model '{model}'...")
        res = client.models.generate_content(
            model=model,
            contents="Say 'Hello' in one word."
        )
        print(f"-> SUCCESS for '{model}': {res.text.strip()}")
    except Exception as e:
        print(f"-> FAILED for '{model}': {e}")
