from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, sessions, statistics, texts

app = FastAPI(title="MCH-English API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(texts.router, prefix="/texts", tags=["texts"])
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(statistics.router, prefix="/statistics", tags=["statistics"])


@app.get("/health")
async def health():
    return {"status": "ok"}
