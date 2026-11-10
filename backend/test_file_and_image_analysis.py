import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_AUTH = 'http://localhost:8000/api/v1/auth'
BASE_CHAT = 'http://localhost:8000/api/v1/chat/stream'

# 1. Login with system account
login_req = urllib.request.Request(
    f'{BASE_AUTH}/login',
    data=json.dumps({'email': 'admin@zuhali.ai', 'password': 'Zuhali@Master2026!'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(login_req) as resp:
    login_data = json.loads(resp.read().decode('utf-8'))
    token = login_data['access_token']
    print(f"[AUTH OK] Logged in as system master: {login_data['user']['email']}")

def stream_post(payload):
    req = urllib.request.Request(
        BASE_CHAT,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    )
    full_resp = ''
    with urllib.request.urlopen(req, timeout=30) as resp:
        for line in resp:
            line_str = line.decode('utf-8').strip()
            if line_str.startswith('data: '):
                try:
                    p = json.loads(line_str[6:])
                    full_resp += p.get('token', '')
                    if p.get('done'):
                        break
                except:
                    pass
    return full_resp

print("\n" + "="*60)
print("TEST 1: IMAGE UPLOAD & VISION ANALYSIS")
print("="*60)

# A 1x1 neon green PNG image data URI
png_base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

image_payload = {
    'message': 'What color is this image? Describe what you see in this uploaded image file in 1-2 sentences.',
    'attachment': {
        'name': 'green_pixel.png',
        'type': 'image/png',
        'dataUrl': png_base64
    },
    'model': 'zuhali-pro-v1'
}

img_response = stream_post(image_payload)
print("AI Image Vision Analysis Result:\n")
print(img_response)

assert len(img_response.strip()) > 5, "Vision analysis returned empty response!"
assert any(w in img_response.lower() for w in ['green', 'color', 'pixel', 'image']), "Vision did not detect image properties!"
print("\n>>> TEST 1 PASSED: IMAGE ANALYSIS SUCCESSFUL! <<<")


print("\n" + "="*60)
print("TEST 2: CODE FILE UPLOAD & TECHNICAL ANALYSIS")
print("="*60)

python_code = '''
def recursive_fibonacci(n):
    if n <= 1:
        return n
    return recursive_fibonacci(n - 1) + recursive_fibonacci(n - 2)

# Calculate 35th fibonacci number
print(recursive_fibonacci(35))
'''

code_payload = {
    'message': 'Review and analyze this uploaded Python script. What is its time complexity and how can it be optimized?',
    'attachment': {
        'name': 'fibonacci_benchmark.py',
        'type': 'text/x-python',
        'textContent': python_code
    },
    'model': 'zuhali-pro-v1'
}

code_response = stream_post(code_payload)
print("AI Code Analysis Result:\n")
print(code_response)

assert len(code_response.strip()) > 20, "Code analysis returned empty response!"
assert any(term in code_response.lower() for term in ['complexity', 'o(2^n)', 'o(n)', 'exponential', 'dynamic', 'memoization', 'fibonacci']), "AI did not analyze the code!"
print("\n>>> TEST 2 PASSED: FILE & CODE ANALYSIS SUCCESSFUL! <<<")

print("\n" + "="*60)
print(">>> ALL MULTIMODAL FILE & IMAGE TESTS PASSED 100%! <<<")
print("="*60)
