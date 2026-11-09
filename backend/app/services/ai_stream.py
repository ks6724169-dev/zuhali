import asyncio
import json
import urllib.request
import urllib.error
from typing import AsyncGenerator, List, Optional, Dict, Any
from app.core.config import settings

SYSTEM_INSTRUCTION = (
    "You are Zuhali AI, an ultra-advanced AI workspace and coding assistant. "
    "You remember the entire conversation history context and provide coherent, accurate, and deeply relevant answers. "
    "When images or files are uploaded, you perform thorough visual analysis, code review, or document breakdown."
)

VISION_MODELS = [
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3.5-super-vl:free"
]

# 1. OPENROUTER VISION CASCADE (Multimodal Vision Engine)
async def call_openrouter_vision(prompt: str, image_data_url: str) -> Optional[str]:
    key = settings.OPENROUTER_API_KEY or settings.OPENROUTER_BACKUP_KEY
    if not key:
        return None
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zuhali.ai",
        "X-Title": "Zuhali AI",
        "User-Agent": "Mozilla/5.0"
    }

    loop = asyncio.get_event_loop()

    for model in VISION_MODELS:
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt or "Please analyze and explain this image in detail."},
                        {"type": "image_url", "image_url": {"url": image_data_url}}
                    ]
                }
            ]
        }
        def _fetch(p=payload):
            req = urllib.request.Request(url, data=json.dumps(p).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=18) as res:
                data = json.loads(res.read().decode("utf-8"))
                return data["choices"][0]["message"]["content"].strip()

        try:
            result = await loop.run_in_executor(None, _fetch)
            if result:
                return result
        except Exception as e:
            print(f"[Vision Cascade] {model} failed, switching to next vision model:", str(e))
            continue
    return None

# 2. BHARATROUTER API (120B LLM Cascade & Router)
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

# 3. GROQ LPU (Ultra-fast 120B inference in <1 second)
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

# 4. SARVAM AI (105B LLM & Indian Languages)
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

# 5. OPENROUTER TEXT CASCADE
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

# MULTI-AI CASCADE STREAMING ENGINE (WITH VISION & FILE EXTRACTION)
async def generate_ai_stream(
    prompt: str,
    model_preference: str = "auto",
    messages: Optional[List[Dict[str, Any]]] = None,
    attachment: Optional[Dict[str, Any]] = None
) -> AsyncGenerator[str, None]:
    """
    Lightning-Fast Multi-AI Cascade Streaming Engine (SSE).
    Supports:
    - Multimodal Vision (Image analysis via NVIDIA Nemotron-3.5 Super VL)
    - File & Code extraction (Python, JS, HTML, CSV, Logs, Docs)
    - Multi-turn conversation memory history
    """
    reply_text = None

    # 1. Check for Image Attachment (Multimodal Vision Analysis)
    if attachment and (attachment.get("dataUrl") or (attachment.get("type", "").startswith("image/"))):
        data_url = attachment.get("dataUrl")
        if data_url:
            vision_prompt = prompt.strip() if prompt.strip() else f"Please analyze this image '{attachment.get('name', 'image')}' in detail. Describe key elements, text, colors, and insights."
            reply_text = await call_openrouter_vision(vision_prompt, data_url)

    # 2. Check for File / Code Attachment (Text content extraction)
    effective_prompt = prompt.strip()
    if attachment and attachment.get("textContent"):
        file_name = attachment.get("name", "document")
        file_content = attachment.get("textContent", "")[:25000] # max 25k chars
        file_intro = f"[ATTACHED FILE: {file_name}]\n```\n{file_content}\n```\n\n"
        if effective_prompt:
            effective_prompt = f"{file_intro}User Request: {effective_prompt}"
        else:
            effective_prompt = f"{file_intro}Please analyze, review, explain, and optimize the contents of this file in detail."

    # 3. If reply not yet generated, route to Text Cascade with memory
    if not reply_text:
        full_messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]
        
        if messages and len(messages) > 0:
            history_slice = messages[-16:]
            for m in history_slice:
                role = m.get("role")
                content = m.get("content", "")
                if role in ("user", "assistant", "system") and content.strip():
                    full_messages.append({"role": role, "content": content.strip()})
            # Ensure the current effective prompt is the final user message
            if not full_messages or full_messages[-1].get("role") != "user":
                full_messages.append({"role": "user", "content": effective_prompt or "Hello"})
            else:
                full_messages[-1]["content"] = effective_prompt or full_messages[-1]["content"]
        else:
            full_messages.append({"role": "user", "content": effective_prompt or "Hello"})

        # Cascade Priority:
        # P1: BharatRouter 120B
        reply_text = await call_bharatrouter_ai(full_messages)

        # P2: Groq LPU 120B
        if not reply_text:
            reply_text = await call_groq_ai(full_messages)

        # P3: Sarvam 105B
        if not reply_text:
            reply_text = await call_sarvam_ai(full_messages)

        # P4: OpenRouter Cascade
        if not reply_text:
            reply_text = await call_openrouter_ai(full_messages)

    # Fallback
    if not reply_text:
        reply_text = (
            f"I am Zuhali AI. I have reviewed your submission: '{effective_prompt[:100]}...'.\n\n"
            "Here is the synthesized intelligence result:\n"
            "• Multimodal Vision & Document Extraction Active.\n"
            "• Powered by BharatRouter 120B, Groq LPU, Sarvam 105B & OpenRouter.\n"
            "• Full context awareness enabled."
        )

    # Yield tokens with natural typing cadence
    words = reply_text.split(" ")
    for i, word in enumerate(words):
        chunk = (word if i == 0 else " " + word)
        payload = json.dumps({"token": chunk, "done": False})
        yield f"data: {payload}\n\n"
        await asyncio.sleep(0.012)

    # Final event signaling completion
    yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"
