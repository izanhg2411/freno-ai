# Privacidad

FRENO 0.1 no tiene servidor propio, cuentas, analíticas ni telemetría.

## Qué se guarda y dónde
Solo en este navegador (`chrome.storage.local`): ajustes, API keys, ejercicios (enunciado, contexto, tus intentos, pistas, solución, comprobaciones) e historial. No se sincroniza con tu cuenta de Google ni con otros dispositivos.

## Qué se envía fuera
Cuando pides ayuda, se envía **al proveedor de IA que elijas** (Gemini, Anthropic u OpenAI), con tu propia clave:
- el enunciado y el contexto del ejercicio actual,
- tus intentos de ese ejercicio y las pistas ya dadas,
- en la comprobación, la solución mostrada y tu respuesta.

**No** se envía el historial de otros ejercicios, la URL de la página ni nada del resto de tu navegación. El tratamiento posterior lo rige la política del proveedor: revísala antes de enviar datos personales o de menores.

## Control del usuario
- Eliminar un ejercicio (con confirmación) o **Borrar todo el historial** desde Ajustes.
- **Borrar claves** desde Ajustes.
- Desinstalar la extensión elimina todos los datos locales.

## Permisos de Chrome
`storage` (guardar datos), `sidePanel` (panel lateral), `contextMenus` (clic derecho) y acceso de red solo a `api.anthropic.com`, `api.openai.com` y `generativelanguage.googleapis.com`. No lee tus pestañas ni el contenido de las páginas; solo recibe el texto que seleccionas y envías con el menú contextual.

## Menores y centros
Antes de uso escolar hay que evaluar RGPD/LOPDGDD y normativa de menores (ver `docs/NEGOCIO.md`). Esta versión no es adecuada para ese uso sin esa revisión.

## Gemini: plan gratuito
Con una clave del plan gratuito de Gemini, Google puede tratar los datos enviados de forma distinta a un plan de pago (por ejemplo, para mejorar sus productos). Compruébalo en sus condiciones vigentes antes de enviar datos personales o de menores.
