// Service worker: abre el panel lateral y recibe el texto seleccionado desde el menú contextual.
import { PENDING_KEY } from './storage';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.contextMenus.create({
    id: 'freno-work', title: 'Trabajar este ejercicio con FRENO', contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'freno-work' || !info.selectionText?.trim()) return;
  // Hay que abrir el panel de forma síncrona dentro del gesto del usuario.
  if (tab?.id !== undefined) chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  void chrome.storage.session.set({ [PENDING_KEY]: { text: info.selectionText.trim().slice(0, 6000) } });
});
