import os
import glob

# Target files
files_to_check = glob.glob("agents/*.py") + ["pipeline.py", "api.py", "tools/search_legal_docs.py"]

for file_path in files_to_check:
    if not os.path.exists(file_path):
        continue
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update standard Agent client initializations
    content = content.replace(
        'client = genai.Client(vertexai=True, api_key=os.environ.get("VERTEX_API_KEY"))',
        'client = genai.Client(vertexai=True, project="talash-496612", location="us-central1")'
    )
    content = content.replace(
        'client = genai.Client(vertexai=use_vertex, api_key=os.environ.get("VERTEX_API_KEY"))',
        'client = genai.Client(vertexai=True, project="talash-496612", location="us-central1")'
    )
    
    # 2. Update VertexClientWrapper in api.py
    old_api_init = """vertex_key = os.getenv("VERTEX_API_KEY")
        if not vertex_key:
            raise ValueError("VERTEX_API_KEY not configured in environment!")
            
        # Migrate fully to Vertex AI on Google Cloud (strict, no developer fallback mode)
        self.raw_client = genai.Client(
            vertexai=True,
            api_key=vertex_key
        )"""
    new_api_init = """# Migrate fully to Vertex AI on Google Cloud
        self.raw_client = genai.Client(
            vertexai=True,
            project="talash-496612",
            location="us-central1"
        )"""
    content = content.replace(old_api_init, new_api_init)

    # 3. Update the Model Strings
    content = content.replace("gemini-2.5-pro", "gemini-1.5-flash")
    content = content.replace("gemini-2.5-flash", "gemini-1.5-flash")
    content = content.replace("gemini-2.5-flash-lite", "gemini-1.5-flash")
    content = content.replace("gemini-3-flash-preview", "gemini-1.5-flash")
    
    # 4. Save changes
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Updated all API connections to Vertex AI (talash-496612, us-central1) and gemini-1.5-flash.")
