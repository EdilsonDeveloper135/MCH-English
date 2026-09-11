import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.limiter import limiter
from app.models.text import Sentence, SentencePhrase, Text
from app.models.user import User
from app.repositories import text_repository
from app.schemas.texts import (
    AlignmentLink,
    AlignmentOut,
    AlignmentSentenceOut,
    AlignmentUpdate,
    ChunkOut,
    GrammarNoteUpdate,
    PhraseCreate,
    PhraseOut,
    ProgressUpdate,
    SentenceOut,
    TextCreate,
    TextOut,
    TranslationUpdate,
)
from app.services import tts_service, vocabulary_service
from app.services.text_service import create_text
from app.services.translation_service import realign_translation

router = APIRouter()


def _to_text_out(text: Text) -> TextOut:
    total_chunks = len(text.chunks)
    progress = (text.current_chunk_index / total_chunks * 100) if total_chunks else 0.0
    return TextOut(
        id=str(text.id),
        title=text.title,
        status=text.status,
        chunk_mode=text.chunk_mode,
        word_count=text.word_count,
        chunk_count=total_chunks,
        current_chunk_index=text.current_chunk_index,
        current_character_index=text.current_character_index,
        progress_percent=round(progress, 1),
        error_message=text.error_message,
        has_translation=bool(text.translation_content),
        alignment_status=text.alignment_status,
        created_at=text.created_at,
    )


def _sentence_translation(sentence: Sentence) -> str | None:
    linked = sorted((link.translation_sentence for link in sentence.translation_links), key=lambda ts: ts.index)
    if not linked:
        return None
    return " ".join(ts.content for ts in linked)


def _to_sentence_out(sentence: Sentence, weak_words: set[str]) -> SentenceOut:
    return SentenceOut(
        id=str(sentence.id),
        index=sentence.index,
        content=sentence.content,
        translation=_sentence_translation(sentence),
        grammar_note=sentence.grammar_note,
        phrases=[
            PhraseOut(id=str(p.id), english_phrase=p.english_phrase, spanish_phrase=p.spanish_phrase)
            for p in sentence.phrases
        ],
        difficult_words=vocabulary_service.compute_difficult_words(sentence.content, weak_words),
    )


async def _build_alignment_out(db: AsyncSession, text: Text) -> AlignmentOut:
    english_sentences = await text_repository.get_ordered_sentences(db, text.id)
    translation_sentences = await text_repository.get_ordered_translation_sentences(db, text.id)
    links = await text_repository.get_translation_links(db, [s.id for s in english_sentences])

    english_position = {s.id: i for i, s in enumerate(english_sentences)}
    spanish_position = {s.id: i for i, s in enumerate(translation_sentences)}

    return AlignmentOut(
        alignment_status=text.alignment_status,
        english_sentences=[AlignmentSentenceOut(index=i, content=s.content) for i, s in enumerate(english_sentences)],
        spanish_sentences=[
            AlignmentSentenceOut(index=i, content=s.content) for i, s in enumerate(translation_sentences)
        ],
        links=[
            AlignmentLink(
                english_index=english_position[link.english_sentence_id],
                spanish_index=spanish_position[link.translation_sentence_id],
            )
            for link in links
        ],
    )


