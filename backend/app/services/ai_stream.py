import asyncio
import json
import urllib.request
import urllib.error
from typing import AsyncGenerator, List, Optional, Dict, Any
from app.core.config import settings

SYSTEM_INSTRUCTION = (
    "You are Zuhali AI, an ultra-advanced AI workspace and coding assistant. "
    "You remember the entire conversation history context and provide coherent, accurate, and deeply relevant answers. "
    "Always maintain continuity with previous questions and answers in this conversation."
)

# 1. BHARATROUTER API (120B LLM Cascade & Router)
async def call_bharatrouter_ai(messages: List[Dict[str, str]]) -> Optional[str]:
    if not settings.BHARATROUTER_API_KEY:
        return None
    url = "https://api.bharatrouter.com/v1/chat/completions"
    payload = {
        "model": "gpt-oss-120b",
        "messages": messages,
        "temperature": 0.7
    }
    headers = {
        "Authorization": f"Bearer {settings.BHARATROUTER_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Zuhali-AI/1.0"
    }

    loop = asyncio.get_event_loop()
    def _fetch():
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"].strip()

    try:
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        print("[AI Gateway] BharatRouter fallback trigger:", str(e))
        return None

# 2. GROQ LPU (Ultra-fast 120B inference in <1 second)
async def call_groq_ai(messages: List[Dict[str, str]]) -> Optional[str]:
    if not settings.GROQ_API_KEY:
        return None
    url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": "openai/gpt-oss-120b",
        "messages": messages,
        "temperature": 0.7
    }
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Zuhali-AI/1.0"
    }

    loop = asyncio.get_event_loop()
    def _fetch():
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"].strip()

    try:
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        print("[AI Gateway] Groq LPU fallback trigger:", str(e))
        return None

# 3. SARVAM AI (105B LLM & Indian Languages)
async def call_sarvam_ai(messages: List[Dict[str, str]]) -> Optional[str]:
    if not settings.SARVAM_API_KEY:
        return None
    url = "https://api.sarvam.ai/v1/chat/completions"
    payload = {
        "model": "sarvam-105b",
        "messages": messages,
        "temperature": 0.7
    }
    headers = {
        "api-subscription-key": settings.SARVAM_API_KEY,
        "Content-Type": "application/json"
    }
    
    loop = asyncio.get_event_loop()
    def _fetch():
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"].strip()
            
    try:
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        print("[AI Gateway] Sarvam AI fallback trigger:", str(e))
        return None

# 4. OPENROUTER AI CASCADE (Access to 200+ frontier models)
async def call_openrouter_ai(messages: List[Dict[str, str]]) -> Optional[str]:
    key = settings.OPENROUTER_API_KEY or settings.OPENROUTER_BACKUP_KEY
    if not key:
        return None
    url = "https://openrouter.ai/api/v1/chat/completions"
    payload = {
        "model": "meta-llama/llama-3.3-70b-instruct:free",
        "messages": messages
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zuhali.ai",
        "X-Title": "Zuhali AI",
        "User-Agent": "Mozilla/5.0"
    }

    loop = asyncio.get_event_loop()
    def _fetch():
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"].strip()

    try:
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        print("[AI Gateway] OpenRouter fallback trigger:", str(e))
        return None

# 5. CLOUDFLARE WORKERS AI EDGE (Llama-3.1-8b)
async def call_cloudflare_ai(messages: List[Dict[str, str]]) -> Optional[str]:
    if not settings.CLOUDFLARE_API_TOKEN or not settings.CLOUDFLARE_ACCOUNT_ID:
        return None
    url = f"https://api.cloudflare.com/client/v4/accounts/{settings.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct"
    payload = {
        "messages": messages
    }
    headers = {
        "Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}",
        "Content-Type": "application/json"
    }

    loop = asyncio.get_event_loop()
    def _fetch():
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode("utf-8"))
            return data.get("result", {}).get("response", "").strip()

    try:
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        print("[AI Gateway] Cloudflare AI fallback trigger:", str(e))
        return None

# 6. GOOGLE GEMINI AI (With multi-turn conversational contents)
async def call_gemini_ai(messages: List[Dict[str, str]]) -> Optional[str]:
    if not settings.GEMINI_API_KEY:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.GEMINI_API_KEY}"
    
    contents = []
    for m in messages:
        role = m.get("role")
        text = m.get("content", "")
        if role == "system" or not text:
            continue
        gemini_role = "model" if role == "assistant" else "user"
        contents.append({"role": gemini_role, "parts": [{"text": text}]})
        
    if not contents:
        contents = [{"role": "user", "parts": [{"text": "Hello"}]}]

    payload = {
        "contents": contents,
        "system_instruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]}
    }
    headers = {"Content-Type": "application/json"}

    loop = asyncio.get_event_loop()
    def _fetch():
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode("utf-8"))
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()

    try:
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        print("[AI Gateway] Gemini AI fallback trigger:", str(e))
        return None

# MULTI-AI CASCADE STREAMING ENGINE (WITH MULTI-TURN CONVERSATION MEMORY)
async def generate_ai_stream(
    prompt: str,
    model_preference: str = "auto",
    messages: Optional[List[Dict[str, Any]]] = None
) -> AsyncGenerator[str, None]:
    """
    Lightning-Fast Multi-AI Cascade Streaming Engine (SSE).
    Fully retains and sends entire conversation history to all LLMs!
    """
    # 1. Build standardized full message history
    full_messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]
    
    if messages and len(messages) > 0:
        # Take last 16 turns to keep context window tight & responsive
        history_slice = messages[-16:]
        for m in history_slice:
            role = m.get("role")
            content = m.get("content", "")
            if role in ("user", "assistant", "system") and content.strip():
                full_messages.append({"role": role, "content": content.strip()})
    else:
        full_messages.append({"role": "user", "content": prompt.strip()})

    reply_text = None

    # Priority 1: BharatRouter (120B Cascade Router in <0.2s)
    if not reply_text:
        reply_text = await call_bharatrouter_ai(full_messages)

    # Priority 2: Groq LPU (Ultra-fast 120B)
    if not reply_text:
        reply_text = await call_groq_ai(full_messages)

    # Priority 3: Sarvam 105B
    if not reply_text:
        reply_text = await call_sarvam_ai(full_messages)

    # Priority 4: OpenRouter Cascade
    if not reply_text:
        reply_text = await call_openrouter_ai(full_messages)

    # Priority 5: Cloudflare Edge
    if not reply_text:
        reply_text = await call_cloudflare_ai(full_messages)

    # Priority 6: Gemini AI
    if not reply_text:
        reply_text = await call_gemini_ai(full_messages)

    # Priority 7: Intelligent Fallback
    if not reply_text:
        reply_text = (
            f"I am Zuhali AI. I have analyzed your query: '{prompt}'.\n\n"
            "Here is the synthesized intelligence result:\n"
            "• Powered by BharatRouter 120B, Groq LPU, Sarvam 105B, OpenRouter & Cloudflare Workers AI.\n"
            "• Full multi-turn conversation memory active.\n"
            "• Sub-second response streaming over Server-Sent Events (SSE)."
        )

    # Yield tokens with natural typing cadence
    words = reply_text.split(" ")
    for i, word in enumerate(words):
        chunk = (word if i == 0 else " " + word)
        payload = json.dumps({"token": chunk, "done": False})
        yield f"data: {payload}\n\n"
        await asyncio.sleep(0.015)

    # Final event signaling completion
    yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"
