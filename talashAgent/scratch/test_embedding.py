import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

key = "AQ.Ab8RN6IS6tohC7tm1ihf9dh7Jk5fTmhgRxCy8drRrfYnSvAn9w"
print("Initializing client...")
client = genai.Client(
    vertexai=True,
    api_key=key
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
        break
    except Exception as e:
        print(f"-> FAILED for {model}: {e}")
