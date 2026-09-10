# Issues y Roadmap

Lista de mejoras futuras, listas para copiar directamente como issues de GitHub. No son parte del trabajo de remediación ya cerrado (ver [`docs/audits/`](./audits/)) — son la siguiente etapa, de cara a producción y a abrir el proyecto a colaboradores externos.

## Cómo usar este documento

Cada bloque de abajo es un issue completo: título, etiquetas sugeridas, y el cuerpo tal cual iría en la descripción. Para crear los 4 principales de una sola vez con la [GitHub CLI](https://cli.github.com/):

```bash
gh issue create --title "Soporte PWA para instalación offline" --label "enhancement,mobile" --body-file /dev/stdin <<'EOF'
... (pegar el cuerpo del issue correspondiente de abajo) ...
EOF
```

---

## Roadmap (orden sugerido)

| # | Issue | Prioridad | Esfuerzo estimado |
|---|---|---|---|
| 1 | Soporte PWA para instalación offline | Alta | Medio (2-3 días) |
| 2 | Gráficas avanzadas en el perfil de usuario | Media | Bajo (1-2 días) — **good first issue** |
| 3 | Importación de textos desde PDF / ePub | Media | Medio-Alto (3-5 días) |
| 4 | Modo multijugador / salas en tiempo real (WebSockets) | Baja (épica) | Alto (2-3 semanas) |

---

## Issue 1 — Soporte PWA para instalación offline

**Labels:** `enhancement`, `mobile`

### Descripción

MCH-English es una app de práctica diaria — el caso de uso natural es abrirla como si fuera nativa desde el celular, y poder seguir viendo el texto que se está practicando aunque la conexión se corte a mitad de sesión. Hoy es una pestaña de navegador más: sin ícono instalable, sin manifest, sin ningún nivel de funcionamiento offline.

### Propuesta

1. Agregar `frontend/public/manifest.json` (nombre, íconos en varios tamaños, `display: "standalone"`, `theme_color` acorde a la paleta oscura ya existente).
2. Registrar un Service Worker mínimo (via `next-pwa` o uno escrito a mano) que cachee el shell de la app (JS/CSS estáticos) y, opcionalmente, el chunk de texto que el usuario está practicando en ese momento — no hace falta cachear toda la biblioteca, solo lo mínimo para no perder una sesión en curso por una caída de red.
3. Meta tags de iOS (`apple-touch-icon`, `apple-mobile-web-app-capable`) ya que Safari no sigue el estándar de manifest al pie de la letra.
4. Un indicador visual sutil de "sin conexión" en el `AppHeader` cuando `navigator.onLine` es `false`, en vez de que las requests fallen en silencio.

### Criterio de aceptación

- Chrome/Edge en Android muestran el prompt "Instalar app" en `/library`.
- Con la app instalada y el WiFi apagado, abrir una sesión de práctica ya cargada previamente no muestra una pantalla en blanco.
- Lighthouse PWA audit ≥ 90.

---

## Issue 2 — Gráficas avanzadas en el perfil de usuario

**Labels:** `enhancement`, `ui/ux`, `good first issue`

### Descripción

`BarChartCard.tsx` y `LineChartCard.tsx` son SVG hechos a mano (deliberado — sin dependencias opacas para algo tan simple), pero son limitados: sin tooltips al pasar el mouse, sin zoom, y las etiquetas de texto todavía se estiran levemente en pantallas angostas por el mismo `preserveAspectRatio="none"` que ya se corrigió para los puntos circulares (ver `docs/audits/FINAL_AUDIT.md`, sección "Qué queda pendiente", ítem 5).

### Propuesta

Una mejora incremental, no un reemplazo completo del enfoque "sin librería pesada":
1. Corregir el estiramiento de texto en `BarChartCard.tsx` con la misma técnica de `vector-effect="non-scaling-stroke"` aplicada a `LineChartCard.tsx`, o cambiando `preserveAspectRatio="none"` por `"xMidYMid meet"` con un `viewBox` que ya respete la proporción real del contenedor.
2. Agregar un tooltip on-hover (ya existe un `<title>` SVG nativo por punto — se puede mejorar a un tooltip HTML posicionado con JS, más legible en mobile).
3. Un heatmap mensual de racha de práctica (estilo "contribution graph" de GitHub) en `/gamification`, reutilizando `get_active_dates` del backend (`gamification_repository.py`), que ya existe y no requiere ninguna consulta nueva.

### Criterio de aceptación

- Las etiquetas de `BarChartCard` se ven nítidas (no estiradas) en un viewport de 375px de ancho.
- Pasar el mouse (o tap sostenido en mobile) sobre una barra o un punto muestra el valor exacto en un tooltip legible.
- El heatmap de racha muestra correctamente los últimos ~90 días de actividad.

---

## Issue 3 — Importación de textos desde archivos PDF / ePub

**Labels:** `enhancement`

### Descripción

Hoy la única forma de agregar un texto es pegarlo a mano en el textarea de `/library`. Para libros o artículos largos esto es tedioso y propenso a arrastrar saltos de línea/notas al pie que rompen el Smart Chunking.

### Propuesta

1. Nuevo endpoint `POST /texts/import` que acepte un archivo (`multipart/form-data`) en vez de (o además de) `raw_content` como string.
2. Extracción de texto plano: `pypdf` o `pdfplumber` para PDF, `ebooklib` + `beautifulsoup4` para ePub — ambas librerías puramente locales, sin servicios externos, consistente con el principio de "cero dependencias opacas" del proyecto.
3. Limpieza previa al Smart Chunking existente: remover números de página, encabezados/pies repetidos, y guiones de corte de línea (`palabra-\nsiguiente` → `palabrasiguiente`) antes de pasarlo a `chunking_service.clean_text`.
4. En el frontend, un selector de archivo en el modal de "Agregar Texto" de `/library`, con una barra de progreso mientras el backend extrae el texto (puede tardar unos segundos en archivos grandes).

### Criterio de aceptación

- Subir un PDF de un capítulo de un libro (~5-10 páginas) produce un texto limpio, sin números de página sueltos ni palabras cortadas por guiones.
- Subir un ePub produce capítulos separables (idealmente un texto por capítulo, no todo el libro como un solo texto gigante).
- Un archivo corrupto o de un formato no soportado devuelve un error claro, no un texto vacío o basura.

### Dependencias

Ninguna sobre el trabajo ya cerrado. Es independiente del resto del roadmap.

---

## Issue 4 — Modo multijugador / salas de mecanografía en tiempo real (WebSockets)

**Labels:** `enhancement`

### Descripción

El benchmark contra TypeRacer (ver `docs/audits/AUDIT_REPORT.md`) identificó la carrera en tiempo real como el diferenciador social más fuerte de esa categoría de apps. Hoy MCH-English es 100% single-player.

### Propuesta — épica, dividir en sub-issues antes de empezar

1. **Backend**: un endpoint WebSocket (`/ws/rooms/{room_id}`, FastAPI ya soporta WebSockets nativamente) que transmita el progreso de cada jugador (posición en el texto, WPM en vivo) a los demás en la sala. Redis Pub/Sub para coordinar entre múltiples instancias del backend si en algún momento se escala horizontalmente.
2. **Modelo de datos**: `Room` (código corto tipo "ABCD", texto elegido, estado `waiting`/`racing`/`finished`) y `RoomParticipant` (usuario, posición actual, WPM, terminado sí/no).
3. **Frontend**: una vista `/race/[roomCode]` con una barra de progreso horizontal por jugador (patrón estándar de TypeRacer/Monkeytype), reutilizando el motor de tipeo (`useTypingSession`) ya existente — la novedad es la sincronización, no el tipeo en sí.
4. **Alcance explícitamente fuera de esta primera versión**: matchmaking automático, ranking global, chat de sala. Solo salas privadas por código, para no subestimar el esfuerzo.

### Criterio de aceptación (v1)

- Dos usuarios en pestañas distintas, en la misma sala, ven el progreso del otro actualizarse en tiempo real (latencia percibida < 500ms).
- Si un jugador cierra la pestaña a mitad de la carrera, los demás ven su estado como "desconectado", no se cuelga la sala.
- La carrera funciona con el mismo texto para todos los participantes (mismo chunk, mismo `target_text`).

### Dependencias

Ninguna del roadmap anterior, pero es el ítem de mayor riesgo/esfuerzo — recomendado dejarlo para el final y trabajarlo en su propia rama de larga duración, no como un PR único.

---

## Sugerencias adicionales (no desarrolladas en detalle, para backlog futuro)

- **`good first issue`** — Agregar `rel="noopener noreferrer"` y `aria-label` a los enlaces externos que se agreguen en el README/docs cuando el proyecto tenga una demo pública.
- **`good first issue`** — Agregar un ícono/favicon propio del proyecto (hoy usa el default de Next.js).
- **`enhancement`** — Exportar el historial de progreso (`/progress`) a CSV para quien quiera llevar sus propias estadísticas fuera de la app.
