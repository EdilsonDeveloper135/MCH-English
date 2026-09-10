# AUDITORÍA INTEGRAL DE SOFTWARE, ARQUITECTURA Y PRODUCTO

**Proyecto:** MCH-English  
**Fecha:** Septiembre 2026  
**Auditor:** Equipo Senior de Auditoría, Arquitectura y Producto  
**Alcance:** Frontend (Next.js 14, React 18, Zustand, Tailwind), Backend (FastAPI, SQLAlchemy 2.0 async, RQ, eSpeak-NG), Base de Datos (PostgreSQL 16, Alembic), Infraestructura & DevOps (Docker, Redis 7).

---

## 1. RESUMEN EJECUTIVO

MCH-English es una plataforma interactiva para el aprendizaje de inglés a través de la mecanografía activa (typing). Integra lectura segmentada por fragmentos (*Smart Chunking*), sincronización de traducciones provistas por el usuario mediante alineación basada en longitudes de oración (*Gale-Church*), repaso de vocabulario con bajo dominio (*Weak Words*), ejercicios de recuerdo activo (*Recall: Missing Words* y *Traducción Inversa*), dictado auditivo sintetizado localmente (*eSpeak-NG*) y un sistema de gamificación basado en experiencia (XP), niveles, rachas y logros.

El sistema destaca por su fidelidad a un principio de diseño claro: **no utilizar modelos de lenguaje generativo ni IA opaca**, recurriendo en su lugar a material legítimo aportado por el usuario y un diccionario bilingüe estructurado (*FreeDict*).

Sin embargo, tras una inspección profunda del código, configuración y base de datos, se han detectado **30 hallazgos técnicos**, clasificados en:
- **5 Críticos (P0):** Pérdida de datos históricos por cascadas foráneas, corrupción de estadísticas de tipeo por bugs de asincronía en React, dependencia obsoleta con riesgo de ruptura en Python 3.13+, fallas de autorización (IDOR) y denegación de servicio por payloads sin límite.
- **8 Altos (P1):** Bucle de consultas N+1 en registro de vocabulario, condiciones de carrera en inserciones concurrentes, recarga total del navegador (`window.location.reload()`) en práctica, duplicación de sesiones en palabras débiles, desconexión entre tiempo medido e histórico, y almacenamiento de audio WAV binario dentro de PostgreSQL.
- **12 Medios (P2):** Errores de API mostrados como `[object Object]`, teclado bloqueado en dispositivos móviles, contraste que infringe WCAG 2.1 AA, navegación fragmentada, falta de linter configurado y omisión de pruebas de integración.
- **5 Bajos (P3):** Duplicación de lógica auxiliar, confirmación nativa bloqueante y renderizado de gráficos SVG con distorsión.

---

## 2. ESTADO GENERAL DEL PROYECTO

| Dimensión | Estado | Observación Principal |
| :--- | :---: | :--- |
| **Compilación & Build** | ⚠️ Advertencia | Backend requiere variables de entorno en tiempo de importación; frontend compila ignorando el linter (`ignoreDuringBuilds: true`). |
| **Pruebas Unitarias** | ⚠️ Parcial | 57 pruebas unitarias en backend (solo lógica de servicios); **0 pruebas de endpoints/integración** y **0 pruebas en frontend**. |
| **Seguridad** | 🔴 En Riesgo | IDOR en rutas de intentos, falta de rate limiting, DoS por payload no acotado, JWT en `localStorage`. |
| **Estabilidad de Datos** | 🔴 Crítico | Borrado en cascada `ON DELETE CASCADE` que elimina sesiones históricas al borrar textos; condiciones de carrera en `get_or_create`. |
| **Experiencia de Usuario (UI/UX)** | 🟡 Aceptable | Tipografía y estética minimalista cuidada, pero contraste insuficiente (falla WCAG AA), navegación inconsistente y mobile roto. |
| **Rendimiento** | 🟡 Regular | Bucles N+1 en registro de vocabulario (hasta 160 queries/sesión) y recálculo masivo en gamificación (18 queries). |
| **DevOps / Infraestructura** | 🟡 Regular | Docker funcional, pero contenedores corren como root, audio WAV en PostgreSQL (bloat) y sin pipeline CI/CD. |

---

## 3. ARQUITECTURA ACTUAL

### 3.1 Diagrama de Componentes
```
[ Navegador Web ] (Next.js 14 Standalone, React 18, Tailwind CSS, Zustand)
       │
       ├── REST API ──> [ FastAPI Application ] (Python 3.12, Uvicorn)
       │                      │
       │                      ├── Async ORM ──> [ PostgreSQL 16 ]
       │                      │                     ├── texts, chunks, sentences
       │                      │                     ├── typing_sessions, errors
       │                      │                     ├── vocabulary_items
       │                      │                     ├── dictation_audio_cache (WAV)
       │                      │                     └── dictionary_entries (64,258)
       │                      │
       │                      └── Redis Client ──> [ Redis 7 ]
       │                                              │
       └─────────────────────────────── RQ Queue ─────┘
                                              │
                                        [ RQ Worker ] (Smart Chunking, Gale-Church Alignment)
```

### 3.2 Evaluación de la Arquitectura
- **Fortalezas:** Estructura modular limpia (`api`, `schemas`, `models`, `services`, `repositories`, `workers`). Buena separación conceptual entre mecanografía, vocabulario y gamificación.
- **Puntos Críticos:**
  - El motor de tareas asíncronas (RQ en proceso síncrono con `asyncio.run`) comparte un motor SQLAlchemy asíncrono con pool de conexiones global. Si un hilo o proceso reutiliza una conexión generada en un loop finalizado, se provocan errores `RuntimeError: Task attached to a different loop`.
  - La capa de servicios ejecuta consultas de base de datos directamente en algunos puntos (`vocabulary_service.py`), saltándose el patrón repositorio.
  - Almacenamiento de archivos binarios de audio directamente en PostgreSQL en lugar de almacenamiento de objetos (S3/MinIO) o sistema de archivos.

