# Arquitectura

Resumen técnico conciso de cómo está armado MCH-English y cómo fluyen los datos. Para el detalle de cada decisión y su justificación, ver [`docs/audits/`](./audits/).

## Componentes

```
                         ┌──────────────────────────┐
                         │   Frontend (Next.js 15)  │
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

- **JWT + lista de revocación en Redis**: tokens de acceso con expiración por defecto de 24 horas (`JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440`). La revocación activa se efectúa en `POST /auth/logout`, guardando el hash SHA-256 del token en Redis con `SETEX` por el TTL remanente. Esto garantiza invalidación inmediata sin refresh tokens complejos.
- **Connection pooling en Redis**: el cliente `aioredis` del backend opera con un pool acotado (`max_connections=50`) compartido entre endpoints y `/health`, previniendo saturación de descriptores de archivo bajo alta concurrencia.
- **Cabeceras de seguridad HTTP**: `next.config.js` implementa `Content-Security-Policy` (CSP), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, y `Permissions-Policy`.
- **Métrica Net WPM**: el cálculo de velocidad de escritura se basa estrictamente en caracteres correctos ($(\text{correct} / 5) / \text{minutos}$), alineado con los estándares internacionales de mecanografía.
- **Rate limiting** (`slowapi`, `app/core/limiter.py`): `/auth/login` a 5/min y `/auth/register` a 3/hora por IP, con cabeceras `X-RateLimit-*` en cada respuesta.
- **CORS restringido** por variable de entorno (`CORS_ORIGINS`), ya no `allow_origins=["*"]`.
- **`SECRET_KEY` validado al arrancar**: el backend se niega a iniciar con placeholders de desarrollo conocidos o con una clave de menos de 32 caracteres.
- **`/health` con verificación real**: `SELECT 1` contra Postgres + `PING` contra Redis (con timeout explícito), responde `503` si cualquiera está caído — no un `200` incondicional.
- **Logging estructurado**: cada request se loguea en JSON (`structlog`) con `request_id` (sanitizado alfanumérico o autogenerado), método, path, status y duración.
- **Contenedores sin root y Multi-Stage**: `backend` corre como `appuser` con build multi-stage mínimo, `frontend` como `node` en standalone.

## Módulos de Experiencia de Usuario, Analítica y Gamificación (Fase 3)

Esta fase incorpora seis módulos interactivos manteniendo rigurosamente el principio de **cero IA**, **cero llamadas a APIs externas** y **máximo rendimiento**:

1. **Sistema de Animaciones del Motor de Tipeo (Módulo 1)**:
   - Micro-transiciones CSS de 80ms (`ease-out`) para estados de caracteres (pending → correct → incorrect).
   - Animación de sacudida horizontal de 3px × 2 ciclos (120ms) y color rojo persistente para errores.
   - Destello sutil de escala (1.0 → 1.02 → 1.0) y verde esmeralda para aciertos.
   - Cursor de práctica con parpadeo mediante `@keyframes blink` en CSS puro (cero sobrecarga de JS).
   - Transiciones de fragmentos (fade-out y slide-up 8px / fade-in y slide-down 8px) y marco dorado con destello al completar el 3er chunk perfecto consecutivo.
   - Partículas de confeti en CSS puro (`@keyframes confetti-fall`) sin librerías externas pesadas.
   - `StreakBar` con niveles visuales progresivos (Gris → Esmeralda → Ámbar).

2. **Estadísticas Avanzadas y Gráficos SVG Puros (Módulo 2)**:
   - Endpoint backend de agregación `GET /sessions/stats/summary?days=30` que consolida series temporales de WPM, precisión, caracteres más fallados y mapa de calor.
   - Gráficos renderizados en SVG puro sin librerías pesadas (`recharts`, `d3` o `chart.js`):
     - `WpmTrendChart`: Gráfico de línea con gradiente de área, marcadores interactivos y tooltip de coordenadas.
     - `AccuracyHeatmap`: Calendario estilo GitHub mapeando niveles de precisión diaria.
     - `ErrorPatternChart`: Gráfico de barras horizontales con el Top 10 de caracteres con fallos.
   - Tabla paginada `SessionHistoryTable` (10 por página) con ordenamiento por columnas y exportación CSV.
   - Cumplimiento estricto de accesibilidad WCAG 1.1.1 con tablas HTML ocultas y atributos `role="img"` con `aria-label`.

3. **Modo Práctica Libre / QuickType (Módulo 3)**:
   - Ruta `/quicktype` para práctica efímera inmediata sobre cualquier texto pegado sin guardarlo previamente en base de datos.
   - Tokenizador y fragmentador consciente de oraciones en el cliente (`clientChunking.ts`, 50–80 palabras por fragmento, límite de 2.000 palabras).
   - Reutilización directa de `useTypingSession`.
   - Botón "Guardar en biblioteca" que transfiere el texto a `sessionStorage` y abre el modal de importación en `/library`.

4. **Motor de Gamificación y Logros (Módulo 4)**:
   - Catálogo de 12 logros determinísticos en `backend/app/services/achievements_service.py` evaluados al finalizar cada sesión.
   - Modelo `UserAchievement` con columna `seen` y migración reversible de Alembic (`a1f893d50b91_add_seen_to_user_achievements.py`).
   - Notificación emergente `AchievementToast` con animación de entrada y auto-cierre.
   - Indicador dinámico `AchievementsBadge` en la barra de navegación mostrando logros no vistos.
   - Galería completa en `/achievements` con tarjetas de logros desbloqueados y bloqueados con efecto shimmer en hover.

5. **Importador Local de PDF y ePub en el Navegador (Módulo 5)**:
   - Procesamiento 100% en el cliente con cero llamadas a red o APIs externas:
     - `pdfjs-dist` con worker local (`/pdf.worker.min.mjs`), extrayendo texto seleccionable página a página y detectando documentos escaneados sin OCR.
     - `epubjs` extrayendo el spine y los capítulos en memoria, saneando etiquetas HTML y decodificando entidades.
   - Límite estricto de 500 KB de texto extraído para garantizar fluidez en el motor de tipeo.
   - Aviso explícito de privacidad y seguridad offline.
   - Modal unificado `ImporterModal` con tres pestañas ("Pegar texto", "Importar PDF", "Importar ePub").

6. **Mejoras de Usabilidad y Núcleo (Módulo 6)**:
   - Atajos de teclado globales (`Cmd+K`/`Ctrl+K` para QuickType, `Cmd+N`/`Ctrl+N` para Nuevo Texto, `Esc` para salir, `Cmd+/`/`Ctrl+/` para ayuda).
   - Selector de temas con previsualización en tiempo real al pasar el ratón (`ThemeSelector.tsx`).
   - Retroalimentación háptica en dispositivos móviles (`navigator.vibrate(50)`) ante errores de tipeo.
   - Exportador CSV en el cliente compatible con RFC 4180 y con escape de inyección de fórmulas (`csvExport.ts`).
   - Experiencia Modo Zen con barra de progreso vertical en el margen izquierdo persistida en `localStorage`.

## Testing

- **Backend**: Tests unitarios y de integración (`pytest`) cubriendo chunking, alineación Gale-Church, servicios de mecanografía, sesiones con agregaciones estadísticas y el catálogo de logros.
- **Frontend**: 24 suites de pruebas con 99 tests unitarios (`vitest` + Testing Library) verificando el motor de tipeo, hooks de teclado, renderizado de gráficos SVG accesibles, modales de importación, badges y toasts de logros.
- **CI** (`.github/workflows/ci.yml`): lint + tipos + tests de frontend, pytest de backend contra Postgres/Redis reales de CI (incluye verificar que el historial completo de migraciones de Alembic aplica limpio desde cero), y build de ambos Dockerfiles — en cada push/PR a `main`.

