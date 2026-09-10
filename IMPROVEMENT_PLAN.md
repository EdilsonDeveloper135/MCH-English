# PLAN INTEGRAL DE MEJORA Y REMEDIACIÓN

**Proyecto:** MCH-English  
**Fecha:** Septiembre 2026  
**Documento Relacionado:** [AUDIT_REPORT.md](file:///Users/edilsontaquimachuctaya/Desktop/MCH-English/AUDIT_REPORT.md)  
**Metodología:** Ejecución escalonada por fases de criticidad e impacto.

---

## FASE 0 — PROBLEMAS CRÍTICOS (P0)

### [ ] Tarea 0.1: Proteger sesiones y estadísticas históricas ante borrado de textos
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

### [ ] Tarea 0.2: Corregir bugs de asincronía y cálculo con Backspace en el motor de mecanografía
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

### [ ] Tarea 0.3: Reemplazar passlib por bcrypt nativo para compatibilidad con Python 3.13+
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

### [ ] Tarea 0.4: Corregir autorización rota (IDOR) en endpoints de intentos
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

### [ ] Tarea 0.5: Limitar longitud máxima de texto para prevenir Denegación de Servicio (DoS)
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

### [ ] Tarea 1.1: Eliminar bucle N+1 en registro de palabras de vocabulario
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

### [ ] Tarea 1.2: Resolver condiciones de carrera en inserciones concurrentes
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

### [ ] Tarea 1.3: Persistir y acotar la duración real de práctica
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

### [ ] Tarea 1.4: Mover almacenamiento de audio WAV fuera de PostgreSQL
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

### [ ] Tarea 2.1: Reemplazar reload forzado de página en la práctica de mecanografía
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

### [ ] Tarea 2.2: Eliminar creación de sesiones duplicadas en Weak Words
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

### [ ] Tarea 2.3: Desacoplar llamadas bloqueantes de síntesis en FastAPI
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

### [ ] Tarea 2.4: Optimizar búsqueda de oraciones para Weak Words
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

### [ ] Tarea 3.1: Formateo legible de errores de validación de API
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

### [ ] Tarea 3.2: Corregir mecánica de tipeo en Missing Words (Recall)
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

### [ ] Tarea 3.3: Ajuste de contrastes y cumplimiento de accesibilidad WCAG 2.1 AA
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

### [ ] Tarea 3.4: Adaptación de interfaz para teclados móviles y virtuales
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

### [ ] Tarea 3.5: Componente de navegación global unificado (<AppHeader>)
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

### [ ] Tarea 4.1: Optimizar renderizado de caracteres en TypingText
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

### [ ] Tarea 4.2: Caché de consultas de diccionario en cliente
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

### [ ] Tarea 4.3: Interceptor de sesión expirada (401) en cliente
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

### [ ] Tarea 5.1: Configurar suite de pruebas unitarias y de componentes en Frontend
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

### [ ] Tarea 5.2: Implementar suite de pruebas de integración de API en Backend
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