---

## 4. UI/UX Y DISEÑO

1. **Consistencia Visual y Jerarquía:**
   - La paleta se apoya en un fondo negro profundo (`#000000`) con detalles en gris y cian (`#22d3ee`). La tipografía monoespaciada es adecuada para el tipeo, pero la jerarquía entre títulos, métricas y acciones secundarias es débil.
2. **Navegación Fragmentada e Inconsistente:**
   - No existe un componente de navegación común (`<Navbar>`). Cada página implementa un encabezado artesanal:
     - `/library` enlaza a Vocabulary, Progress y Salir (omite Gamification).
     - `/vocabulary` enlaza a Library y Progress (omite Gamification y Salir).
     - `/progress` enlaza a Gamification, Vocabulary y Library (omite Salir).
     - `/gamification` enlaza a Progress y Library (omite Vocabulary y Salir).
     - `/practice/[textId]`, `/recall/[textId]` y `/dictation/[textId]` no ofrecen barra de navegación.
3. **Contraste y Accesibilidad (Falla WCAG 2.1 AA):**
   - Caracteres pendientes en `TypingText.tsx`: `text-gray-600` (`#4b5563`) sobre `#000000` tiene un ratio de **2.96:1** (el mínimo legal/accesible es **4.5:1**).
   - Acciones secundarias en `SentenceInfoPanel.tsx`: `text-gray-700` (`#374151`) sobre `#000000`, ratio de **1.83:1** (casi imperceptible).
   - Logros bloqueados en `AchievementGrid.tsx`: `border-gray-900 opacity-40 text-gray-600`, texto con ratio inferior a **1.5:1**.
   - Ningún formulario (`login`, `register`, `library`) implementa etiquetas `<label>` accesibles vinculadas por `htmlFor`.
4. **Experiencia en Dispositivos Móviles:**
   - El motor de tipeo utiliza `<input className="opacity-0 absolute h-0 w-0 pointer-events-none" />`. En iOS Safari y Android Chrome, los campos con dimensiones 0 y `pointer-events-none` no levantan el teclado virtual de pantalla, dejando la aplicación inservible en smartphones y tablets.
5. **Formateo de Errores al Usuario:**
   - Los errores 422 de validación de FastAPI retornan listas de diccionarios. El cliente `api.ts` los convierte en `new ApiError(..., body.detail)`, lo que en React se imprime literalmente como: `[object Object]`.
6. **Mecánica Defectuosa en Missing Words:**
   - Si una oración tiene múltiples palabras ocultas, la función `buildBlankTargetText` concatena los huecos con `""` (sin espacio). El usuario debe escribir las palabras pegadas sin espacio; si pulsa la barra espaciadora por instinto, recibe un error de tipeo.

---

## 5. FRONTEND

1. **Gestión de Estado y Ciclo de Vida:**
   - En `useTypingSession.ts`, la variable `finalCharStates` se asigna sincrónicamente dentro de un updater de estado asíncrono de React (`setCharStates`), provocando que las estadísticas finales reciban estados obsoletos (*stale state*).
   - Al pulsar `Backspace`, el índice retrocede pero no se descuentan los aciertos (`correctCount`) ni se eliminan los errores (`errors`). Un usuario que borra y reescribe un carácter duplica el conteo de aciertos, superando el 100% de precisión y falseando el WPM.
2. **Navegación SPA Vulnerada:**
   - En `practice/[textId]/page.tsx`, para avanzar al siguiente fragmento se ejecuta `window.location.reload()`, lo que destruye el árbol de React, obliga a una recarga de red completa y rompe la experiencia de usuario.
3. **Sesiones Fantasma en Palabras Débiles:**
   - En `vocabulary/page.tsx`, el botón de práctica llama a `api.startWeakWordsSession()` (creando sesión 1 en base de datos) y redirige a `/practice/weak-words`. En dicha pantalla, el `useEffect` de montaje vuelve a llamar a `startWeakWordsSession()` (creando sesión 2). La primera sesión queda abandonada para siempre en la base de datos sin finalizar.
4. **Performance de Renderizado:**
   - Cada pulsación de tecla re-renderiza toda la oración dividida en cientos de etiquetas `<span>` individuales en `TypingText.tsx`.
5. **Configuración de Linter:**
   - Falta el archivo `.eslintrc.json`. `next.config.js` tiene configurado `eslint: { ignoreDuringBuilds: true }`. Las comprobaciones de calidad de código están completamente inactivas.

---

## 6. BACKEND

1. **Seguridad y Criptografía:**
   - Uso de `passlib 1.7.4`, el cual importa internamente `crypt`. En Python 3.13+, `crypt` fue eliminado de la librería estándar, rompiendo la aplicación de manera inmediata si se actualiza el runtime.
   - Ausencia de limitador de velocidad (*rate limiting*) en endpoints de autenticación (`/auth/login`, `/auth/register`).
2. **Autorización y Control de Acceso (IDOR):**
   - En `dictation.py` (`create_dictation_attempt`) y `recall.py` (`create_recall_attempt`), el backend acepta `payload.sentence_id` y ejecuta `await db.get(Sentence, payload.sentence_id)` sin verificar que dicha oración pertenezca al texto del usuario.
   - En `sessions.py` (`create_session`), se recibe `chunk_id` sin validar que forme parte del `text_id` correspondiente.
3. **Denegación de Servicio (DoS):**
   - En `schemas/texts.py`, el campo `raw_content` no tiene `max_length`. Un atacante puede enviar un texto de 100 MB que consumirá la memoria del worker al ejecutar expresiones regulares de tokenización y saturará la base de datos con decenas de miles de filas en una sola transacción.
4. **Bloqueo del Event Loop en Síntesis de Voz:**
   - `tts_service.synthesize` ejecuta `subprocess.run(["espeak-ng", ...])` de forma sincrónica y bloqueante dentro del endpoint asíncrono `get_audio`.
