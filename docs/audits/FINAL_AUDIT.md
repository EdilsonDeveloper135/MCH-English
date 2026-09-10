# Auditoría Final — Remediación MCH-English

**Fecha:** 2026-09-10
**Alcance:** Ejecución completa de `IMPROVEMENT_PLAN.md` (Fases 0–7, 30 tareas) sobre los 30 hallazgos de `AUDIT_REPORT.md`.
**Estado:** ✅ Las 30 tareas del plan están implementadas, verificadas y marcadas `[x]`. 8 commits, uno por fase, todos pusheados a `main`.

```
e0c2721  Fase 0 — data-loss crítico, seguridad, bug del motor de tipeo
16b620b  Fase 1 — N+1 en vocabulario, upserts race-safe, duración honesta, audio fuera de Postgres
6a6ca9d  Fase 2 — navegación SPA, dedup de sesiones weak-words, TTS async, búsqueda en SQL
f17e5a9  Fase 3 — errores legibles, Missing Words, contraste WCAG AA, teclado móvil, AppHeader
68cdf12  Fase 4 — render por bloques memoizados, caché de diccionario, interceptor 401
e9ccf73  Fase 5 — suite de tests frontend (Vitest) y backend (integración con Postgres real)
6db18f8  Fase 6 — ESLint activo, contenedores sin root, healthcheck profundo, CI en GitHub Actions
c8bf984  Fase 7 — dedup final, modal accesible, fix de círculos SVG, logging estructurado
```

---

## 1. Qué se corrigió

### Fase 0 — Crítico (P0, 5/5)
- **Pérdida de datos en cascada:** borrar un texto ya no destruye el historial de XP/rachas. Los FK de `typing_sessions`, `recall_sessions/attempts` y `dictation_sessions/attempts` pasaron de `CASCADE` a `SET NULL` — incluyendo `RecallAttempt.sentence_id` y `DictationAttempt.sentence_id`, que la auditoría no listó explícitamente pero cascadeaban por la misma cadena y también destruían XP.
- **Bug de estado obsoleto en el motor de tipeo:** Backspace y el conteo de caracteres correctos/incorrectos ahora se computan desde el closure directo, no desde el callback de un `setState` funcional cuya ejecución no estaba garantizada a tiempo.
- **Incompatibilidad de `passlib`/`crypt` con Python 3.13:** reemplazado por `bcrypt` directo, sin la dependencia rota.
- **IDOR en attempts de Recall/Dictation:** ambos endpoints ahora verifican que la oración pertenezca al usuario autenticado antes de aceptar un intento.
- **DoS por `raw_content` sin límite:** `TextCreate`/`TranslationUpdate` acotan el tamaño a 100.000 caracteres y rechazan contenido en blanco.

### Fase 1 — Alto impacto (P1, parte 1/2)
- N+1 en `vocabulary_service.record_session_words` reemplazado por un solo `INSERT ... ON CONFLICT DO UPDATE`.
- Condiciones de carrera en `settings_repository.get_or_create` y el cache-marker de audio de Dictation resueltas con `ON CONFLICT DO NOTHING` en vez de check-then-insert.
- La duración de práctica que alimenta racha/objetivo diario ahora es la real (persistida en `typing_sessions.duration_seconds`, acotada al tiempo transcurrido en servidor), no una cifra que el cliente podía inflar.
- El audio de Dictation salió de Postgres (columna `LargeBinary` eliminada) a un volumen en disco (`dictation_audio_cache`), evitando hinchar la base con binarios.

### Fase 2 — Alto impacto (P1, parte 2/2)
- `window.location.reload()` al completar un fragmento reemplazado por navegación SPA real.
- Doble creación de sesión al practicar palabras débiles eliminada en el código; el residuo que persistía en desarrollo se identificó como React Strict Mode duplicando efectos (comportamiento normal de Next.js en modo dev, no un bug), documentado como tal.
- Síntesis TTS movida a un hilo aparte (`asyncio.to_thread`) para no bloquear el event loop.
- Búsqueda de Weak Words movida de "traer todo y filtrar en Python" a una consulta SQL por palabra con el operador de regex de Postgres.

