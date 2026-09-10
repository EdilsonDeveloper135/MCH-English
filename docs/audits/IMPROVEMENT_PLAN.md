# PLAN INTEGRAL DE MEJORA Y REMEDIACIÓN (FASE 2)

**Proyecto:** MCH-English  
**Fecha:** 10 de Septiembre de 2026  
**Documento Base:** [AUDIT_REPORT.md](AUDIT_REPORT.md) (Segunda Auditoría Integral)  
**Alcance:** Consolidación de tareas pendientes y nuevas mejoras justificadas derivadas de la auditoría técnica de 12 dimensiones, la auditoría profunda de UI/UX y el benchmark de mecanografía moderna (Monkeytype, Keybr, TypeLit, TypeRacer).  
**Regla de Exclusión:** Las 30 tareas anteriores (Fases 0 a 7) se encuentran 100% verificadas en código y no se repiten en este documento.

---

## ESTRUCTURA DEL PLAN DE TRABAJO

El plan se organiza en 3 niveles de prioridad y 5 tracks técnicos de ejecución:
- **Track 1: Ergonomía de Mecanografía y Accesibilidad Inmediata (P1)**
- **Track 2: Backend, Concurrencia y Resiliencia de Datos (P1 / P2)**
- **Track 3: Testing y Cobertura Integral (P1 / P2)**
- **Track 4: UI/UX, Responsive y Benchmark de Mecanografía Moderna (P2 / P3)**
- **Track 5: Optimizaciones y Mantenibilidad de Código (P3)**

---

## PRIORIDAD P1 — ALTA

### Tarea P1-01: Desactivar trampa de foco permanente (Focus Trap) en TypingCaptureInput
- **Prioridad:** P1
- **Área:** UI/UX / Accesibilidad (WCAG 2.1.2)
- **Archivos afectados:**
  - `frontend/src/features/typing/TypingCaptureInput.tsx`
- **Problema:** En la línea 33, el input incluye el manejador `onBlur={() => inputRef.current?.focus()}`, secuestrando el foco permanentemente. Los usuarios que navegan con teclado no pueden usar `Tab` para salir a la barra superior o controles secundarios. En pantallas táctiles, cerrar el teclado en pantalla dispara `blur` y el código vuelve a abrir el teclado inmediatamente, atrapando al usuario en un bucle.
- **Solución propuesta:**
  1. Eliminar completamente el manejador `onBlur` de `TypingCaptureInput.tsx`.
  2. Implementar el control de foco asignando un listener de clic en el contenedor principal de tipeo (`onClick={() => inputRef.current?.focus()}`).
  3. Permitir que la pulsación de `Tab` o `Shift+Tab` transfiera libremente el foco hacia los demás elementos interactivos de la página.
- **Criterio de aceptación:** Al ingresar en `/practice/[textId]`, presionar la tecla `Tab` debe desplazar el foco visible hacia el botón "Salir" del `<AppHeader>` sin que el foco sea secuestrado de vuelta por el input de tipeo. En emulación táctil, hacer clic fuera del input debe cerrar el teclado virtual sin re-enfocarlo automáticamente.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P1-02: Corregir algoritmo de detección de palabra completa en errores de tipeo (`wordAtPosition`)
- **Prioridad:** P1
- **Área:** Frontend / Core Typing & Vocabulario
- **Archivos afectados:**
  - `frontend/src/features/typing/useTypingSession.ts`
  - `frontend/src/features/typing/useTypingSession.test.ts`
- **Problema:** En `useTypingSession.ts` (L63-67), la función `wordAtPosition(text, position)` corta la cadena con `text.slice(0, position + 1)`. Esto solo toma el prefijo de la palabra desde el inicio hasta el carácter fallado. Si el usuario falla la primera letra de "elephant", la función retorna "e", consultando `/dictionary/e` en lugar del término completo, arrojando traducciones erróneas o nulas en el tooltip.
- **Solución propuesta:**
  1. Reescribir `wordAtPosition` para expandir la búsqueda bidireccionalmente: localizar el índice izquierdo `wordStart` (primer carácter que no sea espacio/puntuación hacia atrás) y el índice derecho `wordEnd` (primer delimitador hacia adelante).
  2. Extraer la subcadena completa mediante `text.slice(wordStart, wordEnd)`.
  3. Agregar pruebas unitarias en `useTypingSession.test.ts` que validen la extracción de la palabra íntegra ante errores en la primera letra, letras intermedias y última letra.
- **Criterio de aceptación:** Al equivocarse en cualquier posición de una palabra (ej. la primera letra 'e' en "elephant"), el callback `onWordError` debe recibir la palabra completa "elephant" y el tooltip de ayuda debe consultar la traducción correcta de dicha palabra.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P1-03: Implementar borrado atómico de palabra (`Ctrl+Backspace` / `Cmd+Backspace`) en motor de tipeo
- **Prioridad:** P1
- **Área:** Frontend / Ergonomía de Mecanografía (Benchmark Monkeytype)
- **Archivos afectados:**
  - `frontend/src/features/typing/useTypingSession.ts`
  - `frontend/src/features/typing/useTypingSession.test.ts`
