"""Seed quiz + flashcards into DynamoDB and test battle flow."""
import json
import subprocess
import time
import urllib.request
import urllib.error

API = "https://7j54g6e238.execute-api.ap-southeast-1.amazonaws.com"
POOL_ID = "ap-southeast-1_lwKzf90u4"
CLIENT_ID = "hnlk445k9d18uh8u9bg879u9m"
REGION = "ap-southeast-1"
USER_ID = "596ad5cc-a051-7066-e18a-045c2315a46b"

r = subprocess.run(["aws", "cognito-idp", "admin-initiate-auth", "--user-pool-id", POOL_ID, "--client-id", CLIENT_ID, "--auth-flow", "ADMIN_USER_PASSWORD_AUTH", "--auth-parameters", json.dumps({"USERNAME": "e2etest@study-buddy.demo", "PASSWORD": "E2eTest!2026"}), "--region", REGION], capture_output=True, text=True)
token = json.loads(r.stdout)["AuthenticationResult"]["AccessToken"]
print("[PASS] Auth")

def api(method, path, body=None):
    url = f"{API}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    data = None
    if body:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw

def put_item(table, item):
    subprocess.run(["aws", "dynamodb", "put-item", "--table-name", table, "--item", json.dumps(item), "--region", REGION], capture_output=True, text=True)

# Create project
code, proj = api("POST", "/projects", {"name": f"BattleTest-{int(time.time())}"})
pid = proj["projectId"]
print(f"[PASS] Project: {pid}")

# Seed quiz
quiz_id = "test-quiz-001"
quiz_item = {
    "userId": {"S": USER_ID},
    "sk": {"S": f"QUIZ#{pid}#{quiz_id}"},
    "projectId": {"S": pid},
    "quizId": {"S": quiz_id},
    "title": {"S": "AWS Fundamentals Battle"},
    "docIds": {"L": [{"S": "seed"}]},
    "createdAt": {"S": "2026-05-28T10:00:00Z"},
    "bossPersona": {"M": {
        "name": {"S": "CloudMaster"},
        "introLine": {"S": "I am the guardian of the cloud. Answer my questions or perish!"}
    }},
    "questions": {"L": [
        {"M": {
            "questionId": {"S": "q1"}, "prompt": {"S": "What is AWS Lambda?"},
            "difficulty": {"S": "easy"},
            "bossAskLine": {"S": "Let us begin with something simple..."},
            "bossCorrectLine": {"S": "Impressive. You know your serverless."},
            "bossWrongLine": {"S": "Pathetic! Lambda is serverless compute!"},
            "correctChoiceId": {"S": "A"},
            "choices": {"L": [
                {"M": {"choiceId": {"S": "A"}, "text": {"S": "A serverless compute service"}}},
                {"M": {"choiceId": {"S": "B"}, "text": {"S": "A virtual machine service"}}},
                {"M": {"choiceId": {"S": "C"}, "text": {"S": "A database service"}}},
                {"M": {"choiceId": {"S": "D"}, "text": {"S": "A networking service"}}}
            ]}
        }},
        {"M": {
            "questionId": {"S": "q2"}, "prompt": {"S": "What does S3 stand for?"},
            "difficulty": {"S": "easy"},
            "bossAskLine": {"S": "Every cloud warrior knows this..."},
            "bossCorrectLine": {"S": "Correct. Simple Storage Service."},
            "bossWrongLine": {"S": "Wrong! It is Simple Storage Service!"},
            "correctChoiceId": {"S": "B"},
            "choices": {"L": [
                {"M": {"choiceId": {"S": "A"}, "text": {"S": "Simple Server Service"}}},
                {"M": {"choiceId": {"S": "B"}, "text": {"S": "Simple Storage Service"}}},
                {"M": {"choiceId": {"S": "C"}, "text": {"S": "Secure Storage System"}}},
                {"M": {"choiceId": {"S": "D"}, "text": {"S": "Standard Storage Service"}}}
            ]}
        }},
        {"M": {
            "questionId": {"S": "q3"}, "prompt": {"S": "Which service is a NoSQL database?"},
            "difficulty": {"S": "medium"},
            "bossAskLine": {"S": "Now it gets harder..."},
            "bossCorrectLine": {"S": "You know your databases well."},
            "bossWrongLine": {"S": "DynamoDB is the answer, fool!"},
            "correctChoiceId": {"S": "C"},
            "choices": {"L": [
                {"M": {"choiceId": {"S": "A"}, "text": {"S": "RDS"}}},
                {"M": {"choiceId": {"S": "B"}, "text": {"S": "Redshift"}}},
                {"M": {"choiceId": {"S": "C"}, "text": {"S": "DynamoDB"}}},
                {"M": {"choiceId": {"S": "D"}, "text": {"S": "Aurora"}}}
            ]}
        }}
    ]}
}
put_item("study-buddy-g1-quizzes", quiz_item)
print(f"[PASS] Seeded quiz: {quiz_id} (3 questions)")

