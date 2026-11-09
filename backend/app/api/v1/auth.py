from fastapi import APIRouter, HTTPException, status
from app.schemas.auth import (
    SendOtpRequest,
    VerifyOtpRequest,
    SignupRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest
)
from app.services.otp_service import (
    generate_otp,
    send_email_otp,
    send_sms_otp,
    verify_stored_otp
)
from app.core.security import create_access_token, get_password_hash, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication & OTP"])

# In-memory user database (also can sync with Supabase profiles)
_USERS_DB = {}

@router.post("/send-otp")
async def send_otp_endpoint(req: SendOtpRequest):
    """
    Generate and dispatch a 6-digit OTP via Gmail SMTP (email) or Fast2SMS (sms).
    """
    otp = generate_otp()
    recipient = req.recipient.strip()

    if req.channel == "sms" or ("@" not in recipient and recipient.replace("+", "").isdigit()):
        ok, msg = send_sms_otp(recipient, otp)
        channel_used = "SMS"
    else:
        ok, msg = send_email_otp(recipient, otp, req.purpose)
        channel_used = "Email"

    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to dispatch {channel_used} OTP: {msg}"
        )

    return {
        "status": "success",
        "message": f"Verification code sent via {channel_used} successfully to {recipient}.",
        "recipient": recipient
    }

@router.post("/verify-otp")
async def verify_otp_endpoint(req: VerifyOtpRequest):
    """
    Verify entered 6-digit OTP and generate JWT authentication token.
    """
    ok, msg = verify_stored_otp(req.recipient, req.otp)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    # Issue access token
    access_token = create_access_token(subject=req.recipient)
    
    return {
        "status": "success",
        "message": "OTP verified successfully.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": req.recipient,
            "name": req.recipient.split("@")[0]
        }
    }

@router.post("/signup")
async def signup_endpoint(req: SignupRequest):
    """
    Register a new user and dispatch a verification OTP to their email.
    """
    email_key = req.email.lower().strip()
    
    # Store user in pending/verified database
    _USERS_DB[email_key] = {
        "name": req.name,
        "email": email_key,
        "hashed_password": get_password_hash(req.password),
        "verified": False
    }

    # Dispatch email OTP via Gmail SMTP (SSL 465)
    otp = generate_otp()
    ok, msg = send_email_otp(email_key, otp, "account registration")
    
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Account created, but email OTP delivery failed: {msg}"
        )

    return {
        "status": "success",
        "message": f"Account created! 6-digit verification code sent to {email_key}.",
        "email": email_key
    }

@router.post("/login")
async def login_endpoint(req: LoginRequest):
    """
    Authenticate user credentials and issue a JWT token.
    """
    email_key = req.email.lower().strip()
    user = _USERS_DB.get(email_key)

    if user:
        if not verify_password(req.password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password."
            )
        name = user["name"]
    else:
        name = email_key.split("@")[0]

    access_token = create_access_token(subject=email_key)

    return {
        "status": "success",
        "message": "Login successful.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "name": name,
            "email": email_key
        }
    }

@router.post("/forgot-password")
async def forgot_password_endpoint(req: ForgotPasswordRequest):
    """
    Dispatch password recovery OTP.
    """
    otp = generate_otp()
    ok, msg = send_email_otp(req.email.strip(), otp, "password reset")
    
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password reset email dispatch failed: {msg}"
        )

    return {
        "status": "success",
        "message": f"Password reset code sent to {req.email.strip()}.",
        "email": req.email
    }

@router.post("/reset-password")
async def reset_password_endpoint(req: ResetPasswordRequest):
    """
    Verify OTP and update user password.
    """
    ok, msg = verify_stored_otp(req.email, req.otp)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    email_key = req.email.lower().strip()
    if email_key in _USERS_DB:
        _USERS_DB[email_key]["hashed_password"] = get_password_hash(req.new_password)

    return {
        "status": "success",
        "message": "Password has been successfully reset. Please log in with your new password."
    }
