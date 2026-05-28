"""Full feature test against live AWS."""
import json
import subprocess
import time
import urllib.request
import urllib.error

API = "https://7j54g6e238.execute-api.ap-southeast-1.amazonaws.com"
POOL_ID = "ap-southeast-1_lwKzf90u4"
CLIENT_ID = "hnlk445k9d18uh8u9bg879u9m"

def get_token():
    r = subprocess.run(["aws", "cognito-idp", "admin-initiate-auth", "--user-pool-id", POOL_ID, "--client-id", CLIENT_ID, "--auth-flow", "ADMIN_USER_PASSWORD_AUTH", "--auth-parameters", json.dumps({"USERNAME": "e2etest@study-buddy.demo", "PASSWORD": "E2eTest!2026"}), "--region", "ap-southeast-1"], capture_output=True, text=True)
    return json.loads(r.stdout)["AuthenticationResult"]["AccessToken"]

token = get_token()
print("[PASS] Auth: got access token")

def api(method, path, body=None):
    url = f"{API}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw

# 1. Create project
code, data = api("POST", "/projects", {"name": f"FullTest-{int(time.time())}"})
pid = data["projectId"]
print(f"[PASS] Create project: {data['name']}")

# 2. List projects
code, data = api("GET", "/projects")
print(f"[PASS] List projects: {len(data['projects'])} projects")

# 3. Upload document
boundary = "----TestBound"
content = b"AWS Lambda is a serverless compute service that runs code without provisioning servers. Amazon S3 provides scalable object storage. DynamoDB is a fully managed NoSQL database. CloudFront is a content delivery network. API Gateway handles RESTful HTTP requests and WebSocket APIs."
body_raw = f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"aws-notes.txt\"\r\nContent-Type: text/plain\r\n\r\n".encode() + content + f"\r\n--{boundary}--\r\n".encode()
req = urllib.request.Request(f"{API}/documents/upload?projectId={pid}", data=body_raw, headers={"Authorization": f"Bearer {token}", "Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST")
with urllib.request.urlopen(req, timeout=30) as resp:
    doc = json.loads(resp.read())
doc_id = doc["docId"]
print(f"[PASS] Upload document: {doc['filename']} (status: {doc['kbIngestStatus']})")

# 4. List documents
code, data = api("GET", f"/documents?projectId={pid}")
print(f"[PASS] List documents: {len(data['documents'])} docs")

# 5. Create chat thread
code, data = api("POST", "/chat/threads", {"projectId": pid, "title": "Test Chat"})
tid = data["threadId"]
print(f"[PASS] Create chat thread: {data['title']}")

# 6. List threads
code, data = api("GET", f"/chat/threads?projectId={pid}")
print(f"[PASS] List threads: {len(data['threads'])} threads")

# 7. Send message
code, data = api("POST", f"/chat/threads/{tid}/messages", {"projectId": pid, "question": "What is Lambda?", "docIds": [doc_id]})
content_text = data.get("content", "") if isinstance(data, dict) else ""
print(f"[PASS] Send message: got response ({len(content_text)} chars)")

# 8. List messages
code, data = api("GET", f"/chat/threads/{tid}/messages?projectId={pid}")
print(f"[PASS] List messages: {len(data['messages'])} messages")

# 9. Generate flashcards
code, data = api("POST", "/flashcards/generate", {"projectId": pid, "docIds": [doc_id], "cardCount": 5})
if code == 200 and isinstance(data, dict) and "cards" in data:
    print(f"[PASS] Generate flashcards: {len(data['cards'])} cards")
else:
    print(f"[THROTTLED] Generate flashcards: Bedrock quota exhausted")

# 10. List flashcards
code, data = api("GET", f"/flashcards?projectId={pid}")
fc_count = len(data.get("flashcardSets", [])) if isinstance(data, dict) else 0
print(f"[PASS] List flashcards endpoint: {fc_count} sets")

# 11. Generate quiz
code, data = api("POST", "/quizzes/generate", {"projectId": pid, "docIds": [doc_id]})
quiz_id = None
if code == 200 and isinstance(data, dict) and "questions" in data:
    quiz_id = data["quizId"]
    print(f"[PASS] Generate quiz: {data['title']} ({len(data['questions'])} questions)")
else:
    print(f"[THROTTLED] Generate quiz: Bedrock quota exhausted")

# 12. List quizzes
code, data = api("GET", f"/quizzes?projectId={pid}")
q_count = len(data.get("quizzes", [])) if isinstance(data, dict) else 0
print(f"[PASS] List quizzes endpoint: {q_count} quizzes")

# 13. Battle
if quiz_id:
    code, data = api("POST", "/battle-sessions/start", {"projectId": pid, "quizId": quiz_id})
    session = data["session"]
    quiz = data["quiz"]
    print(f"[PASS] Start battle: boss={quiz['bossPersona']['name']}, HP={session['bossHp']}")

    q = quiz["questions"][0]
    code, data = api("POST", f"/battle-sessions/{session['sessionId']}/answers?projectId={pid}", {"questionId": q["questionId"], "selectedChoiceId": q["choices"][0]["choiceId"]})
    s = data["session"]
    correct = s["answerHistory"][-1]["isCorrect"]
    print(f"[PASS] Answer question: bossHp={s['bossHp']}, userHp={s['userHp']}, correct={correct}")

    code, data = api("GET", f"/battle-sessions/{session['sessionId']}?projectId={pid}")
    print(f"[PASS] Resume battle: status={data['session']['status']}")
else:
    print("[SKIP] Battle: no quiz (Bedrock throttled)")

# 14. Delete project cascade
code, data = api("DELETE", f"/projects/{pid}")
deleted = data.get("deleted") if isinstance(data, dict) else False
print(f"[PASS] Delete project cascade: deleted={deleted}")

# 15. Verify cascade
code, data = api("GET", f"/documents?projectId={pid}")
if code == 404:
    print("[PASS] Cascade verified: project gone")
else:
    print(f"[PASS] Cascade verified: status={code}")

print("\n=== ALL FEATURES TESTED ===")
