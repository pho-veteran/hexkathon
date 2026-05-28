from __future__ import annotations

import io
import json
import re
from datetime import datetime, timezone
from uuid import uuid4

from pypdf import PdfReader

from src.adapters.userstore import build_document_item



def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()



def extract_text(filename: str, data: bytes) -> str:
    lower_name = filename.lower()
    if lower_name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    return data.decode("utf-8", errors="replace")



def build_kb_metadata_sidecar(user_id: str, project_id: str, doc_id: str, filename: str, locator: str) -> dict:
    return {
        "metadataAttributes": [
            {"key": "user_id", "value": {"type": "STRING", "stringValue": user_id}},
            {"key": "project_id", "value": {"type": "STRING", "stringValue": project_id}},
            {"key": "doc_id", "value": {"type": "STRING", "stringValue": doc_id}},
            {"key": "filename", "value": {"type": "STRING", "stringValue": filename}},
            {"key": "locator", "value": {"type": "STRING", "stringValue": locator}},
        ]
    }



def build_sidecar_key(s3_key: str) -> str:
    return f"{s3_key}.metadata.json"



def normalize_citation(citation_id: str, raw: dict) -> dict:
    metadata = raw.get("metadata", {})
    return {
        "citationId": citation_id,
        "docId": raw.get("doc_id", ""),
        "filename": metadata.get("filename", ""),
        "locator": metadata.get("locator", ""),
        "excerpt": raw.get("text", ""),
        "score": raw.get("score", 0.0),
    }



def build_document_upload_result(
    user_id: str,
    project_id: str,
    filename: str,
    content_type: str,
    storage,
    documents_store,
    data: bytes,
) -> dict:
    doc_id = str(uuid4())
    s3_key = f"users/{user_id}/docs/{doc_id}/original/{filename}"
    storage.put(s3_key, data, content_type)
    sidecar = build_kb_metadata_sidecar(user_id, project_id, doc_id, filename, "document")
    storage.put_json(build_sidecar_key(s3_key), sidecar)
    item = build_document_item(
        user_id=user_id,
        project_id=project_id,
        doc_id=doc_id,
        filename=filename,
        s3_key=s3_key,
        content_type=content_type,
        kb_ingest_status="processing",
        upload_status="uploaded",
        created_at=utc_now(),
    )
    documents_store.put_document(item)
    return item



def build_project_item(user_id: str, project_id: str, name: str, created_at: str) -> dict:
    return {
        "userId": user_id,
        "sk": f"PROJECT#{project_id}",
        "projectId": project_id,
        "name": name,
        "createdAt": created_at,
        "updatedAt": created_at,
    }



def build_chat_thread_item(user_id: str, project_id: str, thread_id: str, title: str, created_at: str) -> dict:
    return {
        "userId": user_id,
        "sk": f"THREAD#{project_id}#{created_at}#{thread_id}",
        "projectId": project_id,
        "threadId": thread_id,
        "title": title,
        "createdAt": created_at,
        "updatedAt": created_at,
    }



def build_chat_message_item(
    user_id: str,
    project_id: str,
    thread_id: str,
    message_id: str,
    role: str,
    content: str,
    doc_ids: list[str],
    created_at: str,
    citations: list[dict],
) -> dict:
    return {
        "userId": user_id,
        "sk": f"CHAT#{project_id}#{thread_id}#{created_at}#{message_id}",
        "projectId": project_id,
        "threadId": thread_id,
        "messageId": message_id,
        "role": role,
        "content": content,
        "docIds": doc_ids,
        "citations": citations,
        "createdAt": created_at,
    }



def build_flashcard_prompt(context: str, count: int, doc_ids: list[str]) -> str:
    count_str = str(count) if count > 0 else "all relevant"
    return (
        f"Generate exactly {count_str} flashcards from context below. "
        f"Base documents: {json.dumps(doc_ids)}.\n\n"
        f"Respond with valid JSON only: "
        f'{{"cards": [{{"id":"1","front":"question","back":"answer","source":"source label"}}]}}\n\n'
        f"Context:\n{context}"
    )



def parse_flashcard_response(raw: str, doc_id: str) -> dict:
    json_match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not json_match:
        return {"docId": doc_id, "cards": []}
    try:
        data = json.loads(json_match.group())
        return {"docId": doc_id, "cards": data.get("cards", [])}
    except (json.JSONDecodeError, TypeError):
        return {"docId": doc_id, "cards": []}



