"""
RAG Engine for SeedGuide - Supports Ollama (open-source LLMs) and Anthropic Claude
with DuckDuckGo web search for live information retrieval.
"""

import os
import re
import json
import hashlib
import httpx
import chromadb
from chromadb.utils import embedding_functions

# --- Configuration ---
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "ollama")  # "ollama" or "anthropic"
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
WEB_SEARCH_ENABLED = os.environ.get("WEB_SEARCH_ENABLED", "true").lower() == "true"

# --- ChromaDB Setup ---
CHROMA_DIR = os.path.join(os.path.dirname(__file__), ".chroma_db")
chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
embedding_fn = embedding_functions.DefaultEmbeddingFunction()

COLLECTION_NAME = "seedguide_knowledge"


def chunk_text(text, chunk_size=500, overlap=50):
    """Split text into overlapping chunks by section."""
    sections = re.split(r'\n---\n', text)
    chunks = []
    for section in sections:
        section = section.strip()
        if not section:
            continue
        # Further split large sections
        paragraphs = section.split('\n\n')
        current_chunk = ""
        for para in paragraphs:
            if len(current_chunk) + len(para) > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                # Keep overlap
                words = current_chunk.split()
                current_chunk = " ".join(words[-overlap:]) + "\n\n" + para
            else:
                current_chunk += "\n\n" + para if current_chunk else para
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
    return chunks


def ensure_indexed():
    """Index the knowledge base into ChromaDB if not already done."""
    kb_path = os.path.join(os.path.dirname(__file__), "knowledge_base.txt")
    if not os.path.exists(kb_path):
        print("Warning: knowledge_base.txt not found")
        return

    with open(kb_path, "r", encoding="utf-8") as f:
        text = f.read()

    # Check if already indexed with same content
    content_hash = hashlib.md5(text.encode()).hexdigest()

    try:
        collection = chroma_client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=embedding_fn
        )
        meta = collection.metadata or {}
        if meta.get("content_hash") == content_hash:
            print(f"Knowledge base already indexed ({collection.count()} chunks)")
            return
        # Content changed, re-index
        chroma_client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    # Index
    chunks = chunk_text(text)
    collection = chroma_client.create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
        metadata={"content_hash": content_hash}
    )

    ids = [f"chunk_{i}" for i in range(len(chunks))]
    collection.add(documents=chunks, ids=ids)
    print(f"Indexed {len(chunks)} chunks into ChromaDB")


def retrieve(query, n_results=5):
    """Retrieve relevant chunks from the knowledge base."""
    try:
        collection = chroma_client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=embedding_fn
        )
        results = collection.query(query_texts=[query], n_results=n_results)
        return results["documents"][0] if results["documents"] else []
    except Exception as e:
        print(f"Retrieval error: {e}")
        return []


# --- Web Search ---
def web_search(query, max_results=3):
    """Search the web using DuckDuckGo for current gardening info."""
    if not WEB_SEARCH_ENABLED:
        return []

    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(f"gardening {query}", max_results=max_results))
            return [
                {
                    "title": r.get("title", ""),
                    "snippet": r.get("body", ""),
                    "url": r.get("href", "")
                }
                for r in results
            ]
    except Exception as e:
        print(f"Web search error: {e}")
        return []


# --- Ollama Integration ---
def list_ollama_models():
    """List available Ollama models."""
    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5.0)
        if resp.status_code == 200:
            data = resp.json()
            return [m["name"] for m in data.get("models", [])]
    except Exception:
        pass
    return []


def check_ollama_connection():
    """Check if Ollama is running."""
    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3.0)
        return resp.status_code == 200
    except Exception:
        return False


def generate_ollama(prompt, model=None):
    """Generate a response using Ollama."""
    model = model or OLLAMA_MODEL
    try:
        resp = httpx.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "num_predict": 1024
                }
            },
            timeout=120.0
        )
        if resp.status_code == 200:
            return resp.json().get("response", "")
        else:
            return f"Ollama error: {resp.status_code} - {resp.text}"
    except httpx.ConnectError:
        return "Cannot connect to Ollama. Make sure it's running: `ollama serve`"
    except Exception as e:
        return f"Error: {str(e)}"


# --- Anthropic Integration ---
def generate_anthropic(prompt, model=None):
    """Generate a response using Anthropic Claude."""
    if not ANTHROPIC_API_KEY:
        return "Anthropic API key not set. Set ANTHROPIC_API_KEY environment variable."

    model = model or ANTHROPIC_MODEL
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text
    except Exception as e:
        return f"Anthropic error: {str(e)}"


# --- Main Chat Function ---
def chat(message, conversation_history=None, provider=None, model=None, use_web_search=None):
    """
    Process a chat message with RAG-enhanced response.

    Args:
        message: User's question
        conversation_history: List of prior messages [{"role": "user/assistant", "content": "..."}]
        provider: "ollama" or "anthropic" (overrides env var)
        model: specific model name (overrides env var)
        use_web_search: whether to search the web (overrides env var)

    Returns:
        dict with "response", "sources" (knowledge base), "web_sources" (web results)
    """
    provider = provider or LLM_PROVIDER
    use_web_search = use_web_search if use_web_search is not None else WEB_SEARCH_ENABLED

    # 1. Retrieve relevant knowledge base chunks
    kb_chunks = retrieve(message, n_results=5)
    kb_context = "\n\n".join(kb_chunks) if kb_chunks else "No relevant knowledge base entries found."

    # 2. Optionally search the web
    web_results = []
    web_context = ""
    if use_web_search:
        web_results = web_search(message)
        if web_results:
            web_context = "\n\n".join(
                f"[{r['title']}]: {r['snippet']}" for r in web_results
            )

    # 3. Build conversation context
    conv_text = ""
    if conversation_history:
        for msg in conversation_history[-6:]:  # Last 6 messages
            role = "User" if msg["role"] == "user" else "Assistant"
            conv_text += f"{role}: {msg['content']}\n"

    # 4. Build prompt
    prompt = f"""You are SeedGuide AI, a friendly and knowledgeable gardening assistant.
You help people grow their own food, from complete beginners to experienced gardeners.
Answer questions using the knowledge base and web search results provided below.
Be practical, encouraging, and specific. If you reference information from web sources, mention it.
Keep responses concise but helpful.

KNOWLEDGE BASE CONTEXT:
{kb_context}

{"WEB SEARCH RESULTS:" + chr(10) + web_context if web_context else ""}

{"CONVERSATION HISTORY:" + chr(10) + conv_text if conv_text else ""}

USER QUESTION: {message}

Respond helpfully and concisely:"""

    # 5. Generate response
    if provider == "anthropic":
        response = generate_anthropic(prompt, model)
    else:
        response = generate_ollama(prompt, model)

    return {
        "response": response,
        "sources": kb_chunks[:3] if kb_chunks else [],
        "web_sources": web_results
    }


def get_config():
    """Return current configuration for the frontend."""
    ollama_available = check_ollama_connection()
    ollama_models = list_ollama_models() if ollama_available else []

    return {
        "provider": LLM_PROVIDER,
        "ollama": {
            "available": ollama_available,
            "base_url": OLLAMA_BASE_URL,
            "model": OLLAMA_MODEL,
            "models": ollama_models
        },
        "anthropic": {
            "available": bool(ANTHROPIC_API_KEY),
            "model": ANTHROPIC_MODEL
        },
        "web_search": WEB_SEARCH_ENABLED
    }