- **Problema:** El manejador de teclado en `useTypingSession.ts` únicamente procesa `Backspace` simple con `applyBackspace()`, el cual retrocede un único carácter. Presionar `Ctrl+Backspace` en Windows/Linux o `Cmd+Backspace`/`Alt+Backspace` en macOS solo borra una letra, rompiendo la cadencia de mecanografía al requerir presionar repetidamente la tecla para descartar palabras largas.
- **Solución propuesta:**
  1. Detectar combinaciones `e.ctrlKey || e.altKey || e.metaKey` asociadas al evento `Backspace` en `handleKeyDown`.
  2. Implementar la función `applyWordBackspace()` que calcule el inicio de la palabra actual (o la palabra anterior si el cursor está en un espacio).
  3. Revertir en un solo ciclo sincrónico todos los estados de caracteres intermedios a `"pending"`, ajustar los contadores `correctCount` e `incorrectCount` y purgar los errores registrados en ese intervalo.
  4. Agregar pruebas unitarias de regresión en `useTypingSession.test.ts`.
- **Criterio de aceptación:** En una sesión de tipeo, pulsar `Ctrl+Backspace` en medio o al final de una palabra debe devolver el cursor instantáneamente al inicio de la misma y revertir el estado de todas sus letras a pendiente en un solo frame.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P1-04: Navegación completa por teclado en rondas de práctica y atajos de audio en Dictation
- **Prioridad:** P1
- **Área:** UI/UX / Ergonomía de Teclado (Benchmark TypeRacer/Keybr)
- **Archivos afectados:**
  - `frontend/src/app/recall/[textId]/page.tsx`
  - `frontend/src/app/dictation/[textId]/page.tsx`
  - `frontend/src/features/typing/AudioPlayer.tsx`
- **Problema:** En las pantallas de Recall y Dictation, tras completar la oración activa, la interfaz obliga al usuario a soltar el teclado y hacer clic con el mouse en el botón "Siguiente" o "Continuar". Asimismo, en Dictation no existe ningún atajo para reescuchar el audio, forzando la alternancia entre teclado y ratón.
- **Solución propuesta:**
  1. Agregar un escucha de teclado (`keydown`) en las vistas de resultado de ronda para que presionar `Enter` o `Espacio` avance automáticamente a la siguiente oración o complete la sesión.
  2. En Dictation, registrar atajos globales accesibles: `Ctrl+Espacio` para reproducir/pausar y `Ctrl+R` (o `Alt+R`) para reiniciar la reproducción del audio actual.
  3. Indicar visiblemente los atajos disponibles mediante tooltips o leyendas sutiles (`[Enter ↵]` y `[Ctrl+Space 🔊]`).
- **Criterio de aceptación:** Completar una sesión completa de 10 oraciones en Dictation y 10 en Recall operando al 100% desde el teclado físico sin necesidad de tocar el ratón.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P1-05: Resolver condición de carrera por stale closure a alta velocidad (>100 WPM) en useTypingSession
- **Prioridad:** P1
- **Área:** Frontend / Core Typing
- **Archivos afectados:**
  - `frontend/src/features/typing/useTypingSession.ts`
  - `frontend/src/features/typing/useTypingSession.test.ts`
- **Problema:** En `useTypingSession.ts`, las funciones `applyCharacter` y `applyBackspace` leen `currentIndex`, `charStates`, `correctCount` y `errors` desde el closure del render de React. Cuando el usuario tipea a velocidades superiores a 100 WPM (~10 pulsaciones por segundo), dos o más eventos `keydown` consecutivos se disparan antes de que React procese el re-render, causando que el segundo evento lea el índice desactualizado y se pierdan caracteres o se distorsione el conteo de errores.
- **Solución propuesta:**
  1. Almacenar el estado mutable de alta frecuencia (`currentIndex`, `charStatesRef`, `errorsRef`, `correctCountRef`, `incorrectCountRef`) en `useRef` para garantizar lecturas y escrituras atómicas en tiempo real.
  2. Sincronizar el estado de React (`setCharStates`, `setCurrentIndex`) para disparar las actualizaciones de UI sin que la lógica de cálculo dependa de la finalización del ciclo de render.
  3. Crear un test automatizado en Vitest que simule una ráfaga sincrónica de 20 eventos `keydown` en 20 milisegundos y compruebe que no se pierde ninguna pulsación.
- **Criterio de aceptación:** Simular ráfagas de tipeo a 150 WPM sin que se omita ningún carácter ni se desalinee el array final entregado a `onComplete`.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P1-06: Prevenir inyección de flags en CLI de eSpeak-NG y agregar timeout en proceso TTS
- **Prioridad:** P1
- **Área:** Backend / Seguridad e Integridad de Procesos
- **Archivos afectados:**
  - `backend/app/services/tts_service.py`
  - `backend/app/tests/test_health.py` (o nuevo test de TTS)
- **Problema:** En `tts_service.py` (L16-20), la llamada `subprocess.run(["espeak-ng", "-v", VOICE, "-s", str(WORDS_PER_MINUTE), "--stdout", text])` pasa `text` directamente como último argumento sin el separador `--` y sin parámetro `timeout`. Si una oración de un libro comienza con guiones (ej. `-- Yes, of course`), eSpeak-NG interpreta el texto como flags de línea de comandos. La falta de timeout arriesga bloquear indefinidamente el hilo de ejecución si el subproceso se cuelga.
- **Solución propuesta:**
  1. Incorporar el delimitador estándar de fin de opciones `"--"` inmediatamente antes de `text`.
  2. Configurar un parámetro `timeout=15.0` en `subprocess.run` y capturar `subprocess.TimeoutExpired` generando un log de error y retornando una excepción controlada.
  3. Validar con prueba unitaria que oraciones con prefijo `--` se sinteticen correctamente sin error de argumentos.
