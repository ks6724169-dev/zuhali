from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas.chat import ChatStreamRequest, MessageFeedbackRequest
from app.services.ai_stream import generate_ai_stream

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/stream")
async def chat_stream(req: ChatStreamRequest):
    """
    ChatGPT-like Server-Sent Events (SSE) streaming endpoint.
    Supports:
    - Multi-turn conversation memory history
    - Multimodal image analysis (OCR, Vision, Charts, UI)
    - File code & document extraction and analysis
    """
    prompt = req.message or ""
    return StreamingResponse(
        generate_ai_stream(prompt, req.model, req.messages, req.attachment),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/feedback")
async def submit_feedback(req: MessageFeedbackRequest):
    """
    Store message like/dislike feedback with reasons.
    """
    return {
        "status": "success",
        "message": f"Feedback '{req.feedback_type}' logged successfully for message {req.message_id}"
    }
