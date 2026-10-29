import { useState } from 'react';
import { requestHint, requestSolution, requestCheck, evaluateCheck } from '../ai/tutor';
import { createProvider, type AIProvider } from '../ai/provider';
import { SUBJECT_LABEL } from '../ai/prompts';
import {
  addContext, canRequest, finishWithoutPassing, hintLevel, latestHints, restartExercise, saveDraft, submitAttempt, type Request,
} from '../core/flow';
import type { Exercise, Settings } from '../core/types';
import { loadKey } from '../storage';
import { Alert, Button, Confirm, Field, Stepper, Text, friendly, useDebounced, useNotice } from './ui';

interface Props {
  ex: Exercise; settings: Settings; onChange: (e: Exercise) => Promise<void>; onBack: () => void; onSettings: () => void;
}
interface Err { message: string; kind?: string; retry?: () => void }

export function Work({ ex, settings, onChange, onBack, onSettings }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Err | null>(null);
  const [notice, setNotice] = useNotice();
  const [text, setText] = useState(ex.draft);
  const [extra, setExtra] = useState('');
  const [confirmRestart, setConfirmRestart] = useState(false);
  const level = hintLevel(ex.stage);
  const done = ex.status === 'completed';

  useDebounced(() => { if (text !== ex.draft && !done) void onChange(saveDraft(ex, text)); }, [text]);

  async function run(label: string, fn: (p: AIProvider) => Promise<Exercise>) {
    setBusy(label); setErr(null);
    try {
      const apiKey = await loadKey(settings.provider);
      const provider = createProvider({ provider: settings.provider, model: settings.models[settings.provider], apiKey });
      await onChange(await fn(provider));
      setText('');
    } catch (e) {
      setErr({ ...friendly(e), retry: () => void run(label, fn) });
    } finally { setBusy(null); }
  }
  const askHint = (e: Exercise, req: Request & ('hint1' | 'hint2' | 'hint3' | 'rephrase')) =>
    run(req === 'rephrase' ? 'Buscando otra forma de explicarlo…' : 'Preparando tu pista…', (p) => requestHint(e, req, p, settings));

  async function sendAttempt() {
    setErr(null);
    try {
      const next = submitAttempt(ex, text, Date.now());
      await onChange(next);
      setText('');
      if (ex.stage === 'attempt') await askHint(next, 'hint1');
      else setNotice('Intento guardado. Se tendrá en cuenta en la siguiente ayuda.');
    } catch (e) { setErr(friendly(e)); }
  }
  const gate = (r: Request) => canRequest(ex, r);
  const next = (r: 'hint2' | 'hint3') => {
    const g = gate(r);
    return (
      <Button variant="primary" disabled={!g.ok || !!busy} loading={busy?.startsWith('Preparando') ?? false} onClick={() => askHint(ex, r)}>
        Pista {r === 'hint2' ? 2 : 3}
      </Button>
    );
  };
  const lockReason = (r: Request) => { const g = gate(r); return g.ok ? null : g.reason; };

  const hints = latestHints(ex);
  const lastRound = ex.check?.rounds[ex.check.rounds.length - 1];

  return (
    <section className="work" aria-label="Ejercicio">
      <div className="work-head">
        <Button onClick={onBack} aria-label="Volver">← Volver</Button>
        <span className="chip">{SUBJECT_LABEL[ex.subject]}</span>
        <span className="chip chip-mode">{ex.mode === 'strict' ? 'Estricto' : 'Flexible'}</span>
        <Button className="push" onClick={() => setConfirmRestart(true)}>Reiniciar</Button>
      </div>
      {confirmRestart && <Confirm label="¿Reiniciar? Se borrarán tus intentos y pistas de este ejercicio." onYes={() => { setConfirmRestart(false); setText(''); void onChange(restartExercise(ex, Date.now())); }} onNo={() => setConfirmRestart(false)} />}
      <Stepper ex={ex} />

      <article className="card card-exercise">
        <h2 className="label">Enunciado</h2>
        <Text>{ex.prompt}</Text>
        {ex.context && <><h3 className="label">Contexto</h3><Text>{ex.context}</Text></>}
      </article>

      {ex.attempts.map((a, i) => (
        <article key={a.at + '-' + i} className="card card-attempt">
          <h3 className="label">Tu intento {i + 1}{a.afterHint ? ` · tras la pista ${a.afterHint}` : ''}</h3>
          <Text>{a.text}</Text>
        </article>
      ))}
      {hints.map((h) => (
        <article key={h.level} className="card card-hint">
          <h3 className="label">Pista {h.level} · {['orientación', 'ayuda concreta', 'paso a paso'][h.level - 1]}</h3>
          {h.feedback && <Text>{h.feedback}</Text>}
          <Text>{h.text}</Text>
        </article>
      ))}
      {ex.solution && (
        <article className="card card-solution">
          <h3 className="label">Solución explicada</h3>
          {ex.solution.answer && <p className="answer">{ex.solution.answer}</p>}
          {!ex.solution.verified && <Alert tone="info">La IA no ha podido verificar esta respuesta con certeza. Contrástala con tus apuntes o con tu profesor.</Alert>}
          <ol className="steps">{ex.solution.steps.map((s, i) => <li key={i}><Text>{s}</Text></li>)}</ol>
          <h4 className="sub">Cómo se relaciona con el enunciado</h4><Text>{ex.solution.connection}</Text>
          {ex.solution.mistakes.length > 0 && <><h4 className="sub">Qué mejorar de tus intentos</h4><ul>{ex.solution.mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul></>}
          <h4 className="sub">Por qué funciona</h4><Text>{ex.solution.why}</Text>
          {ex.solution.uncertainty && <p className="hint">Ojo: {ex.solution.uncertainty}</p>}
        </article>
      )}
      {ex.check && (
        <article className="card card-check">
          <h3 className="label">Comprobación</h3>
          <Text>{ex.check.question}</Text>
          {ex.check.rounds.map((r, i) => (
            <div key={i} className={`round round-${r.verdict}`}>
              <p className="hint">Tu respuesta: {r.answer}</p>
              <Text>{r.feedback}</Text>
            </div>
          ))}
        </article>
      )}

      {err && (
        <Alert action={<span className="alert-actions">
          {err.kind && ['auth', 'no_key', 'bad_request'].includes(err.kind) && <Button onClick={onSettings}>Ir a Ajustes</Button>}
          {err.retry && <Button onClick={err.retry}>Reintentar</Button>}
        </span>}>{err.message}</Alert>
      )}
      <div aria-live="polite">{notice && <Alert tone="info">{notice}</Alert>}{busy && <p className="busy"><span className="spinner" aria-hidden /> {busy}</p>}</div>

      {/* ===== Zona de acción según la etapa ===== */}
      {!done && ex.pendingClarification && ex.stage === 'attempt' && (
        <div className="action">
          <Alert tone="info">Antes de darte una pista necesito aclarar algo: {ex.pendingClarification}</Alert>
          <Field label="Tu aclaración" value={extra} onChange={(e) => setExtra(e.target.value)} rows={3}
            onSubmit={() => extra.trim() && void (async () => { const e2 = addContext(ex, extra, Date.now()); setExtra(''); await onChange(e2); await askHint(e2, 'hint1'); })()} />
          <Button variant="primary" disabled={!extra.trim() || !!busy}
            onClick={async () => { const e2 = addContext(ex, extra, Date.now()); setExtra(''); await onChange(e2); await askHint(e2, 'hint1'); }}>Enviar aclaración y pedir pista</Button>
        </div>
      )}

      {!done && !ex.pendingClarification && ex.stage === 'attempt' && (
        ex.attempts.length === 0 ? (
          <div className="action">
            <Field label="Tu intento" hint="Cuéntame qué harías o hasta dónde llegas. Aunque esté incompleto o dudes: es lo que me permite ayudarte bien."
              value={text} onChange={(e) => setText(e.target.value)} onSubmit={sendAttempt} placeholder="Yo empezaría por…" />
            <Button variant="primary" disabled={!text.trim() || !!busy} loading={!!busy} onClick={sendAttempt}>Enviar intento y pedir pista 1</Button>
            <p className="hint">Se guarda un borrador automáticamente. Ctrl/⌘ + Enter para enviar.</p>
          </div>
        ) : (
          <div className="action"><Button variant="primary" loading={!!busy} disabled={!!busy} onClick={() => askHint(ex, 'hint1')}>Pedir pista 1</Button></div>
        )
      )}

      {!done && level > 0 && (
        <div className="action">
          <Field label="Vuelve a intentarlo" hint={ex.mode === 'strict' ? 'Con esta pista, ¿qué cambiarías? Un nuevo intento desbloquea lo siguiente.' : 'Opcional en modo flexible, pero te ayuda a aprender más.'}
            value={text} onChange={(e) => setText(e.target.value)} onSubmit={sendAttempt} rows={3} />
          <Button disabled={!text.trim() || !!busy} onClick={sendAttempt}>Guardar nuevo intento</Button>
          <div className="row">
            {level < 3 && next(level === 1 ? 'hint2' : 'hint3')}
            <Button variant={level === 3 || ex.mode === 'flexible' ? 'primary' : 'ghost'} disabled={!gate('solution').ok || !!busy}
              loading={busy?.startsWith('Redactando') ?? false}
              onClick={() => run('Redactando la solución explicada…', (p) => requestSolution(ex, p, settings))}>Ver solución</Button>
            {ex.mode === 'flexible' && <Button disabled={!!busy} onClick={() => askHint(ex, 'rephrase')}>Explícalo de otra forma</Button>}
          </div>
          {[level < 3 ? lockReason(level === 1 ? 'hint2' : 'hint3') : null, lockReason('solution')].filter(Boolean)[0] && (
            <p className="hint">🔒 {(level < 3 ? lockReason(level === 1 ? 'hint2' : 'hint3') : null) ?? lockReason('solution')}</p>
          )}
        </div>
      )}

      {!done && ex.stage === 'solution' && (
        <div className="action">
          <p className="hint">Tómate un momento para leerla. Después, una pregunta corta para comprobar que se te queda.</p>
          <Button variant="primary" loading={!!busy} disabled={!!busy} onClick={() => run('Preparando tu pregunta…', (p) => requestCheck(ex, p, settings))}>Comprobar lo que he aprendido</Button>
        </div>
      )}

      {!done && ex.stage === 'check' && (
        <div className="action">
          <Field label="Tu respuesta" value={text} onChange={(e) => setText(e.target.value)} rows={3}
            hint={lastRound ? 'Casi. Revisa el comentario y prueba de nuevo.' : 'Con tus propias palabras, sin mirar la solución.'}
            onSubmit={() => text.trim() && void run('Valorando tu respuesta…', async (p) => (await evaluateCheck(ex, text, p, settings)).exercise)} />
          <div className="row">
            <Button variant="primary" loading={!!busy} disabled={!text.trim() || !!busy}
              onClick={() => run('Valorando tu respuesta…', async (p) => (await evaluateCheck(ex, text, p, settings)).exercise)}>Enviar respuesta</Button>
            {lastRound && <Button disabled={!!busy} onClick={() => void onChange(finishWithoutPassing(ex, Date.now()))}>Terminar sin superar</Button>}
          </div>
          <p className="hint">La valoración la genera una IA: es una guía razonada, no un veredicto infalible.</p>
        </div>
      )}

      {done && (
        <div className={`card ${ex.check?.passed ? 'card-success' : ''}`}>
          <h3 className="label">{ex.check?.passed ? 'Comprobación superada' : 'Ejercicio terminado'}</h3>
          <p>{ex.check?.passed ? 'Has demostrado que entiendes el concepto. Buen trabajo.' : 'Lo dejas anotado como terminado. Puedes reiniciarlo cuando quieras para volver a intentarlo.'}</p>
          <Button variant="primary" onClick={onBack}>Nuevo ejercicio</Button>
        </div>
      )}
    </section>
  );
}
