import os
from google.oauth2 import service_account
from googleapiclient import discovery

# Clear other keys
os.environ.pop("GOOGLE_API_KEY", None)
os.environ.pop("GEMINI_API_KEY", None)

credentials = service_account.Credentials.from_service_account_file(
    "./service-account.json",
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)

try:
    print("Initializing Service Usage API client...")
    service = discovery.build('serviceusage', 'v1', credentials=credentials)
    
    project_name = 'projects/talash-496613'
    service_name = f'{project_name}/services/aiplatform.googleapis.com'
    
    print(f"Enabling Vertex AI API ({service_name})...")
    request = service.services().enable(name=service_name)
    response = request.execute()
    print("API enabling request sent successfully! Response:")
    print(response)
except Exception as e:
    print(f"Error checking/enabling Vertex AI API: {e}")
