from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


AnalysisMode = Literal["describe", "critique", "style", "poem"]


class AnalyzeRequest(BaseModel):
    imageBase64: str = Field(..., min_length=20)
    mode: AnalysisMode
    promptContext: Optional[str] = None


class AnalyzeResponse(BaseModel):
    text: str
    mode: AnalysisMode
    model: str
    latencyMs: int


class MathSolveRequest(BaseModel):
    imageBase64: str = Field(..., min_length=20)


class MathSolveResponse(BaseModel):
    expression: str
    answer: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    rawModelText: str
    provider: Literal["openai", "gemini"]
    model: str
    latencyMs: int


class HealthResponse(BaseModel):
    status: Literal["ok"]
    model: str
