"""EPHERA voice-intent HTTP service — proposes intents, never moves money."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from intent_compiler import compile_text, needs_clarification

app = FastAPI(title="EPHERA Voice Intent", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CompileRequest(BaseModel):
    text: str = Field(min_length=1)
    language: str = "en"


class CompileResponse(BaseModel):
    intent: dict
    needsClarification: bool
    canAuthoriseFromVoiceAlone: bool = False
    panelHint: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "service": "voice-intent"}


@app.post("/v1/compile", response_model=CompileResponse)
def compile_intent(body: CompileRequest):
    intent = compile_text(body.text, body.language)
    clarify = needs_clarification(intent)
    panel = None
    if intent.get("name") == "send_money" and not clarify:
        panel = "payment_confirmation"
    elif intent.get("name") == "freeze_wallet":
        panel = "freeze_wallet"
    elif clarify:
        panel = "clarification"
    return CompileResponse(
        intent=intent,
        needsClarification=clarify,
        canAuthoriseFromVoiceAlone=False,
        panelHint=panel,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8091)
