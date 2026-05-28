from __future__ import annotations

from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.adapters.factory import (
    make_ai_client,
    make_battle_sessions_store,
    make_chat_messages_store,
    make_documents_store,
    make_flashcard_sets_store,
    make_quizzes_store,
    make_retriever,
    make_storage,
)
from src.auth import get_current_user_id
from src.config import config
from src.handlers import (
    build_chat_message_item,
    build_document_upload_result,
    build_flashcard_prompt,
    build_quiz_item,
    build_quiz_prompt,
    normalize_citation,
    parse_flashcard_response,
    parse_quiz_response,
    start_battle_session,
    apply_answer,
    utc_now,
)


class ChatRequest(BaseModel):
    question: str
    docIds: list[str] = Field(default_factory=list)


class FlashcardGenerateRequest(BaseModel):
    docIds: list[str] = Field(default_factory=list)
    cardCount: int = Field(default=10, ge=1)


class QuizGenerateRequest(BaseModel):
    docIds: list[str]


class BattleStartRequest(BaseModel):
    quizId: str


class BattleAnswerRequest(BaseModel):
    questionId: str
    selectedChoiceId: str


# request-time dependency functions that call factories
def get_storage():
    return make_storage()



def get_documents_store():
    return make_documents_store()



def get_chat_messages_store():
    return make_chat_messages_store()



def get_flashcard_sets_store():
    return make_flashcard_sets_store()



def get_quizzes_store():
    return make_quizzes_store()



def get_battle_sessions_store():
    return make_battle_sessions_store()



def get_retriever():
    return make_retriever()



def get_ai_client():
    return make_ai_client()



