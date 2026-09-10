# AUDITORÍA INTEGRAL DE SOFTWARE, ARQUITECTURA, UI/UX Y BENCHMARK

**Proyecto:** MCH-English  
**Fecha:** 10 de Septiembre de 2026  
**Auditoría:** Segunda Auditoría Técnica y de UI/UX Exhaustiva (Post-Remediación M1-M3)  
**Alcance del Sistema:** Frontend (Next.js 14, React 18, Zustand, Tailwind CSS, Vitest), Backend (FastAPI, SQLAlchemy 2.0 async, Alembic, PostgreSQL 16, Redis 7, RQ, eSpeak-NG, structlog), Infraestructura & DevOps (Docker Compose, GitHub Actions CI), Accesibilidad (WCAG 2.1 AA) y Benchmark de Mecanografía Moderna (Monkeytype, Keybr, TypeLit, TypeRacer).

---

## 1. RESUMEN EJECUTIVO DE LA SEGUNDA AUDITORÍA INTEGRAL (2026-09-10)

El objetivo central de esta segunda auditoría integral ha sido evaluar de forma empírica y rigurosa el estado del repositorio MCH-English tras la ejecución de las 30 tareas de remediación programadas en la fase anterior, contrastando cada afirmación contra el código fuente real, las suites de pruebas automatizadas y los contenedores en ejecución.

### 1.1 Estado Empírico de las Suites de Pruebas y Compilación
- **Frontend Tests (`vitest run`):** **22 de 22 pruebas aprobadas (100%)** en 619ms. Verificación unitaria y de componentes en `useTypingSession`, `TypingText` y `api.ts`.
- **Frontend Linter (`next lint`):** **0 errores y 0 advertencias** bajo la regla `next/core-web-vitals`.
- **Frontend Build (`next build`):** **Compilación limpia de las 14 rutas** de la aplicación (10 estáticas y 4 dinámicas). Tamaño del bundle JavaScript compartido base de **87.1 kB** (First Load JS máximo: 97.6 kB en `/login` y `/register`). Cero errores de TypeScript (`tsc --noEmit` código de salida 0).
- **Backend Tests (`pytest`):** **78 de 78 pruebas aprobadas (100%)** en 4.16s ejecutadas contra una base de datos PostgreSQL real aislada (`mch_english_test`) y Redis 7. Se registraron 41 advertencias de deprecación relativas a la redefinición del fixture `event_loop` en `pytest-asyncio` y al uso de `datetime.datetime.utcnow()` en dependencias descontinuadas (`python-jose`).
- **Backend Static Analysis (`flake8`):** Se identificaron **13 observaciones de higiene estática** (variables no resueltas en anotaciones de modelos, imports no utilizados y formato PEP 8).
- **Discrepancia Crítica Host vs. Docker:** La ejecución de pruebas directamente en la máquina anfitriona (host) falla con código de salida `127` en frontend (por ausencia de `frontend/node_modules/` en el sistema de archivos local) y código `4` en backend (por falta de entorno virtual `venv/` y variables de entorno no exportadas). Todo el entorno productivo y de pruebas opera de forma aislada dentro de los contenedores Docker (`mch-english-frontend-1`, `mch-english-backend-1`, `postgres:16-alpine`, `redis:7-alpine`).

### 1.2 Verificación de las 30 Tareas Previas
La auditoría línea por línea de las 30 tareas distribuidas en las Fases 0 a 7 confirmó un resultado contundente:
- **30 tareas VERIFICADAS (100%)**.
- **0 tareas incompletas o parciales**.
- **0 falsos completados** (no existen stubs ficticios ni mocks que disfracen funcionalidad).
- **0 regresiones** introducidas sobre el comportamiento previamente funcional.

Se confirmaron las remediaciones de los 5 hallazgos críticos originales (P0):
1. La sustitución de `ON DELETE CASCADE` por `SET NULL` en sesiones e intentos históricos de tipeo, recall y dictado evita la pérdida irreversible de XP y rachas al eliminar textos.
2. La corrección de sincronía en `useTypingSession.ts` eliminó el estado obsoleto (*stale state*) en el callback final y garantiza que `Backspace` descuente con precisión los caracteres y errores.
3. El reemplazo de `passlib` por `bcrypt` directo previene rupturas en entornos Python 3.13+.
4. La validación cruzada de pertenencia de oraciones y fragmentos mitigó la vulnerabilidad de autorización (IDOR).
5. La cuota `MAX_TEXT_LENGTH = 100_000` en Pydantic previene ataques de Denegación de Servicio (DoS).

### 1.3 Diagnóstico Global y Nueva Clasificación Técnica (P0 — P3)
A pesar del éxito de la remediación previa, la inspección técnica exhaustiva de 12 dimensiones y la auditoría profunda de la experiencia de usuario y mecanografía identificaron **20 nuevos hallazgos técnicos** que requieren atención antes del lanzamiento a producción:
- **0 Críticos (P0):** No se detectaron vulnerabilidades activas de corrupción masiva de datos o ejecución arbitraria de código.
- **8 Altos (P1):** Trampa de foco permanente (`onBlur`) en input de tipeo que rompe la navegación por teclado (WCAG 2.1.2); riesgo de inyección de argumentos en la CLI de eSpeak-NG; bloqueo del event loop principal de FastAPI por ejecución sincrónica de Gale-Church; condición de carrera en el hook de tipeo a velocidades superiores a 100 WPM; motor SQLAlchemy compartido entre loops independientes del worker RQ; motor asíncrono sin `pool_pre_ping=True` ni dimensionamiento; ausencia total de limitación de tasa (rate limiting) en autenticación; y vacíos críticos de pruebas de integración en 7 módulos API y componentes de interfaz.
- **8 Medios (P2):** Desbordamiento horizontal del `AppHeader` en pantallas móviles (<500px); contraste deficiente en gráficos SVG (`fill="#6b7280"`, ratio 4.35:1); expresión regular de tokenización que mutila caracteres acentuados y palabras compuestas; tokens JWT en `localStorage` sin soporte de revocación ni refresh tokens; CORS permisivo universal (`*`); omisión de índice compuesto en `vocabulary_items (user_id, mastery_score)`; condición de carrera en inserción concurrente de logros; y botones simbólicos sin etiquetas accesibles (`"x"`, `"+"`).
- **4 Bajos (P3):** Consulta SQL redundante de duración en estadísticas; distorsión de gráficos SVG por `preserveAspectRatio="none"` en móviles; falta de timeout de conexión a Redis en `/health`; y deprecaciones de dependencias (`python-jose`, `pytest-asyncio`).

### 1.4 Evolución de Puntuaciones
La puntuación global ponderada del sistema sube de **60.3 / 100** a **72.1 / 100** (**+11.8 puntos**), reflejando una plataforma mucho más sólida y segura, pero que se encuentra en una etapa crítica de maduración técnica y refinamiento ergonómico de interfaz.

---

## 2. VERIFICACIÓN EMPÍRICA DE SUITES DE PRUEBAS Y ENTORNO

### 2.1 Matriz de Resultados de Ejecución Automatizada

| Suite / Herramienta | Entorno de Ejecución | Comando Ejecutado | Código de Salida | Duración | Pruebas Totales | Aprobadas | Fallidas | Estado |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Frontend Tests** | Docker (`frontend-1`) | `docker exec mch-english-frontend-1 npm test` | `0` | 0.62s | 22 | 22 | 0 | **PASS** |
| **Frontend Linter** | Docker (`frontend-1`) | `docker exec mch-english-frontend-1 npm run lint` | `0` | 1.12s | N/A | 0 errores | 0 warns | **PASS** |
| **Frontend Typecheck** | Docker (`frontend-1`) | `docker exec mch-english-frontend-1 npx tsc --noEmit` | `0` | 2.45s | N/A | 0 errores | 0 warns | **PASS** |
| **Frontend Build** | Docker (`frontend-1`) | `docker exec mch-english-frontend-1 npm run build` | `0` | 11.45s | 14 rutas | 14 generadas | 0 | **PASS** |
| **Backend Tests** | Docker (`backend-1`) | `docker exec mch-english-backend-1 pytest -v` | `0` | 4.16s | 78 | 78 | 0 | **PASS** (41 warns) |
| **Backend Lint** | Host CLI | `flake8 backend/app --max-line-length=120` | `1` | 0.38s | 13 issues | N/A | 13 | **ATTENTION** |
| **Host Frontend** | Host CLI | `npm test` en `./frontend` | `127` | <0.05s | N/A | N/A | `node_modules` vacío | **BLOCKED** |
| **Host Backend** | Host CLI | `pytest` en `./backend` | `4` | 0.15s | N/A | N/A | Sin venv/vars | **BLOCKED** |

### 2.2 Desglose de Pruebas Unitarias y de Integración

