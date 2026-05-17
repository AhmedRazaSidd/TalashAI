import sys
import os
import importlib.util
from dotenv import load_dotenv

# Add the talashAgent directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
agent_path = os.path.join(current_dir, "talashAgent")
sys.path.insert(0, agent_path)

# Explicitly load the .env file from the talashAgent folder to populate environment variables globally
load_dotenv(os.path.join(agent_path, ".env"))

# Explicitly load the api.py from talashAgent using importlib to avoid name shadowing
spec = importlib.util.spec_from_file_location("talashAgent_api", os.path.join(agent_path, "api.py"))
real_api = importlib.util.module_from_spec(spec)
sys.modules["api"] = real_api  # Register as 'api' so relative sub-imports work
spec.loader.exec_module(real_api)

app = real_api.app
