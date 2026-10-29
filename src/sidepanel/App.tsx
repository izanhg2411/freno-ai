import { useCallback, useEffect, useRef, useState } from 'react';
import { newExercise } from '../core/flow';
import { DEFAULT_SETTINGS, type Exercise, type Settings, type Subject } from '../core/types';
import { PENDING_KEY, deleteExercise, loadExercises, loadKey, loadSettings, saveExercise, saveSettings, takePending } from '../storage';
import { Work } from './Work';
import { History, Home, SettingsView } from './Views';
import { Logo } from './ui';

type View = 'home' | 'work' | 'history' | 'settings';
const TABS: Array<[View, string]> = [['home', 'Ejercicio'], ['history', 'Historial'], ['settings', 'Ajustes']];

export function App() {
  const [view, setView] = useState<View>('home');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [prefill, setPrefill] = useState('');
  const [homeKey, setHomeKey] = useState(0);
  const [ready, setReady] = useState(false);
  const ref = useRef<Exercise[]>([]);
  ref.current = exercises;

  const refreshKey = useCallback(async () => setHasKey(!!(await loadKey((await loadSettings()).provider))), []);
  const receivePending = useCallback(async () => {
    const t = await takePending();
    if (t) { setPrefill(t); setHomeKey((k) => k + 1); setView('home'); }
  }, []);

  useEffect(() => {
    void (async () => {
      setSettings(await loadSettings()); setExercises(await loadExercises()); await refreshKey(); await receivePending(); setReady(true);
    })();
    const onChanged = (c: Record<string, chrome.storage.StorageChange>, area: string) => { if (area === 'session' && c[PENDING_KEY]) void receivePending(); };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [refreshKey, receivePending]);

  useEffect(() => {
    if (settings.theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);
  useEffect(() => { void refreshKey(); }, [settings.provider, view, refreshKey]);

  const upsert = async (ex: Exercise) => {
    await saveExercise(ex);
    setExercises((list) => [ex, ...list.filter((e) => e.id !== ex.id)].sort((a, b) => b.updatedAt - a.updatedAt));
  };
  const changeSettings = (s: Settings) => { setSettings(s); void saveSettings(s); };
  const start = async (prompt: string, subject: Subject, context: string) => {
    const ex = newExercise({ prompt, subject, context, mode: settings.mode, now: Date.now(), id: crypto.randomUUID() });
    await upsert(ex); setActiveId(ex.id); setPrefill(''); setView('work');
  };
  const open = (id: string) => { setActiveId(id); setView('work'); };
  const current = exercises.find((e) => e.id === activeId);
  const nav = (v: View) => { if (v === 'home') setPrefill(''); setView(v); };

  if (!ready) return <div className="boot" aria-busy="true"><Logo size={32} /></div>;
  return (
    <div className="app">
      <header className="top">
        <div className="brand"><Logo /><span>FRENO</span></div>
        <nav aria-label="Secciones">
          {TABS.map(([v, label]) => (
            <button key={v} aria-current={(view === v || (view === 'work' && v === 'home')) ? 'page' : undefined} onClick={() => nav(v)}>{label}</button>
          ))}
        </nav>
      </header>
      <main>
        {view === 'home' && <Home key={homeKey} settings={settings} hasKey={hasKey} prefill={prefill} active={exercises.filter((e) => e.status === 'active')} onStart={start} onOpen={open} onSettings={() => setView('settings')} />}
        {view === 'work' && current && <Work key={current.id + ':' + current.restarts} ex={current} settings={settings} onChange={upsert} onBack={() => nav('home')} onSettings={() => setView('settings')} />}
        {view === 'history' && <History exercises={exercises} onOpen={open} onDelete={async (id) => { await deleteExercise(id); setExercises((l) => l.filter((e) => e.id !== id)); if (id === activeId) setActiveId(null); }} />}
        {view === 'settings' && <SettingsView settings={settings} onChange={changeSettings} hasKey={hasKey} onKeyChange={refreshKey} count={exercises.length} onClearHistory={() => { setExercises([]); setActiveId(null); }} />}
      </main>
    </div>
  );
}