#### Frontend (Vitest 2.1.9, Node 20.18.0)
- `src/services/api.test.ts` (7 tests): Valida formateo de errores Pydantic (arrays), propagación de mensajes de excepción planos, interceptación selectiva de 401 en peticiones autenticadas vs no autenticadas, fallback a `statusText` y caché en memoria para consultas exitosas y 404 del diccionario.
- `src/features/typing/useTypingSession.test.ts` (10 tests): Concatenación de oraciones y delimitación de rangos, indexación de oraciones por posición, avance de cursor con caracteres correctos, tolerancia a caracteres incorrectos sin bloqueo, reversión precisa con Backspace, cálculo en vivo de WPM (convención de 5 caracteres por palabra), emisión de `onComplete` con métricas exactas, disparo de `onWordError` y compatibilidad con eventos nativos `InputEvent`.
- `src/features/typing/TypingText.test.tsx` (5 tests): Renderizado completo de caracteres, asignación de clases cromáticas según estado, delimitación de cursor con borde cian, sustitución por guión bajo en modo `hidePending` y preservación de bloques ajenos en re-renders (memoización).

#### Backend (pytest 8.3.4, Python 3.12.14)
- `test_alignment_service.py` (6 tests): Alineación de oraciones 1:1, 2:1, 1:2, manejo de discrepancias.
- `test_api_auth.py` (8 tests): Registro de usuario, validación de contraseña, detección de emails duplicados, generación e invalidación de JWT.
- `test_api_sessions.py` (5 tests): Creación de sesiones, rechazo de chunks ajenos al texto (IDOR), métricas de fin de sesión, persistencia de duración.
- `test_api_texts.py` (6 tests): Creación de textos, validación de textos vacíos/espacios, smart chunking, aislamiento por usuario, eliminación de textos y preservación de sesiones (`SET NULL`).
- `test_chunking_service.py` (5 tests): Segmentación de oraciones, abreviaturas en inglés, límites de 80-160 palabras por chunk, modo continuo.
- `test_dictionary_service.py` (3 tests): Desduplicación de traducciones, preservación del orden.
- `test_gamification_service.py` (13 tests): Cálculo de rachas, transiciones de día, gaps de inactividad, curvas de XP, cálculo de niveles, identificadores de logros.
- `test_health.py` (3 tests): Endpoint `/health` con PostgreSQL y Redis operativos (200 OK), fallo controlado ante PostgreSQL caído (503), fallo ante Redis caído (503).
- `test_recall_service.py` (10 tests): Selección de palabras para huecos, priorización de weak words, sistema de calificación.
- `test_typing_service.py` (4 tests): Precisión en vivo, fórmula de WPM con cota de cero caracteres.
- `test_vocabulary_service.py` (15 tests): Puntuación de dominio, decaimiento temporal, extracción de palabras difíciles.

### 2.3 Diagnóstico Host vs. Contenedor Docker
1. **Frontend en Host:** El directorio `frontend/node_modules/` se encuentra vacío en la máquina local. Las dependencias fueron instaladas exclusivamente durante la construcción de la imagen Docker. Un desarrollador que clone el repositorio no puede ejecutar `npm test` o `npm run dev` localmente sin antes ejecutar `npm install`.
2. **Backend en Host:** La ejecución local de `pytest` falla con `KeyError: 'DATABASE_URL'` debido a que `conftest.py` indexa incondicionalmente variables de entorno sin valores por defecto. Adicionalmente, el Python del sistema (3.14) carece del entorno virtual con `bcrypt` y `jose`. El backend depende completamente de los servicios en red definidos en `docker-compose.yml`.

### 2.4 Advertencias de Deprecación y Brechas de Cobertura
1. **Deprecación de `event_loop` en `pytest-asyncio`:** La redefinición del fixture `event_loop` en `backend/app/tests/conftest.py` (L33) genera advertencias de obsolescencia. Debe migrarse al estándar de configuración `asyncio_default_fixture_loop_scope = "session"`.
2. **Deprecación de `datetime.utcnow()` en `python-jose`:** Se registraron 40 advertencias por el uso de `datetime.utcnow()`. Al estar `python-jose` descontinuado, se recomienda la migración a `PyJWT`.
3. **Ausencia de Herramientas de Cobertura:** El comando `vitest --coverage` falla por falta de `@vitest/coverage-v8` en `devDependencies`, y `pytest --cov` falla por ausencia de `pytest-cov` en `requirements.txt`.
4. **Brechas de Cobertura de Integración:**
   - **Frontend:** 0 pruebas de integración de páginas sobre las 14 rutas de Next.js; módulos de Dictado, Alineación bilingüe y Práctica de Recall sin pruebas de interfaz.
   - **Backend:** Cero pruebas de integración HTTP para los routers de `/api/dictation`, `/api/dictionary`, `/api/gamification`, `/api/recall` y `/api/vocabulary`.

---

## 3. ESTADO VERIFICADO DE LAS 30 TAREAS PREVIAS

Todas las 30 tareas implementadas durante el ciclo de remediación fueron contrastadas empíricamente contra el código fuente, la base de datos y los tests en ejecución.

| # | Tarea Verificada | Fase | Área | Evidencia Principal en Código Fuente | Estado |
| :-: | :--- | :---: | :---: | :--- | :---: |
| **0.1** | Proteger sesiones ante borrado de textos | Fase 0 | Base de Datos | `ondelete="SET NULL"` en `TypingSession`, `RecallSession`, `DictationSession`, `RecallAttempt`, `DictationAttempt`. Migración `87783de64709`. | **VERIFICADA** |
| **0.2** | Corregir asincronía y Backspace en tipeo | Fase 0 | Frontend | `applyBackspace` decrementa contadores y purga errores; `finalCharStates` síncrono en closure. | **VERIFICADA** |
| **0.3** | Reemplazar passlib por bcrypt nativo | Fase 0 | Backend | `bcrypt.hashpw` / `checkpw` directo en `security.py` con truncamiento a 72 bytes; `passlib` eliminado. | **VERIFICADA** |
| **0.4** | Corregir autorización IDOR en intentos | Fase 0 | Seguridad | `_get_owned_sentence` con join a `Text.user_id` en `dictation.py` y `recall.py`; validación de chunk en sesiones. | **VERIFICADA** |
| **0.5** | Limitar longitud de texto contra DoS | Fase 0 | Seguridad | `MAX_TEXT_LENGTH = 100_000` y validación de strings en blanco en `schemas/texts.py`. | **VERIFICADA** |
| **1.1** | Eliminar bucle N+1 en vocabulario | Fase 1 | Rendimiento | Un solo `SELECT ... WHERE word IN (...)` y un solo `INSERT ... ON CONFLICT DO UPDATE` masivo en `vocabulary_service.py`. | **VERIFICADA** |
| **1.2** | Resolver condiciones de carrera en inserciones | Fase 1 | Base de Datos | `ON CONFLICT DO NOTHING` en `settings_repository.py` y `dictation.py`. | **VERIFICADA** |
| **1.3** | Persistir y acotar duración real de práctica | Fase 1 | Datos | Persistencia en `typing_sessions.duration_seconds` acotada por tiempo transcurrido en servidor. | **VERIFICADA** |
| **1.4** | Mover audio WAV fuera de PostgreSQL | Fase 1 | DevOps/BD | Retiro de columna `audio_data` (migración `ebfc8aa6e23b`); almacenamiento en volumen de disco `/app/audio_cache`. | **VERIFICADA** |
| **2.1** | Eliminar reload forzado en mecanografía | Fase 2 | Frontend | Transición de fragmento mediante `handleContinue` y carga de estado React sin recargar el navegador. | **VERIFICADA** |
| **2.2** | Eliminar sesiones duplicadas en Weak Words | Fase 2 | Frontend | Eliminada llamada previa redundante en `vocabulary/page.tsx`; creación exclusiva al montar la vista de práctica. | **VERIFICADA** |
| **2.3** | Desacoplar llamadas bloqueantes de TTS | Fase 2 | Backend | Invocación de `tts_service.synthesize` y lecturas de disco envueltas en `asyncio.to_thread`. | **VERIFICADA** |
| **2.4** | Optimizar búsqueda SQL de Weak Words | Fase 2 | Rendimiento | Consulta SQL directa con operador de regex `~*` y límite por palabra en `vocabulary_service.py`. | **VERIFICADA** |
| **3.1** | Formateo legible de errores de API | Fase 3 | UI/UX | Función `formatErrorDetail` en `api.ts` procesa arrays de Pydantic sin imprimir `[object Object]`. | **VERIFICADA** |
| **3.2** | Corregir tipeo en Missing Words | Fase 3 | UI/UX | Concatenación de huecos con espacios delimitadores en `MissingWordsText.tsx` y verificación de backend. | **VERIFICADA** |
| **3.3** | Ajustar contrastes WCAG 2.1 AA | Fase 3 | Accesibilidad | Barrido de `text-gray-500/600/700` a `text-gray-400` y etiquetas `<label htmlFor>` en formularios. | **VERIFICADA** |
| **3.4** | Adaptar interfaz para teclados móviles | Fase 3 | Responsive | Input interactivo visible para `pointer: coarse` y soporte para `InputEvent` nativo en `useTypingSession.ts`. | **VERIFICADA** |
| **3.5** | Componente de navegación `<AppHeader>` | Fase 3 | UI/UX | Barra persistente unificada en `layout.tsx` con breadcrumbs contextuales e indicador de enlace activo. | **VERIFICADA** |
| **4.1** | Optimizar renderizado en `TypingText` | Fase 4 | Rendimiento | Segmentación en bloques memoizados (`splitIntoBlocks`, `TypingWordBlock`) con `areBlockPropsEqual`. | **VERIFICADA** |
| **4.2** | Caché de consultas de diccionario | Fase 4 | Rendimiento | `Map` en memoria de cliente en `api.ts` cachea respuestas exitosas y 404 de FreeDict. | **VERIFICADA** |
| **4.3** | Interceptor de sesión expirada (401) | Fase 4 | Frontend | Interceptor en `api.ts` captura 401 en peticiones autenticadas, resetea `authStore` y redirige a `/login`. | **VERIFICADA** |
| **5.1** | Suite de pruebas unitarias Frontend | Fase 5 | Testing | Configuración completa de Vitest + Testing Library con 22 pruebas aprobadas en tiempo récord (619ms). | **VERIFICADA** |
| **5.2** | Suite de pruebas de integración Backend | Fase 5 | Testing | 19 pruebas de integración HTTP sobre Postgres real (`mch_english_test`) con `httpx.AsyncClient`. | **VERIFICADA** |
| **6.1** | Configurar y activar ESLint en Frontend | Fase 6 | DevOps | `.eslintrc.json` con `next/core-web-vitals`; build de Next.js ejecuta el linter con 0 errores. | **VERIFICADA** |
| **6.2** | Ejecutar contenedores como no-root | Fase 6 | Seguridad | `appuser` (UID 1000) en backend y `node` en frontend verificados mediante `whoami`. | **VERIFICADA** |
| **6.3** | Healthchecks profundos y puertos | Fase 6 | DevOps | `/health` verifica `SELECT 1` en Postgres y `PING` en Redis; puertos 8000/3000 expuestos en compose base. | **VERIFICADA** |
| **6.4** | Pipeline de CI en GitHub Actions | Fase 6 | DevOps | Workflow `.github/workflows/ci.yml` configurado con jobs de frontend, backend y build Docker. | **VERIFICADA** |
| **7.1** | Desduplicación de utilidades y queries | Fase 7 | Calidad | `reconstructTyped` centralizado en `utils.ts`; reuso de `texts` en `gamification_service.py`. | **VERIFICADA** |
| **7.2** | Modal accesible para acciones destructivas | Fase 7 | UI/UX | Componente `<ConfirmModal>` nativo sobre `<dialog>` con cierre por tecla `Escape`; 0 `window.confirm`. | **VERIFICADA** |
| **7.3** | Gráficos SVG y logging estructurado | Fase 7 | Observabilidad | `vectorEffect="non-scaling-stroke"` en `LineChartCard.tsx`; `structlog` emite JSON con `X-Request-ID`. | **VERIFICADA** |

