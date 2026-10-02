/**
 * Depois de publicar uma nova versão, os arquivos antigos (assets/*-HASH.js)
 * deixam de existir no servidor. Quem estava com a página aberta, ao usar uma
 * parte carregada sob demanda (ex.: assinatura digital do PDF), recebia
 * "Failed to fetch dynamically imported module". O Vite avisa com o evento
 * "vite:preloadError": a página é recarregada uma vez, já na versão nova.
 */
const FLAG = 'jvm_stale_chunk_reload_at';
const WINDOW_MS = 60_000;

export function shouldReloadForStaleChunk(lastReloadAt: number | null, now: number = Date.now()): boolean {
  // evita ficar recarregando sem parar se o arquivo realmente não existir
  return !lastReloadAt || now - lastReloadAt > WINDOW_MS;
}

export function installStaleChunkReload(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (event: Event) => {
    let last: number | null = null;
    try { last = Number(sessionStorage.getItem(FLAG)) || null; } catch { /* sem armazenamento */ }
    if (!shouldReloadForStaleChunk(last)) return; // deixa o erro aparecer normalmente
    event.preventDefault();
    try { sessionStorage.setItem(FLAG, String(Date.now())); } catch { /* sem armazenamento */ }
    window.alert('O sistema foi atualizado para uma nova versão. A página será recarregada — depois, repita a operação.');
    window.location.reload();
  });
}
