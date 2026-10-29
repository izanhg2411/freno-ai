# Hoja de ruta

Principio: validar con estudiantes reales antes de construir lo siguiente. Nada de esto está implementado en 0.1.

## Fase 1 · Validar el MVP (próximo)
- Probar con 5–10 estudiantes y medir: ¿completan el flujo?, ¿abandonan en el intento obligatorio?, ¿entienden la comprobación?
- Ajustar los *prompts* con ejercicios reales de varias asignaturas (calidad de pistas, fugas de solución).
- Mejoras pendientes de UX: aviso de ayuda que reinicia su temporizador, atajos de teclado, exportar/importar historial.

## Fase 2 · Producto robusto
- Tipos reales de React/Chrome en CI, `package-lock.json` y GitHub Actions (`npm run check`).
- Matemáticas con notación (KaTeX) y bloques de código con resaltado.
- Importar ejercicios desde PDF; OCR para ejercicios fotografiados.
- Almacenamiento en IndexedDB si el historial crece.
- Auditoría de accesibilidad con herramientas (contraste, lector de pantalla).

## Fase 3 · Modo capa (camino A)
Content script para ChatGPT, Claude y Gemini que reutiliza `core/` y `ai/`. Frágil por selectores del DOM: aislar cada sitio en un adaptador con tests y *feature flag*.

## Fase 4 · Backend y cuentas
Backend propio con autenticación, cuotas por plan, proxy a la IA (sin claves en el cliente), sincronización entre dispositivos, plan gratuito con límites y plan premium. Ver `SECURITY.md`.

## Fase 5 · Educación
Panel de profesores, grupos de estudiantes y licencias para centros. Requiere antes revisión legal de protección de datos de menores.