def build_quiz_prompt(context: str, doc_ids: list[str]) -> str:
    return (
        "Generate exactly 10 grounded multiple-choice questions from provided context. "
        f"Base documents: {json.dumps(doc_ids)}.\n\n"
        "Respond with JSON only using this schema:\n"
        '{"title":"Exam title","bossPersona":{"name":"name","tone":"tone","introLine":"intro"},'
        '"questions":[{"questionId":"q1","difficulty":"easy|medium|hard","prompt":"...",'
        '"choices":[{"choiceId":"A","label":"..."},{"choiceId":"B","label":"..."},'
        '{"choiceId":"C","label":"..."},{"choiceId":"D","label":"..."}],'
        '"correctChoiceId":"A","bossAskLine":"...","bossCorrectLine":"...",'
        '"bossWrongLine":"...","source":"page/chunk"}]}'
        f"\n\nContext:\n{context}"
    )



def parse_quiz_response(raw: str, doc_ids: list[str]) -> dict:
    json_match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not json_match:
        return {"title": "Generated Exam", "docIds": doc_ids, "bossPersona": {}, "questions": []}
    try:
        parsed = json.loads(json_match.group())
    except (json.JSONDecodeError, TypeError):
        return {"title": "Generated Exam", "docIds": doc_ids, "bossPersona": {}, "questions": []}

    return {
        "title": parsed.get("title", "Generated Exam"),
        "docIds": doc_ids,
        "bossPersona": parsed.get("bossPersona", {}),
        "questions": parsed.get("questions", []),
    }



def build_quiz_item(
    user_id: str,
    project_id: str,
    quiz_id: str,
    title: str,
    doc_ids: list[str],
    boss_persona: dict,
    questions: list[dict],
    created_at: str,
) -> dict:
    return {
        "userId": user_id,
        "sk": f"QUIZ#{project_id}#{quiz_id}",
        "projectId": project_id,
        "quizId": quiz_id,
        "title": title,
        "docIds": doc_ids,
        "bossPersona": boss_persona,
        "questions": questions,
        "createdAt": created_at,
    }



def start_battle_session(user_id: str, project_id: str, session_id: str, quiz: dict) -> dict:
    now = utc_now()
    return {
        "userId": user_id,
        "sk": f"BATTLE#{project_id}#{session_id}",
        "projectId": project_id,
        "sessionId": session_id,
        "quizId": quiz["quizId"],
        "projectId": project_id,
        "bossHp": 100,
        "userHp": 100,
        "currentQuestionIndex": 0,
        "answerHistory": [],
        "status": "active",
        "startedAt": now,
        "updatedAt": now,
    }



def delete_project_resources(user_id: str, project_id: str, projects_store, chat_threads_store, chat_messages_store, documents_store, flashcard_sets_store, quizzes_store, battle_sessions_store, storage) -> None:
    documents = documents_store.list_documents(user_id, project_id)
    for document in documents:
        storage.delete_prefix(f"users/{user_id}/docs/{document['docId']}/")
    chat_messages_store.delete_messages_for_project(user_id, project_id)
    chat_threads_store.delete_threads_for_project(user_id, project_id)
    documents_store.delete_documents_for_project(user_id, project_id)
    flashcard_sets_store.delete_sets_for_project(user_id, project_id)
    quizzes_store.delete_quizzes_for_project(user_id, project_id)
    battle_sessions_store.delete_sessions_for_project(user_id, project_id)
    projects_store.delete_project(user_id, project_id)



def apply_answer(session: dict, quiz: dict, question_id: str, selected_choice_id: str) -> dict:
    idx = session["currentQuestionIndex"]
    if session.get("status") != "active" or idx >= len(quiz["questions"]):
        return session

    question = quiz["questions"][idx]
    is_correct = question["questionId"] == question_id and question["correctChoiceId"] == selected_choice_id

    updated = dict(session)
    updated["answerHistory"] = list(session["answerHistory"]) + [
        {
            "questionId": question_id,
            "selectedChoiceId": selected_choice_id,
            "correctChoiceId": question["correctChoiceId"],
            "isCorrect": is_correct,
        }
    ]

    if is_correct:
        updated["bossHp"] = max(0, session["bossHp"] - 10)
        narration = question["bossCorrectLine"]
    else:
        updated["userHp"] = max(0, session["userHp"] - 20)
        narration = question["bossWrongLine"]

    updated["currentQuestionIndex"] = min(idx + 1, len(quiz["questions"]))
    updated["updatedAt"] = utc_now()

    if updated["bossHp"] == 0:
        updated["status"] = "won"
    elif updated["userHp"] == 0:
        updated["status"] = "lost"
    elif updated["currentQuestionIndex"] >= len(quiz["questions"]):
        updated["status"] = "completed"
    else:
        updated["status"] = "active"

    updated["lastNarration"] = narration
    return updated
