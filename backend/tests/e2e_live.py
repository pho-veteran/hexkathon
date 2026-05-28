"""E2E test against live AWS deployment."""
import json
import hmac
import hashlib
import base64
import time
import urllib.request
import urllib.error

API = "https://7j54g6e238.execute-api.ap-southeast-1.amazonaws.com"
POOL_ID = "ap-southeast-1_lwKzf90u4"
CLIENT_ID = "hnlk445k9d18uh8u9bg879u9m"
EMAIL = "e2etest@study-buddy.demo"
PASSWORD = "E2eTest!2026"
REGION = "ap-southeast-1"

# --- Auth via Cognito InitiateAuth (SRP is complex, use admin auth via API) ---
# We'll use the admin-initiated auth to get tokens since SRP requires crypto libs
# Instead, let's use USER_PASSWORD_AUTH... but that's not enabled.
# Fallback: use AWS CLI to get tokens

import subprocess

def get_token():
    """Get access token via AWS CLI admin-initiate-auth."""
    result = subprocess.run([
        "aws", "cognito-idp", "admin-initiate-auth",
        "--user-pool-id", POOL_ID,
        "--client-id", CLIENT_ID,
        "--auth-flow", "ADMIN_USER_PASSWORD_AUTH",
        "--auth-parameters", json.dumps({"USERNAME": EMAIL, "PASSWORD": PASSWORD}),
        "--region", REGION,
    ], capture_output=True, text=True)
    if result.returncode != 0:
        # Try ADMIN_NO_SRP_AUTH
        result = subprocess.run([
            "aws", "cognito-idp", "admin-initiate-auth",
            "--user-pool-id", POOL_ID,
            "--client-id", CLIENT_ID,
            "--auth-flow", "ADMIN_NO_SRP_AUTH",
            "--auth-parameters", json.dumps({"USERNAME": EMAIL, "PASSWORD": PASSWORD}),
            "--region", REGION,
        ], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Auth failed: {result.stderr}")
        return None
    data = json.loads(result.stdout)
    return data["AuthenticationResult"]["AccessToken"]


def api(method, path, body=None, token=None):
    url = f"{API}{path}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
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
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        body_text = e.read().decode() if e.fp else ""
        try:
            return e.code, json.loads(body_text)
        except (json.JSONDecodeError, ValueError):
            return e.code, body_text


def test_all():
    results = []

    def check(name, passed, detail=""):
        status = "PASS" if passed else "FAIL"
        results.append((status, name, detail))
        print(f"  [{status}] {name} {detail}")

    print("\n=== E2E Test Suite ===\n")

    # 1. Health check (no auth)
    print("[1] Health Check")
    code, data = api("GET", "/health")
    check("GET /health", code == 200 and data.get("status") == "ok", f"status={code}")

    # 2. Auth
    print("\n[2] Authentication")
    token = get_token()
    check("Get access token", token is not None, "via admin-initiate-auth")
    if not token:
        print("\n  WARNING: Cannot continue without auth token.")
        return results

    # 3. Projects
    print("\n[3] Project CRUD")
    import time as _t
    proj_name = f"E2E-{int(_t.time())}"
    code, data = api("POST", "/projects", {"name": proj_name}, token)
    check("POST /projects", code == 200 and isinstance(data, dict) and "projectId" in data, f"status={code}")
    project_id = data.get("projectId", "") if isinstance(data, dict) else ""

    code, data = api("GET", "/projects", token=token)
    check("GET /projects", code == 200 and len(data.get("projects", [])) > 0, f"count={len(data.get('projects', []))}")

    # 4. Documents
    print("\n[4] Document Upload")
    # Multipart upload via urllib
    boundary = "----E2ETestBoundary"
    file_content = b"This is a test document about AWS Lambda and S3 storage services."
    body_parts = [
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"test.txt\"\r\nContent-Type: text/plain\r\n\r\n".encode() + file_content + b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ]
    multipart_body = b"".join(body_parts)
    req = urllib.request.Request(
        f"{API}/documents/upload?projectId={project_id}",
        data=multipart_body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            upload_code = resp.status
            upload_data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        upload_code = e.code
        upload_data = e.read().decode()
    check("POST /documents/upload", upload_code == 200 and isinstance(upload_data, dict), f"status={upload_code}")
    doc_id = upload_data.get("docId", "") if isinstance(upload_data, dict) else ""

    code, data = api("GET", f"/documents?projectId={project_id}", token=token)
    doc_count = len(data.get("documents", [])) if isinstance(data, dict) else 0
    check("GET /documents", code == 200 and doc_count > 0, f"count={doc_count}")

    # 5. Chat
    print("\n[5] Chat")
    code, data = api("POST", "/chat/threads", {"projectId": project_id, "title": "E2E Chat"}, token)
    check("POST /chat/threads", code == 200 and "threadId" in data, f"status={code}")
    thread_id = data.get("threadId", "")

    code, data = api("GET", f"/chat/threads?projectId={project_id}", token=token)
    check("GET /chat/threads", code == 200 and len(data.get("threads", [])) > 0)

    code, data = api("POST", f"/chat/threads/{thread_id}/messages", {
        "projectId": project_id,
        "question": "What is AWS Lambda?",
        "docIds": [doc_id] if doc_id else [],
    }, token)
    check("POST /chat/threads/:id/messages", code == 200 and "content" in data, f"status={code}")

    code, data = api("GET", f"/chat/threads/{thread_id}/messages?projectId={project_id}", token=token)
    check("GET /chat/threads/:id/messages", code == 200 and len(data.get("messages", [])) >= 2, f"count={len(data.get('messages', []))}")

    # 6. Flashcards
    print("\n[6] Flashcards")
    code, data = api("POST", "/flashcards/generate", {
        "projectId": project_id,
        "docIds": [doc_id] if doc_id else [],
        "cardCount": 5,
    }, token)
    flash_ok = code == 200 and isinstance(data, dict) and "cards" in data
    check("POST /flashcards/generate", flash_ok, f"status={code}" + (" (throttled)" if code == 500 else ""))

    code, data = api("GET", f"/flashcards?projectId={project_id}", token=token)
    flash_count = len(data.get("flashcardSets", [])) if isinstance(data, dict) else 0
    check("GET /flashcards", code == 200, f"count={flash_count}")

    # 7. Quiz
    print("\n[7] Quiz Generation")
    code, data = api("POST", "/quizzes/generate", {
        "projectId": project_id,
        "docIds": [doc_id] if doc_id else [],
    }, token)
    quiz_ok = code == 200 and isinstance(data, dict) and "questions" in data
    check("POST /quizzes/generate", quiz_ok, f"status={code}" + (" (throttled)" if code == 500 else ""))
    quiz_id = data.get("quizId", "") if isinstance(data, dict) else ""

    code, data = api("GET", f"/quizzes?projectId={project_id}", token=token)
    quiz_count = len(data.get("quizzes", [])) if isinstance(data, dict) else 0
    check("GET /quizzes", code == 200, f"count={quiz_count}")

    # 8. Battle
    print("\n[8] Battle")
    if quiz_id:
        code, data = api("POST", "/battle-sessions/start", {"projectId": project_id, "quizId": quiz_id}, token)
        check("POST /battle-sessions/start", code == 200 and "session" in data, f"status={code}")
        session_id = data.get("session", {}).get("sessionId", "")
        quiz_data = data.get("quiz", {})

        if session_id and quiz_data.get("questions"):
            q = quiz_data["questions"][0]
            code, data = api("POST", f"/battle-sessions/{session_id}/answers?projectId={project_id}", {
                "questionId": q["questionId"],
                "selectedChoiceId": q["choices"][0]["choiceId"],
            }, token)
            check("POST /battle-sessions/:id/answers", code == 200 and "session" in data, f"status={code}")

            code, data = api("GET", f"/battle-sessions/{session_id}?projectId={project_id}", token=token)
            check("GET /battle-sessions/:id", code == 200 and "session" in data, f"status={code}")
    else:
        check("Battle (skipped)", False, "no quiz_id")

    # 9. CORS check
    print("\n[9] CORS")
    req = urllib.request.Request(f"{API}/health", method="OPTIONS", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    try:
        with urllib.request.urlopen(req) as resp:
            cors_headers = dict(resp.headers)
            has_cors = "access-control-allow-origin" in {k.lower() for k in cors_headers}
            check("OPTIONS /health CORS", has_cors, f"headers present={has_cors}")
    except urllib.error.HTTPError as e:
        check("OPTIONS /health CORS", e.code == 204 or e.code == 200, f"status={e.code}")

    # 10. Cleanup
    print("\n[10] Cleanup")
    code, data = api("DELETE", f"/projects/{project_id}", token=token)
    check("DELETE /projects/:id (cascade)", code == 200 and data.get("deleted"), f"status={code}")

    # Summary
    passed = sum(1 for r in results if r[0] == "PASS")
    failed = sum(1 for r in results if r[0] == "FAIL")
    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed, {len(results)} total")
    print(f"{'='*40}\n")
    return results


if __name__ == "__main__":
    test_all()
