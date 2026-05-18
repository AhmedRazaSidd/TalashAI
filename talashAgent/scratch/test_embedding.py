import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

from google.oauth2 import service_account

credentials = service_account.Credentials.from_service_account_file(
    "./service-account.json",
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)

print("Initializing client with Service Account...")
client = genai.Client(
    vertexai=True,
    project="talash-496613",
    location="us-central1",
    credentials=credentials
)
print("Client initialized successfully!")

embedding_models = [
    "gemini-embedding-001",
    "textembedding-gecko",
    "textembedding-gecko@003",
    "text-embedding-004"
]

for model in embedding_models:
    print(f"Testing embed_content with {model}...")
    try:
        response = client.models.embed_content(
            model=model,
            contents="Pakistan penal code"
        )
        print(f"-> SUCCESS for {model}! Response embedding length: {len(response.embeddings[0].values)}")
    except Exception as e:
        print(f"-> FAILED for {model}: {e}")
