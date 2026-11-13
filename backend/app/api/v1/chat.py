from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from app.schemas.chat import ChatStreamRequest, MessageFeedbackRequest
from app.services.ai_stream import generate_ai_stream
from app.core.security import decode_access_token

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/stream")
async def chat_stream(req: ChatStreamRequest):
    """
    Direct ChatGPT-like Server-Sent Events (SSE) streaming endpoint.
    Supports:
    - Natural conversation with memory
    - Code generation and explanation
    - Multimodal image and file analysis
    """
    prompt = req.message or ""
    selected_mode = (req.mode or req.model or "medium").lower()
    generator = generate_ai_stream(prompt, selected_mode, req.messages, req.attachment, req.attachments)

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
async def list_feedback(limit: int = 50, authorization: str = Header(default="")):
    """
    Retrieve stored user feedback for the authenticated user only.
    """
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_access_token(authorization.split(" ", 1)[1].strip())
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    auth_email = payload["sub"]
    safe_limit = max(1, min(limit, 100))

    conn = get_db_connection()
    feedbacks = []
    if conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, message_id, user_email, feedback_type, reason, comment, prompt, message_text, created_at
                    FROM public.message_feedback
                    WHERE user_email = %s
                    ORDER BY created_at DESC
                    LIMIT %s;
                """, (auth_email, safe_limit))
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
import re
import shutil

WORKSPACE_ROOT = (Path(__file__).resolve().parent.parent.parent.parent / "workspace" / "projects").resolve()
MAX_PROJECT_BYTES = 50 * 1024 * 1024  # 50 MB max per project
MAX_PROJECT_FILES = 500

def _resolve_effective_identity(
    authorization: Optional[str] = None,
    x_guest_session_id: Optional[str] = None,
    requested_email: Optional[str] = None
) -> str:
    """
    Cryptographic identity resolver to defeat BOLA/IDOR impersonation:
    - If user presents a valid JWT, identity is bound strictly to the token 'sub'.
    - If unauthenticated, impersonating any registered email is strictly forbidden (HTTP 403).
    - Guests receive an isolated session sandbox (`guest_<sessionId>`).
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        claims = decode_access_token(token)
        if claims and claims.get("sub"):
            return re.sub(r'[^a-z0-9]', '_', str(claims["sub"]).lower())

    if requested_email and "@" in requested_email:
        raise HTTPException(
            status_code=403,
            detail="Valid authentication token required to access or modify registered user projects."
        )

    if x_guest_session_id and re.match(r'^[a-zA-Z0-9_-]{8,64}$', x_guest_session_id):
        return f"guest_{x_guest_session_id.lower()}"

    return "guest_developer"

def _safe_project_dir(user_key: str, project_name: str) -> Path:
    if not project_name or len(project_name) > 80 or ".." in project_name or "/" in project_name or "\\" in project_name:
        raise HTTPException(status_code=400, detail="Invalid project name")
    if not re.match(r'^[a-zA-Z0-9._-]+$', project_name):
        raise HTTPException(status_code=400, detail="Project name contains disallowed characters")
    
    safe_user_key = re.sub(r'[^a-z0-9_]', '_', user_key) or "guest_developer"
    candidate = (WORKSPACE_ROOT / safe_user_key / project_name).resolve()
    
    # Path Traversal Guard: Ensure candidate resides strictly under WORKSPACE_ROOT
    if not candidate.is_relative_to(WORKSPACE_ROOT):
        raise HTTPException(status_code=400, detail="Unsafe project path detected")
    return candidate

@router.delete("/project")
async def delete_project(
    project_name: str,
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None, alias="X-Guest-Session-ID")
):
    """Delete project folder and all files from workspace disk safely."""
    user_key = _resolve_effective_identity(authorization, x_guest_session_id, user_email)
    project_dir = _safe_project_dir(user_key, project_name)
    if project_dir.exists() and project_dir.is_dir():
        # Prevent symlink attacks before removing
        if project_dir.is_symlink():
            project_dir.unlink()
        else:
            shutil.rmtree(project_dir, ignore_errors=True)
        return {"status": "success", "message": f"Project '{project_name}' deleted"}
    return {"status": "not_found", "message": "Directory not found on disk"}

@router.patch("/project/rename")
async def rename_project(
    old_name: str,
    new_name: str,
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None, alias="X-Guest-Session-ID")
):
    """Rename project folder on workspace disk safely."""
    user_key = _resolve_effective_identity(authorization, x_guest_session_id, user_email)
    old_dir = _safe_project_dir(user_key, old_name)
    new_dir = _safe_project_dir(user_key, new_name)
    if old_dir.exists() and old_dir.is_dir():
        old_dir.rename(new_dir)
        return {"status": "success", "message": f"Project renamed to '{new_name}'"}
    return {"status": "not_found", "message": "Directory not found on disk"}
