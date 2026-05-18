import os
import logging
from pinecone import Pinecone
from google import genai

logger = logging.getLogger(__name__)

def search_legal_docs(query: str) -> str:
    """
    Search Pakistani legal documents and penal codes.
    Returns a formatted string of the top results or an empty string on error.
    """
    try:
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        index_name = os.getenv("PINECONE_INDEX")
        if not index_name or index_name not in pc.list_indexes().names():
            logger.warning(f"Pinecone index '{index_name}' not found or not set.")
            return ""
            
        index = pc.Index(index_name)

        # Get embedding
        use_vertex = os.getenv("USE_VERTEX_AI", "true").lower() == "true"
        client = genai.Client(vertexai=True, project="talash-496612", location="us-central1")
        response = client.models.embed_content(
            model='text-embedding-004',
            contents=query,
        )
        vector = response.embeddings[0].values

        # Query Pinecone
        results = index.query(
            vector=vector,
            top_k=10,
            include_metadata=True
        )

        # Filter > 0.3 score
        filtered_results = [m for m in results.matches if m.score > 0.3]
        
        if not filtered_results:
            return ""

        formatted_res = []
        for match in filtered_results:
            metadata = match.metadata or {}
            text = metadata.get("text", "")
            source = metadata.get("source", "Unknown Source")
            formatted_res.append(f"[Source: {source}]\n{text}")

        return "\n\n".join(formatted_res)

    except Exception as e:
        logger.error(f"Error in search_legal_docs: {e}")
        return ""