import urllib.request
import json
import time
import re
import sys

BASE = 'http://localhost:8000/api/v1/auth'
LOG_FILE = r'C:/Users/MANISH KUMAR/.gemini/antigravity/brain/0cbf395a-9276-48b6-843b-4988d4abfbc9/.system_generated/tasks/task-614.log'

def call(path, data):
    req = urllib.request.Request(
        f'{BASE}{path}',
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode('utf-8')
            try:
                return resp.status, json.loads(body)
            except Exception:
                return resp.status, {'raw': body}
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {'error': body}

def get_latest_otp():
    time.sleep(1.2)
    with open(LOG_FILE, 'r', encoding='utf-8') as f:
        log_content = f.read()
    matches = re.findall(r"Active OTP for 'admin@zuhali\.ai' is: (\d{6})", log_content)
    if matches:
        return matches[-1]
    raise RuntimeError("Could not find OTP in log")

results = []

def record(test_name, condition, expected_status, actual_status, passed, detail):
    status_emoji = "[PASS]" if passed else "[FAIL]"
    print(f"\n{status_emoji} {test_name}")
    print(f"   Condition: {condition}")
    print(f"   Status Code: {actual_status} (Expected: {expected_status})")
    print(f"   Detail: {detail}")
    results.append({
        "name": test_name,
        "condition": condition,
        "expected": expected_status,
        "actual": actual_status,
        "passed": passed,
        "detail": detail
    })

# ========================================================
# 1. LOGIN WITH CORRECT CREDENTIALS
# ========================================================
status, res = call('/login', {'email': 'admin@zuhali.ai', 'password': 'Zuhali@Master2026!'})
passed = (status == 200 and 'access_token' in res)
record("1. Sahi Password Se Login", "Sahi email aur master password enter karna", 200, status, passed, res.get('message') or res.get('detail'))

# ========================================================
# 2. LOGIN WITH WRONG PASSWORD
# ========================================================
status, res = call('/login', {'email': 'admin@zuhali.ai', 'password': 'WrongPassword999!'})
passed = (status == 401)
record("2. Galat Password Se Login", "Galat password daalne par login block hona chahiye", 401, status, passed, res.get('detail'))

# ========================================================
# 3. NEW ACCOUNT CREATE WITH SAME EMAIL (SIGNUP RE-ATTEMPT)
# ========================================================
status, res = call('/signup', {'name': 'Hacker', 'email': 'admin@zuhali.ai', 'password': 'FakePassword123!'})
passed = (status == 409)
record("3. Phir Se Naya Account Banana (Signup Block)", "Pehle se registered email se naya account create nahi hona chahiye", 409, status, passed, res.get('detail'))

# ========================================================
# 4. NEW ACCOUNT CREATE WITH ALIAS TRICK
# ========================================================
status, res = call('/signup', {'name': 'Trickster', 'email': 'admin+test@zuhali.ai', 'password': 'FakePassword123!'})
passed = (status == 409)
record("4. Plus-Alias Trick Se Signup", "admin+test@zuhali.ai se naya account create karne ki koshish block hona chahiye", 409, status, passed, res.get('detail'))

# ========================================================
# 5. FORGOT PASSWORD (OTP REQUEST)
# ========================================================
status, res = call('/forgot-password', {'email': 'admin@zuhali.ai'})
passed = (status == 200)
record("5. Forget Password Request", "Password bhool jaane par 6-digit OTP request karna", 200, status, passed, res.get('message'))
latest_otp = get_latest_otp()

# ========================================================
# 6. OTP VERIFICATION WITH WRONG CODE
# ========================================================
status, res = call('/verify-otp', {'recipient': 'admin@zuhali.ai', 'otp': '000000'})
passed = (status == 400)
record("6. Galat OTP Daal Kar Verify Karna", "Galat OTP '000000' daalne par 400 Bad Request aana chahiye", 400, status, passed, res.get('detail'))

# ========================================================
# 7. OTP VERIFICATION WITH CORRECT CODE
# ========================================================
status, res = call('/verify-otp', {'recipient': 'admin@zuhali.ai', 'otp': latest_otp})
passed = (status == 200 and 'access_token' in res)
record("7. Sahi OTP Se Verification", f"Server se generate hua sahi OTP '{latest_otp}' verify karna", 200, status, passed, res.get('message'))

# ========================================================
# 8. RESET PASSWORD WITH WRONG OTP
# ========================================================
status, res = call('/reset-password', {'email': 'admin@zuhali.ai', 'otp': '999999', 'new_password': 'Zuhali@NewPassword2026!'})
passed = (status == 400)
record("8. Galat OTP Ke Sath Password Reset", "Galat OTP ke sath password change request block hona chahiye", 400, status, passed, res.get('detail'))

# ========================================================
# 9. RESET PASSWORD WITH CORRECT OTP (NEW PASSWORD CREATE)
# ========================================================
# Request a fresh OTP for reset-password
call('/forgot-password', {'email': 'admin@zuhali.ai'})
reset_otp = get_latest_otp()
new_pass = 'Zuhali@NewPassword2026!'
status, res = call('/reset-password', {'email': 'admin@zuhali.ai', 'otp': reset_otp, 'new_password': new_pass})
passed = (status == 200)
record("9. Naya Password Create Karna (Reset Password)", f"Sahi OTP ke sath naya password '{new_pass}' set karna", 200, status, passed, res.get('message'))

# ========================================================
# 10. LOGIN WITH PURANA (OLD) PASSWORD (SHOULD FAIL)
# ========================================================
status, res = call('/login', {'email': 'admin@zuhali.ai', 'password': 'Zuhali@Master2026!'})
passed = (status == 401)
record("10. Purane Password Se Login Ka Prayas", "Naya password set hone ke baad purane password se login fail hona chahiye", 401, status, passed, res.get('detail'))

# ========================================================
# 11. LOGIN WITH NAYA (NEW) PASSWORD (SHOULD SUCCEED)
# ========================================================
status, res = call('/login', {'email': 'admin@zuhali.ai', 'password': new_pass})
passed = (status == 200 and 'access_token' in res)
record("11. Naye Password Se Safal Login", f"Naye password '{new_pass}' ke sath login karna", 200, status, passed, res.get('message'))

# ========================================================
# 12. RESTORE ORIGINAL PASSWORD (Zuhali@Master2026!)
# ========================================================
call('/forgot-password', {'email': 'admin@zuhali.ai'})
restore_otp = get_latest_otp()
status, res = call('/reset-password', {'email': 'admin@zuhali.ai', 'otp': restore_otp, 'new_password': 'Zuhali@Master2026!'})
passed = (status == 200)
record("12. Original Password Restore Karna", "Master Password 'Zuhali@Master2026!' wapas set karna", 200, status, passed, res.get('message'))

# Final verification
status, res = call('/login', {'email': 'admin@zuhali.ai', 'password': 'Zuhali@Master2026!'})
passed = (status == 200)
record("13. Final Verification Login", "Restored master password ke sath login verify", 200, status, passed, "Login Token Verified")

print("\n" + "="*60)
all_passed = all(r['passed'] for r in results)
if all_passed:
    print(f">>> BADHAI HO! SAARE {len(results)} CONDITIONS 100% PASS HUE! <<<")
else:
    print(">>> KUCH CHECKS FAIL HUE HAIN! <<<")
print("="*60)