- **Criterio de aceptación:** Enviar a sintetizar el texto `"-- What do you mean?", asked Alice` y verificar que eSpeak-NG genera el archivo de audio WAV sin arrojar error de flags inválidos.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P1-07: Desacoplar cálculo síncrono de Gale-Church del event loop de FastAPI en actualización de traducción
- **Prioridad:** P1
- **Área:** Backend / Concurrencia y Rendimiento
- **Archivos afectados:**
  - `backend/app/api/texts.py`
  - `backend/app/services/translation_service.py`
  - `backend/app/workers/jobs.py`
- **Problema:** En `backend/app/api/texts.py` (L261), la ruta `PATCH /{text_id}/translation` ejecuta `await realign_translation(db, text)` directamente en el event loop principal de FastAPI. El algoritmo de programación dinámica Gale-Church puede evaluar hasta 1,000,000 de estados matriciales en textos de 100,000 caracteres, consumiendo el 100% de la CPU y bloqueando todas las peticiones concurrentes de Uvicorn durante varios segundos.
- **Solución propuesta:**
  1. Opción recomendada: Delegar la tarea de realineación a la cola de fondo de Redis (`RQ`) de manera idéntica al procesamiento inicial de textos, retornando un estado 202 Accepted.
  2. Opción complementaria directa: Si se requiere respuesta sincrónica, envolver la ejecución de `align()` en `await asyncio.to_thread(align, ...)`, liberando el loop de eventos de FastAPI.
- **Criterio de aceptación:** Actualizar la traducción de un texto de 80,000 caracteres mientras se ejecutan peticiones concurrentes a `/health` y verificar que la latencia de `/health` permanece inferior a 15ms.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P1-08: Desacoplar pool de conexiones SQLAlchemy entre bucles de eventos independientes en workers RQ
- **Prioridad:** P1
- **Área:** DevOps & Base de Datos / Concurrencia
- **Archivos afectados:**
  - `backend/app/workers/jobs.py`
  - `backend/app/core/database.py`
- **Problema:** `jobs.py` importa `async_session_maker` (vinculado al motor asíncrono global) y ejecuta tareas con `asyncio.run(_process_text_async(text_id))`. Cada llamada a `asyncio.run` crea y destruye un loop de eventos. Si el pool retiene una conexión abierta creada en un loop previo, asyncpg genera una excepción fatal `RuntimeError: Task <...> attached to a different loop`.
- **Solución propuesta:**
  1. Modificar el worker para que instancie un motor asíncrono dedicado con `NullPool` por cada ejecución de trabajo de fondo, o bien:
  2. Invocar `await engine.dispose()` de forma limpia al cierre de cada tarea procesada por el worker RQ.
- **Criterio de aceptación:** Encolar 10 tareas consecutivas de procesamiento de texto en RQ y verificar en los logs que no se emite ninguna excepción de tipo `Task attached to a different loop`.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P1-09: Configurar pool_pre_ping y dimensionamiento de conexiones en motor asíncrono SQLAlchemy
- **Prioridad:** P1
- **Área:** Base de Datos / Resiliencia y Estabilidad
- **Archivos afectados:**
  - `backend/app/core/database.py`
- **Problema:** `create_async_engine(settings.database_url, echo=False)` no declara `pool_pre_ping=True`, `pool_size`, `max_overflow` ni `pool_recycle`. Si una conexión inactiva es cerrada por PostgreSQL o un proxy de red, la siguiente petición falla arrojando errores 500 no recuperados.
- **Solución propuesta:**
  1. Configurar los parámetros de robustez en `database.py`:
     ```python
     engine = create_async_engine(
         settings.database_url,
         echo=False,
         pool_pre_ping=True,
         pool_size=10,
         max_overflow=20,
         pool_recycle=1800,
     )
     ```
- **Criterio de aceptación:** Reiniciar el contenedor de PostgreSQL con la API en funcionamiento y comprobar que la siguiente petición HTTP a un endpoint autenticado restablece la conexión automáticamente sin responder con error 500.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P1-10: Implementar limitación de tasa (Rate Limiting) en endpoints de autenticación
- **Prioridad:** P1
- **Área:** Seguridad / Control de Abusos y DoS
- **Archivos afectados:**
  - `backend/app/api/auth.py`
  - `backend/app/main.py`
  - `backend/requirements.txt`
- **Problema:** Los endpoints `POST /auth/login` y `POST /auth/register` carecen de limitador de peticiones. Dado que la verificación con `bcrypt` consume ~70ms de cómputo deliberado de CPU por intento, un atacante puede lanzar un ataque de fuerza bruta contra credenciales o un ataque de denegación de servicio por saturación de CPU.
- **Solución propuesta:**
  1. Añadir `slowapi` a `requirements.txt`.
  2. Configurar el limitador conectado a la instancia existente de Redis.
  3. Aplicar límite de 5 intentos por minuto por dirección IP en `/auth/login` y 3 intentos por hora en `/auth/register`.
  4. Retornar código HTTP 429 Too Many Requests con cabecera `Retry-After`.
- **Criterio de aceptación:** Realizar 6 intentos de login fallidos consecutivos en menos de 60 segundos desde una misma IP y verificar que el sexto intento retorna HTTP 429.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P1-11: Desarrollar suite de pruebas de integración HTTP para módulos de API secundarios
- **Prioridad:** P1
- **Área:** Testing / Backend
- **Archivos afectados:**
  - `backend/app/tests/test_api_dictation.py`
  - `backend/app/tests/test_api_recall.py`
  - `backend/app/tests/test_api_vocabulary.py`
  - `backend/app/tests/test_api_settings.py`
