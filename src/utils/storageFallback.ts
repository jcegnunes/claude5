/**
 * Em iframes restritos (ex.: site de terceiros com "sandbox" sem
 * allow-same-origin) o navegador bloqueia localStorage/sessionStorage e o app
 * ficaria em branco. Nesse caso usa-se um armazenamento só em memória: o
 * validador de certificados continua funcionando (nada precisa ficar salvo).
 */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    removeItem: (k: string) => { data.delete(k); },
    setItem: (k: string, v: string) => { data.set(k, String(v)); }
  };
}

export function ensureWebStorage(): void {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      const s = window[name];
      s.setItem('__jvm_probe__', '1');
      s.removeItem('__jvm_probe__');
    } catch {
      try {
        Object.defineProperty(window, name, { value: memoryStorage(), configurable: true });
      } catch { /* sem alternativa */ }
    }
  }
}
