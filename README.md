# FRENO

> **Usa la IA para aprender, no para dejar de pensar.**

FRENO es una extensión de Chrome (Manifest V3) con un tutor en el **panel lateral**. No te da la solución de entrada: primero escribes tu intento, recibes **tres niveles de pista**, solo después ves la **solución explicada** y terminas con una **pregunta de comprobación** para confirmar que lo has entendido.

Funciona con ejercicios de cualquier web (pega el enunciado o selecciona texto → clic derecho → «Trabajar este ejercicio con FRENO»). Usa tu propia API key de **Gemini**, **Anthropic** u **OpenAI**.

> Estado: **MVP 0.1** para uso local. No es un producto publicado. Lee [SECURITY.md](SECURITY.md) y [CAMBIOS.md](CAMBIOS.md) antes de usarlo con datos reales.

## 1. Qué necesitas

- Google Chrome 114 o superior (necesario para el panel lateral).
- Node.js 20 o superior y npm.
- Una API key de Gemini, Anthropic u OpenAI (con límite de gasto recomendado).

## 2. Instalar dependencias

```bash
npm install
```

## 3. Compilar

```bash
npm run build        # genera la carpeta dist/
npm run dev          # opcional: recompila al guardar
```

## 4. Cargar la extensión en Chrome

1. Abre `chrome://extensions`.
2. Activa **Modo de desarrollador** (arriba a la derecha).
3. Pulsa **Cargar descomprimida** y elige la carpeta `dist/` de este proyecto.
4. Fija el icono de FRENO en la barra y haz clic en él: se abre el panel lateral.

Tras cambiar el código y recompilar, pulsa el botón de recarga de la tarjeta de FRENO en `chrome://extensions`.

## 5. Introducir la API key

Panel lateral → **Ajustes** → elige proveedor y modelo → pega la clave → **Guardar clave** → **Probar conexión**.
La clave se guarda en este navegador, **sin cifrar** (ver [SECURITY.md](SECURITY.md)). Usa una clave con límite de gasto.

## 6. Primera prueba

1. En **Ejercicio**, escribe `Resuelve 2x + 3 = 11` y pulsa **Empezar ejercicio**.
2. Escribe tu intento («creo que hay que dividir entre 2») y envíalo: recibirás la pista 1.
3. En modo estricto, la pista 2 y la solución están bloqueadas hasta que hagas un nuevo intento tras cada pista.
4. Tras la pista 3 y un último intento, desbloqueas **Ver solución**, después la **comprobación**.
5. Mira **Historial** para ver tu progreso real.

## Modos

| | Estricto | Flexible |
|---|---|---|
| Intento inicial | Obligatorio | Obligatorio |
| Entre pistas | Nuevo intento obligatorio | Opcional |
| Solución | Tras pista 3 + nuevo intento | Desde la pista 2 (con ≥2 intentos) |
| Explicación alternativa | No | Sí («Explícalo de otra forma») |

El modo se fija al crear cada ejercicio (cambiarlo en Ajustes no afloja uno en curso).

## Comandos

```bash
npm test            # tests unitarios (flujo, IA simulada, estadísticas)
npm run typecheck   # TypeScript estricto
npm run e2e         # prueba end-to-end en Chromium con la extensión cargada (requiere `npx playwright install chromium`)
npm run check       # todo lo anterior + build
```

## Errores habituales

| Síntoma | Causa y solución |
|---|---|
| Al pulsar el icono no pasa nada | Chrome < 114, o la extensión no está recargada. Recarga en `chrome://extensions`. |
| «La API key no es válida» | Clave mal copiada, sin saldo o de otro proveedor. Revisa el proveedor en Ajustes y usa **Probar conexión**. |
| «El proveedor rechazó la petición… Revisa el nombre del modelo» | El modelo no existe para tu cuenta. Escribe otro en el campo Modelo. |
| «No se pudo conectar» | Sin internet o red que bloquea la API. |
| El menú contextual no aparece | Hay que **seleccionar texto** antes del clic derecho. Si acabas de instalar, recarga la extensión. |
| «Se ha cargado, pero el manifest falla» | Carga `dist/`, no la raíz del proyecto. Ejecuta antes `npm run build`. |

## Estructura

```
src/core/      lógica pura: tipos, máquina de etapas (flow.ts), estadísticas
src/ai/        proveedores, prompts por etapa, validación de salidas, orquestador
src/storage.ts chrome.storage
src/sidepanel/ interfaz React
src/background.ts service worker (panel lateral + menú contextual)
tests/         unitarios + e2e
docs/          NEGOCIO.md y archivo previo
```

Documentación: [ARCHITECTURE](ARCHITECTURE.md) · [ROADMAP](ROADMAP.md) · [PRIVACY](PRIVACY.md) · [SECURITY](SECURITY.md) · [CAMBIOS](CAMBIOS.md) · [docs/NEGOCIO](docs/NEGOCIO.md)
