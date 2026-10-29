import { useMemo, useState } from 'react';
import { createProvider } from '../ai/provider';
import { SUBJECT_LABEL } from '../ai/prompts';
import { computeStats } from '../core/stats';
import { DEFAULT_SETTINGS, type Exercise, type Mode, type ProviderId, type Settings, type Subject } from '../core/types';
import { clearExercises, clearKeys, loadKey, saveKey } from '../storage';
import { Alert, Button, Confirm, Field, Logo, friendly } from './ui';

export function Home({ settings, hasKey, active, prefill, onStart, onOpen, onSettings }: {
  settings: Settings; hasKey: boolean; active: Exercise[]; prefill: string;
  onStart: (prompt: string, subject: Subject, context: string) => void; onOpen: (id: string) => void; onSettings: () => void;
}) {
  const [prompt, setPrompt] = useState(prefill);
  const [subject, setSubject] = useState<Subject>('auto');
  const [context, setContext] = useState('');
  const ok = prompt.trim().length >= 5;
  const go = () => ok && onStart(prompt, subject, context);
  return (
    <section aria-label="Nuevo ejercicio">
      {!hasKey && (
        <div className="card card-onboard">
          <div className="brand-row"><Logo size={28} /><h2>Usa la IA para aprender,<br />no para dejar de pensar.</h2></div>
          <ol className="how">
            <li><b>Intentas.</b> Cuentas qué harías.</li>
            <li><b>Pistas progresivas.</b> De vagas a concretas.</li>
            <li><b>Solución explicada</b> cuando toca.</li>
            <li><b>Comprobación.</b> Una pregunta para confirmar que lo entiendes.</li>
          </ol>
          <Button variant="primary" onClick={onSettings}>Añadir mi API key para empezar</Button>
        </div>
      )}
      <Field label="Ejercicio" hint="Pega el enunciado o escribe tu pregunta. También puedes seleccionar texto en una página y usar clic derecho → «Trabajar este ejercicio con FRENO»."
        value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} onSubmit={go} placeholder="Ej.: Resuelve 2x + 3 = 11…" />
      <div className="row">
        <label className="inline">Asignatura
          <select value={subject} onChange={(e) => setSubject(e.target.value as Subject)}>
            {(Object.keys(SUBJECT_LABEL) as Subject[]).map((s) => <option key={s} value={s}>{SUBJECT_LABEL[s]}</option>)}
          </select>
        </label>
      </div>
      <details className="more"><summary>Añadir contexto (opcional)</summary>
        <Field label="Contexto" hint="Apuntes, temario o datos que el enunciado no incluye." value={context} onChange={(e) => setContext(e.target.value)} rows={3} />
      </details>
      <Button variant="primary" disabled={!ok || !hasKey} onClick={go}>Empezar ejercicio</Button>
      {!hasKey && <p className="hint">Necesitas una API key en Ajustes para pedir ayuda.</p>}
      <p className="hint">Modo {settings.mode === 'strict' ? 'estricto' : 'flexible'} · puedes cambiarlo en Ajustes.</p>
      {active.length > 0 && (
        <div className="list-block"><h2 className="label">En curso</h2>
          <ul className="list">{active.slice(0, 4).map((e) => (
            <li key={e.id}><button className="list-item" onClick={() => onOpen(e.id)}>
              <span className="li-title">{e.prompt.slice(0, 90)}</span>
              <span className="li-meta">{SUBJECT_LABEL[e.subject]} · {stageName(e)}</span></button></li>
          ))}</ul>
        </div>
      )}
    </section>
  );
}

const stageName = (e: Exercise) =>
  e.status === 'completed' ? (e.check?.passed ? 'Comprobación superada' : 'Terminado')
  : ({ attempt: 'Esperando tu intento', hint1: 'Pista 1', hint2: 'Pista 2', hint3: 'Pista 3', solution: 'Solución', check: 'Comprobación', done: 'Terminado' } as const)[e.stage];