def create_app() -> FastAPI:
    app = FastAPI(title="Study Buddy Battle Quiz API")

    allowed = [origin.strip() for origin in config.cors_origins.split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed or ["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict:
        return {
            "status": "ok",
            "backends": {
                "storage": config.storage_backend,
                "userstore": config.userstore_backend,
                "vector": config.vector_backend,
                "ai": config.ai_backend,
            },
        }

    @app.post("/documents/upload")
    async def upload_document(
        file: UploadFile = File(...),
        user_id: str = Depends(get_current_user_id),
        storage=Depends(get_storage),
        documents_store=Depends(get_documents_store),
    ) -> dict:
        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Empty file")
        return build_document_upload_result(
            user_id=user_id,
            filename=file.filename or "untitled",
            content_type=file.content_type or "application/octet-stream",
            storage=storage,
            documents_store=documents_store,
            data=data,
        )

    @app.get("/documents")
    def list_documents(
        user_id: str = Depends(get_current_user_id),
        documents_store=Depends(get_documents_store),
    ) -> dict:
        return {"documents": documents_store.list_documents(user_id)}

    @app.get("/documents/{doc_id}")
    def get_document(
        doc_id: str,
        user_id: str = Depends(get_current_user_id),
        documents_store=Depends(get_documents_store),
    ) -> dict:
        item = documents_store.get_document(user_id, doc_id)
        if not item:
            raise HTTPException(status_code=404, detail="Document not found")
        return item

    @app.get("/chat/messages")
    def list_chat_messages(
        user_id: str = Depends(get_current_user_id),
        chat_messages_store=Depends(get_chat_messages_store),
    ) -> dict:
        return {"messages": chat_messages_store.list_messages(user_id)}

    @app.post("/chat/messages")
    def create_chat_message(
        req: ChatRequest,
        user_id: str = Depends(get_current_user_id),
        retriever=Depends(get_retriever),
        ai_client=Depends(get_ai_client),
        chat_messages_store=Depends(get_chat_messages_store),
    ) -> dict:
        results = retriever.retrieve(
            query=req.question,
            user_id=user_id,
            doc_ids=req.docIds if req.docIds else None,
        )
        citations = [normalize_citation(f"c{i}", result) for i, result in enumerate(results)]
        context = "\n\n".join(result["text"] for result in results)
        prompt = ai_client.build_grounded_prompt(req.question, context, citations)
        answer = ai_client.invoke(prompt)

        now = utc_now()
        chat_messages_store.put_message(
            build_chat_message_item(
                user_id=user_id,
                message_id=str(uuid4()),
                role="user",
                content=req.question,
                doc_ids=req.docIds,
                created_at=now,
                citations=[],
            )
        )
        bot_msg = build_chat_message_item(
            user_id=user_id,
            message_id=str(uuid4()),
            role="bot",
            content=answer,
            doc_ids=req.docIds,
            created_at=utc_now(),
            citations=citations,
        )
        chat_messages_store.put_message(bot_msg)
        return bot_msg

    @app.post("/flashcards/generate")
    def generate_flashcards(
        req: FlashcardGenerateRequest,
        user_id: str = Depends(get_current_user_id),
        retriever=Depends(get_retriever),
        ai_client=Depends(get_ai_client),
        flashcard_sets_store=Depends(get_flashcard_sets_store),
    ) -> dict:
        context_chunks = retriever.retrieve(
            query="generate flashcards from document",
            user_id=user_id,
            doc_ids=req.docIds,
            top_k=20,
        )
        context = "\n\n".join(chunk["text"] for chunk in context_chunks)
        prompt = build_flashcard_prompt(context, req.cardCount, req.docIds)
        raw_response = ai_client.invoke(prompt, max_tokens=2048)
        parsed = parse_flashcard_response(raw_response, req.docIds[0] if req.docIds else "unknown")

        set_id = str(uuid4())
        store_item = {
            "userId": user_id,
            "sk": f"FLASHCARD#{set_id}",
            "setId": set_id,
            "docIds": req.docIds,
            "cardCount": req.cardCount,
            "cards": parsed["cards"],
            "createdAt": utc_now(),
        }
        flashcard_sets_store.put_set(store_item)
        return store_item

    @app.get("/flashcards")
    def list_flashcards(
        user_id: str = Depends(get_current_user_id),
        flashcard_sets_store=Depends(get_flashcard_sets_store),
    ) -> dict:
        return {"flashcardSets": flashcard_sets_store.list_sets(user_id)}

    @app.post("/quizzes/generate")
    def generate_quiz(
        req: QuizGenerateRequest,
        user_id: str = Depends(get_current_user_id),
        retriever=Depends(get_retriever),
        ai_client=Depends(get_ai_client),
        quizzes_store=Depends(get_quizzes_store),
    ) -> dict:
        chunks = retriever.retrieve(
            query="generate 10-question exam from document",
            user_id=user_id,
            doc_ids=req.docIds,
            top_k=20,
        )
        context = "\n\n".join(chunk["text"] for chunk in chunks)
        prompt = build_quiz_prompt(context, req.docIds)
        raw_response = ai_client.invoke(prompt, max_tokens=4096)
        parsed = parse_quiz_response(raw_response, req.docIds)

        item = build_quiz_item(
            user_id=user_id,
            quiz_id=str(uuid4()),
            title=parsed["title"],
            doc_ids=req.docIds,
            boss_persona=parsed["bossPersona"],
            questions=parsed["questions"],
            created_at=utc_now(),
        )
        quizzes_store.put_quiz(item)
        return item

    @app.get("/quizzes")
    def list_quizzes(
        user_id: str = Depends(get_current_user_id),
        quizzes_store=Depends(get_quizzes_store),
    ) -> dict:
        return {"quizzes": quizzes_store.list_quizzes(user_id)}

    @app.get("/quizzes/{quiz_id}")
    def get_quiz(
        quiz_id: str,
        user_id: str = Depends(get_current_user_id),
        quizzes_store=Depends(get_quizzes_store),
    ) -> dict:
        quiz = quizzes_store.get_quiz(user_id, quiz_id)
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        return quiz

    @app.post("/battle-sessions/start")
    def start_battle(
        req: BattleStartRequest,
        user_id: str = Depends(get_current_user_id),
        quizzes_store=Depends(get_quizzes_store),
        battle_sessions_store=Depends(get_battle_sessions_store),
    ) -> dict:
        quiz = quizzes_store.get_quiz(user_id, req.quizId)
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")

        session = start_battle_session(user_id, str(uuid4()), quiz)
        battle_sessions_store.put_session(session)
        return {"session": session, "quiz": quiz}

    @app.get("/battle-sessions/{session_id}")
    def get_battle_session(
        session_id: str,
        user_id: str = Depends(get_current_user_id),
        battle_sessions_store=Depends(get_battle_sessions_store),
        quizzes_store=Depends(get_quizzes_store),
    ) -> dict:
        session = battle_sessions_store.get_session(user_id, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Battle session not found")
        quiz = quizzes_store.get_quiz(user_id, session["quizId"])
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        return {"session": session, "quiz": quiz}

    @app.post("/battle-sessions/{session_id}/answers")
    def answer_battle_question(
        session_id: str,
        req: BattleAnswerRequest,
        user_id: str = Depends(get_current_user_id),
        battle_sessions_store=Depends(get_battle_sessions_store),
        quizzes_store=Depends(get_quizzes_store),
    ) -> dict:
        session = battle_sessions_store.get_session(user_id, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Battle session not found")
        quiz = quizzes_store.get_quiz(user_id, session["quizId"])
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        updated = apply_answer(session, quiz, req.questionId, req.selectedChoiceId)
        battle_sessions_store.put_session(updated)
        return {"session": updated, "quiz": quiz}

    return app


app = create_app()
