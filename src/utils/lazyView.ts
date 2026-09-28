import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'jvm_chunk_reload';

/**
 * Carrega uma tela sob demanda (arquivo separado), reduzindo o tempo de
 * abertura do app. Se o arquivo não existir mais — aba aberta durante a
 * publicação de uma nova versão — a página é recarregada uma única vez.
 */
export function lazyView<T extends ComponentType<any>>(
  loader: () => Promise<Record<string, unknown>>,
  exportName: string
) {
  return lazy(async () => {
    try {
      const mod = await loader();
      try { sessionStorage.removeItem(RELOAD_FLAG); } catch {}
      return { default: mod[exportName] as T };
    } catch (err) {
      let alreadyReloaded = false;
      try { alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1'; } catch {}
      if (!alreadyReloaded && typeof navigator !== 'undefined' && navigator.onLine) {
        try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch {}
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    }
  });
}
