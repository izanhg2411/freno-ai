import type { ProviderId } from '../core/types';

export type AIErrorKind = 'no_key' | 'auth' | 'rate_limit' | 'network' | 'timeout' | 'server' | 'bad_request' | 'format';

export class AIError extends Error {
  constructor(public readonly kind: AIErrorKind, message: string, public readonly status?: number) {
    super(message);
    this.name = 'AIError';
  }
  get retryable() { return ['rate_limit', 'network', 'timeout', 'server', 'format'].includes(this.kind); }
}

export interface CompletionRequest { system: string; user: string; maxTokens: number }
export interface AIProvider { readonly id: ProviderId; complete(req: CompletionRequest): Promise<string> }
export interface ProviderConfig { provider: ProviderId; model: string; apiKey: string }

const TIMEOUT_MS = 60_000;

/** Nunca incluye la clave en mensajes de error ni en logs. */
async function postOnce(url: string, headers: Record<string, string>, body: unknown, fetchImpl: typeof fetch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted) throw new AIError('timeout', 'La IA tardó demasiado en responder.');
    throw new AIError('network', 'No se pudo conectar. Comprueba tu conexión a internet.');
  } finally {
    clearTimeout(timer);
  }
  if (res.ok) return res.json() as Promise<any>;
  let detail = '';
  try { detail = String(((await res.json()) as any)?.error?.message ?? '').slice(0, 200); } catch { /* sin cuerpo */ }
  if (res.status === 401 || res.status === 403 || (res.status === 400 && /api key|API_KEY/i.test(detail))) throw new AIError('auth', 'La API key no es válida o no tiene permiso.', res.status);
  if (res.status === 429) throw new AIError('rate_limit', 'Has alcanzado el límite del proveedor. Espera un momento e inténtalo de nuevo.', res.status);
  if (res.status >= 500) throw new AIError('server', `El proveedor de IA tiene problemas ahora mismo${detail ? ` (${detail})` : ''}. Prueba de nuevo en un rato o cambia de modelo en Ajustes.`, res.status);
  throw new AIError('bad_request', `El proveedor rechazó la petición${detail ? `: ${detail}` : '.'} Revisa el nombre del modelo.`, res.status);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reintenta solo errores transitorios del proveedor (5xx y límite de tasa), con espera creciente. */
async function post(url: string, headers: Record<string, string>, body: unknown, fetchImpl: typeof fetch, delays: number[]) {
  for (let i = 0; ; i++) {
    try { return await postOnce(url, headers, body, fetchImpl); }
    catch (e) {
      const transient = e instanceof AIError && (e.kind === 'server' || e.kind === 'rate_limit');
      if (!transient || i >= delays.length) throw e;
      await sleep(delays[i]!);
    }
  }
}

export function createProvider(cfg: ProviderConfig, fetchImpl: typeof fetch = (...a) => fetch(...a), retryDelaysMs: number[] = [1500, 4000]): AIProvider {
  if (!cfg.apiKey.trim()) throw new AIError('no_key', 'Falta la API key. Añádela en Ajustes.');
  if (cfg.provider === 'anthropic') {
    return {
      id: 'anthropic',
      async complete({ system, user, maxTokens }) {
        const data = await post('https://api.anthropic.com/v1/messages', {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        }, { model: cfg.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }, fetchImpl, retryDelaysMs);
        const text = (data?.content ?? []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('');
        if (!text) throw new AIError('format', 'La IA devolvió una respuesta vacía.');
        return text;
      },
    };
  }
  if (cfg.provider === 'gemini') {
    return {
      id: 'gemini',
      async complete({ system, user, maxTokens }) {
        const data = await post(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
          { 'content-type': 'application/json', 'x-goog-api-key': cfg.apiKey.trim() },
          {
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            // Los modelos con "thinking" gastan parte del límite en razonar: margen amplio para no truncar el JSON.
            generationConfig: { maxOutputTokens: Math.max(maxTokens * 4, 4096), responseMimeType: 'application/json' },
          }, fetchImpl, retryDelaysMs);
        const text = (data?.candidates?.[0]?.content?.parts ?? []).map((x: any) => (typeof x?.text === 'string' ? x.text : '')).join('');
        if (!text) throw new AIError('format', 'La IA devolvió una respuesta vacía.');
        return text;
      },
    };
  }
  return {
    id: 'openai',
    async complete({ system, user, maxTokens }) {
      const data = await post('https://api.openai.com/v1/chat/completions', {
        'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey.trim()}`,
      }, {
        model: cfg.model, max_completion_tokens: maxTokens, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }, fetchImpl, retryDelaysMs);
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text) throw new AIError('format', 'La IA devolvió una respuesta vacía.');
      return text;
    },
  };
}
