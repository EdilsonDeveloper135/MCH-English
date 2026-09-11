# Arquitectura

Resumen técnico conciso de cómo está armado MCH-English y cómo fluyen los datos. Para el detalle de cada decisión y su justificación, ver [`docs/audits/`](./audits/).

## Componentes

```
                         ┌──────────────────────────┐
                         │   Frontend (Next.js 14)  │
                         │  App Router + Zustand    │
                         │  http://localhost:3000   │
                         └────────────┬─────────────┘
                                      │ REST (fetch, JWT Bearer)
                                      ▼
                         ┌──────────────────────────┐
                         │   Backend (FastAPI)      │
                         │  Pydantic v2 + SQLAlchemy│
                         │  http://localhost:8000   │
                         └──┬────────────┬──────────┘
                            │            │
                 SQL async  │            │ enqueue (RQ)
                            ▼            ▼
                  ┌──────────────┐  ┌──────────┐      ┌───────────────────┐
                  │ PostgreSQL 16│  │ Redis 7  │◄────►│  Worker (RQ)      │
                  │  (datos)     │  │ (cola +  │      │  Smart Chunking + │
                  │              │  │ rate     │      │  Gale-Church      │
                  │              │  │ limit +  │      │  (alignment_      │
                  │              │  │ revoke   │      │   service.py)     │
                  │              │  │  list)   │      └───────────────────┘
                  └──────────────┘  └──────────┘
```

Cinco contenedores Docker (`docker compose ps`): `frontend`, `backend`, `worker`, `postgres`, `redis`. El TTS de Dictation corre **dentro** del contenedor `backend` (eSpeak-NG local, sin llamadas externas) — no es un servicio aparte.

## Principio rector: cero IA generativa, cero dependencias opacas

Todo el pipeline de idioma es determinístico y auditable línea por línea:
- **Traducción**: el usuario la escribe él mismo (no hay motor de traducción automática).
- **Alineación de oraciones**: Gale-Church (1993), un método estadístico clásico basado en longitud de oración — no un modelo de lenguaje.
- **Diccionario palabra-a-palabra**: FreeDict eng-spa (datos lexicográficos abiertos, ver `backend/data/NOTICE.md`), no una API de traducción.
- **Voz de Dictation**: eSpeak-NG, un sintetizador de voz local basado en reglas fonéticas, no un modelo de TTS neuronal ni una API en la nube.

## Flujo de datos: de un texto pegado a una sesión de práctica

1. **Subida** — `POST /texts` guarda el texto crudo con `status=pending` y encola un job en RQ (`enqueue_process_text`, `app/workers/jobs.py`). La request responde de inmediato; el procesamiento es asíncrono.
2. **Smart Chunking** (`app/services/chunking_service.py`, corre en el worker) — divide el texto en oraciones (con manejo de abreviaturas) y las agrupa en chunks de 30–150 palabras según el modo elegido (`short`/`normal`/`long`/`continuous`), sin cortar nunca a mitad de una oración.
3. **Alineación Gale-Church** (`app/services/alignment_service.py`, `translation_service.py`) — si el usuario pegó también su propia traducción, esta etapa empareja cada oración en inglés con su (o sus) oración(es) en español por longitud relativa, marcando el resultado como `confirmed` o `needs_review` si la heurística no está segura. La programación dinámica corre en banda alrededor de la diagonal (ambos lados son el mismo texto en orden), lo que la hace lineal en número de oraciones en vez de cuadrática: 1.000 oraciones por lado bajaron de 15,9 s / 132 MB a 1,9 s / 19 MB.
4. El worker marca el texto `status=ready` (o `failed` con el error capturado) y libera la sesión de DB.
5. **Consulta de diccionario** — al fallar una palabra durante el tipeo, el frontend pide `GET /dictionary/{word}`, resuelto contra las entradas de FreeDict ya cargadas en Postgres (`seed_dictionary.py`, corre una vez en el arranque vía el servicio `migrate`). Cacheado en memoria en el cliente (`api.ts`) para no repetir la misma consulta dos veces.
6. **Sesión de práctica** — el motor de tipeo (`useTypingSession.ts`) vive enteramente en el cliente; solo al terminar un chunk se manda el resumen (`POST /sessions/{id}`, o el equivalente en Recall/Dictation) para persistir WPM, precisión, errores y XP.
7. **Estado del cliente** — Zustand (`stores/authStore.ts`) guarda únicamente el token JWT y el email, persistido en `localStorage`; todo lo demás (texto actual, progreso de la sesión, estados de gamificación) vive en el estado local del componente de cada página y se recarga desde la API en cada visita — no hay un store global de datos de dominio.

## Seguridad y resiliencia (capas agregadas en la Fase 2 de remediación)

- **JWT + lista de revocación en Redis**: `POST /auth/logout` exige un token válido (si no, cualquiera podría escribir claves arbitrarias en Redis) y guarda su SHA-256 vía `SETEX`, con el TTL que le queda al propio JWT; `get_current_user` rechaza cualquier token presente en esa lista. Redis corre con `appendonly` y volumen propio, así que la revocación sobrevive a un reinicio.
- **Rate limiting** (`slowapi`, `app/core/limiter.py`): `/auth/login` a 5/min y `/auth/register` a 3/hora por IP, con cabeceras `X-RateLimit-*` en cada respuesta.
- **CORS restringido** por variable de entorno (`CORS_ORIGINS`), ya no `allow_origins=["*"]`.
- **`SECRET_KEY` validado al arrancar**: el backend se niega a iniciar con el placeholder de `.env.example` o con una clave de menos de 32 caracteres.
- **`/health` con verificación real**: `SELECT 1` contra Postgres + `PING` contra Redis (con timeout explícito), responde `503` si cualquiera está caído — no un `200` incondicional.
- **Logging estructurado**: cada request se loguea en JSON (`structlog`) con `request_id` (propio o heredado del header `X-Request-ID` del cliente), método, path, status y duración.
- **Contenedores sin root**: `backend` corre como `appuser`, `frontend` como `node`.

## Testing

- **Backend**: 104 tests (`pytest`) — unitarios de servicios puros (chunking, alignment, gamification, vocabulary) + integración HTTP end-to-end contra una base Postgres de test real y separada (`app/tests/conftest.py` crea y destruye `mch_english_test` en cada corrida), cubriendo auth, texts, sessions, recall, dictation, vocabulary, settings, gamification y dictionary.
- **Frontend**: 67 tests (`vitest` + Testing Library) — el motor de tipeo (Backspace, Ctrl+Backspace, WPM, detección de palabra), render de componentes (`TypingText`, `ConfirmModal`, `AppHeader`, `MissingWordsText`, `SentenceInfoPanel`), y manejo de errores/caché de `api.ts`.
- **CI** (`.github/workflows/ci.yml`): lint + tipos + tests de frontend, pytest de backend contra Postgres/Redis reales de CI (incluye verificar que el historial completo de migraciones de Alembic aplica limpio desde cero), y build de ambos Dockerfiles — en cada push/PR a `main`.
