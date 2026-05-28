from src.handlers import build_kb_metadata_sidecar



def test_build_kb_metadata_sidecar_contains_user_and_doc_filter_fields():
    payload = build_kb_metadata_sidecar(
        user_id="user-1",
        doc_id="doc-1",
        filename="lesson.pdf",
        locator="page-1",
    )

    attributes = payload["metadataAttributes"]
    keys = {entry["key"] for entry in attributes}

    assert keys == {"user_id", "doc_id", "filename", "locator"}
