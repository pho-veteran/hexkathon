from src.adapters.userstore import build_document_item



def test_build_document_item_uses_user_partition_and_doc_sort_key():
    item = build_document_item(
        user_id="user-1",
        doc_id="doc-1",
        filename="lesson.pdf",
        s3_key="users/user-1/docs/doc-1/original/lesson.pdf",
        content_type="application/pdf",
        kb_ingest_status="processing",
        upload_status="uploaded",
        created_at="2026-05-27T00:00:00Z",
    )

    assert item["userId"] == "user-1"
    assert item["sk"] == "DOC#doc-1"
    assert item["docId"] == "doc-1"
    assert item["filename"] == "lesson.pdf"
