import asyncio
import json
import httpx
from typing import AsyncGenerator, List, Optional, Dict, Any
from app.core.config import settings

SYSTEM_INSTRUCTION = (
    "You are Rhynia G1, an intelligent, empathetic, and highly capable AI assistant.\n\n"
    "CRITICAL FORMATTING GUIDELINES:\n"
    "- ABSOLUTELY NEVER USE MARKDOWN TABLES (never use '|' pipe table syntax). Tables look cluttered, broken, and ugly on chat screens.\n"
    "- ALWAYS format roadmaps, study plans, time tables, syllabus, book recommendations, timelines, and guides using clean structured paragraphs, bold section headers (###), and bullet points (* or 1, 2, 3).\n"
    "- Exception: ONLY generate a table if the user explicitly asks for a table by using the word 'table' or 'टेबल' in their message. Otherwise, STRICTLY avoid markdown tables.\n"
    "- When live search results are provided, you MUST strictly use the latest current information from the search sources (e.g. 2023-2026 incumbents/winners) and never fall back to outdated pre-trained claims."
)

VISION_MODELS = [
    "nvidia/nemotron-3.5-super-vl:free",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free"
]

HTTP_TIMEOUT = httpx.Timeout(connect=5.0, read=25.0, write=5.0, pool=5.0)

# =====================================================================
# 1. BHARATROUTER STREAMING (Ultra-Fast 120B ~1.15s)
# =====================================================================
async def stream_bharatrouter(messages: List[Dict[str, str]], model: str = "gpt-oss-120b") -> AsyncGenerator[str, None]:
    if not settings.BHARATROUTER_API_KEY:
        return
    url = "https://api.bharatrouter.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.BHARATROUTER_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Zuhali-AI/1.0"
    }
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": 0.7
    }

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as r:
            if r.status_code != 200:
                raise Exception(f"BharatRouter HTTP {r.status_code}")
            async for line in r.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        c = chunk["choices"][0]["delta"].get("content")
                        if c:
                            yield c
                    except Exception:
                        pass

# =====================================================================
# 2. OPENROUTER STREAMING (Nemotron Lightning, Nemotron Ultra 550B, Auto)
# =====================================================================
async def stream_openrouter(messages: List[Dict[str, str]], model: str = "openrouter/auto") -> AsyncGenerator[str, None]:
    key = settings.OPENROUTER_API_KEY or settings.OPENROUTER_BACKUP_KEY
    if not key:
        return
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zuhali.ai",
        "X-Title": "Zuhali AI",
        "User-Agent": "Mozilla/5.0"
    }
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 1600,
        "stream": True,
        "temperature": 0.7
    }

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as r:
            if r.status_code != 200:
                raise Exception(f"OpenRouter HTTP {r.status_code}")
            async for line in r.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        c = chunk["choices"][0]["delta"].get("content")
                        if c:
                            yield c
                    except Exception:
                        pass

# =====================================================================
# 3. GOOGLE GEMINI SSE STREAMING (gemini-3.5-flash-lite Official)
# =====================================================================
async def stream_gemini(messages: List[Dict[str, str]], model: str = "gemini-3.5-flash-lite") -> AsyncGenerator[str, None]:
    if not settings.GEMINI_API_KEY:
        return

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={settings.GEMINI_API_KEY}"
    contents = []
    for m in messages:
        role = "model" if m.get("role") == "assistant" else "user"
        txt = (m.get("content") or "").strip()
        if txt:
            contents.append({"role": role, "parts": [{"text": txt}]})
    if not contents:
        contents = [{"role": "user", "parts": [{"text": "Hello"}]}]

    payload = {"contents": contents}

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        async with client.stream("POST", url, json=payload) as r:
            if r.status_code != 200:
                raise Exception(f"Google Gemini HTTP {r.status_code}")
            async for line in r.aiter_lines():
                if line.startswith("data: "):
                    try:
                        chunk = json.loads(line[6:].strip())
                        candidates = chunk.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            for p in parts:
                                txt = p.get("text", "")
                                if txt:
                                    yield txt
                    except Exception:
                        pass

# =====================================================================
# 4. GROQ LPU STREAMING (Hardware LPU Inference)
# =====================================================================
async def stream_groq(messages: List[Dict[str, str]], model: str = "openai/gpt-oss-120b") -> AsyncGenerator[str, None]:
    if not settings.GROQ_API_KEY:
        return
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Zuhali-AI/1.0"
    }
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": 0.7
    }

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as r:
            if r.status_code != 200:
                raise Exception(f"Groq LPU HTTP {r.status_code}")
            async for line in r.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        c = chunk["choices"][0]["delta"].get("content")
                        if c:
                            yield c
                    except Exception:
                        pass

