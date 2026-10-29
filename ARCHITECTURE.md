# Arquitectura

## Principio de diseño

**La aplicación manda, la IA propone.** El orden de las etapas lo impone código determinista (`src/core/flow.ts`); la IA solo rellena contenido. Un fallo o una respuesta maliciosa de la IA nunca desbloquea una etapa.

```
UI (React)  ──►  tutor.ts  ──►  flow.canRequest()   ¿está permitido? (ANTES de llamar a la IA)
                    │                 │ no → FlowError, la IA ni se consulta
                    ▼                 ▼ sí
               provider.ts ──► API del proveedor
                    │
                    ▼
               validate.ts  (esquema; si falla, 1 reintento y luego error)
                    │
                    ▼
               flow.apply*()  vuelve a validar y produce el nuevo Exercise (inmutable)
                    │
                    ▼
               storage.ts  (chrome.storage.local)
```

## Máquina de etapas

`attempt → hint1 → hint2 → hint3 → solution → check → done`

- `canRequest(ex, req)` decide por etapa, modo e historial de intentos. Cada `apply*` repite la comprobación, así que invocar una función «a mano» desde la UI tampoco salta etapas.
- La solución **no existe en el cliente** hasta que se autoriza: no se pide a la IA antes. No hay nada que «desocultar».
- El modo se guarda en el ejercicio al crearlo.
- Los intentos registran tras qué pista se hicieron (`afterHint`): así el modo estricto exige un reintento entre pistas.

## Capas

| Capa | Archivos | Depende de |
|---|---|---|
| Dominio | `core/*` | nada (puro, testeado) |
| IA | `ai/*` | dominio; `fetch` inyectable para tests |
| Persistencia | `storage.ts` | `chrome.storage` |
| UI | `sidepanel/*` | todo lo anterior |
| Extensión | `background.ts`, `manifest.json` | storage |

Cambiar de proveedor = implementar `AIProvider` (`complete(req): Promise<string>`); el flujo pedagógico no cambia. Un futuro **modo capa** para ChatGPT/Claude/Gemini sería un *content script* nuevo que reutilice `core/` y `ai/` sin tocarlos.

## Decisiones técnicas

- **esbuild en lugar de Vite**: una sola dependencia de build, compilación en milisegundos y sin servidor de desarrollo; la extensión se instala desde `dist/` sin servidor. Vite es viable más adelante si se necesitan HMR o plugins.
- **CSS global con variables** (`styles.css`) en lugar de CSS Modules: un único archivo con tokens (color, radio, sombra) y clases por componente; es consistente y reduce complejidad para un panel con pocas pantallas.
- **Salida estructurada por JSON + validación manual**: sin dependencias de esquemas; los validadores rechazan lo que no cumple el formato.
- **Llamadas a la IA desde el panel lateral**, no desde el service worker: evita pasar por mensajería y los permisos de host bastan (`api.anthropic.com`, `api.openai.com`).
- **Panel lateral con pestañas en lugar de página de opciones**: menos superficie, menos archivos.
- **Texto de la IA renderizado como texto** (nunca `innerHTML`).

## Almacenamiento (`chrome.storage.local`)

`freno.settings`, `freno.keys`, `freno.exercises` (mapa id → ejercicio). El texto pendiente del menú contextual viaja por `chrome.storage.session` y se consume al leerlo.

## Límite conocido de escala

Todo el historial en una sola clave está bien para cientos de ejercicios. Para miles habrá que migrar a IndexedDB.
