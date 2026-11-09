from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas.chat import ChatStreamRequest, MessageFeedbackRequest
from app.services.ai_stream import generate_ai_stream
from app.services.dev_agent import generate_developer_agent_stream

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/stream")
async def chat_stream(req: ChatStreamRequest):
    """
    ChatGPT-like Server-Sent Events (SSE) streaming endpoint.
    Supports:
    - Multi-turn conversation memory history
    - Autonomous Developer Agent (when req.developer_mode is True)
    - Multimodal image analysis (OCR, Vision, Charts, UI)
    - File code & document extraction and analysis
    """
    prompt = req.message or ""

    if req.developer_mode:
        generator = generate_developer_agent_stream(prompt, req.user_email)
    else:
        generator = generate_ai_stream(prompt, req.model, req.messages, req.attachment)

    return StreamingResponse(
        generator,
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

import shutil
import re
from pathlib import Path
from typing import Optional

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "workspace" / "projects"

@router.delete("/project")
async def delete_project(project_name: str, user_email: Optional[str] = None):
    """Delete project folder and all files from workspace disk."""
    user_key = re.sub(r'[^a-z0-9]', '_', user_email.lower()) if user_email else "guest_developer"
    project_dir = WORKSPACE_ROOT / user_key / project_name
    if project_dir.exists() and project_dir.is_dir():
        shutil.rmtree(project_dir, ignore_errors=True)
        return {"status": "success", "message": f"Project '{project_name}' deleted"}
    return {"status": "not_found", "message": "Directory not found on disk"}

@router.patch("/project/rename")
async def rename_project(old_name: str, new_name: str, user_email: Optional[str] = None):
    """Rename project folder on workspace disk."""
    user_key = re.sub(r'[^a-z0-9]', '_', user_email.lower()) if user_email else "guest_developer"
    old_dir = WORKSPACE_ROOT / user_key / old_name
    new_dir = WORKSPACE_ROOT / user_key / new_name
    if old_dir.exists() and old_dir.is_dir():
        old_dir.rename(new_dir)
        return {"status": "success", "message": f"Project renamed to '{new_name}'"}
    return {"status": "not_found", "message": "Directory not found on disk"}