---

## 4. AUDITORÍA TÉCNICA INTEGRAL (12 DIMENSIONES)

A continuación se detalla el análisis de cada dimensión evaluando los avances alcanzados frente a los nuevos hallazgos técnicos detectados.

### 4.1 UI/UX
- **Avances:** Navegación global unificada con `<AppHeader>`, errores de API legibles, eliminación de recargas con `window.location.reload()` y sustitución de `window.confirm` por `<ConfirmModal>`.
- **Deficiencias:**
  - **P1-M2-01 / Focus Trap:** `TypingCaptureInput.tsx` (L33) secuestra el foco incondicionalmente en `onBlur`, impidiendo navegar por teclado hacia botones superiores o salir de la sesión.
  - **Falta de atajos en Dictado y Recall:** No existen combinaciones de teclas para reescuchar audio (`Ctrl+Space`) ni para avanzar de ronda sin mouse (`Enter`).
  - **Cargas infinitas silenciosas:** Llamadas en `progress/page.tsx` (L36-39) y `gamification/page.tsx` (L24) capturan excepciones con `.catch(() => {})`, dejando la pantalla en "Cargando..." permanente si la API falla.

### 4.2 Frontend (Next.js 14, React 18, Zustand)
- **Avances:** Renderizado selectivo memoizado por palabra en `TypingText.tsx`, caché de diccionario en memoria y manejo reactivo de sesiones expiradas en `api.ts`.
- **Deficiencias:**
  - **P1-M2-04 / Race Condition a alta velocidad:** En `useTypingSession.ts` (L162-233), `applyCharacter` lee `currentIndex` y `charStates` desde el closure de React. A más de 100 WPM, pulsaciones consecutivas dentro del mismo frame de render leen estados obsoletos y pierden caracteres.
  - **Layout shift de hidratación en AppHeader:** `AppHeader.tsx` evalúa el token de Zustand en el primer render retornando `null` hasta leer `localStorage`, provocando un salto visual (parpadeo) al hidratar en cliente.

### 4.3 Backend (FastAPI, SQLAlchemy 2.0 async, Alembic)
- **Avances:** Hasheo directo con `bcrypt`, cuota estricta de 100,000 caracteres en entradas de texto y logging estructurado con correlation IDs.
- **Deficiencias:**
  - **P1-M2-02 / Inyección en CLI de eSpeak-NG:** `tts_service.py` (L16-20) ejecuta `subprocess.run` sin el delimitador `"--"` antes del texto y sin parámetro `timeout`. Textos que inicien con guiones (ej. diálogos `"-- Hello"`) se interpretan como modificadores de línea de comandos, o pueden colgar el subproceso.
  - **P1-M2-03 / Bloqueo por Gale-Church:** `PATCH /texts/{id}/translation` ejecuta la realineación síncrona en el hilo de FastAPI, bloqueando el event loop de asyncio en textos largos.
  - **Inconsistencia en Dictation:** `dictation.py` valida que la oración pertenezca al usuario, pero omite validar que corresponda al `text_id` de la sesión activa.

### 4.4 Base de Datos (PostgreSQL 16)
- **Avances:** Eliminación en cascada prevenida (`SET NULL`), upsert masivo atómico en registro de vocabulario, y binarios WAV reubicados en disco.
- **Deficiencias:**
  - **P1-M2-06 / Ausencia de Pre-Ping y Pool Sizing:** `database.py` no configura `pool_pre_ping=True`, `pool_size` ni `pool_recycle`. Conexiones caídas por inactividad provocan excepciones 500 no capturadas.
  - **P2-M2-06 / Omisión de índice compuesto:** `vocabulary_items` carece del índice `(user_id, mastery_score)`, forzando ordenamientos en memoria en consultas de Weak Words.
  - **P2-M2-07 / Condición de carrera en logros:** `unlock_achievements` realiza inserciones planas sin `ON CONFLICT DO NOTHING`, fallando con error 500 si dos sesiones finalizan simultáneamente.

### 4.5 Infraestructura y DevOps
- **Avances:** Ejecución sin root (`appuser`/`node`), puertos expuestos en compose base, `/health` profundo con validación de PostgreSQL y Redis, y workflow de CI configurado.
- **Deficiencias:**
  - **P1-M2-05 / Engine compartido en RQ:** `jobs.py` reutiliza el engine asíncrono global dentro de `asyncio.run()`, provocando `RuntimeError: Task attached to a different loop` ante la reutilización de conexiones en workers.
  - **P3-M2-03 / Socket timeout ausente:** La comprobación de Redis en `/health` carece de `socket_timeout`, arriesgando congelar el healthcheck si Redis se bloquea.

### 4.6 Arquitectura y Mantenibilidad
- **Avances:** Desduplicación de utilidades comunes (`utils.ts`) y reutilización de consultas de textos en gamificación.
- **Deficiencias:**
  - **Sobrecarga en fin de sesión:** `PATCH /sessions/{id}` ejecuta sincrónicamente entre 11 y 14 consultas SQL consecutivas recalculando estadísticas y logros antes de responder al cliente.
  - **Lógica ORM acoplada en endpoints:** Los routers de Dictation y Recall manipulan modelos ORM directamente sin capa de repositorios.

### 4.7 Seguridad
- **Avances:** Erradicación de `passlib`, mitigación de IDOR y validación de longitud contra DoS.
- **Deficiencias:**
  - **P1-M2-07 / Ausencia de Rate Limiting:** `/auth/login` y `/auth/register` no cuentan con limitador de peticiones, exponiendo el servidor a agotamiento de CPU por fuerza bruta contra bcrypt.
  - **P2-M2-04 / JWT sin revocación:** Tokens de 24 horas almacenados en `localStorage` sin refresh tokens ni posibilidad de revocación server-side.
  - **P2-M2-05 / CORS universal:** `allow_origins=["*"]` en `main.py`.

