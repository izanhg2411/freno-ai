# CAMBIOS.md · FRENO 0.1.0

Registro honesto de decisiones, estado y limitaciones.

## Qué hay terminado
- Extensión MV3 con panel lateral, menú contextual «Trabajar este ejercicio con FRENO», iconos y service worker.
- Método completo: ejercicio → intento → pistas 1-3 → solución explicada → comprobación (con reintento y «terminar sin superar»).
- Modos estricto y flexible, con reglas aplicadas por `core/flow.ts` (no por la IA).
- Proveedores Anthropic y OpenAI, modelo editable, «Probar conexión», errores clasificados con reintento.
- Borradores, reinicio, historial con búsqueda/filtro, borrado con confirmación, estadísticas reales (terminados, comprobaciones superadas, racha sin penalización).
- Tema oscuro (por defecto), claro y automático; navegación por teclado, foco visible, `aria-live`, `prefers-reduced-motion`.
- Documentación: README, ARCHITECTURE, ROADMAP, PRIVACY, SECURITY, `docs/NEGOCIO.md`.

## Verificación realizada (20/10/2026)
| Comprobación | Resultado |
|---|---|
| Compilación (`node build.mjs`) | Correcta: `sidepanel.js` 230 KB, `sidepanel.css` 10 KB, `background.js` 0,6 KB |
| Tests unitarios (22: flujo, estadísticas, IA simulada, inyección, errores HTTP) | **22 pasan, 0 fallan** |
| TypeScript estricto | 0 errores, **pero con tipos simulados de React y Chrome** (ver limitaciones) |
| Manifest | MV3 válido; todas las rutas existen; permisos mínimos |
| E2E en Chromium con la extensión cargada y API simulada (14 pasos: bloqueos del modo estricto, pistas, solución, comprobación fallida y superada, persistencia tras recarga, error 401 + reintento, borrado) | **Todo correcto**, sin errores de JavaScript |
| Revisión visual con capturas a 420 px en oscuro y claro | Revisada por mí; no hay auditoría automática |

## Lo que NO he podido verificar
- **Llamadas reales a Anthropic/OpenAI**: no había red ni claves. El formato de petición sigue la API documentada y está probado con `fetch` simulado, pero **no contra los servidores reales**. El modelo OpenAI por defecto (`gpt-4o-mini`) es una suposición editable; los nombres de modelo de Anthropic los tomé de la información de producto disponible.
- **El clic real en el menú contextual abriendo el panel**: la automatización no puede pulsar el menú nativo. Probé el traspaso de datos (almacenamiento de sesión → panel), no el gesto completo.
- **`npm install` y `npm run typecheck` con tipos reales**: sin red, no pude instalar `@types/react` ni `@types/chrome` ni generar `package-lock.json`. Verifiqué con las dependencias globales preinstaladas (enlazadas en `node_modules`, **no incluidas en el zip**) y shims de tipos. Es posible que aparezca algún error de tipos menor al ejecutar `npm run typecheck` en tu equipo.
- Accesibilidad con herramientas (contraste medido, lector de pantalla), otros navegadores y panel con anchos extremos.
- Calidad pedagógica real de las pistas: depende del modelo y requiere ajustar prompts con ejercicios reales.

## Decisiones tomadas
- **esbuild en vez de Vite** y **CSS global con tokens** en vez de CSS Modules (ver ARCHITECTURE.md).
- Los ajustes están en el panel lateral (no hay página de opciones aparte).
- **El modo se fija al crear el ejercicio**, para que no se pueda aflojar sobre la marcha.
- Un intento válido exige al menos una letra o cifra; **no se juzga el esfuerzo** (permite «6»). Un estudiante puede escribir texto de relleno: FRENO no puede evitarlo y no lo promete.
- En estricto, reformular pistas no está disponible; en flexible, sí.
- La valoración de la comprobación se muestra como guía de IA, no como veredicto.
- Terminar sin superar la comprobación queda registrado como terminado, no como superado.
- Sin toggle de «no guardar historial» en 0.1: se puede borrar todo o por ejercicio.

## Archivos preexistentes
El directorio ya contenía restos de un intento anterior: carpetas vacías con nombre `{domain,ai,…}` (una expansión de llaves fallida) y un `options.html` huérfano (apuntaba a `options.js/css` inexistentes). Eliminé las carpetas vacías y moví `options.html` a `docs/previo/` (no se pierde nada ni se envía en `dist`).

## Limitaciones conocidas
- La API key se guarda sin cifrar: **no es adecuada para un producto multiusuario** (ver SECURITY.md).
- Matemáticas y código se muestran como texto (sin KaTeX ni resaltado).
- Un mismo aviso repetido en menos de 3,5 s no reinicia su temporizador.
- Todo el historial vive en una clave de `chrome.storage.local` (suficiente para cientos de ejercicios).
- Sin cuentas, sincronización, PDF/OCR, panel de profesor ni cobros (ver ROADMAP.md).

## Para una primera publicación comercial
1. Validar demanda (docs/NEGOCIO.md).
2. Backend propio con autenticación, cuotas y claves en servidor.
3. Política de privacidad pública y revisión legal (menores, RGPD).
4. Pruebas con usuarios reales y ajuste de prompts; medir coste por ejercicio.
5. Auditoría de accesibilidad, CI, `package-lock.json`, tipos reales.
6. Ficha de Chrome Web Store (capturas, justificación de permisos).

## 0.1.1 · Gemini añadido
- Nuevo proveedor **Gemini** (por petición del usuario, que solo tiene clave de Gemini). Añade el permiso de red `generativelanguage.googleapis.com`. Modelo por defecto `gemini-3.8-flash` (editable). La API real rechazó `gemini-2.5-flash` para cuentas nuevas y sugirió este nombre; los nombres de modelo cambian, edítalo si hace falta. Probado con `fetch` simulado; el e2e sigue usando Anthropic simulado.

## 0.1.3 · Reintentos
- Errores 5xx y límite de tasa del proveedor se reintentan automáticamente (2 veces, con espera de 1,5 s y 4 s). Los errores de clave, de petición y los tiempos de espera no se reintentan. El mensaje del 5xx incluye el detalle que da el proveedor.
