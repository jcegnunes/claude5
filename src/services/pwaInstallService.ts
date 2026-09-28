/**
 * Instalação do app pelo navegador (PWA) e armazenamento persistente.
 *
 * - Android/Chrome/Edge: o navegador dispara "beforeinstallprompt"; guardamos o
 *   evento para o botão "Instalar" abrir a instalação nativa.
 * - iPhone/iPad (Safari): não existe esse evento; a instalação é pelo menu
 *   Compartilhar > "Adicionar à Tela de Início".
 */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => { try { fn(); } catch {} });

export function initPwaInstall(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    (window as any).deferredPrompt = deferredPrompt; // compatibilidade com telas antigas
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    (window as any).deferredPrompt = null;
    notify();
  });

  // Pede ao navegador para NÃO apagar os dados offline (ensaios pendentes)
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(already => {
        if (!already) navigator.storage.persist().catch(() => {});
      }).catch(() => {});
    }
  } catch {}
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
}

export function canPromptInstall(): boolean {
  return !!deferredPrompt;
}

/** Abre a instalação nativa. Retorna 'unavailable' quando o navegador não oferece. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const evt = deferredPrompt;
  await evt.prompt();
  const choice = await evt.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  if (choice.outcome === 'accepted') {
    deferredPrompt = null;
    (window as any).deferredPrompt = null;
  }
  notify();
  return choice.outcome;
}

export function onInstallAvailabilityChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