### 4.8 Rendimiento
- **Avances:** Bucle N+1 erradicado en vocabulario (de 160 consultas a 2), reconciliación DOM selectiva por palabra y caché de FreeDict.
- **Deficiencias:**
  - **Consultas de agregación no cacheadas:** Gamificación y progreso escanean tablas completas de intentos sin vistas materializadas ni caché en Redis.
  - **Gale-Church en proceso web:** La alineación de oraciones en actualizaciones de traducción se ejecuta en el proceso web en lugar de la cola RQ.

### 4.9 Testing y Calidad
- **Avances:** 22 pruebas de frontend (Vitest) y 78 pruebas de backend (pytest con PostgreSQL real).
- **Deficiencias:**
  - **P1-M2-08 / Vacíos de integración:** Cero pruebas de endpoint HTTP para Dictation, Recall, Vocabulary y Settings. Cero pruebas de integración o renderizado para páginas de Next.js.
  - **Falta de herramientas de cobertura:** Faltan `@vitest/coverage-v8` y `pytest-cov`.

### 4.10 Accesibilidad (WCAG 2.1 AA)
- **Avances:** Sustitución masiva de grises por `text-gray-400` y campos de formulario con `<label htmlFor>`.
- **Deficiencias:**
  - **Infracción WCAG 2.1.2 (No Keyboard Trap):** Trampa de foco en `TypingCaptureInput.tsx`.
  - **P2-M2-02 / Infracción WCAG 1.4.3 (Contraste en SVG):** Etiquetas de texto en `BarChartCard.tsx` usan `fill="#6b7280"`, ratio **4.35:1** (< 4.5:1 exigido).
  - **P2-M2-08 / Botones no accesibles:** Botones `"x"` y `"+"` en `SentenceInfoPanel.tsx` carecen de `aria-label`.
  - **Regiones dinámicas ausentes:** `TypingText` no dispone de `aria-live` para anunciar aciertos/errores a lectores de pantalla.

### 4.11 Responsive Design y Dispositivos Móviles
- **Avances:** Input interactivo de 48px para pantallas táctiles y captura mediante `InputEvent` nativo.
- **Deficiencias:**
  - **P2-M2-01 / Desbordamiento de Navbar:** `<AppHeader>` desborda horizontalmente en anchos menores a 500px por falta de menú colapsable.
  - **Colapso con teclado virtual:** El centrado vertical (`min-h-screen justify-center`) oculta el texto detrás del teclado virtual al desplegarse en smartphones.

### 4.12 Calidad de Código
- **Avances:** ESLint integrado en build sin excepciones y tipado estricto.
- **Deficiencias:**
  - **P2-M2-03 / Tokenizador regex defectuoso:** `_WORD_RE = re.compile(r"[A-Za-z0-9']+")` en `chunking_service.py` mutila acentos ("café" → "caf") y fragmenta palabras con guión ("state-of-the-art").
  - **Excepciones no controladas:** Invocaciones asíncronas en `AudioPlayer.tsx` y `WordHelpTooltip.tsx` carecen de bloque `.catch()`.

---

## 5. TABLA COMPARATIVA DE PUNTUACIONES (12 DIMENSIONES)

| # | Dimensión Evaluada | Puntuación Anterior | Puntuación Actual | Variación | Justificación Técnica Sintética |
| :-: | :--- | :---: | :---: | :---: | :--- |
| **1** | **UI/UX** | 6.2 / 10 | **7.4 / 10** | +1.2 | Navegación unificada con `<AppHeader>`, errores legibles de Pydantic y modal accesible. Penalizado por trampa de foco (`onBlur`), falta de atajos y cargas infinitas silenciosas. |
| **2** | **Frontend** | 6.5 / 10 | **7.7 / 10** | +1.2 | Memoización por bloques de palabras en `TypingText`, interceptor 401 y suite Vitest. Penalizado por condición de carrera en `useTypingSession` a >100 WPM y salto de hidratación. |
| **3** | **Backend** | 6.8 / 10 | **7.9 / 10** | +1.1 | Migración a `bcrypt`, cuota de 100k caracteres, TTS en thread y logging estructurado. Penalizado por falta de `--` en CLI de eSpeak-NG y bloqueo del bucle por Gale-Church. |
| **4** | **Base de datos** | 5.8 / 10 | **7.6 / 10** | +1.8 | Resuelto el riesgo crítico de CASCADE (ahora `SET NULL`), upsert atómico masivo y audio en disco. Penalizado por falta de `pool_pre_ping`, omisión de índice compuesto y carrera en logros. |
| **5** | **Infraestructura / DevOps** | 6.0 / 10 | **7.8 / 10** | +1.8 | Contenedores no-root (`appuser`/`node`), puertos en compose base, healthcheck profundo y CI workflow. Penalizado por engine SQLAlchemy compartido entre loops del worker RQ. |
| **6** | **Arquitectura** | 7.0 / 10 | **7.5 / 10** | +0.5 | Desduplicación de utilidades y desacople de consultas. Penalizado por sobrecarga de consultas síncronas en fin de sesión y lógica ORM acoplada en endpoints. |
| **7** | **Seguridad** | 5.5 / 10 | **6.8 / 10** | +1.3 | Hasheo nativo seguro, mitigación de IDOR y validación de entrada. Penalizado por nulo rate limiting en login/register, JWT sin revocación en `localStorage` y CORS universal. |
| **8** | **Rendimiento** | 6.4 / 10 | **7.5 / 10** | +1.1 | Eliminado N+1 en vocabulario, render selectivo en cliente y caché de diccionario. Penalizado por cálculo masivo no cacheado en gamificación y Gale-Church síncrono. |
| **9** | **Testing** | 3.5 / 10 | **6.5 / 10** | +3.0 | Salto cualitativo: 22 tests en frontend (Vitest) y 19 tests de integración backend con Postgres real (78 tests totales). Penalizado por 0 tests de endpoint en 7 módulos y 0 tests de UI. |
| **10** | **Accesibilidad (WCAG 2.1 AA)** | 5.0 / 10 | **6.2 / 10** | +1.2 | Barrido de grises a `text-gray-400` y campos con `<label htmlFor>`. Penalizado por Focus Trap en `TypingCaptureInput`, contraste fallido en `BarChartCard` (4.35:1) y botones sin nombre. |
| **11** | **Responsive Design** | 4.5 / 10 | **6.4 / 10** | +1.9 | Input visible de 48px en dispositivos táctiles y soporte para Gboard. Penalizado por desbordamiento del header en móviles (<500px) y empuje del layout por teclado virtual. |
| **12** | **Calidad y Mantenibilidad** | 6.6 / 10 | **7.6 / 10** | +1.0 | ESLint activo y limpio en Next.js, tipado TypeScript estricto. Penalizado por tokenizador regex que corrompe acentos/guiones y manejo inconsistente de promesas. |
| **TOTAL** | **PROMEDIO PONDERADO** | **60.3 / 100** | **72.1 / 100** | **+11.8** | **Evolución positiva sustancial; el sistema superó el estado de riesgo crítico y entra en fase de consolidación técnica y ergonomía.** |

---

## 6. CLASIFICACIÓN RIGUROSA DE NUEVOS HALLAZGOS (P0 — P3)

### 6.1 Hallazgos de Prioridad Alta (P1)

#### P1-M2-01: Trampa de foco permanente (`onBlur`) en input de tipeo (WCAG 2.1.2)
- **Área:** UI/UX & Accesibilidad
- **Archivos:** `frontend/src/features/typing/TypingCaptureInput.tsx` (L33)
- **Problema:** El manejador `onBlur={() => inputRef.current?.focus()}` reasigna el foco inmediatamente al input invisible cada vez que pierde el foco.
- **Impacto:** Los usuarios que navegan exclusivamente con teclado quedan atrapados sin poder presionar `Tab` para alcanzar botones como "Salir", controles de audio o enlaces de navegación. En smartphones, genera un bucle que vuelve a levantar el teclado virtual cuando el usuario intenta cerrarlo.
- **Solución:** Eliminar el manejador `onBlur` forzado. Controlar el foco mediante clic o toque en el contenedor de tipeo (`onClick={() => inputRef.current?.focus()}`) y respetar la navegación por `Tab`.

#### P1-M2-02: Riesgo de inyección de flags en CLI de eSpeak-NG y ausencia de timeout
- **Área:** Backend / Seguridad e Integridad
- **Archivos:** `backend/app/services/tts_service.py` (L16-21)
- **Problema:** Invocación de `subprocess.run(["espeak-ng", "-v", VOICE, "-s", str(WORDS_PER_MINUTE), "--stdout", text])` sin el delimitador estándar `"--"` antes de `text` y sin el parámetro `timeout`.
- **Impacto:** Oraciones que comiencen con guiones (ej. diálogos de libros como `"-- Good morning", said John`) son interpretadas por eSpeak-NG como parámetros de línea de comandos. La falta de timeout permite que procesos colgados bloqueen indefinidamente los hilos de ejecución.
- **Solución:** Agregar `"--"` antes de `text` y configurar `timeout=15.0` en `subprocess.run`.

