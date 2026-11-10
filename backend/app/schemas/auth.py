from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class SendOtpRequest(BaseModel):
    recipient: str = Field(..., min_length=3, max_length=120)
    channel: Optional[str] = "email"  # "email" or "sms"
    purpose: Optional[str] = "login"

class VerifyOtpRequest(BaseModel):
    recipient: str
    otp: str = Field(..., min_length=6, max_length=6)

class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    email: str = Field(..., min_length=5, max_length=120)
    password: str = Field(..., min_length=8)

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)