5. **Gestión de Sesiones y Pool de Conexiones:**
   - En `app/core/database.py`, `create_async_engine` no especifica `pool_pre_ping=True` ni parámetros de dimensionamiento (`pool_size`, `max_overflow`).

---

## 7. BASE DE DATOS

1. **Pérdida Crítica de Datos por Borrado en Cascada:**
   - `TypingSession`, `RecallSession` y `DictationSession` tienen claves foráneas con `ondelete="CASCADE"` hacia `texts.id`.
   - **Evidencia verificada:** La eliminación de un texto elimina físicamente todas las sesiones del usuario para ese texto. Como el cálculo de XP y rachas de gamificación se realiza sobre las filas existentes de sesiones, al borrar un texto el usuario pierde su experiencia acumulada, sus minutos practicados y sus rachas.
2. **Consultas N+1 Masivas:**
   - `vocabulary_service.record_session_words` ejecuta consultas `_get_or_create` en un bucle secuencial palabra por palabra, generando hasta 160 consultas por fragmento completado.
   - `gamification_service.get_gamification_overview` realiza 18 consultas independientes consecutivas, incluyendo llamadas duplicadas a `list_by_user`.
3. **Condiciones de Carrera (Race Conditions):**
   - `settings_repository.get_or_create`, `vocabulary_service._get_or_create` y `api/dictation.get_audio` implementan un patrón `SELECT -> IF NOT FOUND -> INSERT`. Peticiones concurrentes simultáneas intentan insertar la misma clave única, generando excepciones no capturadas `IntegrityError`.
4. **Falta de Índices Compuestos:**
   - La tabla `vocabulary_items` requiere un índice compuesto en `(user_id, mastery_score)` para optimizar las consultas frecuentes que ordenan por dominio.
5. **Persistencia Inadecuada de Audio:**
   - `dictation_audio_cache` almacena el audio generado en una columna `LargeBinary` dentro de PostgreSQL. Esto produce fragmentación (bloat), sobrecarga de respaldos (`pg_dump`) y consumo excesivo de memoria del gestor de base de datos.

---

## 8. INFRAESTRUCTURA Y DEVOPS

1. **Docker Compose:**
   - El archivo base `docker-compose.yml` no expone puertos al host para ningún servicio. Requiere encadenar flags `-f docker-compose.dev.yml` o `-f docker-compose.prod.yml`.
2. **Seguridad de Contenedores:**
   - Los contenedores de backend y frontend corren como usuario `root` (UID 0). No se crean usuarios restringidos (`appuser` / `node`).
3. **Tamaño de Imágenes y Contexto de Build:**
   - El archivo `backend/data/freedict-eng-spa.tei` (33 MB) se copia dentro de la imagen de producción en `COPY . .`, aumentando el tamaño final de la imagen Docker.
4. **Monitoreo y CI/CD:**
   - Ausencia total de flujos de integración continua en `.github/workflows`.
   - Healthcheck de backend en `/health` no verifica conectividad real con la base de datos ni con Redis.

---

## 9. AUDITORÍA TRANSVERSAL

### 9.1 Seguridad
- **Riesgo IDOR:** Presente en intentos de recall y dictado.
- **Riesgo DoS:** Carga ilimitada de texto en `raw_content`.
- **Secretos:** `dev-secret-key-change-in-production` por defecto en `.env`.
- **XSS / JWT:** Almacenamiento de tokens en `localStorage`.
- **CORS:** Configuración permisiva universal (`allow_origins=["*"]`).

### 9.2 Rendimiento
- **Persistencia:** Bucle N+1 en `record_session_words` y consultas repetidas en gamificación.
- **Frontend:** Renderizado individual de caracteres por span sin memoización.
- **Caché:** Sin caché de consultas de diccionario en cliente.
- **Audio:** WAV almacenado en PostgreSQL saturando el almacenamiento relacional.

### 9.3 Calidad de Código
- **Deuda Técnica:** `useTypingSession.ts` tiene lógica entrelazada de estado, tiempo, cálculo de WPM y precisión.
- **Código Duplicado:** Función `reconstructTyped` duplicada literalmente en `dictation/[textId]/page.tsx` y `recall/[textId]/page.tsx`.
- **Tipado:** Tipos fuertes consistentes entre Pydantic y TypeScript.

### 9.4 Testing
- **Cobertura Real:** 57 pruebas unitarias de backend, pero enfocadas solo en funciones matemáticas y de parsing.
- **Vacíos:** 0 pruebas de integración de API (FastAPI TestClient), 0 pruebas de base de datos, 0 pruebas en frontend (React/Next.js).

---

## 10. CLASIFICACIÓN DETALLADA DE HALLAZGOS

### P0 — CRÍTICO

#### ID: P0-01
- **Área:** Base de Datos / Integridad de Datos
- **Severidad:** P0
- **Archivo(s):** `backend/app/models/typing_session.py` (L20-25), `backend/app/models/recall.py` (L20-22), `backend/app/models/dictation.py` (L35-37)
- **Problema:** Eliminación destructiva de sesiones y progreso histórico al borrar textos (`ondelete="CASCADE"`).
- **Evidencia:** Al invocar `DELETE /texts/{id}`, PostgreSQL elimina todas las filas de `typing_sessions` asociadas al texto. Al consultar `/gamification/overview`, el `total_xp` cae a 0, `current_streak` cae a 0 y `practice_seconds_today` cae a 0.0.
- **Por qué es un problema:** El usuario pierde irrevocablemente meses de esfuerzo, nivel y estadísticas simplemente por limpiar textos antiguos de su biblioteca.
- **Impacto:** Pérdida permanente de datos históricos del usuario.
- **Solución recomendada:** Modificar la clave foránea en los modelos `TypingSession`, `RecallSession` y `DictationSession` a `ForeignKey("texts.id", ondelete="SET NULL")` con `nullable=True`. Generar migración de Alembic.
- **Complejidad estimada:** Baja (1 punto).
- **Dependencias con otros cambios:** Ninguna.