#### P1-M2-03: Gale-Church síncrono en `PATCH /texts/{id}/translation` bloquea el event loop
- **Área:** Backend / Concurrencia y Rendimiento
- **Archivos:** `backend/app/api/texts.py` (L261), `backend/app/services/translation_service.py` (L38)
- **Problema:** La ruta ejecuta `await realign_translation(db, text)` directamente en el hilo principal de asyncio, corriendo la matriz de programación dinámica de Gale-Church (hasta 1,000,000 de celdas).
- **Impacto:** Consume el 100% de la CPU durante varios segundos y congela todas las peticiones concurrentes en esa instancia de Uvicorn.
- **Solución:** Delegar la alineación al worker de RQ o ejecutar la función matemática envuelta en `await asyncio.to_thread(align, ...)`.

#### P1-M2-04: Condición de carrera por stale closure en `useTypingSession` a >100 WPM
- **Área:** Frontend / Lógica Central de Tipeo
- **Archivos:** `frontend/src/features/typing/useTypingSession.ts` (L162-233)
- **Problema:** `applyCharacter` y `applyBackspace` leen `currentIndex`, `charStates` y contadores directamente desde el closure de React.
- **Impacto:** A velocidades superiores a 100 WPM (~10 teclas/segundo) o ante ráfagas de teclado, múltiples eventos `keydown` se procesan antes de que React aplique el nuevo estado, provocando pérdida de caracteres y estadísticas desajustadas.
- **Solución:** Gestionar el índice actual y el búfer de estados en `useRef` para sincronización inmediata de lecturas/escrituras en tiempo real.

#### P1-M2-05: Motor SQLAlchemy compartido en loops independientes del worker RQ
- **Área:** Infraestructura & DevOps / Base de Datos
- **Archivos:** `backend/app/workers/jobs.py` (L8, L21-29), `backend/app/core/database.py` (L6-7)
- **Problema:** `jobs.py` importa `async_session_maker` (atado al engine global) y ejecuta `asyncio.run(_process_text_async(text_id))`.
- **Impacto:** Cada llamada a `asyncio.run` crea y destruye un bucle de eventos. Si el pool de conexiones entrega una conexión generada en un loop previo, asyncpg genera `RuntimeError: Task attached to a different loop`.
- **Solución:** Utilizar un engine con `NullPool` por trabajo en segundo plano o ejecutar `await engine.dispose()` antes de finalizar el job.

#### P1-M2-06: Engine asíncrono sin `pool_pre_ping=True` ni dimensionamiento de pool
- **Área:** Base de Datos / Estabilidad
- **Archivos:** `backend/app/core/database.py` (L6)
- **Problema:** `create_async_engine(settings.database_url, echo=False)` no declara `pool_pre_ping`, `pool_size`, `max_overflow` ni `pool_recycle`.
- **Impacto:** Si una conexión inactiva es cerrada por PostgreSQL o un firewall, la siguiente petición falla con `InterfaceError` / `ConnectionDoesNotExistError` (HTTP 500).
- **Solución:** Configurar `pool_pre_ping=True`, `pool_size=10`, `max_overflow=20` y `pool_recycle=1800`.

#### P1-M2-07: Ausencia total de rate limiting en `/auth/login` y `/auth/register`
- **Área:** Seguridad / Control de Abusos y DoS
- **Archivos:** `backend/app/api/auth.py` (L14-31)
- **Problema:** Cero limitación de peticiones en los endpoints de autenticación.
- **Impacto:** Vulnerabilidad a ataques de fuerza bruta y ataques DoS por consumo intensivo de CPU aprovechando el cómputo de bcrypt (~70ms por verificación).
- **Solución:** Implementar middleware de rate limiting basado en Redis (ej. `slowapi` con límite de 5 intentos por minuto por IP en `/login`).

#### P1-M2-08: Vacíos de pruebas de integración en 7 módulos API y componentes de UI
- **Área:** Testing & Calidad de Software
- **Archivos:** `backend/app/api/` y `frontend/src/`
- **Problema:** Cero pruebas de endpoint HTTP para: Dictation, Recall, Vocabulary, Settings y Alignment. Cero pruebas de renderizado o integración para páginas de Next.js.
- **Impacto:** Alto riesgo de regresiones en flujos de usuario centrales no cubiertos por la suite actual.
- **Solución:** Desarrollar `test_api_dictation.py`, `test_api_recall.py`, `test_api_vocabulary.py` en backend y pruebas de componentes con Testing Library en frontend.

---

### 6.2 Hallazgos de Prioridad Media (P2)

#### P2-M2-01: Desbordamiento horizontal del `AppHeader` en viewports móviles (<500px)
- **Área:** UI/UX & Responsive Design
- **Archivos:** `frontend/src/components/AppHeader.tsx` (L39-62)
- **Problema:** 6 enlaces horizontales en línea sin menú colapsable (hamburguesa).
- **Impacto:** En smartphones estándar (320px–390px), los enlaces se amontonan o generan scroll horizontal desalineando la interfaz.
- **Solución:** Incorporar menú desplegable hamburguesa para pantallas menores a `md` (768px).

#### P2-M2-02: Rótulos SVG en `BarChartCard` incumplen ratio de contraste (4.35:1)
- **Área:** Accesibilidad (WCAG 2.1 AA)
- **Archivos:** `frontend/src/features/progress/BarChartCard.tsx` (L48)
- **Problema:** `<text ... fill="#6b7280">{b.label}</text>` sobre fondo negro `#000000`.
- **Impacto:** Ratio de **4.35:1**, por debajo del 4.5:1 exigido por WCAG 2.1 AA.
- **Solución:** Cambiar el atributo `fill` a `#9ca3af` (ratio 8.27:1).

#### P2-M2-03: Tokenizador regex mutila caracteres acentuados y fragmenta palabras con guión
- **Área:** Calidad de Código & Lógica de Dominio
- **Archivos:** `backend/app/services/chunking_service.py` (L24)
- **Problema:** Expresión regular `_WORD_RE = re.compile(r"[A-Za-z0-9']+")` descarta caracteres fuera de ASCII.
- **Impacto:** Palabras como "café", "naïve" o "résumé" son truncadas en la primera letra no ASCII ("caf"). En Missing Words la letra con tilde queda expuesta. Palabras con guión se dividen erróneamente.
- **Solución:** Actualizar la regex a `_WORD_RE = re.compile(r"[\w']+", re.UNICODE)`.

#### P2-M2-04: JWT en `localStorage` sin soporte de revocación ni refresh tokens
- **Área:** Seguridad / Gestión de Sesiones
- **Archivos:** `frontend/src/stores/authStore.ts` (L20-41), `backend/app/core/config.py` (L11)
- **Problema:** Token de acceso con validez de 24 horas almacenado en `localStorage`.
- **Impacto:** Vulnerable a extracción ante ataques XSS y sin mecanismo para invalidar la sesión desde el servidor.
- **Solución:** Implementar cookies `HttpOnly; SameSite=Strict` o tokens de corta duración (15 min) con refresh tokens revocables en base de datos.

#### P2-M2-05: CORS permisivo universal (`allow_origins=["*"]`) en entorno API
- **Área:** Seguridad / Configuración
- **Archivos:** `backend/app/main.py` (L60-66)
- **Problema:** Configuración `allow_origins=["*"]` en `CORSMiddleware`.
- **Impacto:** Permite que cualquier sitio web malicioso realice peticiones contra la API en el contexto del usuario.
- **Solución:** Restringir orígenes permitidos mediante la variable de entorno `app_settings.cors_origins`.

#### P2-M2-06: Falta de índice compuesto en `vocabulary_items (user_id, mastery_score)`
- **Área:** Base de Datos / Rendimiento
- **Archivos:** `backend/app/models/vocabulary.py`, `backend/alembic/versions/`
- **Problema:** Consultas que filtran por `user_id` y ordenan por `mastery_score` realizan ordenamientos en memoria.
- **Impacto:** Degradación de latencia a medida que crece el catálogo de palabras del usuario.
- **Solución:** Crear migración con `op.create_index('ix_vocabulary_items_user_mastery', 'vocabulary_items', ['user_id', 'mastery_score'])`.

#### P2-M2-07: Condición de carrera en inserción concurrente de logros
- **Área:** Base de Datos & Concurrencia
- **Archivos:** `backend/app/repositories/gamification_repository.py` (L125-128)
- **Problema:** Inserción simple con `db.add(UserAchievement(...))` sin control de colisiones.
- **Impacto:** Sesiones concurrentes intentan insertar el mismo logro, fallando con HTTP 500 (`IntegrityError`).
- **Solución:** Utilizar `pg_insert(UserAchievement).values(...).on_conflict_do_nothing(...)`.

