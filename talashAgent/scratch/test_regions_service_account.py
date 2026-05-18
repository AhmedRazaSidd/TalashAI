import os
from google.oauth2 import service_account
from google import genai

# Clear other keys to avoid interference
os.environ.pop("GOOGLE_API_KEY", None)
os.environ.pop("GEMINI_API_KEY", None)

credentials = service_account.Credentials.from_service_account_file(
    "./service-account.json",
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)

regions = [
    "us-central1",
    "us-east4",
    "us-east1",
    "us-west1",
    "europe-west1",
    "europe-west3",
    "europe-west9",
    "asia-northeast1",
    "asia-southeast1"
]

print("--- TESTING SERVICE ACCOUNT REGIONS ---")
for reg in regions:
    print(f"Testing region '{reg}'...")
    try:
        client = genai.Client(
            vertexai=True,
            project="talash-496613",
            location=reg,
            credentials=credentials
        )
        res = client.models.generate_content(
            model="gemini-1.5-flash",
            contents="Say 'Hello' in one word."
        )
        print(f"-> SUCCESS for '{reg}': {res.text.strip()}")
    except Exception as e:
        print(f"-> FAILED for '{reg}': {e}")