# =====================================================================
# 5. CLOUDFLARE WORKERS AI STREAMING (@cf/openai/gpt-oss-120b Global Edge)
# =====================================================================
async def stream_cloudflare(messages: List[Dict[str, str]], model: str = "@cf/openai/gpt-oss-120b") -> AsyncGenerator[str, None]:
    if not settings.CLOUDFLARE_API_TOKEN or not settings.CLOUDFLARE_ACCOUNT_ID:
        return
    url = f"https://api.cloudflare.com/client/v4/accounts/{settings.CLOUDFLARE_ACCOUNT_ID}/ai/run/{model}"
    headers = {
        "Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messages": messages,
        "stream": True
    }

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as r:
            if r.status_code != 200:
                raise Exception(f"Cloudflare HTTP {r.status_code}")
            async for line in r.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        c = chunk.get("response")
                        if not c and "choices" in chunk and len(chunk["choices"]) > 0:
                            c = chunk["choices"][0].get("delta", {}).get("content")
                        if c:
                            yield c
                    except Exception:
                        pass

# =====================================================================
# 6. SARVAM AI STREAMING (105B Indic LLM for Hindi & Regional)
# =====================================================================
async def stream_sarvam(messages: List[Dict[str, str]], model: str = "sarvam-105b") -> AsyncGenerator[str, None]:
    if not settings.SARVAM_API_KEY:
        return
    url = "https://api.sarvam.ai/v1/chat/completions"
    headers = {
        "api-subscription-key": settings.SARVAM_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1500
    }

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        res = await client.post(url, headers=headers, json=payload)
        if res.status_code != 200:
            raise Exception(f"Sarvam AI HTTP {res.status_code}")
        data = res.json()
        content = data["choices"][0]["message"].get("content") or ""
        # Rapid token chunks for snappy feedback
        words = content.split(" ")
        for i, w in enumerate(words):
            yield (w if i == 0 else " " + w)
            await asyncio.sleep(0.01)

# =====================================================================
# 7. OPENROUTER VISION (Multimodal Image Analysis)
# =====================================================================
async def stream_vision(prompt: str, image_data_url: str) -> AsyncGenerator[str, None]:
    key = settings.OPENROUTER_API_KEY or settings.OPENROUTER_BACKUP_KEY
    if not key:
        return
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zuhali.ai",
        "X-Title": "Zuhali AI",
        "User-Agent": "Mozilla/5.0"
    }

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
            ],
            "stream": True
        }
        tokens_yielded = 0
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(connect=6.0, read=30.0, write=6.0, pool=6.0)) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as r:
                    if r.status_code == 200:
                        async for line in r.aiter_lines():
                            if line.startswith("data: "):
                                data_str = line[6:].strip()
                                if data_str == "[DONE]":
                                    break
                                try:
                                    chunk = json.loads(data_str)
                                    c = chunk["choices"][0]["delta"].get("content")
                                    if c:
                                        tokens_yielded += 1
                                        yield c
                                except Exception:
                                    pass
            if tokens_yielded > 0:
                return
        except Exception as e:
            print(f"[Vision Stream] {model} failed:", e)
            if tokens_yielded > 0:
                return
            continue

