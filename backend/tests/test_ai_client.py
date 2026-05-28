from src.adapters.ai import BedrockAIClient



def test_build_invoke_payload_uses_correct_model():
    client = BedrockAIClient(model_id="anthropic.claude-3-haiku-20240307-v1:0", region="ap-southeast-1")
    payload = client.build_payload("Hello", 512)
    assert "anthropic_version" in payload["body"]
    assert payload["modelId"] == "anthropic.claude-3-haiku-20240307-v1:0"
    assert payload["body"]["max_tokens"] == 512



def test_build_prompt_with_context():
    client = BedrockAIClient(model_id="test-model", region="ap-southeast-1")
    prompt = client.build_grounded_prompt(
        question="What is gradient descent?",
        context="Gradient descent is an optimization algorithm.",
        citations=[{"citationId": "c1", "excerpt": "Gradient descent is an optimization algorithm."}],
    )
    assert "What is gradient descent?" in prompt
    assert "Relevant excerpts:" in prompt
    assert "Gradient descent is an optimization algorithm." in prompt