#### ID: P0-02
- **Área:** Frontend / Lógica Central de Mecanografía
- **Severidad:** P0
- **Archivo(s):** `frontend/src/features/typing/useTypingSession.ts` (L134-145, L158-164, L194-204)
- **Problema:** Captura de estado asíncrono obsoleto (*stale state*) y cálculo corrupto de precisión al usar `Backspace`.
- **Evidencia:** `finalCharStates` es capturado de forma síncrona mientras `setCharStates` programa una actualización asíncrona; el último carácter llega como `"pending"`. Al pulsar `Backspace`, no se decrementa `correctCount`; al reescribir la letra correcta, se vuelve a sumar un acierto, permitiendo precisiones superiores al 100% y distorsionando el WPM.
- **Por qué es un problema:** La funcionalidad principal de la plataforma entrega métricas erróneas y corrompe los datos enviados al backend.
- **Impacto:** Datos erróneos de rendimiento, WPM y precisión.
- **Solución recomendada:** Refactorizar el tracking de caracteres en `useTypingSession` para derivar aciertos, errores y estados directamente del búfer tipeado real o usar un `useRef` para capturar el estado síncrono al completar el texto.
- **Complejidad estimada:** Media (3 puntos).
- **Dependencias con otros cambios:** P1-05.

#### ID: P0-03
- **Área:** Backend / Dependencias y Compatibilidad
- **Severidad:** P0
- **Archivo(s):** `backend/requirements.txt` (L9), `backend/app/core/security.py` (L4, L8)
- **Problema:** Dependencia de `passlib 1.7.4` con el módulo estándar `crypt`, retirado en Python 3.13+.
- **Evidencia:** Advertencia en ejecución: `DeprecationWarning: 'crypt' is deprecated and slated for removal in Python 3.13 from crypt import crypt as _crypt`. En Python 3.13 la aplicación no inicia.
- **Por qué es un problema:** Impide desplegar o actualizar el backend en distribuciones modernas de Python.
- **Impacto:** Ruptura total del servicio de autenticación en entornos modernos.
- **Solución recomendada:** Reemplazar `passlib` por la librería `bcrypt` de forma directa (`bcrypt.hashpw` y `bcrypt.checkpw`) o por `pwdlib`.
- **Complejidad estimada:** Baja (1 punto).
- **Dependencias con otros cambios:** Ninguna.

#### ID: P0-04
- **Área:** Backend / Seguridad y Autorización
- **Severidad:** P0
- **Archivo(s):** `backend/app/api/dictation.py` (L103-106), `backend/app/api/recall.py` (L87-89), `backend/app/api/sessions.py` (L43-45)
- **Problema:** Vulnerabilidad de Referencia Directa a Objetos Insegura (IDOR) en intentos de Recall y Dictation.
- **Evidencia:** En `POST /dictation/attempts` y `POST /recall/attempts`, se realiza `await db.get(Sentence, payload.sentence_id)` sin verificar que la oración pertenezca al texto de la sesión ni al usuario autenticado.
- **Por qué es un problema:** Cualquier usuario autenticado puede enviar intentos y registrar datos contra oraciones de textos privados de otros usuarios.
- **Impacto:** Filtración y manipulación de datos entre usuarios.
- **Solución recomendada:** Validar que `sentence.id` pertenezca a la sesión del usuario mediante una consulta con `join` o filtro estricto.
- **Complejidad estimada:** Media (2 puntos).
- **Dependencias con otros cambios:** Ninguna.

#### ID: P0-05
- **Área:** Backend / Seguridad y Estabilidad
- **Severidad:** P0
- **Archivo(s):** `backend/app/schemas/texts.py` (L11-16, L72-74), `backend/app/services/text_service.py` (L19-25)
- **Problema:** Denegación de Servicio (DoS) por ausencia de límite de longitud en el texto de entrada.
- **Evidencia:** `raw_content: str = Field(min_length=1)`. No existe `max_length`.
- **Por qué es un problema:** Un payload de 50 MB provoca el consumo de toda la memoria RAM del worker durante el chunking regex y genera miles de inserciones en la base de datos en una sola transacción bloqueante.
- **Impacto:** Caída de servicios y saturación de base de datos.
- **Solución recomendada:** Definir `max_length=100000` (aprox. 20,000 palabras) en los esquemas Pydantic `TextCreate` y `TranslationUpdate`.
- **Complejidad estimada:** Baja (1 punto).
- **Dependencias con otros cambios:** Ninguna.

---

### P1 — ALTO

#### ID: P1-01
- **Área:** Base de Datos / Rendimiento
- **Severidad:** P1
- **Archivo(s):** `backend/app/services/vocabulary_service.py` (L27-36, L47-56)
- **Problema:** Bucle N+1 de consultas SQL en `record_session_words`.
- **Evidencia:** Se itera sobre cada palabra del texto completado y se ejecuta `_get_or_create` de manera secuencial (1 `SELECT` + 1 `INSERT` por palabra).
- **Impacto:** Latencia severa en la finalización de sesiones de mecanografía.
- **Solución recomendada:** Realizar una consulta única con `where(VocabularyItem.word.in_(words))` y utilizar un upsert por lotes con `INSERT ... ON CONFLICT (user_id, word) DO UPDATE`.
- **Complejidad estimada:** Media (2 puntos).
- **Dependencias con otros cambios:** P1-02.

