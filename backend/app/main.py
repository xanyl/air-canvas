from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .gemini import GeminiError, analyze_image, solve_math
from .models import (
    AnalyzeRequest,
    AnalyzeResponse,
    HealthResponse,
    MathSolveRequest,
    MathSolveResponse,
)

settings = get_settings()

app = FastAPI(title="AirCanvas API", version="1.0.0")

allowed_origins = [
    settings.frontend_origin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(allowed_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", model=settings.gemini_model)


@app.post("/api/ai/analyze", response_model=AnalyzeResponse)
async def ai_analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    try:
        result = await analyze_image(settings, req.imageBase64, req.mode, req.promptContext)
    except GeminiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unexpected backend failure") from exc

    return AnalyzeResponse(
        text=result.text,
        mode=req.mode,
        provider=result.provider,
        model=result.model or settings.gemini_model,
        latencyMs=result.latency_ms,
    )


@app.post("/api/math/solve", response_model=MathSolveResponse)
async def math_solve(req: MathSolveRequest) -> MathSolveResponse:
    try:
        result = await solve_math(settings, req.imageBase64)
    except GeminiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Unexpected backend failure") from exc

    return MathSolveResponse(
        expression=result.expression,
        answer=result.answer,
        confidence=result.confidence,
        rawModelText=result.raw_text,
        provider=result.provider,
        model=result.model,
        latencyMs=result.latency_ms,
    )
