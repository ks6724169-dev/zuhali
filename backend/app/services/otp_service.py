import smtplib
import ssl
import json
import secrets
import time
import urllib.request
import urllib.parse
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

# In-memory OTP storage: { identifier: { "otp": "123456", "expires_at": float, "attempts": 0 } }
_OTP_CACHE = {}
OTP_EXPIRY_SECONDS = 600  # 10 minutes
MAX_ATTEMPTS = 5

def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP."""
    return f"{secrets.randbelow(900000) + 100000}"

def store_otp(identifier: str, otp: str):
    """Store generated OTP with expiry timestamp."""
    key = identifier.lower().strip()
    _OTP_CACHE[key] = {
        "otp": otp,
        "expires_at": time.time() + OTP_EXPIRY_SECONDS,
        "attempts": 0
    }
    print(f"[OTP SECURITY AUDIT] Active OTP for '{key}' is: {otp} (Expires in 10m)")

def verify_stored_otp(identifier: str, entered_otp: str) -> tuple[bool, str]:
    """Verify OTP and manage rate-limiting and expiry."""
    key = identifier.lower().strip()
    record = _OTP_CACHE.get(key)
    
    if not record:
        return False, "OTP not found or expired. Please request a new one."
    
    if time.time() > record["expires_at"]:
        _OTP_CACHE.pop(key, None)
        return False, "OTP has expired. Please request a new code."
    
    if record["attempts"] >= MAX_ATTEMPTS:
        _OTP_CACHE.pop(key, None)
        return False, "Too many failed attempts. Please request a new code."
    
    if record["otp"] == entered_otp.strip():
        _OTP_CACHE.pop(key, None)  # Consume OTP
        print(f"[OTP SUCCESS] Verified OTP for '{key}'")
        return True, "Verification successful."
    
    record["attempts"] += 1
    remaining = MAX_ATTEMPTS - record["attempts"]
    return False, f"Invalid OTP code. {remaining} attempt(s) remaining."

def send_email_otp(recipient_email: str, otp: str, purpose: str = "verification") -> tuple[bool, str]:
    """
    Send OTP via Gmail SMTP over SSL (Port 465).
    """
    sender = settings.SMTP_USER
    password = settings.SMTP_PASSWORD
    from_name = settings.SMTP_FROM_NAME or "Rhynia Intelligence"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{otp} is your {from_name} verification code"
    msg["From"] = f"{from_name} <{sender}>"
    msg["To"] = recipient_email

    # Plain text version
    text_content = f"""Hello,

Your verification code for {from_name} is: {otp}

This code will expire in 10 minutes. If you did not request this code, please ignore this email.

Best regards,
The {from_name} Team
"""

    # Rich HTML version
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; }}
    .container {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 36px 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; }}
    .logo {{ font-size: 24px; font-weight: 800; color: #16a34a; letter-spacing: -0.5px; margin-bottom: 20px; }}
    .title {{ font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px; }}
    .desc {{ font-size: 15px; color: #4b5563; line-height: 1.5; margin: 0 0 24px; }}
    .otp-card {{ background: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }}
    .otp-code {{ font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #15803d; font-family: 'Courier New', Courier, monospace; }}
    .note {{ font-size: 13px; color: #6b7280; line-height: 1.5; margin-top: 20px; }}
    .footer {{ font-size: 12px; color: #9ca3af; text-align: center; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🌿 {from_name}</div>
    <div class="title">Verification Code</div>
    <div class="desc">Please use the following 6-digit one-time passcode (OTP) to complete your {purpose}.</div>
    <div class="otp-card">
      <div class="otp-code">{otp}</div>
    </div>
    <div class="note">⚠️ This code will expire in <strong>10 minutes</strong>. For your security, never share this OTP with anyone.</div>
    <div class="footer">© 2026 {from_name}. All rights reserved. Secure Automated Gateway.</div>
  </div>
</body>
</html>
"""

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=12) as server:
            server.login(sender, password)
            server.sendmail(sender, recipient_email, msg.as_string())
        
        store_otp(recipient_email, otp)
        print(f"[SMTP DISPATCH] Successfully emailed OTP {otp} to {recipient_email}")
        return True, "Email OTP sent successfully."
    except Exception as e:
        print(f"[SMTP ERROR] Failed to email {recipient_email}: {str(e)}")
        # Even if SMTP has network issue, store OTP so user can still see it in server log
        store_otp(recipient_email, otp)
        return False, f"SMTP Error: {str(e)}"

def send_sms_otp(phone_number: str, otp: str) -> tuple[bool, str]:
    """
    Send OTP via Fast2SMS Bulk V2 API.
    """
    api_key = settings.FAST2SMS_API_KEY
    if not api_key:
        return False, "Fast2SMS API key not configured."

    clean_phone = "".join(filter(str.isdigit, phone_number))
    if clean_phone.startswith("91") and len(clean_phone) == 12:
        clean_phone = clean_phone[2:]
    
    if len(clean_phone) != 10:
        return False, "Please provide a valid 10-digit mobile number."

    url = "https://www.fast2sms.com/dev/bulkV2"
    payload = {
        "variables_values": otp,
        "route": "otp",
        "numbers": clean_phone
    }
    
    headers = {
        "authorization": api_key,
        "Content-Type": "application/json"
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=12) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            if res_body.get("return") is True:
                store_otp(clean_phone, otp)
                print(f"[SMS DISPATCH] Successfully sent SMS OTP {otp} to {clean_phone}")
                return True, "SMS OTP sent successfully."
            else:
                return False, res_body.get("message", ["SMS sending failed"])[0]
    except Exception as e:
        print(f"[SMS ERROR] Failed to send SMS to {clean_phone}: {str(e)}")
        return False, f"Fast2SMS Error: {str(e)}"
