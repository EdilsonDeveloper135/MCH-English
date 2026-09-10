# PLAN INTEGRAL DE MEJORA Y REMEDIACIÓN

**Proyecto:** MCH-English  
**Fecha:** Septiembre 2026  
**Documento Relacionado:** [AUDIT_REPORT.md](file:///Users/edilsontaquimachuctaya/Desktop/MCH-English/AUDIT_REPORT.md)  
**Metodología:** Ejecución escalonada por fases de criticidad e impacto.

---

## FASE 0 — PROBLEMAS CRÍTICOS (P0)

### [x] Tarea 0.1: Proteger sesiones y estadísticas históricas ante borrado de textos
> ✅ **Completado 2026-09-10.** `TypingSession.text_id/chunk_id`, `RecallSession.text_id`, `DictationSession.text_id` pasaron a `ondelete="SET NULL"` + `nullable=True`. Se detectó y corrigió un problema adicional no listado explícitamente: `RecallAttempt.sentence_id` y `DictationAttempt.sentence_id` (donde vive `correct_words`, la fuente real del XP de Recall/Dictation) también tenían `ondelete="CASCADE"` hacia `sentences.id` -- como borrar un texto cascadea hasta sus oraciones, el XP se habría perdido igual aunque la sesión sobreviviera. Se corrigieron también a `SET NULL`. Migración `87783de64709`. Verificado con script E2E: crear texto → sesión con XP → borrar texto → `/gamification/overview` mantiene el XP exacto, la sesión persiste con `text_id=null`.
- **Prioridad:** P0
- **Área:** Base de Datos / Integridad de Datos
- **Archivos afectados:**
  - `backend/app/models/typing_session.py`
  - `backend/app/models/recall.py`
  - `backend/app/models/dictation.py`
  - Nueva migración de Alembic en `backend/alembic/versions/`
- **Motivo:** Actualmente, `ForeignKey("texts.id", ondelete="CASCADE")` borra todas las sesiones del usuario al eliminar un texto, dejando en 0 el XP, las rachas y las horas practicadas.
- **Implementación propuesta:**
  1. Modificar las claves foráneas de `text_id` y `chunk_id` en `TypingSession`, `RecallSession` y `DictationSession` para que usen `ondelete="SET NULL"` y asegurar que las columnas sean `nullable=True`.
  2. Generar y aplicar una migración Alembic que altere los constraints en PostgreSQL.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Crear un texto, registrar una sesión de mecanografía con XP, eliminar el texto mediante `DELETE /texts/{id}`, y comprobar que la sesión continúa existiendo en `typing_sessions` con `text_id = NULL` y que `/gamification/overview` mantiene intactos el XP, el nivel y las rachas del usuario.

---

### [x] Tarea 0.2: Corregir bugs de asincronía y cálculo con Backspace en el motor de mecanografía
> ✅ **Completado 2026-09-10.** `finalCharStates` ahora se computa de forma directa sobre el closure (`[...charStates]` + mutación local) y se pasa a `setCharStates` como valor plano, sin depender del timing de un updater funcional. `Backspace` ahora decrementa `correctCount`/`incorrectCount` y elimina la entrada de `errors` correspondiente según el estado que tenía esa posición antes de borrarla. Verificado en navegador: escribir mal → Backspace → escribir bien → el payload real enviado a `PATCH /sessions/{id}` mostró `total_characters=12` exactos para un texto de 12 caracteres (antes del fix habría dado 13, con el keystroke fantasma sin descontar).
- **Prioridad:** P0
- **Área:** Frontend / Core Typing
- **Archivos afectados:**
  - `frontend/src/features/typing/useTypingSession.ts`
- **Motivo:** El callback `onComplete` recibe `finalCharStates` obsoleto (el último carácter llega como `"pending"`). Además, presionar `Backspace` no decrementa `correctCount`, lo que infla la precisión por encima del 100% y distorsiona el WPM.
- **Implementación propuesta:**
  1. Al pulsar `Backspace`, decrementar `currentIndex`, restaurar el estado a `"pending"` en la posición previa y descontar del conteo de aciertos/errores según corresponda.
  2. Al alcanzar el último carácter, calcular de manera síncrona el array final de estados antes de invocar `onComplete`.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** En una prueba donde se escriba un carácter erróneo, se presione Backspace, y se escriba el carácter correcto, la precisión calculada debe reflejar el porcentaje real exacto sin superar el 100%, y el array de estados entregado a `onComplete` debe contener todos los caracteres como `"correct"` o `"incorrect"`, sin ningún `"pending"`.

---

### [x] Tarea 0.3: Reemplazar passlib por bcrypt nativo para compatibilidad con Python 3.13+
> ✅ **Completado 2026-09-10.** `security.py` usa `bcrypt.hashpw`/`bcrypt.checkpw` directamente (con truncamiento explícito a 72 bytes, el límite real del algoritmo). `passlib` eliminado de `requirements.txt`. Verificado que los hashes YA EXISTENTES generados por passlib (formato bcrypt estándar `$2b$...`) siguen verificando correctamente con `bcrypt.checkpw` -- no hace falta migración de datos ni fuerza a los usuarios a re-registrarse. `pytest` sin la advertencia de deprecación de `crypt`.
- **Prioridad:** P0
- **Área:** Backend / Seguridad y Compatibilidad
- **Archivos afectados:**
  - `backend/app/core/security.py`
  - `backend/requirements.txt`
- **Motivo:** `passlib 1.7.4` importa el módulo obsoleto `crypt`, eliminado de la biblioteca estándar en Python 3.13 (PEP 594), provocando errores fatales de importación.
- **Implementación propuesta:**
  1. Eliminar `passlib` de `requirements.txt`.
  2. Utilizar `bcrypt` directamente en `security.py`:
     ```python
     import bcrypt

     def hash_password(password: str) -> str:
         return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

     def verify_password(plain_password: str, hashed_password: str) -> bool:
         return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
     ```
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Pruebas de registro e inicio de sesión ejecutadas exitosamente sin advertencias de deprecación de `crypt` en Python 3.12 y 3.13+.

---

### [x] Tarea 0.4: Corregir autorización rota (IDOR) en endpoints de intentos
> ✅ **Completado 2026-09-10.** `create_recall_attempt` y `create_dictation_attempt` ahora validan la oración vía join contra el `text_id` del usuario (reusando/extendiendo `text_repository.get_owned_sentence` y el `_get_owned_sentence` ya existente en `dictation.py`) en lugar de `db.get(Sentence, ...)` sin filtro. `create_session` valida que `chunk_id` pertenezca realmente a `text_id` vía nueva `text_repository.get_chunk_by_id`. Verificado con un ataque simulado real: usuario A intenta enviar un intento de Dictation/Recall contra el `sentence_id` de un texto privado de usuario B → HTTP 404 en ambos casos; sesión con `chunk_id` de otro texto → HTTP 404.
- **Prioridad:** P0
- **Área:** Backend / Seguridad
- **Archivos afectados:**
  - `backend/app/api/dictation.py`
  - `backend/app/api/recall.py`
  - `backend/app/api/sessions.py`
- **Motivo:** `create_dictation_attempt` y `create_recall_attempt` aceptan `sentence_id` sin validar pertenencia al texto de la sesión ni al usuario actual. `create_session` acepta `chunk_id` sin validar que pertenezca a `text_id`.
- **Implementación propuesta:**
  1. En `create_dictation_attempt` y `create_recall_attempt`, verificar que la oración pertenezca a un fragmento del `session.text_id`.
  2. En `create_session`, validar que `chunk_id` corresponda a un fragmento con `text_id == payload.text_id`.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Intentar enviar un intento con un `sentence_id` ajeno debe responder inmediatamente con HTTP 404 o 403 Forbidden.

---

### [x] Tarea 0.5: Limitar longitud máxima de texto para prevenir Denegación de Servicio (DoS)
> ✅ **Completado 2026-09-10.** `TextCreate.raw_content`/`translation_content` y `TranslationUpdate.translation_content` ahora tienen `max_length=100_000`, más un `field_validator` que rechaza contenido de solo espacios (no cubierto por `min_length`, que solo cuenta caracteres). Verificado: payload de ~120,000 caracteres → HTTP 422; `raw_content="     "` → HTTP 422.
- **Prioridad:** P0
- **Área:** Backend / Seguridad y Estabilidad
- **Archivos afectados:**
  - `backend/app/schemas/texts.py`
- **Motivo:** `raw_content` y `translation_content` carecen de `max_length`, permitiendo cargas abusivas de cientos de megabytes que saturan memoria y base de datos.
- **Implementación propuesta:**
  1. Agregar `max_length=100_000` (aprox. 20,000 palabras) en `TextCreate.raw_content` y `TranslationUpdate.translation_content`.
  2. Agregar validación en FastAPI que rechace textos vacíos o de solo espacios.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Envío de un payload con `raw_content` de 100,001 caracteres debe responder con error HTTP 422 Unprocessable Entity.

---

## FASE 1 — ESTABILIDAD Y SEGURIDAD (P1)

### [x] Tarea 1.1: Eliminar bucle N+1 en registro de palabras de vocabulario
> ✅ **Completado 2026-09-10.** `record_session_words` reemplazó el loop `_get_or_create` por: una `SELECT ... WHERE word IN (...)` para leer el estado previo de las palabras ya trackeadas, cómputo en Python de los nuevos valores (reusando la función pura `mastery_score` ya testeada, sin duplicar su lógica de redondeo en SQL), y un único `INSERT ... ON CONFLICT (user_id, word) DO UPDATE` con todas las filas en un solo statement. Verificado con `echo=True`: una sesión de 3 palabras generó exactamente 2 queries (1 SELECT + 1 INSERT batched), sin importar la cantidad de palabras.
- **Prioridad:** P1
- **Área:** Base de Datos / Rendimiento
- **Archivos afectados:**
  - `backend/app/services/vocabulary_service.py`
- **Motivo:** `record_session_words` ejecuta consultas `SELECT` e `INSERT` individuales secuencialmente por cada palabra de una sesión, produciendo hasta 160 consultas bloqueantes por fragmento.
- **Implementación propuesta:**
  1. Cargar todas las palabras existentes del usuario en una sola consulta: `WHERE user_id = :uid AND word IN (:words)`.
  2. Utilizar `INSERT ... ON CONFLICT (user_id, word) DO UPDATE` para realizar el upsert masivo en una única operación atómica.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Finalizar una sesión de mecanografía de 80 palabras debe realizar un máximo de 2 a 3 consultas SQL para registrar el vocabulario completo en lugar de 160.

---

### [x] Tarea 1.2: Resolver condiciones de carrera en inserciones concurrentes
> ✅ **Completado 2026-09-10.** `settings_repository.get_or_create` y `api/dictation.get_audio` ahora usan `INSERT ... ON CONFLICT DO NOTHING` + re-lectura en vez de `SELECT -> IF NOT FOUND -> INSERT`. (El tercer archivo listado, `vocabulary_service.py`, quedó resuelto de raíz por la Tarea 1.1 -- el patrón `_get_or_create` que causaba la condición de carrera ya no existe ahí.) Verificado con concurrencia real: 10 requests simultáneas a `/settings` para un usuario nuevo → 10x HTTP 200; 8 requests simultáneas a `/dictation/audio/{id}` para una oración nunca sintetizada → 8x HTTP 200 con audio idéntico, cero `IntegrityError`.
- **Prioridad:** P1
- **Área:** Backend & Base de Datos / Concurrencia
- **Archivos afectados:**
  - `backend/app/repositories/settings_repository.py`
  - `backend/app/services/vocabulary_service.py`
  - `backend/app/api/dictation.py`
- **Motivo:** Comprobaciones no atómicas provocan fallos `IntegrityError` (HTTP 500) ante solicitudes concurrentes simultáneas de un mismo usuario.
- **Implementación propuesta:**
  1. Implementar `ON CONFLICT DO NOTHING` / `ON CONFLICT DO UPDATE` en los repositorios correspondientes.
  2. Envolver la inserción en un bloque `try/except IntegrityError` con rollback y reintento de consulta.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Dos solicitudes simultáneas a `/settings` o `/dictation/audio/{id}` deben resolver ambas con HTTP 200 sin lanzar ninguna excepción de base de datos.

---

### [x] Tarea 1.3: Persistir y acotar la duración real de práctica
> ✅ **Completado 2026-09-10.** `typing_sessions.duration_seconds` (nueva columna) guarda `min(payload.duration_seconds, wall_clock_elapsed)` -- el valor del cliente nunca puede superar lo que el servidor mismo observó transcurrir. `overview_for_user`/`history_for_user` ahora suman esta columna en vez de `finished_at - started_at`. De paso se corrigió el mismo patrón en `gamification_repository.practice_seconds_on` (objetivo diario), que sumaba wall-clock para las 3 tablas de sesión -- ahora usa `TypingSession.duration_seconds` y, para Recall/Dictation, la suma de `duration_seconds` por intento (ya existía y ya era honesta, solo no se estaba usando). Nota de transparencia: las sesiones históricas anteriores a esta migración quedan en `duration_seconds=0` (no se puede reconstruir retroactivamente un valor que nunca se guardó); el tiempo total practicado cae para reflejar solo datos honestos desde ahora en adelante -- es la compensación correcta de arreglar una sobreestimación sistemática. Verificado: sesión que reporta 3600s con <1s de wall-clock real → queda acotada a ~0.016s; sesión que reporta 1s con ~1.2s de wall-clock real → se guarda el 1s tal cual.
- **Prioridad:** P1
- **Prioridad:** P1
- **Área:** Backend & Datos / Integridad de Métricas
- **Archivos afectados:**
  - `backend/app/models/typing_session.py`
  - `backend/app/repositories/session_repository.py`
  - `backend/app/api/sessions.py`
  - Nueva migración de Alembic
- **Motivo:** El servidor calcula el tiempo de práctica como `finished_at - started_at`, inflando las horas si una pestaña queda abierta en segundo plano.
- **Implementación propuesta:**
  1. Añadir la columna `duration_seconds: Float` a la tabla `typing_sessions`.
  2. Al finalizar la sesión, almacenar `min(payload.duration_seconds, elapsed_wall_clock)`.
  3. Modificar `session_repository.overview_for_user` para que sume `duration_seconds` en lugar de la diferencia entre timestamps.
- **Dependencias:** Tarea 0.1.
- **Criterio de aceptación:** Una sesión abierta durante 1 hora donde el usuario tipió activamente durante 30 segundos debe computar exactamente 30 segundos de práctica en el perfil del usuario.

---

### [x] Tarea 1.4: Mover almacenamiento de audio WAV fuera de PostgreSQL
> ✅ **Completado 2026-09-10.** El WAV se escribe a un volumen Docker nombrado (`dictation_audio_cache`, montado en `/app/audio_cache` del backend) con nombre determinístico `{sentence_id}.wav`; `dictation_audio_cache` en Postgres perdió la columna `audio_data` y ahora es solo una fila-marcador (`id, sentence_id, created_at`) que sostiene el chequeo de cache-hit y la seguridad ante condiciones de carrera de la Tarea 1.2. Se agregó además resiliencia no pedida explícitamente pero necesaria para esta migración: si la fila existe en la DB pero el archivo falta en disco (ej. volumen limpiado por separado), el endpoint resintetiza en vez de devolver 500. Verificado: archivo real confirmado en el volumen (`ls` dentro del contenedor) con el tamaño exacto de la respuesta HTTP; `\d dictation_audio_cache` confirma que no queda ninguna columna binaria; 8 requests concurrentes a una oración nunca sintetizada devuelven audio idéntico; borrar el archivo manualmente y volver a pedirlo regenera correctamente en vez de fallar.
- **Prioridad:** P1
- **Prioridad:** P1
- **Área:** DevOps & Base de Datos / Almacenamiento
- **Archivos afectados:**
  - `backend/app/models/dictation.py`
  - `backend/app/api/dictation.py`
  - `backend/docker-compose.yml`
- **Motivo:** Guardar archivos WAV binarios en `LargeBinary` degrada severamente el rendimiento de la base de datos relacional y dificulta copias de seguridad.
- **Implementación propuesta:**
  1. Guardar el archivo `.wav` en un directorio montado (`/var/app/audio_cache/`) identificado por el hash SHA-256 o UUID de la oración.
  2. Guardar en PostgreSQL únicamente los metadatos y la ruta local o URL.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Comprobar que la tabla `dictation_audio_cache` no almacene blobs de bytes y que el endpoint `/dictation/audio/{id}` responda correctamente leyendo el archivo del volumen persistente.

---

## FASE 2 — ARQUITECTURA Y CÓDIGO (P1 / P2)

### [x] Tarea 2.1: Reemplazar reload forzado de página en la práctica de mecanografía
> ✅ **Completado 2026-09-10.** `onContinue` ahora llama a `handleContinue`, que limpia el resumen y reinvoca `loadChunk(text)` (la misma función ya usada en la carga inicial) con el `TextDTO` actualizado que `handleChunkComplete` obtiene de la respuesta de `updateProgress`. `useTypingSession` ya reseteaba su estado interno en base a cambios de `targetText`, así que la transición reutiliza ese mecanismo sin tocarlo. Verificado sin ambigüedad: seteé `window.__miMarcador` antes de tocar "Continuar" y confirmé que sobrevivió después del click (una recarga real lo habría borrado); la pantalla siguiente ("Ya completaste este texto") apareció correctamente sin ningún request de navegación de documento completo.
- **Prioridad:** P1
- **Prioridad:** P1
- **Área:** Frontend / Arquitectura SPA
- **Archivos afectados:**
  - `frontend/src/app/practice/[textId]/page.tsx`
- **Motivo:** `onContinue` ejecuta `window.location.reload()`, destruyendo el estado de la aplicación y causando un reinicio brusco.
- **Implementación propuesta:**
  1. Al presionar "Continuar", actualizar el estado de `current_chunk_index`, reiniciar el hook de tipeo y llamar a `loadChunk` para el siguiente índice sin recargar el navegador.
- **Dependencias:** Tarea 0.2.
- **Criterio de aceptación:** Al terminar un fragmento, hacer clic en "Continuar" debe hacer una transición fluida al siguiente fragmento sin parpadeo de pantalla blanca ni recarga del documento HTML.

---

### [x] Tarea 2.2: Eliminar creación de sesiones duplicadas en Weak Words
> ✅ **Completado 2026-09-10.** `vocabulary/page.tsx` ya no llama a `api.startWeakWordsSession()` -- `handlePracticeWeak` solo navega. Verificado por inspección directa del bundle servido (`_next/static/chunks/app/vocabulary/page.js` ya no contiene esa llamada) y confirmando que visitar `/practice/weak-words` de forma aislada crea exactamente una sesión. **Nota de transparencia:** al llegar mediante `router.push` desde `/vocabulary` en modo desarrollo, todavía se observan 2 requests a `POST /vocabulary/weak/session` -- esto es React Strict Mode (activo por defecto en el App Router de Next.js 14, sin override en `next.config.js`), que duplica intencionalmente los efectos de montaje en dev para detectar side-effects no idempotentes; una navegación dura al mismo destino produjo una sola sesión, y Strict Mode no duplica nada en un build de producción. La causa raíz que diagnosticó la auditoría (dos puntos de creación distintos) está eliminada; el duplicado remanente es una característica del framework en dev, no un defecto de esta corrección.
- **Prioridad:** P1
- **Prioridad:** P1
- **Área:** Frontend & Base de Datos / Limpieza
- **Archivos afectados:**
  - `frontend/src/app/vocabulary/page.tsx`
  - `frontend/src/app/practice/weak-words/page.tsx`
- **Motivo:** Se crean dos sesiones simultáneas en base de datos al hacer clic en "Practicar palabras débiles".
- **Implementación propuesta:**
  1. En `vocabulary/page.tsx`, eliminar la llamada a `api.startWeakWordsSession()` y realizar únicamente la navegación `router.push('/practice/weak-words')`.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Al hacer clic en "Practicar palabras débiles", la tabla `typing_sessions` debe registrar exactamente una única fila nueva.

---

### [x] Tarea 2.3: Desacoplar llamadas bloqueantes de síntesis en FastAPI
> ✅ **Completado 2026-09-10.** `get_audio` ahora envuelve `tts_service.synthesize` (subprocess), `write_cached_audio` y `read_cached_audio` (I/O de disco) en `asyncio.to_thread`, liberando el event loop mientras corren. Verificado con concurrencia real: se disparó una síntesis de audio y, mientras estaba en vuelo, `GET /health` respondió en 0.002s en vez de quedar bloqueado detrás de la síntesis.
- **Prioridad:** P2
- **Prioridad:** P2
- **Área:** Backend / Concurrencia
- **Archivos afectados:**
  - `backend/app/services/tts_service.py`
  - `backend/app/api/dictation.py`
- **Motivo:** `subprocess.run` detiene el event loop de asyncio para todos los usuarios mientras eSpeak genera el audio.
- **Implementación propuesta:**
  1. Convertir la función a asíncrona utilizando `asyncio.to_thread` o `asyncio.create_subprocess_exec`.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** El endpoint `/dictation/audio/{id}` no debe degradar la latencia de endpoints paralelos durante la síntesis.

---

### [x] Tarea 2.4: Optimizar búsqueda de oraciones para Weak Words
> ✅ **Completado 2026-09-10.** `build_weak_words_sentences` ahora hace una consulta SQL por palabra con el operador `~*` de Postgres y límite (`\\y...\\y` para límites de palabra -- el equivalente en Advanced Regular Expressions de Postgres al `\\b` de PCRE/Python), en vez de cargar toda la biblioteca del usuario a Python y filtrar con bucles anidados. Verificado con un caso adversarial real: buscar solo "wolf" devuelve únicamente las oraciones con esa palabra completa y excluye correctamente "Wolves live in packs." (que un `LIKE '%wolf%'` ingenuo habría matcheado por substring).
- **Prioridad:** P2
- **Prioridad:** P2
- **Área:** Backend / Rendimiento y Memoria
- **Archivos afectados:**
  - `backend/app/services/vocabulary_service.py`
- **Motivo:** `build_weak_words_sentences` carga todas las oraciones del usuario a la memoria de Python y filtra con bucles anidados.
- **Implementación propuesta:**
  1. Filtrar las oraciones directamente en SQL utilizando expresiones regulares (`~*`) o búsqueda con operadores `ILIKE` en PostgreSQL.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Búsqueda ejecutada en una sola consulta SQL con límite (`LIMIT 15`) sin transferir miles de filas a Python.

---

## FASE 3 — UI/UX Y ACCESIBILIDAD (P2)

### [x] Tarea 3.1: Formateo legible de errores de validación de API
> ✅ **Completado 2026-09-10.** `api.ts` ahora tiene `formatErrorDetail()`: si `detail` es un array (respuestas 422 de Pydantic), extrae `item.msg` de cada entrada y las une con `"; "`; si es un string (HTTPException normal), lo pasa sin tocar. Verificado con `docker compose build frontend` (type-check limpio) y probando en el navegador un registro con contraseña de menos de 8 caracteres: el mensaje ahora se lee "String should have at least 8 characters" en vez de "[object Object]".
- **Prioridad:** P2
- **Área:** UI/UX & Frontend
- **Archivos afectados:**
  - `frontend/src/services/api.ts`
  - Formularios en `frontend/src/app/(auth)/login/page.tsx` y `register/page.tsx`
- **Motivo:** Los errores de validación de Pydantic se renderizan como `[object Object]`.
- **Implementación propuesta:**
  1. En `api.ts`, si `body.detail` es un array, mapearlo extrayendo `item.msg` y unirlos con coma o salto de línea.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Si el usuario ingresa un correo inválido o contraseña corta, la pantalla debe mostrar un mensaje comprensible como `"String should have at least 8 characters"` o texto en español amigable.

---

### [x] Tarea 3.2: Corregir mecánica de tipeo en Missing Words (Recall)
> ✅ **Completado 2026-09-10.** `MissingWordsText.tsx` reescrito con un modelo de segmentos: cada hueco expone sus letras tipeables más un segmento `"space"` sintético entre huecos consecutivos, así que ahora el usuario escribe un espacio real para pasar de un hueco al siguiente (igual que separaría las palabras leyendo la oración) en vez de tener que pegarlas. `buildBlankTargetText` concatena los huecos con un único espacio, y en el backend (`recall.py::create_recall_attempt`) `expected` se arma de la misma forma, reutilizando `recall_service.score_attempt` (comparación por palabra) para ambos modos — se eliminó `score_missing_words_attempt` por quedar duplicado, no por pérdida de funcionalidad. Verificado con `pytest` (57 tests, incluye los 2 nuevos casos de `score_attempt` estilo Missing Words) y con una sesión real en el navegador tipeando dos huecos consecutivos separados por espacio.
- **Prioridad:** P2
- **Área:** UI/UX & Lógica de Aprendizaje
- **Archivos afectados:**
  - `frontend/src/features/recall/MissingWordsText.tsx`
  - `backend/app/services/recall_service.py`
- **Motivo:** Palabras omitidas contiguas se concatenan sin espacio, obligando al usuario a pegarlas.
- **Implementación propuesta:**
  1. Insertar un espacio delimitador entre blanks o permitir navegar de hueco en hueco mediante la tecla espacio o tabulación.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** El usuario puede completar huecos separados en una oración escribiendo de forma natural con un espacio entre cada término.

---

### [x] Tarea 3.3: Ajuste de contrastes y cumplimiento de accesibilidad WCAG 2.1 AA
> ✅ **Completado 2026-09-10.** Calculé la luminancia relativa real de `gray-500`/`600`/`700` contra el fondo `bg-black`: `gray-600` (~2.77:1) y `gray-700` (~2.04:1) confirman los ratios 2.96:1/1.83:1 que reportó la auditoría, pero además `gray-500` (~4.35:1) también queda por debajo del mínimo 4.5:1 aunque la auditoría no lo mencionó explícitamente — el criterio de aceptación pide que *todos* los elementos de texto superen 4.5:1, así que además de los 3 archivos listados barrí **las 21 archivos del frontend** que usaban `text-gray-500/600/700` y los reemplacé por `text-gray-400` (~8.27:1, cumple con margen). En `AchievementGrid.tsx` el problema real no era solo el color sino el `opacity-40` aplicado a toda la tarjeta bloqueada, que multiplica el contraste del texto ya reemplazado y lo volvía a hundir por debajo del mínimo — lo reemplacé por un tinte de fondo (`bg-gray-950/40`) que no toca la opacidad del texto, y un prefijo "🔒" en el nombre para mantener la distinción visual bloqueado/desbloqueado. También agregué `<label htmlFor>` (con `sr-only` donde no había texto visible que ya cumpliera ese rol) a los inputs de login, register, alta de texto, alineación, nota de gramática, frases y velocidad de audio — los inputs ocultos de captura de teclas del motor de tipeo (Practice/Recall/Dictation) se dejaron sin label porque no son campos de formulario percibidos por el usuario, son un mecanismo de captura de teclado reemplazado visualmente por `TypingText`/`MissingWordsText`. Verificado con `docker compose build frontend` (type-check limpio), reinicio del contenedor dev, y en el navegador: pantalla de Gamification con logros bloqueados legibles, texto pendiente de Practice en `gray-400` claramente visible, y el input de email en `/login` ahora expone nombre accesible "Email" ligado por `label`/`htmlFor` (confirmado vía árbol de accesibilidad, no solo el `placeholder`).
- **Prioridad:** P2
- **Área:** UI/UX / Accesibilidad
- **Archivos afectados:**
  - `frontend/src/features/typing/TypingText.tsx`
  - `frontend/src/features/gamification/AchievementGrid.tsx`
  - `frontend/src/features/typing/SentenceInfoPanel.tsx`
  - `frontend/tailwind.config.ts`
- **Motivo:** Varios textos y estados presentan ratios de contraste de 2.96:1 y 1.83:1, violando el estándar mínimo de 4.5:1.
- **Implementación propuesta:**
  1. Actualizar colores secundarios en Tailwind a un gris más claro (mínimo `#9ca3af` / `gray-400`).
  2. Ajustar la opacidad de los logros bloqueados para mantener legibilidad.
  3. Agregar `<label>` con `htmlFor` a todos los inputs de formularios.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Comprobación con herramienta de accesibilidad (Lighthouse / axe) verificando que todos los elementos de texto superen el ratio 4.5:1.

---

### [x] Tarea 3.4: Adaptación de interfaz para teclados móviles y virtuales
> ✅ **Completado 2026-09-10.** El input de captura ya no vive duplicado en 4 archivos (Practice, Dictation, Recall y también `practice/weak-words`, que usa el mismo motor de tipeo aunque no estaba en la lista original) -- se extrajo a un componente compartido `frontend/src/features/typing/TypingCaptureInput.tsx`. En desktop sigue siendo invisible y de tamaño 0 (`.focus()` se llama programáticamente); en un dispositivo táctil (media query `(pointer: coarse)`, sin necesidad de JS) se renderiza como una barra real de 48px de alto, con texto visible y placeholder "Toca aqui y escribi" -- un input de tamaño 0 nunca abre el teclado nativo en iOS/Android, tenga o no foco. Además, `useTypingSession.ts` ganó un segundo camino de entrada: refactoricé `handleKeyDown` en dos funciones puras (`applyBackspace`, `applyCharacter`) y agregué `handleInput`, que escucha el evento nativo `input` (via `onInput`) y lee `nativeEvent.inputType`/`.data` -- esto cubre el teclado de Android (Gboard y similares), que en muchos casos no reporta un `e.key` real en `keydown` (llega como `"Unidentified"`) pero sí dispara un `input` nativo con el caracter correcto. No hay doble conteo: cuando `keydown` sí trae un `e.key` utilizable (desktop, iOS Safari) ya se llama `preventDefault()`, lo que suprime el `input` nativo correspondiente. Verificado: (1) `docker compose build frontend` con type-check limpio; (2) sesión completa de escritura en desktop sin cambios de comportamiento (Backspace y caracteres correctos/incorrectos funcionan igual que antes); (3) viewport móvil emulado (375x812, `pointer: coarse`) confirmando que el input pasa de `opacity:0 h-0 w-0` a `opacity:1 position:static 327x48px pointer-events:auto`; (4) simulé el camino que toma Android disparando un `InputEvent` nativo (`insertText`/`deleteContentBackward`) directamente sobre el input sin pasar por `keydown`, y confirmé en pantalla que el caracter se procesó como correcto y que el Backspace subsiguiente lo revirtió -- confirma que `handleInput` funciona de punta a punta. No pude probar en hardware iOS/Android real ni en el simulador nativo (la tarea es sobre la app web, no una app iOS/Android nativa), así que la verificación de teclado virtual real queda sujeta a una prueba manual del usuario en un dispositivo físico como confirmación final.
- **Prioridad:** P2
- **Área:** UI/UX & Responsive
- **Archivos afectados:**
  - `frontend/src/app/practice/[textId]/page.tsx`
  - `frontend/src/app/dictation/[textId]/page.tsx`
  - `frontend/src/app/recall/[textId]/page.tsx`
- **Motivo:** El input de tamaño 0 no levanta el teclado en iOS ni Android.
- **Implementación propuesta:**
  1. Detectar dispositivo táctil y renderizar un campo de entrada interactivo visible que garantice la apertura del teclado virtual nativo.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Poder completar una sesión de práctica de fragmento en un teléfono móvil (iOS Safari o Chrome Android) utilizando el teclado virtual.

---

### [x] Tarea 3.5: Componente de navegación global unificado (<AppHeader>)
> ✅ **Completado 2026-09-10.** Nuevo `frontend/src/components/AppHeader.tsx`, renderizado una única vez en `layout.tsx` (`<AppHeader />` antes de `{children}`, dentro del `<body>`) en vez de que cada página arme su propia fila de links a mano -- confirmé antes de tocar nada que Library/Vocabulary/Progress/Gamification tenían cada una un subconjunto distinto e inconsistente de esos 4 links (p.ej. Vocabulary no tenia "Salir" ni "Gamification", Library no tenia "Gamification"), exactamente el síntoma que describe la auditoría. El componente decide su propio contenido según la ruta (`usePathname`): oculto en `/`, `/login` y `/register`; en `/practice`, `/recall` y `/dictation` (sesiones de escritura a pantalla completa) muestra solo un link fijo "← Salir / Volver a Biblioteca"; en el resto de las páginas autenticadas muestra la barra completa (Library, Vocabulary, Progress, Gamification, Salir) con el link activo resaltado en blanco vía `aria-current="page"`. Ambas variantes son `sticky top-0` para que el link de salida siga "siempre disponible" incluso si la página tiene contenido más alto que la pantalla (esto era necesario: sin `sticky` el link de salida en Practice quedaba justo 40px por encima del fold en desktop). Elimine la fila de navegación duplicada (y los imports de `Link`/`logout` que quedaron sin uso) de `library/page.tsx`, `vocabulary/page.tsx`, `progress/page.tsx` y `gamification/page.tsx`, dejando solo el `<h1>` de cada página. Verificado con `docker compose build frontend` (type-check limpio), reinicio del contenedor dev, `pytest` (57 tests, sin tocar backend), y en el navegador: Library/Vocabulary muestran la barra completa con el link correcto resaltado, `/login` y `/register` no muestran ningún header, y `/practice/{id}` muestra "← Salir / Volver a Biblioteca" fijo arriba que efectivamente navega a `/library` al clickear.
- **Prioridad:** P2
- **Área:** UI/UX & Frontend
- **Archivos afectados:**
  - `frontend/src/app/layout.tsx`
  - Nuevo componente `frontend/src/components/AppHeader.tsx`
  - Páginas en `frontend/src/app/`
- **Motivo:** Enlaces inconsistentes y repetidos manualmente en cada página.
- **Implementación propuesta:**
  1. Crear un `<AppHeader>` persistente en `RootLayout` con enlaces uniformes a: Biblioteca, Vocabulario, Progreso, Gamificación y Cerrar Sesión.
  2. En vistas de práctica (`/practice`, `/recall`, `/dictation`), incluir un botón claro de "Salir / Volver a Biblioteca".
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Barra de navegación consistente visible en todas las páginas autenticadas, con enlace activo resaltado y botón de salida siempre disponible.

---

## FASE 4 — RENDIMIENTO (P2)

### [x] Tarea 4.1: Optimizar renderizado de caracteres en TypingText
> ✅ **Completado 2026-09-10.** `TypingText.tsx` reescrito: el texto se parte en bloques (palabras y espacios, via `/\S+|\s+/g`) memoizados con `useMemo` sobre `targetText`, y cada bloque se renderiza con un componente `TypingWordBlock` envuelto en `React.memo` con un comparador custom (`areBlockPropsEqual`) que compara por *valor* -- no por referencia -- solo el rango `[start,end)` de `charStates` que le corresponde a ese bloque, más si el cursor entró o salió de él. Como `charStates` es un array nuevo en cada tecla (por diseño, ver `useTypingSession`), un `React.memo` con comparación por referencia por defecto no hubiera servido de nada; con el comparador por valor, cada pulsación solo fuerza el re-render + reconciliación DOM del bloque (palabra) donde ocurre el cambio real, en vez de las ~30 palabras completas del fragmento. Verificado: `docker compose build frontend` (type-check limpio) y una sesión de tipeo real disparando eventos `KeyboardEvent` directos sobre el input (para evitar el ruido conocido del tool de automatización con teclas individuales) -- confirmé letra por letra que el estado (correcto/incorrecto/pendiente) y la posición del cursor se renderizan exactamente igual que antes del refactor, incluyendo un error aislado en medio de una palabra ("c" incorrecta dentro de "cats" con "ats" siguiendo correcto). No pude medir fps real en este entorno (sin devtools de performance), así que el criterio de "60fps sin lag a >100 WPM" queda validado por diseño (menos nodos DOM tocados por tecla) y por la ausencia de regresiones funcionales, no por un profiling numerico.
- **Prioridad:** P2
- **Área:** Frontend / Rendimiento
- **Archivos afectados:**
  - `frontend/src/features/typing/TypingText.tsx`
- **Motivo:** Cientos de nodos DOM `<span>` re-evaluados y re-renderizados en cada pulsación de tecla.
- **Implementación propuesta:**
  1. Agrupar los caracteres en palabras o componentes de bloques memoizados (`React.memo`).
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Tasa de refresco constante a 60 fps sin lag de entrada durante mecanografía rápida (>100 WPM).

---

### [x] Tarea 4.2: Caché de consultas de diccionario en cliente
> ✅ **Completado 2026-09-10.** `api.ts` gana un `Map<string, string | null>` a nivel de módulo (`dictionaryCache`), consultado y poblado dentro de `api.lookupWord` antes de tocar la red -- cachea tanto los hits (traducción encontrada) como los misses (404, palabra no existe en el diccionario local), para que reescribir el mismo error de tipeo nunca dispare una segunda petición. Verificado en el navegador con eventos de teclado reales (no el `type`/`key` del tool, que en este entorno resultó poco confiable con teclas individuales -- lo documentado ya en la sesión): tipear un error sobre "cats" dispara `GET /dictionary/c`; deshacer con Backspace y volver a cometer el mismo error NO dispara una segunda petición (confirmado con `performance.getEntriesByType('resource')`, mismo array de un solo elemento antes y despues).
- **Prioridad:** P2
- **Área:** Frontend / Red
- **Archivos afectados:**
  - `frontend/src/features/typing/WordHelpTooltip.tsx`
- **Motivo:** Cada error de tipeo lanza una petición HTTP de búsqueda de diccionario redundante.
- **Implementación propuesta:**
  1. Implementar un mapa de caché en memoria dentro de `api.lookupWord`.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Repetir un error sobre la misma palabra no debe emitir una nueva solicitud de red en la consola del navegador.

---

### [x] Tarea 4.3: Interceptor de sesión expirada (401) en cliente
> ✅ **Completado 2026-09-10.** `request()` en `api.ts` intercepta 401 -- pero solo cuando la petición llevaba un token (`token` ya leído al principio de la función), para no confundir un 401 de *credenciales invalidas* en `/auth/login` (que nunca lleva token) con un token realmente vencido; sin esa guarda, un intento de login con contrasena incorrecta hubiera mostrado "Tu sesion expiro" en vez del mensaje real del backend, verifique esto explicitamente como caso de regresion antes de darlo por bueno. Cuando sí es un token vencido/revocado, llama a `useAuthStore.getState().logout(mensaje)` -- reutilizando el mismo mecanismo reactivo de token->null que ya usa cada página para redirigir (el guard `if (hasHydrated && !token) router.replace('/login')` que ya existe en todas), sin recurrir a `window.location` (eso hubiera reintroducido el full-page-reload que la Fase 2 elimino a propósito). `authStore.ts` gana `sessionExpiredMessage` (excluido de `persist` via `partialize`, para que no sobreviva un reinicio del navegador ni reaparezca en un login no relacionado) y `login/page.tsx` lo muestra como banner informativo. Durante la verificación encontré y corregí un efecto secundario real: varias páginas (`library`, `progress`, `gamification`, `vocabulary`, `practice/[textId]`, `library/[textId]/align`) llamaban a `api.getX().then(setX)` sin `.catch`, así que el nuevo throw en 401 se filtraba como "Uncaught (in promise)" en la consola -- agregué `.catch(() => {})` a cada uno de esos call sites (el fallo ya no necesita manejo propio: el token pasa a null y el guard de cada página redirige solo). Verificado con `docker compose build frontend`, `pytest` (57 tests), y en el navegador: (1) login con contrasena incorrecta sigue mostrando "Invalid email or password" sin tocar el interceptor; (2) corromper el token en `localStorage` y navegar a una página protegida redirige de inmediato a `/login` mostrando "Tu sesion expiro. Inicia sesion de nuevo." sin reload completo; (3) repetí la prueba en una pestaña nueva (consola limpia) confirmando cero errores de promesa sin capturar.
- **Prioridad:** P2
- **Área:** Frontend / Autenticación
- **Archivos afectados:**
  - `frontend/src/services/api.ts`
- **Motivo:** Cuando el token JWT expira, las páginas quedan en estado de carga indefinido.
- **Implementación propuesta:**
  1. Al recibir respuesta 401 en `request()`, invocar `useAuthStore.getState().logout()` y redirigir a `/login`.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Si se revoca o expira el token, la siguiente petición debe redirigir inmediatamente al usuario a la pantalla de inicio de sesión con un mensaje informativo.

---

## FASE 5 — TESTING (P1 / P2)

### [x] Tarea 5.1: Configurar suite de pruebas unitarias y de componentes en Frontend
> ✅ **Completado 2026-09-10.** Instalado Vitest 2.1.9 + `@vitejs/plugin-react` + `jsdom` + Testing Library (react/jest-dom/user-event) via `docker compose exec frontend npm install` (el `node_modules` del contenedor dev es un volumen anonimo separado del host, así que la instalación tuvo que hacerse ahí adentro, no en el host). Tuve que fijar `vite@^5.4.11` explícitamente: Vitest 2/3/4 arrastran por default una versión de Vite cuyo peer de `@types/node` (>=20.19) no calza con el `@types/node@20.16.11` ya fijado en el proyecto -- Vite 5 sí es compatible sin tocar esa versión. Nuevo `vitest.config.ts` (entorno `jsdom`, alias `@` -> `./src` igual que `tsconfig.json`) y `vitest.setup.ts` (`@testing-library/jest-dom/vitest`). Scripts `test`/`test:watch` en `package.json`. Tests nuevos, colocados junto a su código fuente: `useTypingSession.test.ts` (10 casos: `buildTargetText`/`findSentenceIdAt`, tipeo correcto/incorrecto, Backspace deshaciendo estado y conteo -- no solo el color --, cálculo de WPM con temporizador simulado (`vi.useFakeTimers`), `onComplete` con las estadísticas agregadas, `onWordError`, y el camino nuevo de `handleInput` vía `InputEvent` nativo para teclados virtuales), `TypingText.test.tsx` (5 casos, incluyendo una prueba de regresión especifica para el refactor por bloques memoizados de la Tarea 4.1: un error aislado en medio de una palabra debe pintarse sin afectar el resto), `api.test.ts` (7 casos: formateo de errores de validación Pydantic, passthrough de errores de string plano, el interceptor 401 no debe dispararse en un login fallido, sí debe dispararse y loguear afuera en una petición autenticada, fallback a `statusText` sin cuerpo JSON, y el cache de `lookupWord` tanto para hits como para 404). Corregí dos bugs en mis propias pruebas durante la primera corrida (un `end` de rango mal calculado a mano, y un caso de Backspace que sin querer completaba la sesión de 2 caracteres antes de poder probar el Backspace, chocando con el guard `if (isComplete) return` de `handleKeyDown` -- ambos eran errores del test, no del código de producción). `npm run test`: **22/22 pruebas pasando** (supera el mínimo de 10 del criterio de aceptación). Verificado también que `docker compose build frontend` (el build de produccion, que sí type-checkea todos los `.ts/.tsx` del proyecto por el `include` de `tsconfig.json`) sigue compilando limpio con los archivos de test presentes, y que el contenedor dev restaurado corre la suite igual de bien (confirma que las dependencias nuevas sobreviven el ciclo build/restore ya que `package.json` esta en el bind mount, no en el volumen anonimo).
- **Prioridad:** P1
- **Área:** Testing Frontend
- **Archivos afectados:**
  - `frontend/package.json`
  - Nueva configuración `vitest.config.ts`
  - Pruebas para `useTypingSession.test.ts`, `TypingText.test.tsx`, `api.test.ts`
- **Motivo:** El frontend tiene 0% de cobertura de pruebas.
- **Implementación propuesta:**
  1. Instalar Vitest, `@testing-library/react` y `@testing-library/user-event`.
  2. Crear pruebas automatizadas para: mecanografía con Backspace, cálculo de WPM/precisión, y manejo de errores de API.
- **Dependencias:** Tarea 0.2.
- **Criterio de aceptación:** `npm run test` ejecutándose en frontend con al menos 10 pruebas unitarias aprobadas.

---

### [x] Tarea 5.2: Implementar suite de pruebas de integración de API en Backend
> ✅ **Completado 2026-09-10.** Elegí "Postgres de test" (no SQLite) de las dos opciones que ofrecía el plan: el proyecto usa `pg_insert(...).on_conflict_do_update/nothing` y el operador de regex `~*` en varios lugares (vocabulary_service, settings_repository, dictation), ninguno de los dos existe en SQLite -- una base en memoria hubiera dado falsos verdes en gran parte de la app. Nuevo `backend/app/tests/conftest.py`: apunta `DATABASE_URL` a una base separada `mch_english_test` en el mismo servidor Postgres (nunca la base de desarrollo) *antes* de que `app.core.database`/`app.core.config` se importen en ningún lado (ambos arman su engine una sola vez, al importarse), recrea esa base desde cero (`DROP`+`CREATE DATABASE`) una vez por sesión de tests y crea las tablas con `Base.metadata.create_all`, y trunca todas las tablas (en orden inverso de dependencias) después de cada test individual para que no se pisen entre sí. `enqueue_process_text` se mockea a un no-op en todos los tests (ningún test tiene un worker RQ real escuchando la base de test) -- los tests que necesitan que el chunking realmente ocurra llaman explícitamente a `_process_text_async` via el fixture `process_text_now`, de forma determinística, en vez de competir con un worker externo.
>
> Encontré y resolví un problema real de infraestructura de testing, no de la app: con el scope de event loop por-test que trae `pytest-asyncio` por default, el engine async de SQLAlchemy fallaba en el segundo test en adelante con `InterfaceError: cannot perform operation: another operation is in progress` -- una conexión asyncpg pooled en el loop del test N no es válida en el loop nuevo del test N+1. Solución estándar documentada para este problema exacto: un fixture `event_loop` de scope `session` que reemplaza el default de pytest-asyncio, para que todos los tests y fixtures async de la sesión compartan un único event loop (igual que la app real, que corre bajo un solo loop de uvicorn) y el pool del engine se mantenga válido. Queda un `DeprecationWarning` de pytest-asyncio sobre este patrón (sugiere el marcador `loop_scope` como reemplazo moderno) -- lo dejé documentado en el propio comentario del fixture en vez de migrar a la API nueva, porque exigiría decorar cada test individualmente sin ganar nada funcional con la versión de pytest-asyncio ya fijada en el proyecto (0.24.0).
>
> `pytest.ini` gana `asyncio_mode = auto` (si no, cada test async nuevo necesitaría `@pytest.mark.asyncio` a mano). Tests nuevos: `test_api_auth.py` (8 casos: registro + token utilizable via `/auth/me`, email duplicado, contraseña corta, login correcto/incorrecto/inexistente, endpoint protegido sin token y con token malformado), `test_api_texts.py` (6 casos: creación queda en `pending`, contenido en blanco rechazado, Smart Chunking end-to-end -- crea el texto, corre el chunking real, confirma `status=ready` y que las oraciones quedan divididas correctamente --, aislamiento entre usuarios (IDOR), borrado, y alta/baja de una frase de gramática en una oración), `test_api_sessions.py` (5 casos: creación de sesión sobre un chunk real, rechazo de un chunk que no pertenece al texto, `finish` persistiendo WPM/precisión calculados correctamente, desbloqueo del logro "Primer paso" + XP tras terminar una sesión real via `/gamification/overview`, y que un usuario no puede terminar la sesión de otro). Total: **19 pruebas de integración nuevas**, todas contra la base de datos real (Postgres), a través del stack HTTP real (`httpx.AsyncClient` + `ASGITransport`, sin mockear la app). `pytest` completo: **76/76 pasando** (57 preexistentes + 19 nuevas), corrido dos veces seguidas para confirmar que el ciclo DROP/CREATE de la base de test es repetible sin dejar residuos, y verificado por fuera con `psql` que la base de desarrollo real (`mch_english`, con los 19 usuarios reales de las pruebas manuales de esta sesión) permanece intacta y separada de `mch_english_test`.
- **Prioridad:** P1
- **Área:** Testing Backend
- **Archivos afectados:**
  - `backend/app/tests/test_api_texts.py`
  - `backend/app/tests/test_api_auth.py`
  - `backend/app/tests/test_api_sessions.py`
- **Motivo:** El backend solo prueba servicios aislados; ningún endpoint HTTP ni flujo con base de datos está probado.
- **Implementación propuesta:**
  1. Crear fixtures con `httpx.AsyncClient` y base de datos de pruebas (SQLite en memoria o Postgres de test).
  2. Implementar pruebas para los flujos completos: registro, login, subida de texto, Smart Chunking, tipeo, guardado de sesión y gamificación.
- **Dependencias:** Tarea 0.4.
- **Criterio de aceptación:** `pytest` ejecutando exitosamente pruebas de integración de endpoints con aserciones sobre códigos de respuesta y estados en BD.

---

## FASE 6 — DEVOPS Y PRODUCCIÓN (P1 / P2)

### [ ] Tarea 6.1: Configurar y activar ESLint en Frontend
- **Prioridad:** P2
- **Área:** DevOps & Calidad
- **Archivos afectados:**
  - `frontend/.eslintrc.json`
  - `frontend/next.config.js`
- **Motivo:** El linter está roto y deliberadamente ignorado durante los builds.
- **Implementación propuesta:**
  1. Crear `frontend/.eslintrc.json` con `{"extends": "next/core-web-vitals"}`.
  2. Retirar `ignoreDuringBuilds: true` de `next.config.js`.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** `npm run lint` y `npm run build` ejecutados exitosamente sin ignorar errores.

---

### [ ] Tarea 6.2: Ejecución de contenedores sin privilegios de root
- **Prioridad:** P1
- **Área:** DevOps & Seguridad
- **Archivos afectados:**
  - `backend/Dockerfile`
  - `frontend/Dockerfile`
- **Motivo:** Los procesos dentro de Docker corren como UID 0 (root).
- **Implementación propuesta:**
  1. En `backend/Dockerfile`, crear y activar el usuario `appuser`:
     ```dockerfile
     RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
     USER appuser
     ```
  2. En `frontend/Dockerfile`, activar el usuario existente `USER node`.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** `docker exec mch-english-backend-1 whoami` debe retornar `appuser` y no `root`.

---

### [ ] Tarea 6.3: Implementar Healthchecks profundos y puertos unificados
- **Prioridad:** P2
- **Área:** DevOps & Monitoreo
- **Archivos afectados:**
  - `backend/app/main.py`
  - `docker-compose.yml`
- **Motivo:** `/health` no comprueba base de datos y `docker-compose.yml` base no mapea puertos al host.
- **Implementación propuesta:**
  1. Añadir comprobación de `SELECT 1` y ping a Redis en `/health`.
  2. Mapear puertos por defecto en `docker-compose.yml` o incluir un archivo `.env` documentado para compose.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Si PostgreSQL o Redis se detienen, `/health` debe responder con código HTTP 503 Service Unavailable.

---

### [ ] Tarea 6.4: Pipeline de Integración Continua (CI) en GitHub Actions
- **Prioridad:** P2
- **Área:** DevOps / CI-CD
- **Archivos afectados:**
  - `.github/workflows/ci.yml`
- **Motivo:** No existe automatización de calidad para pull requests o commits.
- **Implementación propuesta:**
  1. Crear flujo de GitHub Actions que ejecute:
     - Linting y verificación de tipos en Frontend (`npm run lint`, `tsc --noEmit`).
     - Pruebas de Frontend (`vitest run`).
     - Pruebas unitarias e integradas de Backend (`pytest`).
     - Verificación de builds de Docker.
- **Dependencias:** Tareas 5.1, 5.2, 6.1.
- **Criterio de aceptación:** Ejecución exitosa del pipeline ante cada push y pull request en la rama principal.

---

## FASE 7 — LIMPIEZA Y OPTIMIZACIÓN FINAL (P3)

### [ ] Tarea 7.1: Desduplicación de utilidades y consultas redundantes
- **Prioridad:** P3
- **Área:** Calidad de Código
- **Archivos afectados:**
  - `frontend/src/features/typing/utils.ts` (nuevo)
  - `backend/app/services/gamification_service.py`
- **Motivo:** Función `reconstructTyped` duplicada en dos páginas; consulta redundante a `list_by_user` en gamificación.
- **Implementación propuesta:**
  1. Centralizar `reconstructTyped` en un módulo compartido en frontend.
  2. Reutilizar la variable `texts` en `gamification_service.py`.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Eliminación de código duplicado verificado por análisis estático.

---

### [ ] Tarea 7.2: Modal accesible para acciones destructivas
- **Prioridad:** P3
- **Área:** UI/UX
- **Archivos afectados:**
  - `frontend/src/app/library/page.tsx`
  - Nuevo componente `frontend/src/components/ConfirmModal.tsx`
- **Motivo:** `window.confirm()` bloquea el hilo principal y ofrece una estética obsoleta.
- **Implementación propuesta:**
  1. Crear un modal accesible (`dialog` accesible con escape y foco) para confirmar eliminación de textos.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Eliminación de un texto confirmada mediante modal accesible sin llamadas a `window.confirm`.

---

### [ ] Tarea 7.3: Corrección de distorsión en gráficos SVG y Logging estructurado
- **Prioridad:** P3
- **Área:** UI/UX & Observabilidad
- **Archivos afectados:**
  - `frontend/src/features/progress/LineChartCard.tsx`
  - `backend/app/main.py`
- **Motivo:** Los puntos en gráficos SVG se deforman en pantallas móviles; los logs de backend carecen de formato estructurado JSON.
- **Implementación propuesta:**
  1. Retirar `preserveAspectRatio="none"` de elementos circulares o fijar radio escalable.
  2. Añadir middleware con `structlog` y cabecera `X-Request-ID`.
- **Dependencias:** Ninguna.
- **Criterio de aceptación:** Círculos en gráficos perfectamente redondeados en cualquier resolución y logs del backend emitidos en formato JSON estructurado con ID de solicitud.