- **Problema:** Siete módulos de endpoints en `backend/app/api/` carecen de pruebas de integración HTTP en pytest (Dictation, Recall, Vocabulary, Settings y Alignment), dejando desprotegidos flujos críticos de la aplicación ante regresiones.
- **Solución propuesta:**
  1. Crear `test_api_dictation.py` validando la generación de audio, descarga de audio WAV y registro de intentos de dictado.
  2. Crear `test_api_recall.py` validando la obtención de oraciones para Missing Words y registro de intentos de recall.
  3. Crear `test_api_vocabulary.py` validando los endpoints de listado de vocabulario y palabras débiles.
  4. Crear `test_api_settings.py` verificando la lectura y actualización de preferencias del usuario.
- **Criterio de aceptación:** La suite de pytest debe superar las 95 pruebas aprobadas, cubriendo el 100% de los routers registrados en FastAPI.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P1-12: Implementar pruebas de integración y renderizado para páginas y componentes clave de Frontend
- **Prioridad:** P1
- **Área:** Testing / Frontend
- **Archivos afectados:**
  - `frontend/src/components/__tests__/AppHeader.test.tsx`
  - `frontend/src/components/__tests__/ConfirmModal.test.tsx`
  - `frontend/src/features/typing/__tests__/SentenceInfoPanel.test.tsx`
  - `frontend/src/features/recall/__tests__/MissingWordsText.test.tsx`
  - `frontend/src/app/__tests__/library.test.tsx`
- **Problema:** Las 14 rutas de Next.js y los componentes centrales de navegación y diálogo tienen 0 pruebas automatizadas en Vitest, dependiendo enteramente de verificación manual.
- **Solución propuesta:**
  1. Escribir pruebas de renderizado e interacción con Testing Library para `AppHeader` (comprobando enlaces activos, modo sesión y logout).
  2. Probar `ConfirmModal` validando el cierre con tecla `Escape` y confirmación.
  3. Probar `MissingWordsText` verificando el renderizado de huecos y segmentación de espacios.
  4. Añadir prueba de integración para la página de Biblioteca (`LibraryPage`) comprobando la lista de textos y estados vacíos.
- **Criterio de aceptación:** La suite de Vitest debe superar las 40 pruebas unitarias y de componentes aprobadas en tiempo inferior a 2 segundos.
- **Dependencias:** Tarea P1-01
- **Estado:** Completado

---

## PRIORIDAD P2 — MEDIA

### Tarea P2-01: Menú colapsable responsivo (Hamburguesa) en AppHeader para móviles (<500px)
- **Prioridad:** P2
- **Área:** UI/UX & Responsive Design
- **Archivos afectados:**
  - `frontend/src/components/AppHeader.tsx`
- **Problema:** En pantallas angostas (<500px), los 6 enlaces horizontales de navegación (`MCH English`, `Library`, `Vocabulary`, `Progress`, `Gamification`, `Salir`) se desbordan horizontalmente o quiebran en múltiples líneas, desarticulando el diseño y la usabilidad táctil.
- **Solución propuesta:**
  1. Ocultar los enlaces horizontales en viewports inferiores a `md` (768px).
  2. Implementar un botón accesible con ícono de menú hamburguesa (`aria-expanded`, `aria-label="Abrir menú de navegación"`).
  3. Renderizar un panel deslizable o menú desplegable con fondo sólido, enlaces de 48px de alto táctil y botón de cierre con tecla `Escape`.
- **Criterio de aceptación:** En un viewport de 375x667 (iPhone SE), la barra de navegación no debe generar scroll horizontal y el menú desplegable debe permitir acceder a todas las secciones de forma cómoda con una sola mano.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P2-02: Corregir contraste WCAG 2.1 AA en etiquetas de gráficos SVG (BarChartCard)
- **Prioridad:** P2
- **Área:** Accesibilidad (WCAG 2.1 AA)
- **Archivos afectados:**
  - `frontend/src/features/progress/BarChartCard.tsx`
- **Problema:** En la línea 48, las etiquetas de texto utilizan el atributo directo `fill="#6b7280"`. Sobre el fondo negro `#000000`, el ratio de contraste es de **4.35:1**, incumpliendo el mínimo de 4.5:1 exigido por WCAG 2.1 AA para texto normal/pequeño.
- **Solución propuesta:**
  1. Reemplazar el color hexadecimal por `fill="#9ca3af"` (`text-gray-400`), cuyo ratio contra fondo negro es de **8.27:1**.
  2. Asegurar que las leyendas de los ejes mantengan un tamaño de fuente legible sin deformación SVG.
- **Criterio de aceptación:** Las herramientas de auditoría de accesibilidad (axe / Lighthouse) deben certificar 0 violaciones de contraste en la página de progreso (`/progress`).
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P2-03: Tokenización regex compatible con caracteres Unicode y palabras compuestas
- **Prioridad:** P2
- **Área:** Backend & Calidad de Código
- **Archivos afectados:**
  - `backend/app/services/chunking_service.py`
  - `backend/app/tests/test_chunking_service.py`
