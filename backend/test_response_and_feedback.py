import sys
import os
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

print("=================================================================")
print("🧪 TESTING RESPONSE ACTION & FEEDBACK SYSTEM IN SUPABASE")
print("=================================================================")

BASE_URL = "http://localhost:8000/api/v1"

# 1. Test Submitting Like Feedback
like_payload = {
    "message_id": "test_msg_like_1001",
    "feedback_type": "like",
    "reason": "Helpful and accurate",
    "comment": "Zuhali AI explained the concepts clearly!",
    "user_email": "admin@zuhali.ai",
    "prompt": "Explain quantum computing in simple terms",
    "message_text": "Quantum computing uses qubits to perform complex calculations exponentially faster."
}

req = urllib.request.Request(
    f"{BASE_URL}/chat/feedback",
    data=json.dumps(like_payload).encode('utf-8'),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print("✅ 1. Submit Like Feedback Response:", res)
        assert res.get("status") == "success"
        assert res.get("feedback_id") is not None, "feedback_id should be returned"
        like_id = res.get("feedback_id")
except Exception as e:
    print("❌ 1. Failed to submit like feedback:", e)
    sys.exit(1)

# 2. Test Submitting Dislike Feedback
dislike_payload = {
    "message_id": "test_msg_dislike_1002",
    "feedback_type": "dislike",
    "reason": "Too short or incomplete",
    "comment": "Please provide more code examples next time.",
    "user_email": "admin@zuhali.ai",
    "prompt": "Write a full React component with Tailwind",
    "message_text": "Here is a brief outline of the component."
}

req2 = urllib.request.Request(
    f"{BASE_URL}/chat/feedback",
    data=json.dumps(dislike_payload).encode('utf-8'),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req2) as resp2:
        res2 = json.loads(resp2.read().decode('utf-8'))
        print("✅ 2. Submit Dislike Feedback Response:", res2)
        assert res2.get("status") == "success"
        assert res2.get("feedback_id") is not None
except Exception as e:
    print("❌ 2. Failed to submit dislike feedback:", e)
    sys.exit(1)

# 3. Test Fetching Feedbacks via GET /api/v1/chat/feedback
req3 = urllib.request.Request(f"{BASE_URL}/chat/feedback")
try:
    with urllib.request.urlopen(req3) as resp3:
        res3 = json.loads(resp3.read().decode('utf-8'))
        print(f"✅ 3. Fetched Feedbacks from Supabase! Count: {res3.get('count')}")
        feedbacks = res3.get("feedbacks", [])
        assert len(feedbacks) >= 2
        latest = feedbacks[0]
        print(f"   Latest Stored Feedback in Supabase:")
        print(f"   - ID: {latest.get('id')}")
        print(f"   - Type: {latest.get('feedback_type')}")
        print(f"   - Reason: {latest.get('reason')}")
        print(f"   - Comment: {latest.get('comment')}")
        print(f"   - User: {latest.get('user_email')}")
        print(f"   - Prompt: {latest.get('prompt')}")
        print(f"   - Response Text: {latest.get('message_text')}")
        print(f"   - Created At: {latest.get('created_at')}")
except Exception as e:
    print("❌ 3. Failed to list feedbacks:", e)
    sys.exit(1)

print("\n🎉 ALL FEEDBACK STORAGE & RETRIEVAL TESTS PASSED WITH 100% SUCCESS!")