# =====================================================================
# UNIFIED DISPATCHER BY PROVIDER & MODEL
# =====================================================================
def get_stream_for_target(provider: str, model: str, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
    if provider == "bharatrouter":
        return stream_bharatrouter(messages, model=model)
    elif provider == "openrouter":
        return stream_openrouter(messages, model=model)
    elif provider == "gemini":
        return stream_gemini(messages, model=model)
    elif provider == "groq":
        return stream_groq(messages, model=model)
    elif provider == "cloudflare":
        return stream_cloudflare(messages, model=model)
    elif provider == "sarvam":
        return stream_sarvam(messages, model=model)
    else:
        return stream_openrouter(messages, model="openrouter/auto")

# =====================================================================
# TRUE NATIVE MULTI-AI CASCADE STREAMING (FAST, MEDIUM, COMPLEX HIGH)
# =====================================================================
async def generate_ai_stream(
    prompt: str,
    model_preference: str = "medium",
    messages: Optional[List[Dict[str, Any]]] = None,
    attachment: Optional[Dict[str, Any]] = None
) -> AsyncGenerator[str, None]:
    """
    True Native SSE Streaming Engine with Instant Token Emission (<0.3s TTFT).
    Streams live tokens directly as generated by the LLM (ChatGPT/Gemini speed).
    """

    # 1. Image Attachment Streaming
    if attachment and (attachment.get("dataUrl") or (attachment.get("type", "").startswith("image/"))):
        data_url = attachment.get("dataUrl")
        if data_url:
            vision_prompt = prompt.strip() if prompt.strip() else f"Please analyze this image '{attachment.get('name', 'image')}' in detail. Describe key elements, text, colors, and insights."
            print("[AI Cascade] ⚡ Streaming image analysis live...")
            async for tok in stream_vision(vision_prompt, data_url):
                yield f"data: {json.dumps({'token': tok})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
            return

    # 2. File / Code Attachment processing
    effective_prompt = prompt.strip()
    if attachment and attachment.get("textContent"):
        file_name = attachment.get("name", "document")
        file_content = attachment.get("textContent", "")[:25000]
        file_intro = f"[ATTACHED FILE: {file_name}]\n```\n{file_content}\n```\n\n"
        if effective_prompt:
            effective_prompt = f"{file_intro}User Request: {effective_prompt}"
        else:
            effective_prompt = f"{file_intro}Please analyze, review, explain, and optimize the contents of this file in detail."

    # 3. Construct system prompt and conversation history
    full_messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]
    if messages and len(messages) > 0:
        history_slice = messages[-16:]
        for m in history_slice:
            role = m.get("role")
            content = m.get("content", "")
            if role in ("user", "assistant") and content.strip():
                full_messages.append({"role": role, "content": content.strip()})
        if not full_messages or full_messages[-1].get("role") != "user":
            full_messages.append({"role": "user", "content": effective_prompt or "Hello"})
        else:
            full_messages[-1]["content"] = effective_prompt or full_messages[-1]["content"]
    else:
        full_messages.append({"role": "user", "content": effective_prompt or "Hello"})

    mode = (model_preference or "medium").lower()

    # 4. Define cascading priority queues
    if "fast" in mode:
        targets = [
            ("bharatrouter", "gpt-oss-120b"),
            ("openrouter", "nvidia/nemotron-3.5-lightning:free"),
            ("openrouter", "openrouter/auto")
        ]
    elif "complex" in mode or "high" in mode:
        targets = [
            ("gemini", "gemini-3.5-flash-lite"),
            ("groq", "openai/gpt-oss-120b"),
            ("openrouter", "openrouter/auto")
        ]
    else:
        # Medium Mode
        targets = [
            ("gemini", "gemini-3.5-flash-lite"),
            ("openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free"),
            ("cloudflare", "@cf/openai/gpt-oss-120b"),
            ("openrouter", "openrouter/auto"),
            ("sarvam", "sarvam-105b")
        ]

    # Global backup in case chosen queue exhausts
    targets.append(("openrouter", "openrouter/auto"))

    print(f"[AI Brain Stream] Starting True Native Stream in mode '{mode}' with {len(targets)} cascade targets...")

    streamed_any_token = False

    for idx, (provider, model) in enumerate(targets):
        tokens_in_this_target = 0
        try:
            print(f"[AI Brain Stream] [Priority {idx + 1}] Connecting to {provider} ({model})...")
            gen = get_stream_for_target(provider, model, full_messages)
            async for token in gen:
                if token:
                    tokens_in_this_target += 1
                    streamed_any_token = True
                    # Instantly send token to client with zero buffering!
                    yield f"data: {json.dumps({'token': token})}\n\n"

            if tokens_in_this_target > 0:
                print(f"[AI Brain Stream] ✅ Stream complete from {provider} ({model})! Streamed {tokens_in_this_target} chunks.")
                break

        except Exception as err:
            print(f"[AI Brain Stream] ⚠️ {provider} ({model}) stream error:", err)
            if tokens_in_this_target > 0:
                # If partial tokens were already displayed to user, do not restart
                break
            # If zero tokens were sent, immediately try the next priority model!
            continue

    # Fallback if no provider could stream any token
    if not streamed_any_token:
        fallback = "I am Rhynia G1. I received your request and am standing by to assist you."
        for word in fallback.split(" "):
            yield f"data: {json.dumps({'token': word + ' '})}\n\n"
            await asyncio.sleep(0.02)

    yield f"data: {json.dumps({'done': True})}\n\n"
