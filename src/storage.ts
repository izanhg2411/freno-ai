// Acceso a chrome.storage. Todo queda en el dispositivo (storage.local); lo pendiente del menú contextual, en storage.session.
import { DEFAULT_SETTINGS, type Exercise, type ProviderId, type Settings } from './core/types';

const K = { settings: 'freno.settings', keys: 'freno.keys', exercises: 'freno.exercises', pending: 'freno.pending' } as const;
export const PENDING_KEY = K.pending;

export async function loadSettings(): Promise<Settings> {
  const raw = (await chrome.storage.local.get(K.settings))[K.settings] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...raw, models: { ...DEFAULT_SETTINGS.models, ...(raw?.models ?? {}) } };
}
export const saveSettings = (s: Settings) => chrome.storage.local.set({ [K.settings]: s });

type Keys = Partial<Record<ProviderId, string>>;
export async function loadKey(p: ProviderId): Promise<string> {
  return (((await chrome.storage.local.get(K.keys))[K.keys] as Keys | undefined) ?? {})[p] ?? '';
}
export async function saveKey(p: ProviderId, key: string): Promise<void> {
  const keys = ((await chrome.storage.local.get(K.keys))[K.keys] as Keys | undefined) ?? {};
  if (key.trim()) keys[p] = key.trim(); else delete keys[p];
  await chrome.storage.local.set({ [K.keys]: keys });
}
export const clearKeys = () => chrome.storage.local.remove(K.keys);

export async function loadExercises(): Promise<Exercise[]> {
  const map = ((await chrome.storage.local.get(K.exercises))[K.exercises] as Record<string, Exercise> | undefined) ?? {};
  return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function saveExercise(ex: Exercise): Promise<void> {
  const map = ((await chrome.storage.local.get(K.exercises))[K.exercises] as Record<string, Exercise> | undefined) ?? {};
  map[ex.id] = ex;
  await chrome.storage.local.set({ [K.exercises]: map });
}
export async function deleteExercise(id: string): Promise<void> {
  const map = ((await chrome.storage.local.get(K.exercises))[K.exercises] as Record<string, Exercise> | undefined) ?? {};
  delete map[id];
  await chrome.storage.local.set({ [K.exercises]: map });
}
export const clearExercises = () => chrome.storage.local.remove(K.exercises);

export async function takePending(): Promise<string | null> {
  const p = (await chrome.storage.session.get(K.pending))[K.pending] as { text?: string } | undefined;
  if (!p?.text) return null;
  await chrome.storage.session.remove(K.pending);
  return p.text;
}
