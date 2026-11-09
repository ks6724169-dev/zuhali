import asyncio
import json
from typing import AsyncGenerator

async def generate_ai_stream(prompt: str, model: str = "zuhali-pro-v1") -> AsyncGenerator[str, None]:
    """
    ChatGPT-style Server-Sent Events (SSE) token generator.
    Yields data in 'data: {"token": "..."}\n\n' format.
    """
    response_template = (
        f"I am Zuhali AI. I have analyzed your request regarding: '{prompt}'.\n\n"
        "Here is the production-grade architectural solution:\n"
        "1. Modular separation of concerns across state, UI components, and API routing.\n"
        "2. Strict Row Level Security (RLS) ensuring total data isolation in Supabase.\n"
        "3. Resilient Server-Sent Events token delivery with automatic reconnection.\n\n"
        "You can inspect this further in the integrated Code Editor or execute validation commands via the Zuhali Terminal."
    )
    
    words = response_template.split(" ")
    for i, word in enumerate(words):
        chunk = (word if i == 0 else " " + word)
        payload = json.dumps({"token": chunk, "done": False})
        yield f"data: {payload}\n\n"
        await asyncio.sleep(0.03)  # natural human typing pace
    
    # Final event signaling completion
    yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"