### Fase 3 — Medio (P2, UI/UX)
- Errores de validación de la API (arrays de Pydantic) ahora se muestran como texto legible, no `[object Object]`.
- Missing Words en Recall: los huecos consecutivos ya no se pegan sin espacio; se puede tipear con un espacio real entre palabras.
- Contraste WCAG AA: barrido de `text-gray-500/600/700` (varios por debajo del mínimo 4.5:1, incluyendo uno que la auditoría no había marcado) a `gray-400` en las 21 archivos afectados; `<label htmlFor>` agregado a todos los inputs de formulario reales.
- Teclado virtual móvil: el input de captura ya no es un truco de tamaño 0 (nunca abre el teclado nativo); en `pointer: coarse` se renderiza como una barra real y tapeable, y el motor de tipeo gana un segundo camino de entrada (`handleInput` sobre el evento nativo `input`) para teclados que no reportan `e.key` real (Android/Gboard).
- `<AppHeader>` único reemplaza la navegación duplicada e inconsistente que cada página armaba a mano.

### Fase 4 — Rendimiento (P2)
- `TypingText` divide el texto en bloques de palabra memoizados; una tecla ya no re-renderiza las ~30 palabras del fragmento completo, solo la palabra donde ocurrió el cambio.
- `api.lookupWord` cachea en memoria hits y misses del diccionario; repetir el mismo error de tipeo no dispara una nueva petición.
- `request()` detecta un 401 en una petición *autenticada* y desloguea con un mensaje informativo — con la guarda explícita de no confundirlo con credenciales inválidas en login.

### Fase 5 — Testing (P1, cobertura 0% → real)
- Frontend: Vitest + Testing Library, 22 tests (motor de tipeo, render de `TypingText`, manejo de errores/caché de `api.ts`).
- Backend: 19 tests de integración nuevos contra una base Postgres de test real (nunca la de desarrollo), a través del stack HTTP real — registro/login, subida de texto + Smart Chunking end-to-end, tipeo + guardado de sesión, y desbloqueo de logros de gamificación. **78/78 pruebas backend pasando** (57 preexistentes + 21 nuevas entre Fase 5 y Fase 6).

### Fase 6 — DevOps (P1/P2)
- ESLint activo (antes ignorado durante el build); cero errores en todo el código existente.
- Backend y frontend corren como usuarios sin privilegios (`appuser`/`node`), no root.
- `/health` verifica de verdad Postgres (`SELECT 1`) y Redis (`PING`); responde `503` si cualquiera está caído — verificado deteniendo y reiniciando ambos servicios contra el stack real, no solo con mocks.
- `docker-compose.yml` base mapea los puertos 8000/3000 por default.
- Pipeline de CI en GitHub Actions (lint + tipos + tests de frontend, pytest de backend contra Postgres/Redis reales de CI, verificación de que el historial completo de migraciones aplica limpio, build de ambos Dockerfiles).

### Fase 7 — Limpieza final (P3)
- `reconstructTyped` centralizado (estaba duplicado idéntico en Dictation y Recall); consulta redundante a `list_by_user` eliminada de `gamification_service`.
- `window.confirm()` reemplazado por un modal accesible sobre `<dialog>` nativo para borrar textos.
- Los puntos de los gráficos SVG ya no se deforman en elipses en pantallas angostas.
- Logging estructurado (`structlog`, JSON) con `X-Request-ID` por request.

---

## 2. Qué queda pendiente y por qué

Nada del plan quedó sin implementar — las 30 tareas están completas. Lo que sigue son huecos **fuera del alcance literal del plan** que encontré en el camino, o partes de una tarea que no pude verificar con la certeza que sí tuve para el resto:

