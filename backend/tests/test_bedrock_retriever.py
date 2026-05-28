from src.adapters.vector import BedrockKBRetriever



def test_retriever_builds_filter_with_user_and_docs():
    retriever = BedrockKBRetriever(kb_id="test-kb", region="ap-southeast-1")
    filter_expression = retriever.build_filter(
        user_id="user-1", doc_ids=["doc-a", "doc-b"]
    )

    assert filter_expression == {
        "andAll": [
            {"equals": {"key": "user_id", "value": "user-1"}},
            {"orAll": [
                {"equals": {"key": "doc_id", "value": "doc-a"}},
                {"equals": {"key": "doc_id", "value": "doc-b"}},
            ]},
        ]
    }
