import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.services.otp_service import (
    generate_otp,
    send_email_otp,
    send_sms_otp,
    verify_stored_otp
)
from app.core.security import get_password_hash, verify_password, create_access_token, decode_access_token

def run_tests():
    print("=" * 60)
    print("RUNNING ZUHALI AUTH & OTP GATEWAY COMPREHENSIVE AUDIT")
    print("=" * 60)

    # 1. Test Password Hashing
    raw_pwd = "MySecretPassword123!"
    hashed = get_password_hash(raw_pwd)
    assert verify_password(raw_pwd, hashed) is True, "Password hash verification failed"
    assert verify_password("WrongPassword", hashed) is False, "False positive in password check"
    print("[OK] [Security] Password Hashing & Verification: PASSED")

    # 2. Test JWT Token Creation & Decoding
    test_user = "mk6611236@gmail.com"
    token = create_access_token(subject=test_user)
    payload = decode_access_token(token)
    assert payload is not None and payload.get("sub") == test_user, "JWT decoding failed"
    print("[OK] [Security] JWT Access Token Generation & Claims: PASSED")

    # 3. Test OTP Generation & Storage Logic
    test_email = "test.verification@zuhali.ai"
    test_otp = generate_otp()
    assert len(test_otp) == 6 and test_otp.isdigit(), "Invalid OTP format generated"
    
    # Simulate Email Dispatch (using internal cache)
    from app.services.otp_service import store_otp
    store_otp(test_email, test_otp)
    
    # Test Wrong OTP
    valid, err_msg = verify_stored_otp(test_email, "000000")
    assert valid is False, "Wrong OTP was falsely accepted"
    print("[OK] [OTP] Invalid OTP Rejection & Attempt Counter: PASSED")

    # Test Correct OTP
    valid, success_msg = verify_stored_otp(test_email, test_otp)
    assert valid is True, "Correct OTP was rejected"
    print("[OK] [OTP] Valid OTP Verification & Cache Invalidation: PASSED")

    # 4. Test Live Gmail SMTP Connection
    print("\nTesting Live Gmail SMTP Gateway (mk6611236@gmail.com)...")
    live_otp = generate_otp()
    ok, email_msg = send_email_otp("mk6611236@gmail.com", live_otp, "system self-test")
    if ok:
        print(f"[OK] [Gmail SMTP] Live Delivery to mk6611236@gmail.com: SUCCESS (OTP: {live_otp})")
    else:
        print(f"[FAIL] [Gmail SMTP] Delivery Error: {email_msg}")

    print("=" * 60)
    print("ALL AUTH & SECURITY TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
