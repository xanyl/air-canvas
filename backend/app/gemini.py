from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from .config import Settings
from .models import AnalysisMode

ANALYZE_PROMPTS: dict[AnalysisMode, str] = {
    "describe": (
        "You are evaluating a hand-drawn air-canvas artwork. Describe what is visible in 2-4 clear sentences. "
        "Be concrete, encouraging, and specific."
    ),
    "critique": (
        "You are an expert art mentor. Provide a concise critique with strengths, one improvement suggestion, "
        "and one next-step experiment. Keep response <= 60 words."
    ),
    "style": (
        "Identify the most likely art style/movement of this drawing, then justify in 2-3 sentences."
    ),
    "poem": "Write a short 4-6 line poem inspired by this drawing.",
}

MATH_PROMPT = """
You are a math expression reader for handwritten numeric expressions.
Input is an image of a whiteboard/canvas with a simple arithmetic expression.
Return STRICT JSON only with shape:
{"expression":"...","answer":"...","confidence":0.0}
Rules:
- expression: extracted arithmetic expression using only digits, + - * / ( ) and optional '=' at end.
- answer: final computed numeric result as concise string.
- confidence: number between 0 and 1 for extraction confidence.
- If unreadable, still return JSON with best guess and lower confidence.
No markdown, no explanations, only JSON.
""".strip()


class GeminiError(RuntimeError):
    """Raised when model API call/parse fails."""


@dataclass
class GeminiResult:
    text: str
    latency_ms: int
    provider: str = "gemini"
    model: str = ""


@dataclass
class MathResult:
    expression: str
    answer: str
    confidence: float
    raw_text: str
    provider: str
    model: str
    latency_ms: int


def _cleanup_json_text(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    return cleaned


def _extract_json_object(text: str) -> dict[str, Any]:
    cleaned = _cleanup_json_text(text)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        raise GeminiError("Model did not return JSON for math solve.")

    snippet = match.group(0)
    try:
        parsed = json.loads(snippet)
    except json.JSONDecodeError as exc:
        raise GeminiError("Unable to parse JSON from model output.") from exc

    if not isinstance(parsed, dict):
        raise GeminiError("Parsed math response is not an object.")
    return parsed


def _extract_gemini_text_payload(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    for candidate in candidates:
        content = candidate.get("content") or {}
        parts = content.get("parts") or []
        text_parts = [part.get("text", "") for part in parts if isinstance(part, dict) and part.get("text")]
        if text_parts:
            return "\n".join(text_parts).strip()
    raise GeminiError("No text returned from Gemini response.")


def _extract_openai_text_payload(data: dict[str, Any]) -> str:
    choices = data.get("choices") or []
    for choice in choices:
        message = choice.get("message") or {}
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()

        if isinstance(content, list):
            text_parts: list[str] = []
            for part in content:
                if not isinstance(part, dict):
                    continue
                text = part.get("text")
                if isinstance(text, str) and text.strip():
                    text_parts.append(text.strip())
            if text_parts:
                return "\n".join(text_parts)

    raise GeminiError("No text returned from OpenAI response.")


def _normalize_confidence(value: Any) -> float:
    try:
        conf = float(value)
    except (TypeError, ValueError):
        conf = 0.0
    return max(0.0, min(1.0, conf))


def _parse_math_result(
    model_text: str,
    latency_ms: int,
    provider: str,
    model: str,
) -> MathResult:
    data = _extract_json_object(model_text)
    expression = str(data.get("expression", "")).strip() or "unknown"
    answer = str(data.get("answer", "")).strip() or "unknown"
    confidence = _normalize_confidence(data.get("confidence", 0.0))
    return MathResult(
        expression=expression,
        answer=answer,
        confidence=confidence,
        raw_text=model_text,
        provider=provider,
        model=model,
        latency_ms=latency_ms,
    )


async def _call_gemini(settings: Settings, image_base64: str, prompt: str) -> GeminiResult:
    if not settings.gemini_api_key:
        raise GeminiError("Gemini API key is not configured on backend.")

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
        f"?key={settings.gemini_api_key}"
    )
    payload = {
        "contents": [
            {
                "parts": [
                    {"inline_data": {"mime_type": "image/png", "data": image_base64}},
                    {"text": prompt},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 512,
            "responseMimeType": "text/plain",
        },
    }

    start = time.perf_counter()
    timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(endpoint, json=payload)
    latency_ms = int((time.perf_counter() - start) * 1000)

    if response.status_code >= 400:
        detail = response.text
        try:
            data = response.json()
            detail = data.get("error", {}).get("message", detail)
        except Exception:
            pass
        raise GeminiError(f"Gemini API error ({response.status_code}): {detail}")

    try:
        data = response.json()
    except ValueError as exc:
        raise GeminiError("Gemini returned invalid JSON payload.") from exc

    text = _extract_gemini_text_payload(data)
    return GeminiResult(text=text, latency_ms=latency_ms, provider="gemini", model=settings.gemini_model)


async def _call_openai_math(settings: Settings, image_base64: str, prompt: str) -> tuple[str, int, str]:
    if not settings.openai_api_key:
        raise GeminiError("OpenAI API key is not configured on backend.")

    endpoint = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": settings.openai_model,
        "temperature": 0,
        "max_tokens": 220,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": "Return only strict JSON with expression, answer, and confidence.",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}},
                ],
            },
        ],
    }

    start = time.perf_counter()
    timeout = httpx.Timeout(30.0, connect=10.0)
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(endpoint, headers=headers, json=payload)
    latency_ms = int((time.perf_counter() - start) * 1000)

    if response.status_code >= 400:
        detail = response.text
        try:
            data = response.json()
            detail = data.get("error", {}).get("message", detail)
        except Exception:
            pass
        raise GeminiError(f"OpenAI API error ({response.status_code}): {detail}")

    try:
        data = response.json()
    except ValueError as exc:
        raise GeminiError("OpenAI returned invalid JSON payload.") from exc

    text = _extract_openai_text_payload(data)
    model = str(data.get("model", settings.openai_model))
    return text, latency_ms, model