- **Problema:** La expresión regular `_WORD_RE = re.compile(r"[A-Za-z0-9']+")` descarta caracteres fuera del rango ASCII. Términos con acentos o diéresis comunes en inglés ("café", "cliché", "naïve", "résumé") se truncan en la primera letra especial, rompiendo la experiencia en Missing Words. Además, divide indebidamente palabras compuestas con guión.
- **Solución propuesta:**
  1. Actualizar la expresión regular para soportar caracteres de palabras Unicode:
     ```python
     _WORD_RE = re.compile(r"[\w']+", re.UNICODE)
     ```
  2. Ajustar la tokenización de palabras con guión según corresponda en el servicio de chunking.
  3. Añadir casos de prueba con textos que contengan palabras con acentos y apóstrofes tipográficos.
- **Criterio de aceptación:** Segmentar un texto que contenga "café" y "naïve" y comprobar que las palabras completas se extraen sin truncamiento tanto en el vocabulario como en los huecos de recall.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P2-04: Implementar gestión de sesiones segura con Refresh Tokens o Cookies HttpOnly
- **Prioridad:** P2
- **Área:** Seguridad / Autenticación y Sesiones
- **Archivos afectados:**
  - `backend/app/api/auth.py`
  - `backend/app/core/security.py`
  - `frontend/src/stores/authStore.ts`
  - `frontend/src/services/api.ts`
- **Problema:** El JWT de acceso tiene una vida útil estática de 24 horas (`1440` minutos) y se almacena en `localStorage` a través de Zustand. Si el token es extraído por un ataque XSS, sigue siendo válido durante todo el día sin capacidad de invalidación en servidor.
- **Solución propuesta:**
  1. Reducir el tiempo de expiración del token de acceso a 15 minutos.
  2. Implementar refresh tokens de larga duración almacenados en base de datos (con rotación e invalidación en logout).
  3. Alternativamente, transmitir el token de autenticación mediante cookies seguras `HttpOnly`, `Secure` y `SameSite=Strict`.
- **Criterio de aceptación:** Tras cerrar sesión con el botón "Salir", el token anterior debe ser inmediatamente rechazado por la API con HTTP 401.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P2-05: Restricción de orígenes en política de CORS mediante variables de entorno
- **Prioridad:** P2
- **Área:** Seguridad / Configuración
- **Archivos afectados:**
  - `backend/app/main.py`
  - `backend/app/core/config.py`
- **Problema:** En `main.py` (L60-66), el middleware de CORS está configurado con `allow_origins=["*"]`, permitiendo solicitudes desde cualquier origen web malicioso.
- **Solución propuesta:**
  1. Añadir el campo `cors_origins: list[str]` en `Settings` (`config.py`), con valor por defecto `["http://localhost:3000"]`.
  2. Configurar `CORSMiddleware` para utilizar `app_settings.cors_origins` y permitir `allow_credentials=True`.
- **Criterio de aceptación:** Peticiones OPTIONS pre-flight desde un origen no autorizado deben ser rechazadas por la API.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P2-06: Agregar índice compuesto (user_id, mastery_score) en vocabulary_items
- **Prioridad:** P2
- **Área:** Base de Datos / Rendimiento
- **Archivos afectados:**
  - `backend/app/models/vocabulary.py`
  - Nueva migración en `backend/alembic/versions/`
- **Problema:** Las consultas frecuentes de Weak Words y distribución de dominio filtran por `user_id` y ordenan por `mastery_score.asc()`. Al carecer de un índice compuesto, PostgreSQL debe realizar escaneos secuenciales y ordenamientos en memoria.
- **Solución propuesta:**
  1. Definir el índice compuesto en el modelo SQLAlchemy `VocabularyItem`.
  2. Crear y aplicar una migración Alembic que genere `CREATE INDEX ix_vocabulary_items_user_mastery ON vocabulary_items (user_id, mastery_score)`.
- **Criterio de aceptación:** Ejecutar `EXPLAIN ANALYZE` sobre la consulta de `get_weak_words` y comprobar que utiliza `Index Scan` en lugar de `Seq Scan`.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P2-07: Inserción atómica y a prueba de carreras para logros en gamificación
- **Prioridad:** P2
- **Área:** Base de Datos & Concurrencia
- **Archivos afectados:**
  - `backend/app/repositories/gamification_repository.py`
- **Problema:** `unlock_achievements` ejecuta inserciones directas con `db.add(UserAchievement(...))`. Si dos sesiones finalizan en el mismo segundo y ambas intentan registrar el mismo logro, la segunda falla arrojando `IntegrityError` (código HTTP 500) por colisión en la restricción única `(user_id, achievement_id)`.
- **Solución propuesta:**
  1. Modificar la función en `gamification_repository.py` para utilizar `pg_insert(UserAchievement).values(...).on_conflict_do_nothing(index_elements=[UserAchievement.user_id, UserAchievement.achievement_id])`.
- **Criterio de aceptación:** Finalizar simultáneamente dos sesiones que cumplan la condición de un mismo logro y verificar que ambas solicitudes responden 200 OK sin colisión de base de datos.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P2-08: Nombres accesibles en botones de acción y estilos focus-visible en controles interactivos
- **Prioridad:** P2
- **Área:** Accesibilidad (WCAG 4.1.2 & 2.4.7)
- **Archivos afectados:**
  - `frontend/src/features/typing/SentenceInfoPanel.tsx`
  - `frontend/src/components/AppHeader.tsx`
  - `frontend/src/features/typing/AudioPlayer.tsx`