#### ID: P1-02
- **Área:** Backend & Base de Datos / Concurrencia
- **Severidad:** P1
- **Archivo(s):** `backend/app/repositories/settings_repository.py` (L9-16), `backend/app/services/vocabulary_service.py` (L27-36), `backend/app/api/dictation.py` (L47-55)
- **Problema:** Condiciones de carrera en funciones `get_or_create`.
- **Evidencia:** Comprobación previa no atómica (`if settings is None: db.add(settings)`). Si llegan dos solicitudes concurrentes del mismo usuario, ambas intentan insertar la misma clave única, disparando `IntegrityError` y fallas HTTP 500.
- **Impacto:** Errores 500 intermitentes ante cargas concurrentes.
- **Solución recomendada:** Manejar la cláusula `ON CONFLICT DO NOTHING` en PostgreSQL o capturar `IntegrityError` y reintentar la lectura.
- **Complejidad estimada:** Media (2 puntos).
- **Dependencias con otros cambios:** Ninguna.

#### ID: P1-03
- **Área:** Frontend / Arquitectura y UX
- **Severidad:** P1
- **Archivo(s):** `frontend/src/app/practice/[textId]/page.tsx` (L260)
- **Problema:** Recarga forzada de la página (`window.location.reload()`) para pasar al siguiente fragmento.
- **Evidencia:** `onContinue={() => window.location.reload()}`.
- **Impacto:** Rompe el modelo de Single Page Application, destruye el estado de React y provoca parpadeos en blanco.
- **Solución recomendada:** Actualizar el estado interno de la página cargando el siguiente fragmento (`loadChunk`) sin reiniciar la aplicación en el navegador.
- **Complejidad estimada:** Media (2 puntos).
- **Dependencias con otros cambios:** Ninguna.

#### ID: P1-04
- **Área:** Frontend & Base de Datos / Lógica de Negocio
- **Severidad:** P1
- **Archivo(s):** `frontend/src/app/vocabulary/page.tsx` (L32-33), `frontend/src/app/practice/weak-words/page.tsx` (L32-38)
- **Problema:** Creación duplicada de sesiones y abandono de filas huérfanas en Weak Words.
- **Evidencia:** `handlePracticeWeak` ejecuta `await api.startWeakWordsSession()` y redirige; al montar `/practice/weak-words`, su `useEffect` vuelve a ejecutar `startWeakWordsSession()`.
- **Impacto:** Dos filas de sesión creadas por cada práctica, quedando la primera huérfana en estado incompleto (`finished_at = NULL`).
- **Solución recomendada:** Eliminar la llamada en `vocabulary/page.tsx` y dejar únicamente la inicialización en la página de destino.
- **Complejidad estimada:** Baja (1 punto).
- **Dependencias con otros cambios:** Ninguna.

#### ID: P1-05
- **Área:** Backend & Datos / Integridad de Métricas
- **Severidad:** P1
- **Archivo(s):** `backend/app/repositories/session_repository.py` (L89-96), `backend/app/api/sessions.py` (L84-93)
- **Problema:** Desconexión y falseo del tiempo de práctica acumulado.
- **Evidencia:** El cliente envía `duration_seconds` (tiempo activo real), pero el backend lo ignora para la persistencia y calcula la duración mediante `finished_at - started_at`. Si un usuario deja la pestaña abierta durante horas, su tiempo de práctica diario se infla artificialmente.
- **Impacto:** Estadísticas irreales y cumplimiento espurio de metas diarias y logros de tiempo.
- **Solución recomendada:** Guardar el campo `duration_seconds` enviado por el cliente en `typing_sessions`, validando que no exceda el tiempo transcurrido del servidor (`min(payload.duration_seconds, server_elapsed)`).
- **Complejidad estimada:** Media (2 puntos).
- **Dependencias con otros cambios:** P0-01.

#### ID: P1-06
- **Área:** Base de Datos & DevOps / Almacenamiento
- **Severidad:** P1
- **Archivo(s):** `backend/app/models/dictation.py` (L13-27)
- **Problema:** Almacenamiento de archivos binarios de audio WAV en PostgreSQL.
- **Evidencia:** Columna `audio_data: Mapped[bytes] = mapped_column(LargeBinary)`.
- **Impacto:** Rápida degradación y crecimiento desmedido de la base de datos relacional (*bloat*), ralentizando respaldos y lecturas de memoria.
- **Solución recomendada:** Guardar los archivos de audio en disco montado o almacenamiento S3/MinIO y registrar únicamente la ruta o identificador en PostgreSQL.
- **Complejidad estimada:** Media (3 puntos).
- **Dependencias con otros cambios:** Ninguna.

#### ID: P1-07
- **Área:** DevOps & Seguridad / Configuración
- **Severidad:** P1
- **Archivo(s):** `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`
- **Problema:** Procesos en contenedores ejecutados como `root` y puertos no expuestos en `docker-compose.yml` base.
- **Evidencia:** Ningún Dockerfile declara `USER`. `docker-compose.yml` base no mapea puertos `3000:3000` ni `8000:8000`.
- **Impacto:** Riesgo de seguridad por escalada de privilegios y confusión en el despliegue local.
- **Solución recomendada:** Declarar usuarios no privilegiados en Dockerfiles y mapear puertos o documentar claramente la obligatoriedad del override de compose.
- **Complejidad estimada:** Baja (1 punto).
- **Dependencias con otros cambios:** Ninguna.

#### ID: P1-08
- **Área:** Testing & Calidad / Cobertura
- **Severidad:** P1
- **Archivo(s):** Todo el repositorio
- **Problema:** Ausencia total de pruebas en frontend y falta de pruebas de integración de API en backend.
- **Evidencia:** 0 archivos de prueba en `frontend/src`. En backend, solo se prueban funciones matemáticas y de parsing en `app/tests/`, sin probar ningún endpoint FastAPI con base de datos real o TestClient.
- **Impacto:** Alta probabilidad de regresiones silenciosas en refactorizaciones.
- **Solución recomendada:** Configurar Vitest en frontend y crear suite de integración en backend utilizando `httpx.AsyncClient`.
- **Complejidad estimada:** Alta (5 puntos).
- **Dependencias con otros cambios:** Ninguna.

---

### P2 — MEDIO

