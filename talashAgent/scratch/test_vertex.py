import os
import sys
from google import genai
from dotenv import load_dotenv

load_dotenv()

key = "AQ.Ab8RN6IS6tohC7tm1ihf9dh7Jk5fTmhgRxCy8drRrfYnSvAn9w"
print("Initializing client...", flush=True)

locations = [
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

for loc in locations:
    print(f"Testing environment location {loc} with gemini-1.5-flash...", flush=True)
    os.environ["GOOGLE_CLOUD_LOCATION"] = loc
    os.environ["GOOGLE_GENAI_LOCATION"] = loc
    try:
        client = genai.Client(
            vertexai=True,
            api_key=key
        )
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents="Say 'Vertex AI is working in " + loc + "' in one sentence."
        )
        print(f"-> SUCCESS for location {loc}! Response text: {response.text}", flush=True)
        sys.exit(0)
    except Exception as e:
        print(f"-> FAILED for location {loc}: {e}", flush=True)
