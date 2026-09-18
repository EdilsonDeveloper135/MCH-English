# Issues y Roadmap

Lista de estado de mejoras y roadmap del proyecto. Las tareas de remediación previas se detallan en [`docs/audits/`](./audits/) y las funcionalidades consolidadas en [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Estado del Roadmap

| # | Issue | Estado | Prioridad | Notas de Implementación |
|---|---|---|---|---|
| 1 | Soporte PWA para instalación offline | ✅ **Completado** | — | Implementado con `manifest.json`, Service Worker nativo (`sw.js`), caché de audio en IndexedDB y cola de sincronización resiliente (`offlineOutbox.ts`). |
| 2 | Gráficas avanzadas en el perfil de usuario | ✅ **Completado** | — | Implementado con SVG puro en `ProgressCharts.tsx`: `WpmTrendChart`, `AccuracyHeatmap` tipo GitHub y `ErrorPatternChart` (Top 10 errores). |
| 3 | Importación de textos desde PDF / ePub | ✅ **Completado** | — | Implementado 100% en cliente en `ImporterModal.tsx` con `pdfjs-dist` y `epubjs`, sin dependencias pesadas en backend ni envío de archivos por red. |
| 4 | Modo multijugador / salas en tiempo real (WebSockets) | ⏳ **Pendiente** | Alta (Épica) | Siguiente gran hito para carreras de mecanografía sincronizadas. |

---

## Épica Activa — Modo multijugador / salas de mecanografía en tiempo real (WebSockets)

**Labels:** `enhancement`, `epic`, `multiplayer`

### Descripción

El benchmark contra TypeRacer (ver `docs/audits/AUDIT_REPORT.md`) identificó la carrera en tiempo real como el diferenciador social más fuerte de esa categoría de apps. Actualmente MCH-English es 100% individual.

### Propuesta técnica

1. **Backend**:
   - Endpoint WebSocket (`/ws/rooms/{room_id}`, FastAPI ya soporta WebSockets nativamente) que transmita el progreso de cada jugador (posición en el texto, WPM en vivo) a los demás en la sala.
   - Redis Pub/Sub para coordinar eventos entre múltiples workers de backend si se escala horizontalmente.
2. **Modelo de datos**:
   - Tabla/Entidad `Room` (código corto tipo "ABCD", texto elegido, chunk activo, estado `waiting`/`racing`/`finished`).
   - Tabla/Entidad `RoomParticipant` (usuario, posición actual, WPM, completado sí/no).
3. **Frontend**:
   - Vista dedicada `/race/[roomCode]` con barras de progreso horizontales por jugador (patrón estándar de TypeRacer/Monkeytype).
   - Reutilización directa del motor de mecanografía (`useTypingSession`), conectando los eventos de tipeo con el socket.
4. **Fuera del alcance v1**:
   - Matchmaking global automático o chat en vivo.
   - La v1 se limitará a salas privadas compartiendo enlace o código de 4-6 caracteres.

### Criterio de aceptación (v1)

- Dos usuarios en navegadores distintos dentro de la misma sala ven el avance del otro en tiempo real (latencia < 200ms en red local / normal).
- Si un jugador se desconecta o cierra la pestaña, los demás participantes ven su estado como desconectado sin romper la carrera.
- La carrera sincroniza el mismo texto y fragmento para todos los integrantes.

---

## Mejoras ya completadas (Histórico de Roadmap)

### Issue 1 — Soporte PWA para instalación offline (Cerrado)
- **Implementación:**
  - `frontend/public/manifest.json` configurado con display standalone, paleta oscura y conjunto completo de íconos (SVG, maskable, 192px y 512px).
  - Service Worker nativo `frontend/public/sw.js` precacheando el shell de la aplicación y la página offline `offline.html`.
  - Almacenamiento local de audio en IndexedDB (`dictation-audio`) para reproducir voz en Dictation sin conexión.
  - `frontend/src/services/offlineOutbox.ts`: intercepta fallos de red al enviar estadísticas de sesión y las encola localmente, sincronizándolas automáticamente al reconectar.
  - Indicador visual de estado de conectividad en `AppHeader.tsx`.

### Issue 2 — Gráficas avanzadas en el perfil de usuario (Cerrado)
- **Implementación:**
  - Endpoint de agregación `GET /sessions/stats/summary?days=30` con caché en Redis.
  - Gráficos renderizados en SVG puro y liviano sin dependencias externas: `WpmTrendChart` (tendencia con gradiente y tooltips), `AccuracyHeatmap` (calendario de consistencia estilo contribuciones de GitHub) y `ErrorPatternChart` (Top 10 caracteres con fallos).
  - Tabla paginada `SessionHistoryTable` con ordenamiento dinámico por columnas y exportador CSV con escape seguro contra inyecciones de fórmulas (`csvExport.ts`).

### Issue 3 — Importación de textos desde PDF / ePub (Cerrado)
- **Implementación:**
  - En lugar de sobrecargar el backend con parsers de archivos pesados, se implementó una solución 100% en el cliente en `ImporterModal.tsx`.
  - Integración de `pdfjs-dist` (con worker local `/pdf.worker.min.mjs`) para extracción de texto página por página y alerta ante PDFs escaneados sin OCR.
  - Integración de `epubjs` para leer capítulos y spine en memoria, saneando entidades HTML.
  - Límite de seguridad de 500 KB para evitar degradación de rendimiento en el motor de tipeo.

---

## Sugerencias para Backlog Futuro

- **`enhancement`** — Soporte para paquetes de sonido personalizados (perfiles adicionales en `SoundEngine.ts`).
- **`enhancement`** — Selector de rango de fechas personalizado (7, 30, 90, 365 días) en `/progress`.
- **`enhancement`** — Filtros por nivel de dominio en el explorador de `/vocabulary` (ej. solo palabras débiles con mastery < 50%).
- **`good first issue`** — Agregar `rel="noopener noreferrer"` y `aria-label` a los enlaces externos que se agreguen en el README/docs cuando el proyecto tenga una demo pública.
