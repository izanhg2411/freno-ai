// Prueba end-to-end: carga dist/ como extensión real en Chromium, simula la API del proveedor
// (sin red ni claves reales) y recorre el flujo estricto completo. Uso: npm run build && npm run e2e
import { chromium } from 'playwright';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const dist = resolve('dist');
const shots = process.env.SHOTS_DIR; if (shots) mkdirSync(shots, { recursive: true });
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'freno-')), {
  headless: false, viewport: { width: 420, height: 860 },
  args: ['--headless=new', `--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--no-sandbox'],
});

// ---- API simulada: responde según la ETAPA del prompt y registra lo que se pidió ----
const requests = []; let failNext = 0; let checkVerdicts = ['incorrect', 'correct'];
await ctx.route('https://api.anthropic.com/**', async (route) => {
  const body = JSON.parse(route.request().postData() ?? '{}');
  const stage = ((body.system.match(/ETAPA: ([A-ZÁÉÍÓÚ0-9 ]+)/) ?? [])[1] ?? 'PING').trim();
  requests.push({ stage, key: route.request().headers()['x-api-key'], user: body.user });
  if (failNext > 0) { failNext--; return route.fulfill({ status: 401, json: { error: { message: 'invalid x-api-key' } } }); }
  const verdict = stage.startsWith('VALORACIÓN') ? (checkVerdicts.shift() ?? 'correct') : null;
  const out = {
    'PISTA 1': { needsClarification: false, clarifyingQuestion: null, feedback: null, hint: 'Piensa qué operación deshace la suma de 3.' },
    'PISTA 2': { needsClarification: false, clarifyingQuestion: null, feedback: 'Bien: quieres aislar x.', hint: 'Resta el mismo número en ambos lados.' },
    'PISTA 3': { needsClarification: false, clarifyingQuestion: null, feedback: null, hint: 'Te queda 2x = ___. ¿Cómo despejas x?' },
    'SOLUCIÓN EXPLICADA': { answer: 'x = 4', verified: true, steps: ['Resta 3: 2x = 8', 'Divide entre 2: x = 4'], connection: 'Aísla x.', mistakes: [], why: 'Operaciones inversas.', uncertainty: null },
    'PREGUNTA DE COMPROBACIÓN': { question: '¿Cuánto vale x en 3x + 1 = 10?', concept: 'despejar' },
    'VALORACIÓN DE LA COMPROBACIÓN': { verdict, feedback: 'Revisa el orden de las operaciones.', nextHint: 'Empieza restando 1.' },
  }[stage] ?? { ok: true };
  await route.fulfill({ json: { content: [{ type: 'text', text: JSON.stringify(out) }] } });
});

let [sw] = ctx.serviceWorkers(); sw ??= await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`chrome-extension://${id}/sidepanel.html`);
const shot = async (n) => shots && page.screenshot({ path: join(shots, `${n}.png`) });
const btn = (name) => page.getByRole('button', { name });
let n = 0; const step = (t) => console.log(`✓ ${++n}. ${t}`);

// 1. Primera vez: onboarding, sin ejercicios
await page.getByText('Usa la IA para aprender').waitFor();
assert.equal(await btn(/Empezar ejercicio/).isDisabled(), true); await shot('01-inicio'); step('pantalla inicial sin API key bloquea el inicio');

// 2. Ajustes: clave y prueba de conexión
await page.getByRole('navigation').getByRole('button', { name: 'Ajustes' }).click();
await page.getByPlaceholder('Pega aquí tu clave').fill('sk-ant-clave-de-prueba-123');
await btn('Guardar clave').click(); await page.getByText('Clave guardada en este dispositivo.').waitFor();
await btn('Probar conexión').click(); await page.getByText(/Conexión correcta/).waitFor(); await shot('02-ajustes');
assert.equal(requests.at(-1).key, 'sk-ant-clave-de-prueba-123'); step('guardar clave y probar conexión');

// 3. Nuevo ejercicio
await page.getByRole('navigation').getByRole('button', { name: 'Ejercicio' }).click();
await page.getByRole('textbox', { name: 'Ejercicio', exact: true }).fill('Resuelve 2x + 3 = 11');
await btn('Empezar ejercicio').click();
await page.getByRole('textbox', { name: 'Tu intento' }).waitFor();
assert.equal(await btn('Ver solución').count(), 0, 'no hay botón de solución en la etapa del intento');
assert.equal(await btn(/Enviar intento/).isDisabled(), true); await shot('03-intento'); step('modo estricto: sin intento no hay ayuda ni solución');

// 4. Intento -> pista 1 (automática)
await page.getByRole('textbox', { name: 'Tu intento' }).fill('Creo que tengo que dividir entre 2');
await btn(/Enviar intento/).click(); await page.getByText('Piensa qué operación deshace').waitFor(); await shot('04-pista1');
step('el intento desbloquea la pista 1');

// 5. Estricto: pista 2 y solución bloqueadas hasta reintentar
assert.equal(await btn('Pista 2').isDisabled(), true);
assert.equal(await btn('Ver solución').isDisabled(), true);
await page.getByText(/Vuelve a intentarlo tras la pista 1/).waitFor(); step('pista 2 y solución bloqueadas con motivo visible');
for (const [lvl, attempt, expect] of [[2, 'Resto 3 en un lado', 'Resta el mismo número'], [3, 'Entonces 2x = 8?', 'Te queda 2x']]) {
  await page.getByRole('textbox', { name: 'Vuelve a intentarlo' }).fill(attempt);
  await btn('Guardar nuevo intento').click(); await page.waitForFunction(() => document.querySelector('textarea')?.value === '');
  await page.getByText('Intento guardado').waitFor();
  assert.equal(await btn(`Pista ${lvl}`).isEnabled(), true);
  assert.equal(await btn('Ver solución').isDisabled(), true, 'solución sigue bloqueada antes de la pista 3');
  await btn(`Pista ${lvl}`).click(); await page.getByText(expect).waitFor(); if (lvl === 2) await shot('05-pista2');
}
step('pistas 2 y 3 en orden, una por cada reintento');
assert.equal(await btn('Ver solución').isDisabled(), true);
assert.ok(!requests.some((r) => r.stage.startsWith('SOLUCIÓN')), 'la IA no recibió ninguna petición de solución todavía');
await page.getByRole('textbox', { name: 'Vuelve a intentarlo' }).fill('x = 4');
await btn('Guardar nuevo intento').click(); await page.waitForFunction(() => document.querySelector('textarea')?.value === '');
assert.equal(await btn('Ver solución').isEnabled(), true); step('la solución solo se desbloquea tras pista 3 + reintento');

// 6. Solución y comprobación
await btn('Ver solución').click(); await page.getByText('Solución explicada').waitFor(); await page.getByText('x = 4').first().waitFor(); await shot('06-solucion');
await btn('Comprobar lo que he aprendido').click(); await page.getByText('¿Cuánto vale x en 3x + 1 = 10?').waitFor();
await page.getByRole('textbox', { name: 'Tu respuesta' }).fill('x = 4'); await btn('Enviar respuesta').click();
await page.getByText(/Pista: Empieza restando 1/).waitFor(); await shot('07-comprobacion-fallida'); step('respuesta incorrecta: pista y reintento, sin completar');
await page.getByRole('textbox', { name: 'Tu respuesta' }).fill('x = 3'); await btn('Enviar respuesta').click();
await page.getByText('Comprobación superada').waitFor(); await shot('08-completado'); step('respuesta correcta completa el ejercicio');

// 7. Historial, estadísticas reales y persistencia tras recargar
await page.reload(); await page.getByRole('navigation').getByRole('button', { name: 'Historial' }).click();
const stats = await page.locator('.stats').innerText(); await shot('09-historial');
assert.match(stats, /Terminados\s*1/); assert.match(stats, /Comprobaciones superadas\s*1/); step('historial y estadísticas persisten tras recargar');
await page.getByPlaceholder('Buscar…').fill('zzz'); await page.getByText('Ningún ejercicio coincide').waitFor(); await page.getByPlaceholder('Buscar…').fill('');

// 8. Errores de IA: no avanzan etapa, ofrecen reintento
await page.getByRole('navigation').getByRole('button', { name: 'Ejercicio' }).click();
await page.getByRole('textbox', { name: 'Ejercicio', exact: true }).fill('Explica la causa de la Revolución Francesa');
await btn('Empezar ejercicio').click(); await page.getByRole('textbox', { name: 'Tu intento' }).fill('La crisis económica');
failNext = 1; await btn(/Enviar intento/).click();
await page.getByRole('alert').getByText(/API key no es válida/).waitFor(); await shot('10-error');
assert.equal(await btn('Pedir pista 1').count(), 1, 'sigue en la etapa del intento'); step('error 401: mensaje claro, sin avanzar de etapa');
await btn('Reintentar').click(); await page.getByText('Piensa qué operación deshace').waitFor(); step('reintentar tras el error funciona');

// 9. Menú contextual -> prefill (se simula el valor que escribe el service worker)
await sw.evaluate(() => chrome.storage.session.set({ 'freno.pending': { text: 'Texto seleccionado en una web' } }));
await page.getByRole('textbox', { name: 'Ejercicio', exact: true }).waitFor();
assert.equal(await page.getByRole('textbox', { name: 'Ejercicio', exact: true }).inputValue(), 'Texto seleccionado en una web'); step('texto del menú contextual llega al panel');

// 10. Borrado con confirmación
await page.getByRole('navigation').getByRole('button', { name: 'Historial' }).click();
await page.getByRole('button', { name: /Eliminar: Resuelve/ }).click(); await page.getByRole('button', { name: 'Sí, eliminar' }).click();
await page.waitForFunction(() => !document.body.innerText.includes('Resuelve 2x'));
step('eliminar con confirmación');

assert.deepEqual(errors, [], 'sin errores de JavaScript en la página');
console.log(`\nPeticiones simuladas a la API: ${requests.length}. Todo correcto.`);
await ctx.close();
