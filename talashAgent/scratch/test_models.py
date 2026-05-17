import os
import sys
from google import genai
from google.genai import types

key = "AQ.Ab8RN6IS6tohC7tm1ihf9dh7Jk5fTmhgRxCy8drRrfYnSvAn9w"

models_to_test = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
]

print("--- TESTING VERTEX AI = TRUE ---", flush=True)
for model in models_to_test:
    print(f"Testing model '{model}' with vertexai=True...", flush=True)
    try:
        client = genai.Client(vertexai=True, api_key=key)
        res = client.models.generate_content(
            model=model,
            contents="Hello"
        )
        print(f"-> SUCCESS for '{model}': {res.text}", flush=True)
    except Exception as e:
        print(f"-> FAILED for '{model}': {e}", flush=True)

print("\n--- TESTING VERTEX AI = FALSE ---", flush=True)
for model in models_to_test:
    print(f"Testing model '{model}' with vertexai=False...", flush=True)
    try:
        client = genai.Client(vertexai=False, api_key=key)
        res = client.models.generate_content(
            model=model,
            contents="Hello"
        )
        print(f"-> SUCCESS for '{model}': {res.text}", flush=True)
    except Exception as e:
        print(f"-> FAILED for '{model}': {e}", flush=True)