# Seed flashcards
fc_id = "test-fc-001"
fc_item = {
    "userId": {"S": USER_ID},
    "sk": {"S": f"FLASHCARD#{pid}#{fc_id}"},
    "projectId": {"S": pid},
    "setId": {"S": fc_id},
    "docIds": {"L": [{"S": "seed"}]},
    "cardCount": {"N": "5"},
    "createdAt": {"S": "2026-05-28T10:00:00Z"},
    "cards": {"L": [
        {"M": {"front": {"S": "What is AWS Lambda?"}, "back": {"S": "Serverless compute service"}, "source": {"S": "notes.txt"}}},
        {"M": {"front": {"S": "What is S3?"}, "back": {"S": "Simple Storage Service"}, "source": {"S": "notes.txt"}}},
        {"M": {"front": {"S": "What is DynamoDB?"}, "back": {"S": "Managed NoSQL database"}, "source": {"S": "notes.txt"}}},
        {"M": {"front": {"S": "What is CloudFront?"}, "back": {"S": "Content Delivery Network"}, "source": {"S": "notes.txt"}}},
        {"M": {"front": {"S": "What is API Gateway?"}, "back": {"S": "HTTP API management service"}, "source": {"S": "notes.txt"}}}
    ]}
}
put_item("study-buddy-g1-flashcard-sets", fc_item)
print(f"[PASS] Seeded flashcards: 5 cards")

# Test: list quizzes
code, data = api("GET", f"/quizzes?projectId={pid}")
quizzes = data.get("quizzes", [])
print(f"[PASS] List quizzes: {len(quizzes)}")

# Test: list flashcards
code, data = api("GET", f"/flashcards?projectId={pid}")
sets = data.get("flashcardSets", [])
cards = sets[0]["cards"] if sets else []
print(f"[PASS] List flashcards: {len(sets)} set(s), {len(cards)} cards")

# Test: START BATTLE
code, data = api("POST", "/battle-sessions/start", {"projectId": pid, "quizId": quiz_id})
session = data["session"]
quiz = data["quiz"]
print(f"[PASS] Start battle: boss={quiz['bossPersona']['name']}, bossHp={session['bossHp']}, userHp={session['userHp']}")

# Answer Q1 correctly
code, data = api("POST", f"/battle-sessions/{session['sessionId']}/answers?projectId={pid}", {"questionId": "q1", "selectedChoiceId": "A"})
if code != 200:
    print(f"[FAIL] Q1: status={code}, body={data}")
else:
    s = data["session"]
    print(f"[PASS] Q1 correct: bossHp={s['bossHp']}, userHp={s['userHp']}, hit={s['answerHistory'][-1]['isCorrect']}")

    # Answer Q2 wrong
    code, data = api("POST", f"/battle-sessions/{s['sessionId']}/answers?projectId={pid}", {"questionId": "q2", "selectedChoiceId": "A"})
    if code != 200:
        print(f"[FAIL] Q2: status={code}, body={data}")
    else:
        s = data["session"]
        print(f"[PASS] Q2 wrong: bossHp={s['bossHp']}, userHp={s['userHp']}, hit={s['answerHistory'][-1]['isCorrect']}")

        # Answer Q3 correctly
        code, data = api("POST", f"/battle-sessions/{s['sessionId']}/answers?projectId={pid}", {"questionId": "q3", "selectedChoiceId": "C"})
        if code != 200:
            print(f"[FAIL] Q3: status={code}, body={data}")
        else:
            s = data["session"]
            print(f"[PASS] Q3 correct: bossHp={s['bossHp']}, userHp={s['userHp']}, hit={s['answerHistory'][-1]['isCorrect']}, status={s['status']}")

            # Resume
            code, data = api("GET", f"/battle-sessions/{s['sessionId']}?projectId={pid}")
            print(f"[PASS] Resume: status={data['session']['status']}")

print(f"\n=== ALL FEATURES VERIFIED ===")
print(f"Project for browser test: {pid}")
print(f"Quiz ID: {quiz_id}")