#### ID: P2-01
- **Área:** UI/UX & Frontend
- **Severidad:** P2
- **Archivo(s):** `frontend/src/services/api.ts` (L48-57), `frontend/src/app/(auth)/login/page.tsx` (L32)
- **Problema:** Errores de validación se renderizan como `[object Object]` en pantalla.
- **Evidencia:** `new Error(pydanticDetailArray).message` convierte arrays de objetos Pydantic en `"[object Object]"`.
- **Impacto:** Confusión al usuario que no entiende por qué falló su solicitud.
- **Solución recomendada:** Extraer y formatear los mensajes legibles (`msg`) del array de errores en `api.ts`.
- **Complejidad estimada:** Baja (1 punto).

#### ID: P2-02
- **Área:** UI/UX & Lógica de Juego
- **Severidad:** P2
- **Archivo(s):** `frontend/src/features/recall/MissingWordsText.tsx` (L14-16), `backend/app/services/recall_service.py` (L76-91)
- **Problema:** Palabras omitidas en Missing Words unidas sin espacio.
- **Evidencia:** `buildBlankTargetText` hace `.join("")`. El usuario debe escribir palabras contiguas sin espacio entre ellas.
- **Impacto:** Fricción cognitiva y frustración innecesaria en el ejercicio de memoria.
- **Solución recomendada:** Insertar espacios delimitadores entre palabras o separar los inputs por palabra omitida.
- **Complejidad estimada:** Media (2 puntos).

#### ID: P2-03
- **Área:** UI/UX / Accesibilidad
- **Severidad:** P2
- **Archivo(s):** `frontend/src/features/typing/TypingText.tsx`, `frontend/src/features/gamification/AchievementGrid.tsx`, `frontend/src/features/typing/SentenceInfoPanel.tsx`
- **Problema:** Contraste deficiente de colores que no cumple WCAG 2.1 AA.
- **Evidencia:** Textos en `text-gray-600` y `text-gray-700` sobre `bg-black` tienen ratios de 2.96:1 y 1.83:1 (mínimo 4.5:1).
- **Impacto:** Inaccesibilidad para usuarios con fatiga visual o discapacidades visuales.
- **Solución recomendada:** Ajustar los grises secundarios a `text-gray-400` y optimizar la opacidad en logros bloqueados.
- **Complejidad estimada:** Baja (1 punto).

#### ID: P2-04
- **Área:** UI/UX & Responsive
- **Severidad:** P2
- **Archivo(s):** `frontend/src/app/practice/[textId]/page.tsx` (L223-234), `frontend/src/app/dictation/[textId]/page.tsx` (L183-195)
- **Problema:** Inoperatividad del tipeo en teclados virtuales de teléfonos y tablets.
- **Evidencia:** El input invisible con `opacity-0 absolute h-0 w-0 pointer-events-none` no despliega el teclado nativo en dispositivos táctiles.
- **Impacto:** La aplicación no se puede utilizar en dispositivos móviles.
- **Solución recomendada:** Crear un modo de entrada adaptado para mobile con un input visible o asistente de teclado táctil.
- **Complejidad estimada:** Media (3 puntos).

#### ID: P2-05
- **Área:** UI/UX & Arquitectura Frontend
- **Severidad:** P2
- **Archivo(s):** Múltiples páginas en `frontend/src/app/`
- **Problema:** Navegación inconsistente y ausencia de Navbar global.
- **Evidencia:** Cada vista define enlaces distintos; `/gamification` no está en `/library`; `/practice` no permite volver atrás.
- **Impacto:** Navegación torpe y desorientación del usuario.
- **Solución recomendada:** Implementar un `<AppHeader>` o `<Navbar>` persistente en `layout.tsx`.
- **Complejidad estimada:** Baja (2 puntos).

#### ID: P2-06
- **Área:** Frontend / Rendimiento
- **Severidad:** P2
- **Archivo(s):** `frontend/src/features/typing/TypingText.tsx` (L23-36)
- **Problema:** Renderizado de cientos de etiquetas `<span>` individuales por cada pulsación de tecla.
- **Evidencia:** `targetText.split("").map(...)` re-renderiza la totalidad de los caracteres en cada evento de entrada.
- **Impacto:** Lag o latencia de pulsación (*keystroke latency*) en textos extensos o dispositivos de gama baja.
- **Solución recomendada:** Agrupar el texto en palabras o bloques memoizados (`React.memo`).
- **Complejidad estimada:** Media (2 puntos).

#### ID: P2-07
- **Área:** Frontend / Red y Caché
- **Severidad:** P2
- **Archivo(s):** `frontend/src/features/typing/WordHelpTooltip.tsx` (L15-26)
- **Problema:** Búsquedas de diccionario no cacheadas en errores de tipeo.
- **Evidencia:** Cada equivocación genera una petición HTTP directa a `/dictionary/{word}`.
- **Impacto:** Carga repetitiva e innecesaria sobre la API.
- **Solución recomendada:** Implementar una caché en memoria (Map o LRU) en el cliente para términos ya consultados.
- **Complejidad estimada:** Baja (1 punto).

#### ID: P2-08
- **Área:** Frontend & Autenticación
- **Severidad:** P2
- **Archivo(s):** `frontend/src/services/api.ts` (L48-57), `frontend/src/stores/authStore.ts`
- **Problema:** Omisión de intercepción de respuestas 401 para cierre de sesión y redirección.
- **Evidencia:** Si el token JWT expira a las 24 horas, las vistas muestran "Cargando..." infinitamente.
- **Impacto:** Bloqueo de la interfaz ante sesiones expiradas.
- **Solución recomendada:** Añadir un interceptor en `api.ts` que limpie `authStore` y redirija a `/login` al recibir 401.
- **Complejidad estimada:** Baja (1 punto).