#### P2-M2-08: Botones interactivos con nombres no accesibles (`"x"` y `"+"`)
- **Área:** Accesibilidad (WCAG 4.1.2)
- **Archivos:** `frontend/src/features/typing/SentenceInfoPanel.tsx` (L126, L155)
- **Problema:** Botones representados por literales `"x"` y `"+"` sin `aria-label`.
- **Impacto:** Lectores de pantalla anuncian "botón equis" y "botón más" sin indicar la acción.
- **Solución:** Agregar `aria-label="Eliminar frase"` y `aria-label="Guardar frase"`.

---

### 6.3 Hallazgos de Prioridad Baja (P3)

#### P3-M2-01: Consulta SQL redundante de suma de duración en estadísticas
- **Área:** Base de Datos / Optimización
- **Archivos:** `backend/app/repositories/session_repository.py` (L89-106)
- **Problema:** Dos consultas separadas con el mismo `WHERE` para obtener promedios y luego sumar duración.
- **Impacto:** Round-trip adicional innecesario en cada carga de perfil.
- **Solución:** Integrar `func.coalesce(func.sum(TypingSession.duration_seconds), 0)` en la consulta principal.

#### P3-M2-02: Distorsión visual de textos SVG en `BarChartCard` en móviles
- **Área:** UI/UX & SVG
- **Archivos:** `frontend/src/features/progress/BarChartCard.tsx` (L38)
- **Problema:** Atributo `preserveAspectRatio="none"` estira textos de ejes en pantallas angostas.
- **Impacto:** Defecto visual cosmético en gráficos de progreso.
- **Solución:** Emplear proporciones fijas con `viewBox` responsivo y `vector-effect="non-scaling-stroke"`.

#### P3-M2-03: Falta de timeout de conexión en ping a Redis en `/health`
- **Área:** DevOps / Observabilidad
- **Archivos:** `backend/app/main.py` (L92-97)
- **Problema:** `aioredis.from_url` no declara `socket_timeout`.
- **Impacto:** Bloqueo del healthcheck de Docker si Redis entra en estado zombi.
- **Solución:** Configurar `socket_timeout=3.0` en la verificación de salud.

#### P3-M2-04: Deprecación de `python-jose` y fixture `event_loop` en suite de tests
- **Área:** Mantenibilidad & Dependencias
- **Archivos:** `backend/requirements.txt` (L8, L16), `backend/app/core/security.py` (L4)
- **Problema:** 41 advertencias de deprecación en la ejecución de pytest.
- **Impacto:** Ruido en logs y riesgo de incompatibilidad en futuras versiones de Python.
- **Solución:** Migrar a `PyJWT` y configurar `asyncio_default_fixture_loop_scope = "session"`.

---

## 7. AUDITORÍA PROFUNDA DE UI/UX Y FLUJOS DE MECANOGRAFÍA

### 7.1 Scorecard de Dimensiones UI/UX

