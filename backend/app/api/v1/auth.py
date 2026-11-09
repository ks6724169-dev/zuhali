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
from app.db.supabase import upsert_user_profile
import uuid

router = APIRouter(prefix="/auth", tags=["Authentication & OTP"])

# In-memory user database { email: { name, email, hashed_password, verified } }
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

@router.post("/signup")
async def signup_endpoint(req: SignupRequest):
    """
    Register a new user in pending state and dispatch an OTP to their email.
    Account is NOT active until OTP is verified!
    """
    email_key = req.email.lower().strip()

    # Store user with verified=False
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
        "message": f"Verification code sent to {email_key}. Please enter the 6-digit code to activate your account.",
        "email": email_key,
        "requires_otp": True
    }

@router.post("/verify-otp")
async def verify_otp_endpoint(req: VerifyOtpRequest):
    """
    Verify 6-digit OTP. Only after this does the account become verified and active!
    """
    email_key = req.recipient.lower().strip()
    ok, msg = verify_stored_otp(email_key, req.otp)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    # Activate user
    user = _USERS_DB.get(email_key)
    if user:
        user["verified"] = True
        user_name = user["name"]
    else:
        user_name = email_key.split("@")[0]

    # Sync verified user to live Supabase PostgreSQL
    try:
        user_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, email_key))
        upsert_user_profile(user_uuid, email_key, user_name)
    except Exception as e:
        print("[Supabase Sync Warning]:", e)

    # Issue access token
    access_token = create_access_token(subject=email_key)

    return {
        "status": "success",
        "message": "Account verified and activated successfully!",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": email_key,
            "name": user_name
        }
    }

@router.post("/login")
async def login_endpoint(req: LoginRequest):
    """
    Authenticate user credentials.
    CRITICAL: Rejects unverified accounts! If not verified, triggers OTP and requires verification.
    """
    email_key = req.email.lower().strip()
    user = _USERS_DB.get(email_key)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found. Please create an account first."
        )

    if not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    # Enforce OTP verification before allowing into the app
    if not user.get("verified", False):
        otp = generate_otp()
        send_email_otp(email_key, otp, "account verification")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not verified yet. A fresh OTP has been sent to your email. Please verify to log in."
        )

    access_token = create_access_token(subject=email_key)

    return {
        "status": "success",
        "message": "Login successful.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "name": user["name"],
            "email": email_key
        }
    }

@router.post("/forgot-password")
async def forgot_password_endpoint(req: ForgotPasswordRequest):
    """
    Dispatch password recovery OTP.
    """
    email_key = req.email.lower().strip()
    user = _USERS_DB.get(email_key)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email."
        )

    otp = generate_otp()
    ok, msg = send_email_otp(email_key, otp, "password reset")

    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password reset email dispatch failed: {msg}"
        )

    return {
        "status": "success",
        "message": f"Password reset code sent to {email_key}.",
        "email": email_key
    }

@router.post("/reset-password")
async def reset_password_endpoint(req: ResetPasswordRequest):
    """
    Verify OTP and update user password.
    """
    email_key = req.email.lower().strip()
    ok, msg = verify_stored_otp(email_key, req.otp)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    if email_key in _USERS_DB:
        _USERS_DB[email_key]["hashed_password"] = get_password_hash(req.new_password)

    return {
        "status": "success",
        "message": "Password has been successfully reset. Please log in with your new password."
    }
