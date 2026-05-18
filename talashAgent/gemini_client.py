import os
from google.oauth2 import service_account
from google import genai

def get_vertex_client():
    # Primary paths to check for the service account key
    key_paths = [
        "./service-account.json",
        "./service-account.json",
        "../service-account.json",
        "service-account.json"
    ]
    
    credentials = None
    for path in key_paths:
        if os.path.exists(path):
            try:
                credentials = service_account.Credentials.from_service_account_file(
                    path,
                    scopes=["https://www.googleapis.com/auth/cloud-platform"]
                )
                print(f"[+] Successfully loaded Google credentials from: {path}")
                break
            except Exception as e:
                print(f"[-] Found credentials file at {path} but failed to load: {e}")
                
    if credentials:
        return genai.Client(
            vertexai=True,
            project="talash-496613",
            location="us-central1",
            credentials=credentials
        )
    
    # Fallback to Application Default Credentials (ADC) or ambient environment auth
    try:
        return genai.Client(
            vertexai=True,
            project="talash-496613",
            location="us-central1"
        )
    except Exception as e:
        print(f"[-] Ambient credentials/ADC fallback failed: {e}")
        
    # Clear error message instructing the user exactly what to do
    raise FileNotFoundError(
        "\n\n=========================================================================\n"
        "ERROR: Google Vertex AI Service Account Credentials File Not Found!\n"
        "=========================================================================\n"
        "Please provide your GCP service account JSON key file. You can either:\n"
        "1. Create the directory 'talashAgent/key' and place your 'service-account.json' inside it.\n"
        "2. Or place your 'service-account.json' directly inside the 'talashAgent' directory.\n"
        "3. Or configure Application Default Credentials by running this command in your terminal:\n"
        "   gcloud auth application-default login\n"
        "=========================================================================\n"
    )

FAST_MODEL = "gemini-2.5-flash"
DEEP_MODEL = "gemini-2.5-pro"
EMBEDDING_MODEL = "gemini-embedding-001"