@router.post("", response_model=TextOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/hour")
async def create(
    request: Request,
    # `response` lo exige slowapi para inyectar las cabeceras X-RateLimit-*.
    response: Response,
    payload: TextCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = await create_text(
        db,
        user_id=current_user.id,
        title=payload.title,
        raw_content=payload.raw_content,
        chunk_mode=payload.chunk_mode,
        translation_content=payload.translation_content,
    )
    return _to_text_out(text)


@router.get("", response_model=list[TextOut])
async def list_texts(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    texts = await text_repository.list_by_user(db, current_user.id)
    return [_to_text_out(t) for t in texts]


@router.get("/{text_id}", response_model=TextOut)
async def get_text(
    text_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    text = await text_repository.get_by_id(db, text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")
    return _to_text_out(text)


@router.delete("/{text_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_text(
    text_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    text = await text_repository.get_by_id(db, text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")

    # The cache-marker rows cascade with the sentences, but the WAV files live on a
    # mounted volume and would otherwise stay there forever.
    sentence_ids = await text_repository.get_sentence_ids(db, text_id)
    await text_repository.delete(db, text)
    if sentence_ids:
        await asyncio.to_thread(tts_service.delete_cached_audio, sentence_ids)


@router.get("/{text_id}/chunks/{index}", response_model=ChunkOut)
async def get_chunk(
    text_id: uuid.UUID,
    index: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = await text_repository.get_by_id(db, text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")

    chunk = await text_repository.get_chunk(db, text_id, index)
    if chunk is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chunk not found")

    weak_words = await vocabulary_service.get_weak_word_set(db, current_user.id)

    return ChunkOut(
        id=str(chunk.id),
        index=chunk.index,
        word_count=chunk.word_count,
        total_chunks=len(text.chunks),
        sentences=[_to_sentence_out(s, weak_words) for s in chunk.sentences],
    )


@router.patch("/{text_id}/sentences/{sentence_id}/grammar-note", response_model=GrammarNoteUpdate)
async def update_grammar_note(
    text_id: uuid.UUID,
    sentence_id: uuid.UUID,
    payload: GrammarNoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sentence = await text_repository.get_owned_sentence(db, sentence_id, current_user.id, text_id)
    if sentence is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sentence not found")

    sentence.grammar_note = payload.grammar_note.strip() if payload.grammar_note else None
    await db.commit()
    return GrammarNoteUpdate(grammar_note=sentence.grammar_note)


@router.post("/{text_id}/sentences/{sentence_id}/phrases", response_model=PhraseOut, status_code=status.HTTP_201_CREATED)
async def add_phrase(
    text_id: uuid.UUID,
    sentence_id: uuid.UUID,
    payload: PhraseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sentence = await text_repository.get_owned_sentence(db, sentence_id, current_user.id, text_id)
    if sentence is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sentence not found")

    phrase = SentencePhrase(
        sentence_id=sentence.id,
        english_phrase=payload.english_phrase.strip(),
        spanish_phrase=payload.spanish_phrase.strip(),
    )
    db.add(phrase)
    await db.commit()
    return PhraseOut(id=str(phrase.id), english_phrase=phrase.english_phrase, spanish_phrase=phrase.spanish_phrase)


@router.delete("/{text_id}/sentences/{sentence_id}/phrases/{phrase_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_phrase(
    text_id: uuid.UUID,
    sentence_id: uuid.UUID,
    phrase_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sentence = await text_repository.get_owned_sentence(db, sentence_id, current_user.id, text_id)
    if sentence is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sentence not found")

    phrase = next((p for p in sentence.phrases if p.id == phrase_id), None)
    if phrase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phrase not found")

    await db.delete(phrase)
    await db.commit()


@router.patch("/{text_id}/progress", response_model=TextOut)
async def update_progress(
    text_id: uuid.UUID,
    payload: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = await text_repository.get_by_id(db, text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")

    # Clamped instead of trusted: an out-of-range index produced progress above 100%
    # and made the "text completed" achievement unlockable without practicing.
    # chunk_count itself is a valid value -- it is what "finished the whole text" means.
    chunk_index = min(max(payload.current_chunk_index, 0), len(text.chunks))
    character_index = max(payload.current_character_index, 0)

    text = await text_repository.update_progress(db, text, chunk_index, character_index)
    return _to_text_out(text)


@router.patch("/{text_id}/translation", response_model=TextOut)
@limiter.limit("60/hour")
async def update_translation(
    request: Request,
    response: Response,
    text_id: uuid.UUID,
    payload: TranslationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = await text_repository.get_by_id(db, text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")
    if text.status != "ready":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Text is still processing; try again once it's ready"
        )

    text.translation_content = payload.translation_content.strip()
    await db.commit()
    await realign_translation(db, text)
    return _to_text_out(text)


@router.get("/{text_id}/alignment", response_model=AlignmentOut)
async def get_alignment(
    text_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    text = await text_repository.get_by_id(db, text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")

    return await _build_alignment_out(db, text)


@router.put("/{text_id}/alignment", response_model=AlignmentOut)
async def update_alignment(
    text_id: uuid.UUID,
    payload: AlignmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = await text_repository.get_by_id(db, text_id, current_user.id)
    if text is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Text not found")

    english_sentences = await text_repository.get_ordered_sentences(db, text_id)
    translation_sentences = await text_repository.get_ordered_translation_sentences(db, text_id)
    n, m = len(english_sentences), len(translation_sentences)

    seen: set[tuple[int, int]] = set()
    links: list[tuple[int, int]] = []
    for link in payload.links:
        if not (0 <= link.english_index < n) or not (0 <= link.spanish_index < m):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Link index out of range (have {n} english, {m} spanish sentences)",
            )
        key = (link.english_index, link.spanish_index)
        if key not in seen:
            seen.add(key)
            links.append(key)

    await text_repository.replace_translation_links(db, text, english_sentences, translation_sentences, links)

    return await _build_alignment_out(db, text)
