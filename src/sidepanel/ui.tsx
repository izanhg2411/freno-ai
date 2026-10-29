import { useEffect, useRef, useState, type ComponentProps, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { FlowError } from '../core/flow';
import type { Exercise } from '../core/types';
import { AIError } from '../ai/provider';

export const Logo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="FRENO">
    <rect width="32" height="32" rx="8" fill="var(--accent)" />
    <path d="M10 7h13v4.2H14.4v3.4H21v4.2h-6.6V25H10z" fill="var(--accent-ink)" />
    <circle cx="23" cy="22.8" r="2.2" fill="var(--accent-ink)" />
  </svg>
);

type BtnProps = ComponentProps<'button'> & { variant?: 'primary' | 'ghost' | 'danger'; loading?: boolean };
export function Button({ variant = 'ghost', loading, children, disabled, className = '', ...rest }: BtnProps) {
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={`btn btn-${variant} ${className}`}>
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}

export function Alert({ tone = 'error', children, action }: { tone?: 'error' | 'info'; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {action}
    </div>
  );
}

export const friendly = (e: unknown): { message: string; kind?: string } =>
  e instanceof AIError ? { message: e.message, kind: e.kind }
  : e instanceof FlowError ? { message: e.message, kind: 'flow' }
  : { message: 'Algo no ha salido como esperaba. Inténtalo de nuevo.' };

/** Textarea con Ctrl/Cmd+Enter para enviar. */
export function Field({ label, hint, onSubmit, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; onSubmit?: () => void }) {
  const id = useRef(`f${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && <p className="hint" id={`${id}h`}>{hint}</p>}
      <textarea
        id={id} aria-describedby={hint ? `${id}h` : undefined} rows={4} {...rest}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onSubmit?.(); }}
      />
    </div>
  );
}

/** Texto de la IA como texto plano: párrafos, `código` y bloques ```. Nunca HTML. */
export function Text({ children }: { children: string }) {
  const blocks = children.split(/```[a-z]*\n?/i);
  return (
    <div className="prose">
      {blocks.map((b, i) =>
        i % 2 === 1 ? <pre key={i}><code>{b.trim()}</code></pre>
        : b.split(/\n{2,}/).filter((p) => p.trim()).map((p, j) => (
          <p key={`${i}-${j}`}>{p.split(/(`[^`]+`)/).map((s, k) => s.startsWith('`') && s.endsWith('`') && s.length > 2 ? <code key={k}>{s.slice(1, -1)}</code> : s)}</p>
        )))}
    </div>
  );
}

const STEPS = ['Ejercicio', 'Intento', 'Pistas', 'Solución', 'Comprobar'];
export function Stepper({ ex }: { ex: Exercise }) {
  const idx = { attempt: 1, hint1: 2, hint2: 2, hint3: 2, solution: 3, check: 4, done: 5 }[ex.stage];
  return (
    <ol className="stepper" aria-label="Progreso del ejercicio">
      {STEPS.map((s, i) => (
        <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''} aria-current={i === idx ? 'step' : undefined}>
          <span className="dot" aria-hidden />{s}
        </li>
      ))}
    </ol>
  );
}

export function Confirm({ label, onYes, onNo }: { label: string; onYes: () => void; onNo: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="confirm" role="alertdialog" aria-label={label}>
      <span>{label}</span>
      <Button ref={ref} variant="danger" onClick={onYes}>Sí, eliminar</Button>
      <Button onClick={onNo}>Cancelar</Button>
    </div>
  );
}

export function useDebounced(fn: () => void, deps: unknown[], ms = 600) {
  useEffect(() => { const t = setTimeout(fn, ms); return () => clearTimeout(t); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

export const useNotice = () => {
  const [n, setN] = useState<string | null>(null);
  useEffect(() => { if (!n) return; const t = setTimeout(() => setN(null), 3500); return () => clearTimeout(t); }, [n]);
  return [n, setN] as const;
};
