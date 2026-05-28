from src.handlers import delete_project_resources


class FakeProjectsStore:
    def __init__(self) -> None:
        self.deleted = []

    def delete_project(self, user_id: str, project_id: str) -> None:
        self.deleted.append(project_id)


class FakeDocumentsStore:
    def __init__(self) -> None:
        self.deleted = []

    def list_documents(self, user_id: str, project_id: str) -> list[dict]:
        return [{"docId": "doc-1"}]

    def delete_documents_for_project(self, user_id: str, project_id: str) -> None:
        self.deleted.append(project_id)


class FakePrefixStore:
    def __init__(self) -> None:
        self.deleted = []

    def delete_threads_for_project(self, user_id: str, project_id: str) -> None:
        self.deleted.append(project_id)

    def delete_messages_for_project(self, user_id: str, project_id: str) -> None:
        self.deleted.append(project_id)

    def delete_sets_for_project(self, user_id: str, project_id: str) -> None:
        self.deleted.append(project_id)

    def delete_quizzes_for_project(self, user_id: str, project_id: str) -> None:
        self.deleted.append(project_id)

    def delete_sessions_for_project(self, user_id: str, project_id: str) -> None:
        self.deleted.append(project_id)


class FakeStorage:
    def __init__(self) -> None:
        self.deleted_prefixes = []

    def delete_prefix(self, prefix: str) -> None:
        self.deleted_prefixes.append(prefix)


def test_delete_project_cascades_owned_resources():
    projects = FakeProjectsStore()
    threads = FakePrefixStore()
    messages = FakePrefixStore()
    documents = FakeDocumentsStore()
    flashcards = FakePrefixStore()
    quizzes = FakePrefixStore()
    battles = FakePrefixStore()
    storage = FakeStorage()

    delete_project_resources("user-1", "project-1", projects, threads, messages, documents, flashcards, quizzes, battles, storage)

    assert projects.deleted == ["project-1"]
    assert threads.deleted == ["project-1"]
    assert messages.deleted == ["project-1"]
    assert documents.deleted == ["project-1"]
    assert flashcards.deleted == ["project-1"]
    assert quizzes.deleted == ["project-1"]
    assert battles.deleted == ["project-1"]
    assert storage.deleted_prefixes == ["users/user-1/docs/doc-1/"]
