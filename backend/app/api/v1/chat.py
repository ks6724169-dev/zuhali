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

from app.db.supabase import get_db_connection
from psycopg2.extras import RealDictCursor

@router.post("/feedback")
async def submit_feedback(req: MessageFeedbackRequest):
    """
    Store message like/dislike feedback with reasons directly into Supabase PostgreSQL.
    """
    conn = get_db_connection()
    feedback_id = None
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO public.message_feedback 
                    (message_id, feedback_type, reason, comment, user_email, prompt, message_text)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, created_at;
                """, (
                    req.message_id,
                    req.feedback_type,
                    req.reason,
                    req.comment,
                    req.user_email,
                    req.prompt,
                    req.message_text
                ))
                row = cur.fetchone()
                if row:
                    feedback_id = str(row['id'])
        except Exception as e:
            print("[Feedback Insert Error]:", str(e))
        finally:
            conn.close()

    return {
        "status": "success",
        "feedback_id": feedback_id,
        "message": f"Feedback '{req.feedback_type}' logged successfully for message {req.message_id}"
    }

@router.get("/feedback")
async def list_feedback(limit: int = 50):
    """
    Retrieve stored user feedback from Supabase PostgreSQL for auditing and evaluation.
    """
    conn = get_db_connection()
    feedbacks = []
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, message_id, user_email, feedback_type, reason, comment, prompt, message_text, created_at
                    FROM public.message_feedback
                    ORDER BY created_at DESC
                    LIMIT %s;
                """, (limit,))
                feedbacks = cur.fetchall()
                # Format datetimes
                for f in feedbacks:
                    f['created_at'] = f['created_at'].isoformat() if f.get('created_at') else None
        except Exception as e:
            print("[Feedback Fetch Error]:", str(e))
        finally:
            conn.close()
    return {"status": "success", "count": len(feedbacks), "feedbacks": feedbacks}