#### ID: P2-09
- **Área:** DevOps & Calidad de Código
- **Severidad:** P2
- **Archivo(s):** `frontend/next.config.js` (L4-6), ausencia de `.eslintrc.json`
- **Problema:** Linter desactivado y sin configuración en el proyecto frontend.
- **Evidencia:** `npm run lint` falla por falta de configuración; `next.config.js` omite el linter durante builds.
- **Impacto:** Acumulación de código con malas prácticas sin detección temprana.
- **Solución recomendada:** Añadir archivo `.eslintrc.json` extendiendo `next/core-web-vitals` y reactivar linting en build.
- **Complejidad estimada:** Baja (1 punto).

#### ID: P2-10
- **Área:** Backend / Rendimiento y Memoria
- **Severidad:** P2
- **Archivo(s):** `backend/app/services/vocabulary_service.py` (L88-94)
- **Problema:** Carga masiva en memoria de todas las oraciones del usuario en `build_weak_words_sentences`.
- **Evidencia:** Se leen todas las oraciones de la biblioteca del usuario a Python y se busca con expresiones regulares en un bucle anidado.
- **Impacto:** Consumo excesivo de RAM en bibliotecas de más de 10,000 oraciones.
- **Solución recomendada:** Filtrar directamente en PostgreSQL mediante operadores de texto completo o `ILIKE`.
- **Complejidad estimada:** Media (2 puntos).

#### ID: P2-11
- **Área:** Backend & DevOps / Observabilidad
- **Severidad:** P2
- **Archivo(s):** `backend/app/main.py` (L28-30)
- **Problema:** Healthcheck superficial.
- **Evidencia:** `/health` devuelve `{"status": "ok"}` sin verificar el estado de PostgreSQL ni Redis.
- **Impacto:** Orquestadores reportarán el contenedor como saludable incluso si la base de datos está caída.
- **Solución recomendada:** Ejecutar un `SELECT 1` y un `redis.ping()` en el endpoint `/health`.
- **Complejidad estimada:** Baja (1 punto).

#### ID: P2-12
- **Área:** Backend / Concurrencia
- **Severidad:** P2
- **Archivo(s):** `backend/app/services/tts_service.py` (L12-16)
- **Problema:** Bloqueo del hilo de eventos mediante llamada síncrona `subprocess.run`.
- **Evidencia:** `subprocess.run(["espeak-ng", ...])` ejecutado directamente en ruta `async def get_audio`.
- **Impacto:** Congela el servidor para otras peticiones concurrentes mientras se sintetiza el audio.
- **Solución recomendada:** Utilizar `asyncio.to_thread` o `asyncio.create_subprocess_exec`.
- **Complejidad estimada:** Baja (1 punto).

---

### P3 — BAJO

#### ID: P3-01
- **Área:** Backend / Limpieza
- **Severidad:** P3
- **Archivo(s):** `backend/app/services/gamification_service.py` (L112, L122)
- **Problema:** Consulta redundante a `text_repository.list_by_user`.
- **Evidencia:** Se ejecuta dentro de `statistics_service.get_overview` y luego se vuelve a invocar 10 líneas más abajo.
- **Impacto:** Una consulta SQL extra innecesaria.
- **Solución recomendada:** Reutilizar el resultado de la primera consulta.
- **Complejidad estimada:** Baja (1 punto).

#### ID: P3-02
- **Área:** Frontend / DRY
- **Severidad:** P3
- **Archivo(s):** `dictation/[textId]/page.tsx` (L14-22), `recall/[textId]/page.tsx` (L14-22)
- **Problema:** Código duplicado en la función `reconstructTyped`.
- **Evidencia:** Implementación idéntica copiada en dos archivos distintos.
- **Impacto:** Dificultad de mantenimiento si cambia la lógica de reconstrucción.
- **Solución recomendada:** Extraer a un módulo de utilidades compartido.
- **Complejidad estimada:** Baja (1 punto).

#### ID: P3-03
- **Área:** UI/UX
- **Severidad:** P3
- **Archivo(s):** `frontend/src/app/library/page.tsx` (L78)
- **Problema:** Uso de `window.confirm` nativo.
- **Evidencia:** `if (!confirm("Eliminar este texto?")) return;`.
- **Impacto:** Interfaz tosca y poco profesional.
- **Solución recomendada:** Reemplazar por un modal de confirmación accesible.
- **Complejidad estimada:** Baja (1 punto).

#### ID: P3-04
- **Área:** UI/UX & SVG
- **Severidad:** P3
- **Archivo(s):** `frontend/src/features/progress/LineChartCard.tsx` (L43-55)
- **Problema:** Distorsión de círculos SVG en pantallas estrechas.
- **Evidencia:** Uso de `preserveAspectRatio="none"` en elementos `<circle>`.
- **Impacto:** Los puntos de datos se deforman como óvalos en pantallas móviles.
- **Solución recomendada:** Emplear `vectorEffect="non-scaling-stroke"` y calcular coordenadas responsivas.
- **Complejidad estimada:** Baja (1 punto).

#### ID: P3-05
- **Área:** Backend / Logging
- **Severidad:** P3
- **Archivo(s):** `backend/app/main.py`
- **Problema:** Ausencia de logging estructurado y correlation IDs.
- **Evidencia:** Solo se imprimen logs planos por defecto de Uvicorn.
- **Impacto:** Dificultad para rastrear errores en producción.
- **Solución recomendada:** Configurar middleware con `structlog` y cabecera `X-Request-ID`.
- **Complejidad estimada:** Media (2 puntos).

---

## 11. MATRIZ CONSOLIDADA DE HALLAZGOS

