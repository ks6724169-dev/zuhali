from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str

class ChatStreamRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=10000)
    messages: Optional[List[Dict[str, Any]]] = None
    model: Optional[str] = "zuhali-pro-v1"
    system_prompt: Optional[str] = None

class MessageFeedbackRequest(BaseModel):
    message_id: str
    feedback_type: str = Field(..., pattern="^(like|dislike)$")
    reason: Optional[str] = None
    comment: Optional[str] = None

class ConversationCreate(BaseModel):
    title: str = "New chat"

class RenameConversation(BaseModel):
    title: str
