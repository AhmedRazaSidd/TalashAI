import os
import time
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Sirf ek key
API_KEY = os.getenv("VERTEX_API_KEY")
os.environ.pop("GOOGLE_API_KEY", None)
if not API_KEY:
    raise ValueError("VERTEX_API_KEY not set in .env!")

os.environ["VERTEX_API_KEY"] = API_KEY

def get_current_key():
    return API_KEY

def rotate_key():
    pass  # sirf ek key hai, rotate nahi hogi

def run_agent_with_retry(agent_callable, *args, **kwargs):
    try:
        return agent_callable(*args, **kwargs)
    except Exception as e:
        error_str = str(e).lower()
        if "429" in error_str or "exhausted" in error_str or "quota" in error_str or "rate limit" in error_str:
            logger.error("Rate limit hit, stopping pipeline.")
            raise Exception("RATE_LIMIT_429")
        raise e