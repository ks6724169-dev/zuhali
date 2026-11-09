import urllib.request
import json
import sys

BASE = 'http://localhost:8000/api/v1/auth'

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
            except:
                return resp.status, {'raw': body}
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, {'error': body}

print('=== TEST 1: Unregistered account login (Should Fail 404) ===')
status, res = call('/login', {'email': 'never_registered_user_99@gmail.com', 'password': 'Password123!'})
print(f'Status: {status}, Detail: {res.get("detail")}')
assert status == 404, f'Expected 404, got {status}'

print('\n=== TEST 2: First-time signup with mktest.zuhali@gmail.com ===')
status, res = call('/signup', {'name': 'Manish Test', 'email': 'mktest.zuhali@gmail.com', 'password': 'SecretPassword123!'})
print(f'Status: {status}, Message: {res.get("message")}')
assert status == 200, f'Expected 200, got {status}'

print('\n=== TEST 3: Login before OTP verification (Should Fail 403) ===')
status, res = call('/login', {'email': 'mktest.zuhali@gmail.com', 'password': 'SecretPassword123!'})
print(f'Status: {status}, Detail: {res.get("detail")}')
assert status == 403, f'Expected 403, got {status}'

print('\n=== TEST 4: Verify OTP for mktest.zuhali@gmail.com ===')
import re, time
time.sleep(1.5)
with open(r'C:/Users/MANISH KUMAR/.gemini/antigravity/brain/0cbf395a-9276-48b6-843b-4988d4abfbc9/.system_generated/tasks/task-614.log', 'r', encoding='utf-8') as f:
    log_content = f.read()
matches = re.findall(r"Active OTP for 'mktest\.zuhali@gmail\.com' is: (\d{6})", log_content)
otp = matches[-1]
print(f'OTP retrieved from live server log: {otp}')
status, res = call('/verify-otp', {'recipient': 'mktest.zuhali@gmail.com', 'otp': otp})
print(f'Status: {status}, Response: {res}')
assert status == 200, f'Expected 200, got {status}'

print('\n=== TEST 5: Re-register with exact same email (Should Fail 409) ===')
status, res = call('/signup', {'name': 'Hacker', 'email': 'mktest.zuhali@gmail.com', 'password': 'AnotherPassword!'})
print(f'Status: {status}, Detail: {res.get("detail")}')
assert status == 409, f'Expected 409, got {status}'

print('\n=== TEST 6: Anti-Abuse Trick: Dot Trick m.k.t.e.s.t.z.u.h.a.l.i@gmail.com (Should Fail 409) ===')
status, res = call('/signup', {'name': 'Trick Dot', 'email': 'm.k.t.e.s.t.z.u.h.a.l.i@gmail.com', 'password': 'AnotherPassword!'})
print(f'Status: {status}, Detail: {res.get("detail")}')
assert status == 409, f'Expected 409, got {status}'

print('\n=== TEST 7: Anti-Abuse Trick: Plus Trick mktest.zuhali+trick@gmail.com (Should Fail 409) ===')
status, res = call('/signup', {'name': 'Trick Plus', 'email': 'mktest.zuhali+trick@gmail.com', 'password': 'AnotherPassword!'})
print(f'Status: {status}, Detail: {res.get("detail")}')
assert status == 409, f'Expected 409, got {status}'

print('\n=== TEST 8: Anti-Abuse Trick: Domain Trick mktestzuhali@googlemail.com (Should Fail 409) ===')
status, res = call('/signup', {'name': 'Trick Domain', 'email': 'mktestzuhali@googlemail.com', 'password': 'AnotherPassword!'})
print(f'Status: {status}, Detail: {res.get("detail")}')
assert status == 409, f'Expected 409, got {status}'

print('\n=== TEST 9: Normal Login with registered verified account ===')
status, res = call('/login', {'email': 'mktest.zuhali@gmail.com', 'password': 'SecretPassword123!'})
print(f'Status: {status}, Message: {res.get("message")}, Token: {res.get("access_token")[:20]}...')
assert status == 200, f'Expected 200, got {status}'

print('\n=== TEST 10: Direct verification in live Supabase Database ===')
from app.db.supabase import get_db_connection
conn = get_db_connection()
cur = conn.cursor()
cur.execute('SELECT email, canonical_email, full_name, is_verified FROM public.profiles WHERE canonical_email = %s;', ('mktestzuhali@gmail.com',))
row = cur.fetchone()
print(f'Supabase DB Row: {row}')
assert row is not None and row[3] is True, 'Account not verified in Supabase!'
cur.close()
conn.close()

print('\n>>> ALL 10 SECURITY CHECKS PASSED WITH 100% SUCCESS! <<<')