- **Problema:** Los botones de eliminar y agregar frase en `SentenceInfoPanel.tsx` contienen únicamente literales `"x"` y `"+"` sin atributo `aria-label`. Asimismo, los botones y enlaces carecen de estilos de foco visibles (`focus-visible`).
- **Solución propuesta:**
  1. Añadir `aria-label="Eliminar frase"` y `aria-label="Guardar frase"` a los botones en `SentenceInfoPanel.tsx`.
  2. Agregar clases de foco accesibles (`focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none`) a todos los botones interactivos del sistema.
- **Criterio de aceptación:** Navegar mediante la tecla `Tab` a lo largo de toda la interfaz y verificar que cada elemento interactivo muestra un anillo cian destacado al recibir el foco.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P2-09: Motor de cursor suave (Smooth Caret Engine) con interpolación CSS
- **Prioridad:** P2
- **Área:** UI/UX / Mecanografía Moderna (Benchmark Monkeytype)
- **Archivos afectados:**
  - `frontend/src/features/typing/SmoothCaret.tsx`
  - `frontend/src/features/typing/TypingText.tsx`
- **Problema:** El cursor actual es un simple borde izquierdo CSS (`border-l-2`) en un `<span>` inline. Salta bruscamente de letra en letra sin animación, no tiene parpadeo suave al pausar y desaparece al finalizar el fragmento, generando fatiga visual y rigidez mecánica.
- **Solución propuesta:**
  1. Crear un componente desacoplado `<SmoothCaret>` posicionado de forma absoluta dentro del contenedor del texto de tipeo.
  2. Calcular la posición relativa `(left, top)` del carácter activo y aplicar una transición CSS continua:
     ```css
     transition: transform 90ms cubic-bezier(0.1, 0.9, 0.2, 1.0);
     ```
  3. Añadir animación sutil de parpadeo (*blink*) tras 500ms de inactividad.
- **Criterio de aceptación:** Al tipear a diferentes velocidades, el cursor debe deslizarse suavemente entre caracteres en lugar de dar saltos discretos instantáneos.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P2-10: Buffer no destructivo de caracteres extra (Extra Characters) en TypingWordBlock
- **Prioridad:** P2
- **Área:** UI/UX / Mecanografía Moderna (Benchmark Monkeytype/TypeLit)
- **Archivos afectados:**
  - `frontend/src/features/typing/TypingText.tsx`
  - `frontend/src/features/typing/useTypingSession.ts`
- **Problema:** Si el usuario pulsa accidentalmente una letra adicional dentro de una palabra, el motor actual avanza forzosamente sobre el siguiente carácter del texto legítimo, desplazando toda la palabra restante y tiñéndola de rojo en cascada (efecto dominó).
- **Solución propuesta:**
  1. Permitir que `TypingWordBlock` mantenga un búfer de caracteres excedentes para la palabra activa.
  2. Renderizar las letras extra tipeadas como `span.text-red-700.line-through` al final de la palabra sin consumir los caracteres posteriores del texto objetivo hasta que el usuario presione la barra espaciadora.
- **Criterio de aceptación:** Si la palabra objetivo es "cat" y el usuario tipea "caat", la segunda 'a' debe renderizarse tachada en rojo sin desplazar la 't' ni desalinear las palabras subsiguientes.
- **Dependencias:** Tarea P1-05
- **Estado:** Completado

---

### Tarea P2-11: Tooltip de vocabulario contextual flotante sobre la palabra activa
- **Prioridad:** P2
- **Área:** UI/UX / Aprendizaje Activo (Benchmark TypeLit/LingQ)
- **Archivos afectados:**
  - `frontend/src/features/typing/WordHelpTooltip.tsx`
  - `frontend/src/features/typing/TypingText.tsx`
- **Problema:** `WordHelpTooltip` se encuentra anclado rígidamente en el pie de página (`bottom-8`), obligando a desviar la vista del área de tipeo para consultar el significado de una palabra fallada.
- **Solución propuesta:**
  1. Calcular las coordenadas de la palabra activa en el DOM mediante `getBoundingClientRect()`.
  2. Posicionar el tooltip flotante con una animación suave (*fade-in*) justo encima o debajo de la palabra errónea en el texto.
  3. Asegurar que el tooltip no tape la línea de texto que se está leyendo.
- **Criterio de aceptación:** Al equivocarse en una palabra, el tooltip de traducción debe aparecer suavemente sobre la palabra en cuestión sin obligar a desviar la mirada hacia la parte inferior de la pantalla.
- **Dependencias:** Tarea P1-02
- **Estado:** Completado

---

### Tarea P2-12: Modo Zen y paletas de color suaves antifatiga visual (Nord, Slate, Sepia)
- **Prioridad:** P2
- **Área:** UI/UX / Ergonomía Visual (Benchmark Monkeytype)
- **Archivos afectados:**
  - `frontend/src/app/globals.css`
  - `frontend/src/app/layout.tsx`
  - `frontend/src/features/typing/ZenToggle.tsx`
