from src.handlers import extract_text



def test_extract_text_decodes_utf8_text_file():
    content = b"Hello study buddy"
    assert extract_text("notes.txt", content) == "Hello study buddy"
