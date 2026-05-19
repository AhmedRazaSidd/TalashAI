import os
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

print("--- TESTING MODELS WITH SERVICE ACCOUNT ---")
for model in ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-flash-preview", "gemini-1.5-flash-001"]:
    try:
        print(f"Testing model '{model}'...")
        res = client.models.generate_content(
            model=model,
            contents="Say 'Hello' in one word."
        )
        print(f"-> SUCCESS for '{model}': {res.text.strip()}")
    except Exception as e:
        print(f"-> FAILED for '{model}': {e}")