| ID | Problema | Área | Prioridad | Impacto | Complejidad | Estado |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **P0-01** | Pérdida masiva de estadísticas y XP al borrar textos (CASCADE) | Base de Datos | **P0** | Crítico | Baja | Pendiente |
| **P0-02** | Stale state y corrupción de estadísticas con Backspace en tipeo | Frontend | **P0** | Crítico | Media | Pendiente |
| **P0-03** | Incompatibilidad de passlib en Python 3.13+ por remoción de crypt | Backend | **P0** | Crítico | Baja | Pendiente |
| **P0-04** | IDOR en endpoints de intentos de Recall y Dictation | Seguridad | **P0** | Alto | Media | Pendiente |
| **P0-05** | DoS por ausencia de límite de longitud en raw_content | Seguridad | **P0** | Alto | Baja | Pendiente |
| **P1-01** | Bucle N+1 de consultas SQL en registro de vocabulario | Rendimiento | **P1** | Alto | Media | Pendiente |
| **P1-02** | Condiciones de carrera en inserciones de Settings, Vocab y Audio | Base de Datos | **P1** | Medio | Media | Pendiente |
| **P1-03** | Recarga total (window.location.reload()) al avanzar de fragmento | Frontend | **P1** | Medio | Media | Pendiente |
| **P1-04** | Creación duplicada de sesiones huérfanas en Weak Words | Frontend | **P1** | Medio | Baja | Pendiente |
| **P1-05** | Inflación de tiempo de práctica por diferencia de reloj de servidor | Datos | **P1** | Medio | Media | Pendiente |
| **P1-06** | Audio WAV binario almacenado en PostgreSQL | DevOps/BD | **P1** | Medio | Media | Pendiente |
| **P1-07** | Contenedores como root y puertos cerrados en docker-compose base | DevOps | **P1** | Medio | Baja | Pendiente |
| **P1-08** | Cero pruebas en frontend y cero pruebas de integración en API | Testing | **P1** | Alto | Alta | Pendiente |
| **P2-01** | Errores de validación de API se imprimen como [object Object] | UI/UX | **P2** | Medio | Baja | Pendiente |
| **P2-02** | Palabras unidas sin espacios en Missing Words | UI/UX | **P2** | Medio | Media | Pendiente |
| **P2-03** | Contraste de colores no cumple accesibilidad WCAG AA | UI/UX | **P2** | Medio | Baja | Pendiente |
| **P2-04** | Input de tipeo no levanta teclado virtual en dispositivos móviles | UI/UX | **P2** | Medio | Media | Pendiente |
| **P2-05** | Navegación inconsistente y falta de barra de navegación común | UI/UX | **P2** | Medio | Baja | Pendiente |
| **P2-06** | Renderizado costoso de spans individuales por carácter | Rendimiento | **P2** | Medio | Media | Pendiente |
| **P2-07** | Búsquedas de diccionario sin caché en cliente | Rendimiento | **P2** | Bajo | Baja | Pendiente |
| **P2-08** | Falta de logout y redirección automática ante token expirado (401) | Frontend | **P2** | Medio | Baja | Pendiente |
| **P2-09** | Linter Next.js/ESLint roto y desactivado en build | DevOps | **P2** | Medio | Baja | Pendiente |
| **P2-10** | Carga completa de oraciones en memoria en build_weak_words | Rendimiento | **P2** | Medio | Media | Pendiente |
| **P2-11** | Healthcheck superficial sin ping a PostgreSQL ni Redis | DevOps | **P2** | Bajo | Baja | Pendiente |
| **P2-12** | Llamada bloqueante subprocess.run en TTS dentro de bucle async | Backend | **P2** | Medio | Baja | Pendiente |
| **P3-01** | Doble llamada a list_by_user en gamification overview | Calidad | **P3** | Bajo | Baja | Pendiente |
| **P3-02** | Función reconstructTyped duplicada en Dictation y Recall | Calidad | **P3** | Bajo | Baja | Pendiente |
| **P3-03** | Confirmación nativa window.confirm en borrado de textos | UI/UX | **P3** | Bajo | Baja | Pendiente |
| **P3-04** | Distorsión de círculos SVG en gráficos responsivos | UI/UX | **P3** | Bajo | Baja | Pendiente |
| **P3-05** | Ausencia de logs estructurados y Correlation IDs | DevOps | **P3** | Bajo | Media | Pendiente |

---

## 12. PUNTUACIONES FINALES EVALUADAS (0 A 100)

| Área Evaluada | Puntuación | Justificación Técnica |
| :--- | :---: | :--- |
| **UI/UX** | **62 / 100** | Estética visual atractiva, pero contraste fallido bajo WCAG AA, navegación desordenada, tipeo móvil inoperativo y errores `[object Object]`. |
| **Frontend** | **65 / 100** | Buen uso de TypeScript, pero bugs de precisión en `useTypingSession`, recarga forzada con `reload()` y linter desactivado. |
| **Backend** | **68 / 100** | Arquitectura FastAPI sólida y limpia, pero con IDOR en intentos, dependencias con `crypt` y endpoints sin cuotas de tamaño. |
| **Base de Datos** | **58 / 100** | Modelado relacional prolijo, pero **destrucción de estadísticas por CASCADE**, bucle N+1 severo y audio WAV en BD. |
| **DevOps** | **60 / 100** | Contenedores funcionales, pero ejecutados como root, puertos no mapeados en compose base y ausencia de CI/CD. |
| **Seguridad** | **55 / 100** | Hasheo de claves y JWT funcionales, pero con IDOR en intentos, sin rate limiting, tokens en localStorage y sin cuotas de entrada. |
| **Rendimiento** | **64 / 100** | Gale-Church rápido en CPU, pero bucle N+1 en vocabulario y renderizado DOM de alta frecuencia en cada pulsación. |
| **Testing** | **35 / 100** | 57 pruebas unitarias de lógica pura en backend, pero **cero pruebas en frontend** y **cero pruebas de integración de API**. |
| **Arquitectura** | **70 / 100** | Diseño modular pragmático sin sobreingeniería, pero con desacoples pendientes en el worker y en la capa de persistencia. |
| **Mantenibilidad** | **66 / 100** | Código ordenado y legible, pero vulnerable a regresiones por carencia de suite de pruebas integrales. |

**Promedio General Ponderado:** **60.3 / 100**