| # | Ítem | Por qué queda pendiente |
|---|------|--------------------------|
| 1 | **Corrida real del pipeline de CI** (Tarea 6.4) | No hay forma de disparar un runner de GitHub Actions ni ver la pestaña Actions desde esta sesión. Verifiqué cada paso del workflow por separado contra infraestructura equivalente (Postgres/Redis reales, migración completa desde cero, `npm run lint`/`test`, `pytest`, ambos `docker build`) y todos pasan — pero la primera corrida real en GitHub queda como confirmación pendiente del propio repositorio. |
| 2 | **Prueba en hardware móvil real** (Tarea 3.4) | Verifiqué el teclado virtual con un viewport emulado (375×812, `pointer: coarse`) y simulando el camino exacto de Android (`InputEvent` nativo sin `keydown` útil) mediante JS directo — ambos caminos funcionan. No hay forma de probar en un iPhone/Android físico ni en un simulador nativo desde este entorno (la tarea es sobre la app web, no una app nativa), así que la confirmación en un dispositivo real queda como el único paso que falta. |
| 3 | **Medición numérica de FPS** (Tarea 4.1) | El fix (bloques memoizados) está verificado por diseño (menos nodos DOM tocados por tecla) y por ausencia de regresiones funcionales, pero no hay herramientas de profiling de rendimiento en este entorno para medir un número real de FPS a >100 WPM. |
| 4 | **Cobertura de integración para Recall, Dictation, Vocabulary y Settings** | La Tarea 5.2 pedía explícitamente 3 archivos (`test_api_texts.py`, `test_api_auth.py`, `test_api_sessions.py`), que es lo que se implementó — con gamificación cubierta de forma cruzada dentro de `test_api_sessions.py`. Los endpoints de Recall, Dictation, Vocabulary y Settings siguen sin pruebas de integración HTTP propias (sí tienen pruebas unitarias de sus funciones de servicio, ya existentes antes de esta sesión). No es un incumplimiento del plan — es un límite de alcance que vale la pena cerrar después. |
| 5 | **`BarChartCard.tsx` también usa `preserveAspectRatio="none"`** | Noté que el texto de las etiquetas del eje X se estira levemente en pantallas angostas por el mismo mecanismo que afectaba los círculos de `LineChartCard`. La auditoría y el plan solo mencionan "los puntos" (círculos) y solo listan `LineChartCard.tsx`, así que lo dejé fuera a propósito — es un defecto cosmético menor, no un hallazgo de la auditoría. |
| 6 | **`event_loop` fixture de pytest-asyncio deprecado** | La solución que usé (un `event_loop` de sesión compartido, para que el engine async de SQLAlchemy no falle entre tests) genera un `DeprecationWarning` en cada corrida — funciona perfecto en la versión fijada del proyecto (`pytest-asyncio==0.24.0`), pero pytest-asyncio sugiere migrar al marcador `loop_scope` en versiones futuras. Migrar hoy exigiría decorar cada test individualmente sin ganar nada funcional ahora mismo. |
| 7 | **Uvicorn sigue emitiendo su propio access log (no-JSON) además del structlog nuevo** | La Tarea 7.3 pedía tocar únicamente `main.py`; deshabilitar el access log nativo de uvicorn requiere tocar el `CMD` de los Dockerfiles o la invocación de uvicorn, fuera del archivo listado. Ambos logs conviven sin conflicto — el nuevo (JSON, con `request_id`) es el que cumple el criterio de aceptación. |

## 3. Recomendaciones para continuar (no urgentes)

- Pushear esta rama y confirmar la primera corrida verde de `.github/workflows/ci.yml` en GitHub.
- Probar el teclado virtual en un iPhone/Android real cuando haya oportunidad.
- Si se agrega más superficie a Recall/Dictation/Vocabulary/Settings, considerar sumarles su propio archivo de tests de integración siguiendo el mismo patrón de `conftest.py` ya armado.
