import hmac
import hashlib
import base64
import json
import time
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Union
from .config import settings

def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def _base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)

# 1. Ultra-Secure Password Hashing (PBKDF2-HMAC-SHA256)
def get_password_hash(password: str) -> str:
    """Generate secure salted PBKDF2 hash."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against salted PBKDF2 hash."""
    try:
        salt, key_hex = hashed_password.split('$')
        new_key = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return hmac.compare_digest(new_key.hex(), key_hex)
    except Exception:
        return False

# 2. Cryptographic JWT Access Token (HMAC-SHA256)
def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    """Create a signed JWT token compliant with RFC 7519."""
    if expires_delta:
        expire = int((datetime.now(timezone.utc) + expires_delta).timestamp())
    else:
        expire = int((datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp())

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": str(subject), "exp": expire, "iat": int(time.time())}

    encoded_header = _base64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    encoded_payload = _base64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))

    signing_input = f"{encoded_header}.{encoded_payload}".encode('utf-8')
    signature = hmac.new(settings.SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    encoded_signature = _base64url_encode(signature)

    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"

def decode_access_token(token: str) -> dict:
    """Validate and decode a signed JWT token."""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None

        encoded_header, encoded_payload, encoded_signature = parts
        signing_input = f"{encoded_header}.{encoded_payload}".encode('utf-8')

        expected_sig = hmac.new(settings.SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        provided_sig = _base64url_decode(encoded_signature)

        if not hmac.compare_digest(expected_sig, provided_sig):
            return None  # Signature mismatch

        payload = json.loads(_base64url_decode(encoded_payload).decode('utf-8'))
        
        # Check expiration
        if payload.get('exp') and time.time() > payload['exp']:
            return None

        return payload
    except Exception:
        return None
