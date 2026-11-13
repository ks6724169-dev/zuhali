import asyncio
import uuid
from datetime import datetime, timedelta
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
    verify_stored_otp,
    store_otp
)
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.supabase import (
    normalize_email,
    get_user_by_canonical,
    save_pending_user,
    mark_user_verified,
    update_user_password,
    upsert_user_profile
)

router = APIRouter(prefix="/auth", tags=["Authentication & OTP"])

# In-memory user cache as fallback/speed layer { canonical_email: { name, email, canonical_email, hashed_password, verified } }
_USERS_DB = {}

@router.post("/send-otp")
async def send_otp_endpoint(req: SendOtpRequest):
    """
    Generate and dispatch a 6-digit OTP via Gmail SMTP (email) or Fast2SMS (sms).
    """
    otp = generate_otp()
    recipient = req.recipient.strip()

    if req.channel == "sms" or ("@" not in recipient and recipient.replace("+", "").isdigit()):
        ok, msg = await asyncio.to_thread(send_sms_otp, recipient, otp)
        channel_used = "SMS"
    else:
        display_email, canonical_email = normalize_email(recipient)
        ok, msg = await asyncio.to_thread(send_email_otp, display_email, otp, req.purpose)
        if ok:
            store_otp(canonical_email, otp)
            store_otp(display_email, otp)
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
    Register a new user:
    - 1 Gmail = 1 Account ONLY.
    - Anti-abuse canonical normalization defeats dots (m.a.n.i.s.h) and +tags (user+tag).
    - If already registered and verified: 409 Conflict rejection!
    - Requires 6-digit OTP verification via Gmail SMTP SSL to activate.
    """
    display_email, canonical_email = normalize_email(req.email)
    
    # 1. Check if already registered in Supabase PostgreSQL or memory
    db_user = await asyncio.to_thread(get_user_by_canonical, canonical_email)
    mem_user = _USERS_DB.get(canonical_email)
    
    is_verified = (db_user and db_user.get("is_verified")) or (mem_user and mem_user.get("verified"))
    
    if is_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Yeh Gmail ({display_email}) pehle se registered hai! Ek Gmail se kewal ek hi account ban sakta hai. Kripya seedhe Login karein ya Forgot Password use karein."
        )

    password_hash = get_password_hash(req.password)
    user_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, canonical_email))

    # 2. Store pending user in Supabase & memory
    await asyncio.to_thread(save_pending_user, user_uuid, display_email, canonical_email, req.name, password_hash)
    _USERS_DB[canonical_email] = {
        "name": req.name,
        "email": display_email,
        "canonical_email": canonical_email,
        "hashed_password": password_hash,
        "verified": False
    }

    # 3. Dispatch real 6-digit OTP via Gmail SMTP SSL port 465
    otp = generate_otp()
    ok, msg = await asyncio.to_thread(send_email_otp, display_email, otp, "account registration")
    
    if ok:
        store_otp(canonical_email, otp)
        store_otp(display_email, otp)

    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Account banaya gaya, par email OTP bhejne me samasya aayi: {msg}"
        )

    return {
        "status": "success",
        "message": f"Verification code {display_email} par bhej diya gaya hai. Kripya 6-digit OTP enter karein.",
        "email": display_email,
        "canonical_email": canonical_email,
        "requires_otp": True
    }

@router.post("/verify-otp")
async def verify_otp_endpoint(req: VerifyOtpRequest):
    """
    Verify 6-digit OTP:
    Marks account verified permanently in Supabase and memory.
    Issues JWT access token.
    """
    display_email, canonical_email = normalize_email(req.recipient)
    
    # Try verifying by display email, or fallback to canonical email
    ok, msg = verify_stored_otp(display_email, req.otp)
    if not ok:
        ok, msg = verify_stored_otp(canonical_email, req.otp)

    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    # Mark user verified in memory
    user = _USERS_DB.get(canonical_email) or _USERS_DB.get(display_email)
    user_name = user["name"] if user else display_email.split("@")[0]
    if user:
        user["verified"] = True

    # Mark user verified in Supabase PostgreSQL
    await asyncio.to_thread(mark_user_verified, canonical_email)

    # Issue access token
    access_token = create_access_token(subject=canonical_email)

    return {
        "status": "success",
        "message": "Account safaltapoorvak verify aur activate ho gaya hai!",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": display_email,
            "canonical_email": canonical_email,
            "name": user_name
        }
    }

@router.post("/login")
async def login_endpoint(req: LoginRequest):
    """
    Strict Login:
    - Only registered accounts can log in!
    - Rejects unregistered accounts with 404.
    - Rejects unverified accounts with 403 and automatically sends an OTP to activate.
    - Verifies password against PBKDF2-HMAC hash.
    """
    display_email, canonical_email = normalize_email(req.email)
    
    # Check in memory, then Supabase
    user = _USERS_DB.get(canonical_email)
    if not user:
        db_user = await asyncio.to_thread(get_user_by_canonical, canonical_email)
        if db_user:
            user = {
                "name": db_user.get("full_name") or display_email.split("@")[0],
                "email": db_user.get("email"),
                "canonical_email": canonical_email,
                "hashed_password": db_user.get("password_hash"),
                "verified": db_user.get("is_verified", False)
            }
            _USERS_DB[canonical_email] = user

    # 1 & 2. Uniform credential check (prevents account enumeration)
    password_hash = user.get("hashed_password") if user else None
    if not user or not password_hash or not verify_password(req.password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Galat email ya password! Kripya dobara check karein."
        )

    # 3. OTP verification check: If not verified yet, block and send OTP
    if not user.get("verified", False):
        otp = generate_otp()
        await asyncio.to_thread(send_email_otp, display_email, otp, "account verification")
        store_otp(canonical_email, otp)
        store_otp(display_email, otp)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Aapka account verify nahi hua hai! Ek naya 6-digit OTP aapki email par bhej diya gaya hai. Kripya pehle verify karein."
        )

    access_token = create_access_token(subject=canonical_email)

    return {
        "status": "success",
        "message": "Login safal raha!",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "name": user["name"],
            "email": display_email,
            "canonical_email": canonical_email
        }
    }

@router.post("/forgot-password")
async def forgot_password_endpoint(req: ForgotPasswordRequest):
    """
    Dispatch password recovery OTP to registered users only.
    """
    display_email, canonical_email = normalize_email(req.email)
    user = _USERS_DB.get(canonical_email) or await asyncio.to_thread(get_user_by_canonical, canonical_email)
    
    if user:
        otp = generate_otp()
        ok, _msg = await asyncio.to_thread(send_email_otp, display_email, otp, "password reset")
        if ok:
            store_otp(canonical_email, otp)
            store_otp(display_email, otp)

    return {
        "status": "success",
        "message": f"Yadi {display_email} se koi account juda hai, to password reset code bhej diya gaya hai.",
        "email": display_email
    }

@router.post("/reset-password")
async def reset_password_endpoint(req: ResetPasswordRequest):
    """
    Verify OTP and update user password in Supabase and memory.
    """
    display_email, canonical_email = normalize_email(req.email)
    
    ok, msg = verify_stored_otp(display_email, req.otp)
    if not ok:
        ok, msg = verify_stored_otp(canonical_email, req.otp)
        
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    new_hash = get_password_hash(req.new_password)
    
    if canonical_email in _USERS_DB:
        _USERS_DB[canonical_email]["hashed_password"] = new_hash
        
    await asyncio.to_thread(update_user_password, canonical_email, new_hash)

    return {
        "status": "success",
        "message": "Password safaltapoorvak badal diya gaya hai! Kripya naye password ke sath login karein."
    }
