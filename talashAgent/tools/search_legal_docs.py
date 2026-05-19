import logging
from tools.legal_tools import search_legal_docs as _search_legal_docs

logger = logging.getLogger(__name__)

def search_legal_docs(query: str) -> str:
    """
    Backward-compatible wrapper that queries the unified legal tools search
    and returns a formatted string.
    """
    try:
        results = _search_legal_docs(query)
        if not results:
            return ""
        
        formatted_res = []
        for match in results:
            formatted_res.append(f"[Law: {match['law_name']} - Section: {match['section']} - Source: {match['source']}]\n{match['summary']}")
        
        return "\n\n".join(formatted_res)
    except Exception as e:
        logger.error(f"Error in search_legal_docs wrapper: {e}")
        return ""