export function History({ exercises, onOpen, onDelete }: { exercises: Exercise[]; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'passed'>('all');
  const [confirm, setConfirm] = useState<string | null>(null);
  const stats = useMemo(() => computeStats(exercises, Date.now()), [exercises]);
  const shown = exercises.filter((e) =>
    (filter === 'all' || (filter === 'active' && e.status === 'active') || (filter === 'completed' && e.status === 'completed') || (filter === 'passed' && !!e.check?.passed)) &&
    e.prompt.toLowerCase().includes(q.trim().toLowerCase()));
  if (exercises.length === 0)
    return (<div className="empty"><Logo size={36} /><h2>Aún no hay ejercicios</h2><p>Cuando completes el primero, aquí verás tu historial y tu progreso real.</p></div>);
  return (
    <section aria-label="Historial">
      <dl className="stats">
        <div><dt>Terminados</dt><dd>{stats.completed}</dd></div>
        <div><dt>Comprobaciones superadas</dt><dd>{stats.checksPassed}</dd></div>
        <div><dt>Racha de días</dt><dd>{stats.currentStreak}</dd></div>
        <div><dt>Días estudiados</dt><dd>{stats.studyDays}</dd></div>
      </dl>
      <p className="hint">Mejor racha: {stats.bestStreak} {stats.bestStreak === 1 ? 'día' : 'días'}. Si un día no estudias, la racha empieza de nuevo sin más.</p>
      <div className="row">
        <input type="search" aria-label="Buscar en el historial" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filtrar" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">Todos</option><option value="active">En curso</option><option value="completed">Terminados</option><option value="passed">Comprobación superada</option>
        </select>
      </div>
      {shown.length === 0 && <p className="hint">Ningún ejercicio coincide con tu búsqueda.</p>}
      <ul className="list">{shown.map((e) => (
        <li key={e.id}>
          <button className="list-item" onClick={() => onOpen(e.id)}>
            <span className="li-title">{e.prompt.slice(0, 90)}</span>
            <span className="li-meta">{SUBJECT_LABEL[e.subject]} · {stageName(e)} · {new Date(e.updatedAt).toLocaleDateString('es-ES')}</span>
          </button>
          {confirm === e.id
            ? <Confirm label="¿Eliminar este ejercicio?" onYes={() => { setConfirm(null); onDelete(e.id); }} onNo={() => setConfirm(null)} />
            : <Button aria-label={`Eliminar: ${e.prompt.slice(0, 30)}`} onClick={() => setConfirm(e.id)}>Eliminar</Button>}
        </li>
      ))}</ul>
    </section>
  );
}

const MODELS: Record<ProviderId, string[]> = {
  anthropic: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'], openai: ['gpt-4o-mini', 'gpt-4o'],
  gemini: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
};

export function SettingsView({ settings, onChange, hasKey, onKeyChange, onClearHistory, count }: {
  settings: Settings; onChange: (s: Settings) => void; hasKey: boolean; onKeyChange: () => void; onClearHistory: () => void; count: number;
}) {
  const p = settings.provider;
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirm, setConfirm] = useState<'history' | 'keys' | null>(null);

  async function save() {
    await saveKey(p, key); setKey(''); onKeyChange(); setMsg({ tone: 'info', text: 'Clave guardada en este dispositivo.' });
  }
  async function test() {
    setTesting(true); setMsg(null);
    try {
      const apiKey = (key.trim() || (await loadKey(p)));
      await createProvider({ provider: p, model: settings.models[p], apiKey }).complete({ system: 'Responde solo con {"ok":true}', user: 'ping', maxTokens: 20 });
      setMsg({ tone: 'info', text: 'Conexión correcta: la clave y el modelo funcionan.' });
    } catch (e) { setMsg({ tone: 'error', text: friendly(e).message }); } finally { setTesting(false); }
  }
  const mode = (m: Mode, title: string, body: string) => (
    <label className={`mode ${settings.mode === m ? 'on' : ''}`}>
      <input type="radio" name="mode" checked={settings.mode === m} onChange={() => onChange({ ...settings, mode: m })} />
      <b>{title}</b><span>{body}</span>
    </label>
  );
  return (
    <section aria-label="Ajustes">
      <h2 className="label">Modo de aprendizaje</h2>
      <div className="modes">
        {mode('strict', 'Estricto', 'Intento obligatorio, pistas en orden y un nuevo intento entre pistas. Solución tras la pista 3.')}
        {mode('flexible', 'Flexible', 'Intento inicial obligatorio, pero más ritmo: solución desde la pista 2 y explicaciones alternativas.')}
      </div>
      <p className="hint">El modo se fija al empezar cada ejercicio.</p>

      <h2 className="label">Proveedor de IA</h2>
      <div className="seg" role="radiogroup" aria-label="Proveedor">
        {(['gemini', 'anthropic', 'openai'] as ProviderId[]).map((id) => (
          <button key={id} role="radio" aria-checked={p === id} className={p === id ? 'on' : ''} onClick={() => onChange({ ...settings, provider: id })}>{{ anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Gemini' }[id]}</button>
        ))}
      </div>
      <label className="inline">Modelo
        <input list="models" value={settings.models[p]} onChange={(e) => onChange({ ...settings, models: { ...settings.models, [p]: e.target.value.trim() || DEFAULT_SETTINGS.models[p] } })} />
        <datalist id="models">{MODELS[p].map((m) => <option key={m} value={m} />)}</datalist>
      </label>
      <label className="inline">API key
        <input type="password" autoComplete="off" spellCheck={false} placeholder={hasKey ? 'Clave guardada · escribe otra para reemplazarla' : 'Pega aquí tu clave'} value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <div className="row">
        <Button variant="primary" disabled={!key.trim()} onClick={save}>Guardar clave</Button>
        <Button loading={testing} disabled={!key.trim() && !hasKey} onClick={test}>Probar conexión</Button>
        {hasKey && <Button onClick={() => setConfirm('keys')}>Borrar claves</Button>}
      </div>
      {confirm === 'keys' && <Confirm label="¿Borrar las API keys guardadas?" onYes={async () => { await clearKeys(); onKeyChange(); setConfirm(null); setMsg({ tone: 'info', text: 'Claves borradas.' }); }} onNo={() => setConfirm(null)} />}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <p className="hint">Tu clave se guarda sin cifrar en el almacenamiento local de esta extensión y solo se envía al proveedor elegido. Usa una clave con límite de gasto y no la compartas.</p>

      <h2 className="label">Tu nivel y apariencia</h2>
      <div className="row">
        <label className="inline">Nivel
          <select value={settings.level} onChange={(e) => onChange({ ...settings, level: e.target.value as Settings['level'] })}>
            <option value="eso">ESO</option><option value="bachillerato">Bachillerato</option><option value="universidad">Universidad</option>
          </select></label>
        <label className="inline">Tema
          <select value={settings.theme} onChange={(e) => onChange({ ...settings, theme: e.target.value as Settings['theme'] })}>
            <option value="auto">Automático</option><option value="dark">Oscuro</option><option value="light">Claro</option>
          </select></label>
      </div>

      <h2 className="label">Tus datos</h2>
      <p className="hint">Ejercicios, intentos e historial se guardan solo en este navegador ({count} guardados). Al pedir ayuda, el enunciado y tus intentos se envían al proveedor de IA que elijas.</p>
      <Button disabled={count === 0} onClick={() => setConfirm('history')}>Borrar todo el historial</Button>
      {confirm === 'history' && <Confirm label="¿Borrar todos los ejercicios guardados?" onYes={async () => { await clearExercises(); onClearHistory(); setConfirm(null); }} onNo={() => setConfirm(null)} />}
    </section>
  );
}
