from src.handlers import build_sidecar_key



def test_build_sidecar_key_places_metadata_next_to_original_file():
    key = build_sidecar_key("users/user-1/docs/doc-1/original/lesson.pdf")
    assert key == "users/user-1/docs/doc-1/original/lesson.pdf.metadata.json"