async def _call_openai_analyze(settings: Settings, image_base64: str, prompt: str) -> GeminiResult:
    """Call OpenAI vision API for general text analysis (non-JSON)."""
    if not settings.openai_api_key:
        raise GeminiError("OpenAI API key is not configured on backend.")

    endpoint = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": settings.openai_model,
        "temperature": 0.3,
        "max_tokens": 512,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}},
                ],
            },
        ],
    }

    start = time.perf_counter()
    timeout = httpx.Timeout(30.0, connect=10.0)
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(endpoint, headers=headers, json=payload)
    latency_ms = int((time.perf_counter() - start) * 1000)

    if response.status_code >= 400:
        detail = response.text
        try:
            data = response.json()
            detail = data.get("error", {}).get("message", detail)
        except Exception:
            pass
        raise GeminiError(f"OpenAI API error ({response.status_code}): {detail}")

    try:
        data = response.json()
    except ValueError as exc:
        raise GeminiError("OpenAI returned invalid JSON payload.") from exc

    text = _extract_openai_text_payload(data)
    model = str(data.get("model", settings.openai_model))
    return GeminiResult(text=text, latency_ms=latency_ms, provider="openai", model=model)


async def analyze_image(
    settings: Settings,
    image_base64: str,
    mode: AnalysisMode,
    prompt_context: Optional[str] = None,
) -> GeminiResult:
    prompt = ANALYZE_PROMPTS[mode]
    if prompt_context:
        prompt = f"{prompt}\n\nAdditional context: {prompt_context.strip()}"

    errors: list[str] = []

    # Try OpenAI first
    if settings.openai_api_key:
        try:
            return await _call_openai_analyze(settings, image_base64, prompt)
        except GeminiError as exc:
            errors.append(f"OpenAI: {exc}")

    # Fall back to Gemini
    if settings.gemini_api_key:
        try:
            return await _call_gemini(settings, image_base64, prompt)
        except GeminiError as exc:
            errors.append(f"Gemini fallback: {exc}")

    if errors:
        raise GeminiError(" ; ".join(errors))
    raise GeminiError("Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured on backend.")


async def solve_math_with_openai(settings: Settings, image_base64: str) -> MathResult:
    model_text, latency_ms, model = await _call_openai_math(settings, image_base64, MATH_PROMPT)
    return _parse_math_result(model_text, latency_ms, provider="openai", model=model)


async def solve_math_with_gemini(settings: Settings, image_base64: str) -> MathResult:
    result = await _call_gemini(settings, image_base64, MATH_PROMPT)
    return _parse_math_result(result.text, result.latency_ms, provider="gemini", model=settings.gemini_model)


async def solve_math(settings: Settings, image_base64: str) -> MathResult:
    errors: list[str] = []

    if settings.openai_api_key:
        try:
            return await solve_math_with_openai(settings, image_base64)
        except GeminiError as exc:
            errors.append(f"OpenAI: {exc}")

    if settings.gemini_api_key:
        try:
            return await solve_math_with_gemini(settings, image_base64)
        except GeminiError as exc:
            errors.append(f"Gemini fallback: {exc}")

    if errors:
        raise GeminiError(" ; ".join(errors))
    raise GeminiError("Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured on backend.")