| Dimensión Evaluada | Puntuación Previa | Puntuación Auditada | Estado | Hallazgo Principal |
| :--- | :---: | :---: | :---: | :--- |
| **Ergonomía de Mecanografía (Typing Flow)** | 62 / 100 | **58 / 100** | ⚠️ Deficiente | Sin cursor suave; sin `Ctrl+Backspace`; pérdida de ritmo por descarte 1-a-1 sin buffer; Focus Trap en `onBlur`. |
| **Feedback en Tiempo Real** | 60 / 100 | **52 / 100** | 🔴 Crítico | Bug en `wordAtPosition` (busca prefijos truncados como "c", "ca" en FreeDict); tooltip anclado al pie de página. |
| **Accesibilidad (WCAG 2.1 AA)** | 58 / 100 | **60 / 100** | ⚠️ Parcial | Falla de contraste en `BarChartCard` (4.35:1), ausencia total de anillos `focus-visible` y etiquetas `sr-only`. |
| **Consistencia de Navegación** | 64 / 100 | **68 / 100** | 🟡 Regular | Falta contexto del texto en práctica; redirecciones cruzadas en Weak Words ("Volver a Biblioteca" vs "Vocabulary"). |
| **Diseño Responsive & Móvil** | 55 / 100 | **48 / 100** | 🔴 Crítico | `min-h-screen justify-center` colapsa el texto detrás del teclado virtual; fuente mono rígida de 20px. |
| **Fatiga Visual y Estética** | 65 / 100 | **55 / 100** | ⚠️ Deficiente | Contraste extremo (#000000 vs #ffffff = 21:1) genera halo visual y fatiga; sin paletas suaves (Nord, Sepia) ni modo Zen. |
| **Gamificación & Cierre de Sesión** | 62 / 100 | **54 / 100** | ⚠️ Pobre | Pantalla post-sesión espartana: solo 2 números planos, sin desglose de palabras falladas, sin curvas ni XP visual. |

### 7.2 Análisis Detallado de Flujos Reales

1. **Navegación y Consistencia:**
   - En `/practice/[textId]` y `/dictation/[textId]`, no se muestra en ningún punto el título del libro o texto en práctica. El usuario pierde el contexto de qué fragmento u obra está leyendo.
   - En `/practice/weak-words`, la barra superior muestra `← Volver a Biblioteca`, pero el botón de fin de sesión indica `Volver a Vocabulary`.
   - En `/library/[textId]/align`, la barra global `<AppHeader>` convive con un segundo botón interno duplicado que enlaza a Library.

2. **Jerarquía Visual y Distribución:**
   - En `/library`, el formulario de creación de textos ocupa más de 550px verticales con dos áreas de texto masivas, empujando la lista de textos por debajo del pliegue visible (*below the fold*).
   - En la lista de biblioteca, cada ítem renderiza hasta 5 acciones en texto subrayado apiñadas sin delimitación visual clara (`Revisar alineacion`, `Abrir`, `Recall`, `Dictation`, `Eliminar`).
   - En `/progress`, 14 tarjetas métricas idénticas no establecen jerarquía entre métricas estrella (WPM, Precisión) y datos accesorios.

3. **Tipografía, Espaciado y Contraste (WCAG 2.1 AA):**
   - Rótulos en `BarChartCard.tsx` (L48) con `fill="#6b7280"` sobre negro tienen ratio de **4.35:1** (incumple el 4.5:1 de WCAG AA).
   - Bordes `border-gray-900` sobre negro `#000000` tienen un ratio de contraste de **1.1:1**, fundiéndose visualmente con el fondo.
   - Underscores consecutivos en `MissingWordsText.tsx` se renderizan como una línea continua indiferenciada (`______`), impidiendo saber cuántas letras tiene la palabra oculta.
   - Formularios de autenticación usan únicamente `sr-only` y `placeholder`, perdiendo la etiqueta tan pronto el usuario comienza a tipear.

4. **Estados Interactivos:**
   - Ausencia universal de anillos de foco accesibles (`focus-visible:ring-2 focus-visible:ring-cyan-400`).
   - Botones deshabilitados (`SentenceInfoPanel.tsx`) no modifican opacidad ni muestran cursor `cursor-not-allowed` durante el guardado.
   - Botones de acción simbólica `"x"` y `"+"` carecen de atributos descriptivos `aria-label`.

5. **Feedback Visual Inmediato y Mecánica de Tipeo:**
   - **Bug en `wordAtPosition` (`useTypingSession.ts` L63-67):** La función utiliza `text.slice(0, position + 1)`, capturando únicamente prefijos ("c", "ca", "cat"). Si el usuario falla la primera letra de "elephant", la función busca "e" en FreeDict en lugar de la palabra completa, mostrando traducciones absurdas o vacías.
   - **Cursor estático:** Borde CSS plano sin animación de parpadeo suave ni transición interpolada entre caracteres.
   - **Mecánica rígida 1-a-1:** Al tipear una letra extra accidental, el motor no la retiene en un búfer extra; corre todos los caracteres subsiguientes, tiñendo de rojo toda la palabra restante en cascada.
   - **Tooltip desacoplado:** `WordHelpTooltip.tsx` está fijado al borde inferior de la pantalla (`bottom-8`), obligando a desviar la vista del área de tipeo en el tercio superior.

6. **Manejo de Estados (Loading, Error, Empty, Success):**
   - En `/progress`, las excepciones de red silenciadas con `.catch(() => {})` dejan la pantalla en "Cargando..." infinito sin botón de reintento.
   - `EmptyState.tsx` muestra un texto plano `"Sin datos suficientes para graficar"` sin llamados a la acción (CTA) para iniciar una práctica.
   - `ChunkCompleteSummary` ofrece un cierre plano y anticlímax con 2 métricas sin desglose de palabras falladas ni curvas de velocidad.

7. **Accesibilidad y Navegación por Teclado:**
   - Trampa de foco crítica en `TypingCaptureInput.tsx` (L33) con `onBlur={() => inputRef.current?.focus()}`.
   - Ausencia de atajos operativos: sin `Ctrl+Backspace` para borrar palabras completas; sin `Enter` para avanzar de ronda en Recall y Dictation; sin `Ctrl+Space` para reescuchar audios.

8. **Experiencia Móvil y Teclado Virtual:**
   - `min-h-screen justify-center` desplaza el texto detrás del teclado virtual en pantallas táctiles al reducirse el viewport útil a menos de 380px.
   - Tipografía monoespaciada rígida de 20px (`text-xl`) provoca continuos quiebres de línea en pantallas de 360px a 390px.

9. **Fatiga Visual y Ergonomía en Sesiones Largas:**
   - Contraste absoluto de 21:1 (#000000 vs #ffffff) produce fatiga y halo visual tras 15 minutos de uso continuo.
   - Ausencia total de temas suaves de alto confort (Nord, Catppuccin, Sepia) y modo de concentración Zen.
   - Cero retroalimentación auditiva mecánica opcional para mantener la cadencia de tipeo.

---

## 8. BENCHMARK DE APLICACIONES WEB DE MECANOGRAFÍA MODERNA

Se investigaron y compararon las mejores prácticas de **Monkeytype**, **Keybr**, **TypeLit** y **TypeRacer**.

### 8.1 Matriz Comparativa de Características

| Característica / Patrón UX | Monkeytype | Keybr | TypeLit | TypeRacer | MCH-English (Actual) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Área de Escritura** | Centrada, 3 líneas con scroll vertical suave | Fila activa con teclado virtual y calor | Vista de libro con paginación limpia | Pista de autos con texto debajo | Bloque de texto continuo estático |
| **Estilizado de Caracteres** | Pendiente (gris), Correcto (tema), Error (rojo extra) | Coloreado por confianza de tecla | Superposición exacta sobre páginas | Bloque verde correcto, cursor activo | Pendiente (`gray-400`), Correcto (`white`), Error (`red-500`) |
| **Animación de Cursor** | Caret interpolado (smooth, blink, block, line) | Barra vertical sólida precisa | Subrayado o barra clásica | Carro en pista + cursor en texto | Borde izquierdo estático (`border-l-2`) |
| **Manejo de Errores** | Modo permisivo/estricto; letras extra destacadas | Bloqueo estricto hasta tecla correcta | Permite sobrescribir y resalta fallos | Bloqueo estricto con tiñe de buffer | Descarte 1-a-1; desalinea palabras ante extras |
| **Borrado de Palabra (`Ctrl+BS`)** | Soporte nativo para borrar palabra completa | Soporte estándar | Soporte estándar | Bloqueo o borrado | Solo borra 1 carácter por pulsación |
| **Métricas en Tiempo Real** | WPM, Precisión, Errores, Tiempo, o modo Zen | Velocidad instantánea y promedio móvil | Porcentaje de avance, WPM acumulado | Velocímetro gráfico en tiempo real | WPM crudo y Precisión porcentual fija |
| **Pantalla de Resultados** | Gráfico interactivo WPM vs tiempo, errores, replay | Curva por fonema y mapa de calor | Precisión de capítulo y palabras difíciles | Tabla de posiciones, WPM final, replay | 3 líneas de texto plano y botón Continuar |
| **Personalización & Temas** | Más de 50 temas (Nord, Dracula, Gruvbox) | Configuración de algoritmos y layouts | Tipografías literarias (serif/sans) | Pocos temas cosméticos | Paleta fija negra/cian/gris |
| **Modo Concentración (Zen)** | UI se desvanece por completo al tipear | Teclado táctil ocultable | Vista inmersiva a pantalla completa | Modo carrera sin distracciones | Interfaz fija con botones y contadores |
| **Atajos de Teclado** | `Tab + Enter` (restart), `Esc` (menú rápido) | `Enter` (siguiente reto) | `Ctrl + Enter` (pasar página) | `Ctrl + Alt + K` (atajos de carrera) | Ningún atajo de teclado implementado |

### 8.2 Las 10 Propuestas de Mejora del Benchmark
*(Formato Estricto: REFERENCIA → PROBLEMA ACTUAL → PATRÓN OBSERVADO → ADAPTACIÓN PROPUESTA → BENEFICIO PARA EL USUARIO)*

#### Propuesta 1: Cursor Suave y Animaciones de Transición
- **REFERENCIA:** Monkeytype (Smooth Caret Engine).
- **PROBLEMA ACTUAL:** El cursor en `TypingText.tsx` es un borde izquierdo estático (`border-l-2 border-cyan-400`) que salta bruscamente de carácter en carácter sin transición, carece de parpadeo suave y desaparece abruptamente al culminar el texto.
- **PATRÓN OBSERVADO:** Monkeytype calcula la posición relativa `(left, top)` del carácter activo y renderiza un elemento de cursor desacoplado con transición CSS `transform: translate3d(...)` y curva `cubic-bezier(0.1, 0.9, 0.2, 1.0)` de 80ms–100ms, generando una sensación de fluidez visual continua.
- **ADAPTACIÓN PROPUESTA:** Desacoplar el cursor del span de la letra en un elemento absoluto dentro del contenedor de texto; aplicar interpolación CSS suave (`transition: transform 90ms ease-out`) con estilos configurables (línea, bloque con opacidad, subrayado).
- **BENEFICIO PARA EL USUARIO:** Elimina la fatiga de saltos bruscos entre caracteres, reduce el estrés visual y optimiza la anticipación motora de la siguiente pulsación.

#### Propuesta 2: Borrado de Palabra Completa (`Ctrl+Backspace` / `Cmd+Backspace`)
- **REFERENCIA:** Monkeytype & Editores de Código Modernos (Word-Level Deletion).
- **PROBLEMA ACTUAL:** En `useTypingSession.ts`, el manejador `handleKeyDown` intercepta `Backspace` y ejecuta siempre `applyBackspace()`, el cual solo retrocede un único carácter; presionar `Ctrl+Backspace` o `Cmd+Backspace` solo borra una letra, forzando a golpear repetidamente la tecla para corregir una palabra entera.
- **PATRÓN OBSERVADO:** Las herramientas modernas detectan combinaciones con `ctrlKey` / `altKey` / `metaKey` y retroceden de forma atómica hasta el delimitador de palabra anterior, revirtiendo estados y contadores en un solo ciclo.
- **ADAPTACIÓN PROPUESTA:** Implementar `applyWordBackspace()` en `useTypingSession` que localice el inicio de la palabra actual y purgue en un solo paso los estados y errores correspondientes.
- **BENEFICIO PARA EL USUARIO:** Permite recuperarse instantáneamente de un error grave sin romper la posición de las manos en la fila base (*home row*).

#### Propuesta 3: Modo Zen y Reducción de Distracciones en Tiempo Real
- **REFERENCIA:** Monkeytype (Zen / Focus Mode).
- **PROBLEMA ACTUAL:** Durante la escritura en `PracticePage`, los contadores de WPM y precisión se actualizan continuamente justo encima del texto, compitiendo por la visión periférica del estudiante y generando ansiedad de rendimiento.
- **PATRÓN OBSERVADO:** Monkeytype permite ocultar completamente las cifras durante el ejercicio o desvanecer toda la interfaz circundante a una opacidad del 10% tan pronto como se pulsa la primera tecla, mostrando estadísticas únicamente al finalizar o al pausar.
- **ADAPTACIÓN PROPUESTA:** Incorporar una opción de `"Modo Zen"` que atenúe las métricas superiores (`opacity-0` con `hover:opacity-100`) y oculte botones secundarios mientras se escribe, dejando en pantalla únicamente el texto objetivo.
- **BENEFICIO PARA EL USUARIO:** Máxima concentración en la asimilación del inglés y reducción sustancial de la ansiedad generada por la fluctuación constante del WPM.

#### Propuesta 4: Navegación Fluida sin Mouse mediante Atajos de Teclado
- **REFERENCIA:** TypeRacer & Keybr (Full Keyboard Navigation).
- **PROBLEMA ACTUAL:** En `RecallPage` y `DictationPage`, tras completar una oración, el usuario está obligado a soltar el teclado y tomar el ratón para hacer clic en "Siguiente". En `AudioPlayer`, no hay forma de volver a escuchar el audio sin el mouse.
- **PATRÓN OBSERVADO:** Keybr y TypeRacer permiten que la tecla `Enter` o `Espacio` avance inmediatamente al siguiente reto una vez terminada la ronda, y combinaciones como `Ctrl+Espacio` reproducen nuevamente el audio.
- **ADAPTACIÓN PROPUESTA:** Escucha global en `RoundResult` para avanzar de oración con `Enter`, y en `DictationRoundView` asignar `Ctrl+Espacio` para reproducir/pausar y `Ctrl+R` para repetir la frase.
- **BENEFICIO PARA EL USUARIO:** Mantiene la postura de mecanografía ininterrumpida a lo largo de toda la sesión de estudio.

#### Propuesta 5: Buffer de Caracteres Sobrantes (*Extra Characters Highlighting*)
- **REFERENCIA:** Monkeytype & TypeLit (Non-destructive Typo Buffer).
- **PROBLEMA ACTUAL:** Si el usuario pulsa una letra adicional por error en una palabra, el motor actual avanza al siguiente carácter del texto objetivo, provocando que toda la palabra subsiguiente quede desplazada y se tiña de rojo en cascada.
- **PATRÓN OBSERVADO:** Monkeytype no consume caracteres posteriores legítimos ante pulsaciones erróneas dentro de una palabra; en su lugar, inserta caracteres "extra" en rojo oscuro tachado dentro de la palabra activa en el DOM hasta que el usuario borra o presiona espacio.
- **ADAPTACIÓN PROPUESTA:** Permitir que `TypingWordBlock` renderice caracteres excedentes como `span.text-red-700.line-through` cuando se escriben más letras de las requeridas antes de pulsar espacio.
- **BENEFICIO PARA EL USUARIO:** Elimina el efecto dominó de falsos errores, facilitando una lectura limpia de la discrepancia tipográfica.

#### Propuesta 6: Corrección del Tooltip de Vocabulario y Posicionamiento Contextual
- **REFERENCIA:** TypeLit & LingQ (Contextual Word Inspection).
- **PROBLEMA ACTUAL:** `wordAtPosition` en `useTypingSession.ts` tiene un bug donde `before = text.slice(0, position + 1)` solo toma prefijos incompletos ("c", "ca" en lugar de "cat"), generando búsquedas erróneas en FreeDict. Además, el tooltip aparece anclado al pie de página (`bottom-8`).
- **PATRÓN OBSERVADO:** En herramientas de lectura activa, al fallar una palabra, el motor extrae la palabra completa `\b\w+\b` y el tooltip flota suavemente justo encima o debajo de la palabra activa en el texto.
- **ADAPTACIÓN PROPUESTA:** Corregir `wordAtPosition` para expandir los límites izquierdo y derecho desde la posición actual del cursor extrayendo la palabra íntegra. Posicionar el tooltip adyacente a la palabra activa mediante `getBoundingClientRect()` o un popover accesible.
- **BENEFICIO PARA EL USUARIO:** El estudiante recibe la traducción exacta de la palabra fallada justo donde están enfocados sus ojos.

#### Propuesta 7: Pantalla Post-Sesión Enriquecida con Analítica y Gamificación
- **REFERENCIA:** Monkeytype (Detailed Session Breakdown) & Duolingo (Post-Lesson Payoff).
- **PROBLEMA ACTUAL:** Al terminar un fragmento, `ChunkCompleteSummary` muestra únicamente WPM plano y precisión con un botón "Continuar", sin XP visual, palabras difíciles ni curvas de velocidad.
- **PATRÓN OBSERVADO:** Monkeytype y las mejores apps educativas presentan una gráfica sparkline de velocidad por segundo con marcas de errores, un contador animado de XP ganado, estado de la racha y una lista de vocabulario a reforzar.
- **ADAPTACIÓN PROPUESTA:** Reemplazar `ChunkCompleteSummary` por un modal interactivo que integre: (1) gráfico SVG de velocidad por segundo durante el fragmento; (2) barra de XP ganado y progreso al siguiente nivel; (3) lista de palabras falladas con traducción inmediata y botón de repaso rápido.
- **BENEFICIO PARA EL USUARIO:** Gratificación inmediata, refuerzo pedagógico del vocabulario y estímulo para mantener el hábito de estudio diario.

#### Propuesta 8: Paletas de Color Suaves y Personalizables contra la Fatiga Visual
- **REFERENCIA:** Monkeytype (Theme Customization) & Keybr (Visual Comfort).
- **PROBLEMA ACTUAL:** El fondo `#000000` con texto `#ffffff` genera un contraste de 21:1 que causa fatiga ocular en sesiones prolongadas. No existe opción de cambio de paleta ni modo sepia para lectura diurna.
- **PATRÓN OBSERVADO:** Monkeytype ofrece paletas de alto confort visual como *Nord* (`#2e3440` / `#d8dee9`) o *Sepia* que disminuyen significativamente el cansancio en los conos de la retina.
- **ADAPTACIÓN PROPUESTA:** Configurar variables CSS temáticas en `globals.css` y ofrecer 4 temas predefinidos: OLED Black, Nord / Slate (`#1e222a`), Catppuccin Mocha (`#1e1e2e`) y Paper Sepia (`#fbf1c7`).
- **BENEFICIO PARA EL USUARIO:** Capacidad de practicar durante sesiones prolongadas sin irritación ocular, adecuando el contraste a la luz ambiental.

#### Propuesta 9: Desacople del Focus Trap y Hoja Inferior en Móviles
- **REFERENCIA:** Keybr Mobile & Monkeytype Touch Optimization.
- **PROBLEMA ACTUAL:** `onBlur` secuestra el foco impidiendo cerrar el teclado en pantalla en Android/iOS o tocar enlaces superiores. El input superior se desconecta visualmente del texto.
- **PATRÓN OBSERVADO:** Las interfaces móviles para mecanografía ubican el texto en la mitad superior con scroll anclado a la línea activa, y el input se mantiene receptivo sin secuestrar el evento `blur`.
- **ADAPTACIÓN PROPUESTA:** Eliminar `onBlur` forzado en `TypingCaptureInput.tsx`. En pantallas móviles, centrar el texto en la mitad superior (`h-1/2 overflow-y-auto`) con seguimiento de línea activa, previniendo que el teclado virtual tape el texto objetivo.
- **BENEFICIO PARA EL USUARIO:** Navegación táctil intuitiva, eliminación de bucles de teclado y visibilidad plena del texto en dispositivos móviles.

#### Propuesta 10: Visualización Distintiva de Huecos en Missing Words
- **REFERENCIA:** TypeLit & Duolingo Fill-in-the-Blank.
- **PROBLEMA ACTUAL:** En `MissingWordsText.tsx`, los caracteres ocultos se representan con guiones bajos continuos (`_`), fusionándose en una línea opaca que no permite contar cuántas letras tiene la palabra.
- **PATRÓN OBSERVADO:** Las plataformas de aprendizaje representan cada letra pendiente como una celda delimitada individual con borde inferior espaciado.
- **ADAPTACIÓN PROPUESTA:** Modificar `MissingWordsText` para renderizar cada carácter pendiente como un bloque con subrayado espaciado (`border-b-2 border-gray-500 mx-0.5 inline-block min-w-[0.85em] text-center`).
- **BENEFICIO PARA EL USUARIO:** Percepción inmediata e inequívoca de la longitud de la palabra buscada, reduciendo la fricción cognitiva en ejercicios de recuerdo activo.

---

## 9. ROADMAP Y PRÓXIMA FASE RECOMENDADA

Para la siguiente etapa de desarrollo, se recomienda organizar los trabajos en 4 fases ordenadas por criticidad e impacto:

```
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 8: ERGONOMÍA CRÍTICA DE MECANOGRAFÍA Y ACCESIBILIDAD (P1)        │
│ • Desactivar Focus Trap en TypingCaptureInput (WCAG 2.1.2)             │
│ • Corregir algoritmo wordAtPosition (detección de palabra completa)   │
│ • Implementar Ctrl+Backspace / Cmd+Backspace en motor de tipeo        │
│ • Agregar atajos de teclado completos (Enter para avanzar, Ctrl+Space)│
│ • Resolver condición de carrera a >100 WPM en useTypingSession         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ FASE 9: SEGURIDAD, CONCURRENCIA Y RESILIENCIA DE BACKEND (P1 / P2)    │
│ • Blindar eSpeak-NG CLI con '--' y timeout de 15s                      │
│ • Mover Gale-Church a threadpool o cola RQ en actualización de texto   │
│ • Configurar pool_pre_ping=True y dimensionamiento en async engine    │
│ • Desacoplar engine SQLAlchemy en bucles de workers RQ                │
│ • Implementar rate limiting en /auth/login y /auth/register           │
│ • Upsert atómico en logros y restricción de orígenes CORS              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ FASE 10: SUITE DE PRUEBAS DE INTEGRACIÓN Y COBERTURA (P1 / P2)         │
│ • Pruebas de integración HTTP para Dictation, Recall y Vocabulary     │
│ • Pruebas de renderizado de componentes y flujos de UI en Frontend    │
│ • Incorporar @vitest/coverage-v8 y pytest-cov con reportes de cobertura│
│ • Migrar deprecaciones: event_loop de pytest-asyncio y PyJWT          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ FASE 11: EXPERIENCIA UI/UX MODERNA, TEMAS Y ANALÍTICA (P2 / P3)       │
│ • Cursor animado desacoplado (Smooth Caret Engine)                    │
│ • Buffer no destructivo de caracteres extra en TypingWordBlock         │
│ • Tooltip flotante contextual adyacente a la palabra activa           │
│ • Menú colapsable responsivo en AppHeader para móviles                 │
│ • Paletas suaves antifatiga (Nord, Slate, Sepia) y Modo Zen           │
│ • Pantalla post-sesión enriquecida con curva WPM, XP y repaso         │
└────────────────────────────────────────────────────────────────────────┘
```