- **Problema:** El contraste extremo de 21:1 (#000000 vs #ffffff) fatiga la vista en sesiones prolongadas. No existe opción de cambio de paleta ni modo de concentración para ocultar métricas durante la escritura.
- **Solución propuesta:**
  1. Definir variables CSS temáticas en `globals.css` soportando 4 modos:
     - **OLED Black** (actual)
     - **Dark Slate / Nord** (fondo `#1e222a`, texto `#e5e9f0`, acento cian nórdico)
     - **Catppuccin Mocha** (fondo `#1e1e2e`, texto `#cdd6f4`)
     - **Paper / Sepia** (fondo `#fbf1c7`, texto `#3c3836`)
  2. Implementar un selector rápido de tema persistente en preferencias.
  3. Añadir opción de "Modo Zen" que desvanezca las métricas (`opacity-0` con `hover:opacity-100`) durante el tipeo activo.
- **Criterio de aceptación:** El usuario puede alternar entre los 4 temas visuales y las métricas de WPM se atenúan mientras escribe en modo Zen.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P2-13: Visualización distintiva de huecos (character cells) en Missing Words
- **Prioridad:** P2
- **Área:** UI/UX / Accesibilidad Cognitiva (Benchmark TypeLit/Duolingo)
- **Archivos afectados:**
  - `frontend/src/features/recall/MissingWordsText.tsx`
- **Problema:** En `MissingWordsText.tsx`, las letras pendientes se representan con guiones bajos continuos (`_`), fundiéndose en una línea continua que impide apreciar visualmente la cantidad de letras de la palabra oculta.
- **Solución propuesta:**
  1. Renderizar cada carácter pendiente dentro de un blank como una celda delimitada individual:
     ```tsx
     <span className="border-b-2 border-gray-500 mx-0.5 inline-block min-w-[0.85em] text-center font-mono">
       {state === "pending" ? "\u00A0" : seg.char}
     </span>
     ```
- **Criterio de aceptación:** En una palabra oculta de 5 letras, el usuario debe ver 5 líneas de subrayado claramente separadas por espacios.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P2-14: Optimización del layout móvil ante la apertura del teclado virtual
- **Prioridad:** P2
- **Área:** UI/UX & Responsive
- **Archivos afectados:**
  - `frontend/src/app/practice/[textId]/page.tsx`
  - `frontend/src/features/typing/TypingCaptureInput.tsx`
- **Problema:** El centrado vertical mediante `min-h-screen justify-center` en pantallas móviles provoca que al desplegarse el teclado en pantalla (ocupando el 40-50% del viewport vertical), el texto a tipear quede desplazado hacia arriba o tapado por el teclado.
- **Solución propuesta:**
  1. En viewports táctiles, anclar el área de práctica en la mitad superior de la pantalla (`h-1/2 overflow-y-auto`) con seguimiento automático a la línea activa.
  2. Asegurar que el tamaño de fuente sea dinámico (`text-lg` en móviles, `text-xl` en desktop) para evitar saltos de renglón constantes.
- **Criterio de aceptación:** Al abrir el teclado virtual en un emulador móvil con viewport reducido, el texto a escribir y el cursor deben permanecer 100% visibles y centrados en el área visible superior.
- **Dependencias:** Tarea P1-01
- **Estado:** Completado

---

### Tarea P2-15: Manejo robusto de estados de carga con reintento y Empty States con llamados a la acción
- **Prioridad:** P2
- **Área:** UI/UX & Resiliencia Frontend
- **Archivos afectados:**
  - `frontend/src/app/progress/page.tsx`
  - `frontend/src/app/gamification/page.tsx`
  - `frontend/src/features/progress/EmptyState.tsx`
- **Problema:** Llamadas a la API silenciadas con `.catch(() => {})` provocan cargas infinitas ("Cargando...") si falla algún endpoint. Los estados vacíos en gráficos solo muestran texto plano sin botones de acción.
- **Solución propuesta:**
  1. Capturar errores de carga en `progress` y `gamification`, mostrando una alerta descriptiva y un botón de "Reintentar conexión".
  2. Enriquecer `EmptyState.tsx` con un botón de llamado a la acción (CTA) que enlace directamente a la biblioteca o práctica.
- **Criterio de aceptación:** Simular la caída de la API y comprobar que la página de progreso muestra un mensaje de error claro con botón funcional de reintento en lugar de quedarse congelada en "Cargando...".
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P2-16: Reorganización de jerarquía en Library y contexto del texto en pantallas de práctica
- **Prioridad:** P2
- **Área:** UI/UX / Arquitectura de Información
- **Archivos afectados:**
  - `frontend/src/app/library/page.tsx`
  - `frontend/src/app/practice/[textId]/page.tsx`
  - `frontend/src/app/dictation/[textId]/page.tsx`
- **Problema:** El formulario de creación de textos ocupa 550px en la parte superior de `/library`, empujando la lista de textos por debajo del pliegue. En las páginas de práctica, no se muestra el título del libro o texto que el usuario está escribiendo.
- **Solución propuesta:**
  1. En `/library`, trasladar el formulario de subida a un drawer lateral o modal accesible accionado por el botón "+ Agregar Texto", dejando la lista de textos como contenido principal visible de inmediato.
  2. En `/practice/[textId]` y `/dictation/[textId]`, mostrar en la barra superior un encabezado sutil con el título del texto y el número de fragmento (ej. `"Alice in Wonderland · Fragmento 2/12"`).
- **Criterio de aceptación:** Al ingresar a `/library`, la lista de textos debe ser visible inmediatamente sin necesidad de scrollear. Al practicar, el título del texto debe ser visible en el encabezado.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

## PRIORIDAD P3 — BAJA

### Tarea P3-01: Integrar agregación de duración en consulta principal de estadísticas de sesión
- **Prioridad:** P3
- **Área:** Base de Datos / Optimización de Consultas
- **Archivos afectados:**
  - `backend/app/repositories/session_repository.py`
- **Problema:** En `overview_for_user` (L89-106), se ejecuta una consulta para `count, avg, max` y luego una segunda consulta separada con el mismo filtro `WHERE` para calcular `sum(duration_seconds)`.
- **Solución propuesta:**
  1. Consolidar `func.coalesce(func.sum(TypingSession.duration_seconds), 0)` dentro de la primera sentencia `SELECT`, eliminando el round-trip adicional a PostgreSQL.
- **Criterio de aceptación:** Verificar que la función `overview_for_user` retorna las mismas métricas ejecutando exactamente una consulta SQL.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P3-02: Corregir distorsión visual de textos SVG en BarChartCard para móviles
- **Prioridad:** P3
- **Área:** UI/UX & Gráficos SVG
- **Archivos afectados:**
  - `frontend/src/features/progress/BarChartCard.tsx`
- **Problema:** El uso de `preserveAspectRatio="none"` en el elemento `<svg>` de `BarChartCard.tsx` estira desproporcionadamente las etiquetas tipográficas de los ejes en pantallas estrechas.
- **Solución propuesta:**
  1. Utilizar un `viewBox` responsivo con proporciones fijas y aplicar `vectorEffect="non-scaling-stroke"` en las barras.
- **Criterio de aceptación:** En pantallas móviles de 320px de ancho, las etiquetas del eje del gráfico de barras deben mantener proporciones tipográficas naturales sin deformación horizontal.
- **Dependencias:** Tarea P2-02
- **Estado:** Completado

---

### Tarea P3-03: Timeout explícito en comprobación de Redis en endpoint /health
- **Prioridad:** P3
- **Área:** DevOps / Monitoreo y Observabilidad
- **Archivos afectados:**
  - `backend/app/main.py`
- **Problema:** En `main.py` (L92), la conexión de comprobación a Redis no especifica `socket_timeout`. Si Redis entra en un estado zombi sin rechazar conexiones, el healthcheck de Docker se cuelga indefinidamente.
- **Solución propuesta:**
  1. Configurar `socket_timeout=3.0` en la creación del cliente temporal de Redis para `/health`.
- **Criterio de aceptación:** Simular un Redis congelado y comprobar que `/health` responde con HTTP 503 en menos de 3.5 segundos.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P3-04: Migrar python-jose a PyJWT y modernizar fixture event_loop en pytest-asyncio
- **Prioridad:** P3
- **Área:** Mantenibilidad & Dependencias
- **Archivos afectados:**
  - `backend/requirements.txt`
  - `backend/app/core/security.py`
  - `backend/app/tests/conftest.py`
- **Problema:** La suite de pruebas backend emite 41 advertencias de deprecación vinculadas a `datetime.utcnow()` en `python-jose` (librería abandonada) y a la redefinición del fixture `event_loop` en `pytest-asyncio`.
- **Solución propuesta:**
  1. Sustituir `python-jose` por `PyJWT>=2.9.0` en `requirements.txt` y `security.py` utilizando datetimes con zona horaria UTC (`datetime.now(datetime.UTC)`).
  2. Eliminar el fixture personalizado `event_loop` en `conftest.py` y configurar `asyncio_default_fixture_loop_scope = "session"` en `pytest.ini`.
- **Criterio de aceptación:** La ejecución de `pytest` debe arrojar 0 advertencias de deprecación en la consola.
- **Dependencias:** Ninguna
- **Estado:** Completado

---

### Tarea P3-05: Modal post-sesión enriquecido con curva de WPM, visualización de XP y palabras falladas
- **Prioridad:** P3
- **Área:** UI/UX / Gamificación (Benchmark Monkeytype/Duolingo)
- **Archivos afectados:**
  - `frontend/src/app/practice/[textId]/page.tsx`
  - `frontend/src/features/typing/SessionSummaryModal.tsx`
- **Problema:** Al terminar un fragmento, `ChunkCompleteSummary` muestra únicamente dos cifras planas y un botón "Continuar", desaprovechando el momento de mayor satisfacción del estudiante.
- **Solución propuesta:**
  1. Diseñar el modal `<SessionSummaryModal>` con:
     - Gráfico sparkline SVG de WPM segundo a segundo.
     - Barra animada de experiencia (+XP ganado) y avance hacia el próximo nivel.
     - Lista interactiva de palabras falladas con su traducción directa.
     - Botón de acción directa: "Practicar palabras débiles ahora".
- **Criterio de aceptación:** Al completar un fragmento, se despliega el modal enriquecido con el sparkline de velocidad y la lista de palabras en las que se cometió error.
- **Dependencias:** Tarea P1-02
- **Estado:** Completado

---

### Tarea P3-06: Retroalimentación auditiva mecánica opcional durante el tipeo (Audio Cues)
- **Prioridad:** P3
- **Área:** UI/UX / Accesibilidad y Cadencia (Benchmark Monkeytype)
- **Archivos afectados:**
  - `frontend/src/features/typing/useTypingSession.ts`
  - `frontend/src/features/typing/AudioFeedbackSettings.tsx`
- **Problema:** La aplicación carece por completo de feedback auditivo al pulsar teclas, una funcionalidad altamente valorada en mecanografía para sostener el ritmo neuromuscular.
- **Solución propuesta:**
  1. Sintetizar clics mecánicos sutiles mediante la API Web Audio (`AudioContext` nativo, sin dependencias externas ni carga de archivos MP3 pesados).
  2. Añadir un interruptor en ajustes de usuario para activar/desactivar el sonido de tipeo y error.
- **Criterio de aceptación:** Con el audio habilitado, cada pulsación de tecla debe emitir un clic mecánico suave de menos de 10ms de duración con latencia imperceptible.
- **Dependencias:** Ninguna
- **Estado:** Completado
