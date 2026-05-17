import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

key = "AQ.Ab8RN6IS6tohC7tm1ihf9dh7Jk5fTmhgRxCy8drRrfYnSvAn9w"
print("Initializing client with location='us-central1'...")
try:
    client = genai.Client(
        vertexai=True,
        api_key=key,
        location="us-central1"
    )
    print("Client initialized successfully!")
except Exception as e:
    print("Error during initialization:", e)
