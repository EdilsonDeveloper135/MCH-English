from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, dictation, dictionary, gamification, recall, sessions, settings, statistics, texts, vocabulary

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
app.include_router(dictionary.router, prefix="/dictionary", tags=["dictionary"])
app.include_router(vocabulary.router, prefix="/vocabulary", tags=["vocabulary"])
app.include_router(recall.router, prefix="/recall", tags=["recall"])
app.include_router(dictation.router, prefix="/dictation", tags=["dictation"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
app.include_router(gamification.router, prefix="/gamification", tags=["gamification"])


@app.get("/health")
async def health():
    return {"status": "ok"}
