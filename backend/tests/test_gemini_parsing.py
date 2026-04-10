from app.gemini import _extract_json_object, _extract_openai_text_payload


def test_extract_json_object_plain_json() -> None:
    out = _extract_json_object('{"expression":"1+5=","answer":"6","confidence":0.92}')
    assert out["expression"] == "1+5="
    assert out["answer"] == "6"


def test_extract_json_object_markdown_fence() -> None:
    out = _extract_json_object('```json\n{"expression":"9/3","answer":"3","confidence":0.88}\n```')
    assert out["answer"] == "3"


def test_extract_json_object_embedded_text() -> None:
    out = _extract_json_object('Result follows: {"expression":"2*7","answer":"14","confidence":0.9}')
    assert out["expression"] == "2*7"


def test_extract_openai_text_payload_string() -> None:
    payload = {
        "choices": [
            {
                "message": {
                    "content": '{"expression":"1+5=","answer":"6","confidence":0.95}',
                }
            }
        ]
    }
    out = _extract_openai_text_payload(payload)
    assert '"answer":"6"' in out
