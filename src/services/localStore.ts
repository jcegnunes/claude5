/**
 * Armazenamento local dos dados do app no IndexedDB.
 *
 * O localStorage tem ~5 MB: poucos ensaios com fotos offline já o enchiam.
 * O IndexedDB guarda centenas de MB. Para não mudar o restante do app (que lê
 * os dados de forma síncrona), as chaves grandes são carregadas na memória na
 * abertura do app e cada gravação é enviada ao IndexedDB imediatamente.
 *
 * - Migração automática: o que estava no localStorage é copiado e só depois
 *   removido de lá.
 * - Várias abas abertas: uma aba avisa as outras quando grava (BroadcastChannel).
 * - IndexedDB indisponível (ex.: navegação privada): continua no localStorage.
 */

const DB_NAME = 'jvm_dielectric_store';
const STORE = 'kv';
const CHANNEL = 'jvm-local-store';
const OPEN_TIMEOUT_MS = 4000;

let db: IDBDatabase | null = null;
let managedKeys = new Set<string>();
const memory = new Map<string, unknown>();
let channel: BroadcastChannel | null = null;
let lastError: string | null = null;

function clone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transação cancelada'));
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('IndexedDB não respondeu')), OPEN_TIMEOUT_MS);
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(DB_NAME, 1);
    } catch (err) {
      clearTimeout(timer);
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => { clearTimeout(timer); resolve(req.result); };
    req.onerror = () => { clearTimeout(timer); reject(req.error); };
    req.onblocked = () => { clearTimeout(timer); reject(new Error('IndexedDB bloqueado')); };
  });
}

/** Junta listas por id: itens que só existem no localStorage não se perdem. */
function mergeById(primary: unknown, extra: unknown): unknown {
  if (!Array.isArray(primary) || !Array.isArray(extra)) return primary;
  const ids = new Set(primary.map((i: any) => i && i.id).filter(Boolean));
  const missing = extra.filter((i: any) => i && i.id && !ids.has(i.id));
  return missing.length ? [...primary, ...missing] : primary;
}

function readLegacy(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function reloadKey(key: string): Promise<void> {
  if (!db) return;
  const tx = db.transaction(STORE, 'readonly');
  const value = await requestToPromise(tx.objectStore(STORE).get(key));
  if (value === undefined) memory.delete(key);
  else memory.set(key, value);
}

/**
 * Carrega as chaves no IndexedDB (migrando do localStorage). Deve terminar
 * antes de o app ler qualquer dado. Retorna true se o IndexedDB está em uso.
 */
export async function initLocalStore(keys: string[], factory: IDBFactory | undefined = globalThis.indexedDB): Promise<boolean> {
  managedKeys = new Set(keys);
  memory.clear();
  if (!factory) {
    db = null;
    return false;
  }
  try {
    db = await openDb(factory);
  } catch (err) {
    console.warn('[Armazenamento] IndexedDB indisponível — usando o armazenamento simples do navegador:', err);
    db = null;
    return false;
  }

  // 1. Carrega o que já está no IndexedDB
  const readTx = db.transaction(STORE, 'readonly');
  const store = readTx.objectStore(STORE);
  await Promise.all(keys.map(async key => {
    const value = await requestToPromise(store.get(key));
    if (value !== undefined) memory.set(key, value);
  }));

  // 2. Migra o que ainda está no localStorage
  const migrated: string[] = [];
  const toWrite: Array<[string, unknown]> = [];
  keys.forEach(key => {
    const legacy = readLegacy(key);
    if (legacy === undefined) return;
    const value = memory.has(key) ? mergeById(memory.get(key), legacy) : legacy;
    memory.set(key, value);
    toWrite.push([key, value]);
    migrated.push(key);
  });
  if (toWrite.length) {
    const tx = db.transaction(STORE, 'readwrite');
    toWrite.forEach(([key, value]) => tx.objectStore(STORE).put(value, key));
    await transactionDone(tx);
    // só remove do localStorage depois de gravado no IndexedDB
    migrated.forEach(key => { try { localStorage.removeItem(key); } catch {} });
  }

  // 3. Outras abas do app: recarrega a chave que elas gravaram
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (ev: MessageEvent) => {
      const key = ev.data && ev.data.key;
      if (typeof key !== 'string' || !managedKeys.has(key)) return;
      reloadKey(key)
        .then(() => window.dispatchEvent(new Event('jvm-data-changed')))
        .catch(() => {});
    };
  } catch {
    channel = null;
  }
  return true;
}

/** true se a chave é guardada no IndexedDB (e não no localStorage). */
export function isManaged(key: string): boolean {
  return !!db && managedKeys.has(key);
}

/** Lê uma chave gerenciada (cópia; undefined se não existir). */
export function storeGet<T>(key: string): T | undefined {
  return memory.has(key) ? clone(memory.get(key) as T) : undefined;
}

export function storeHas(key: string): boolean {
  return memory.has(key);
}

/** Grava uma chave gerenciada: memória na hora, IndexedDB em seguida. */
export function storeSet<T>(key: string, value: T): Promise<void> {
  const copy = clone(value);
  memory.set(key, copy);
  return persist(key, copy, false);
}

export function storeRemove(key: string): Promise<void> {
  memory.delete(key);
  return persist(key, undefined, true);
}

function persist(key: string, value: unknown, remove: boolean): Promise<void> {
  if (!db) return Promise.resolve();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    if (remove) tx.objectStore(STORE).delete(key);
    else tx.objectStore(STORE).put(value, key);
    return transactionDone(tx)
      .then(() => {
        lastError = null;
        channel?.postMessage({ key });
      })
      .catch(err => reportError(key, err));
  } catch (err) {
    reportError(key, err);
    return Promise.resolve();
  }
}

function reportError(key: string, err: any): void {
  lastError = err?.message || String(err);
  console.error(`[Armazenamento] Falha ao gravar ${key}:`, err);
  if (typeof window !== 'undefined' && err && (err.name === 'QuotaExceededError' || /quota/i.test(lastError))) {
    window.dispatchEvent(new CustomEvent('jvm-storage-quota', { detail: { key } }));
  }
}

/** Situação do armazenamento (para a tela de diagnóstico). */
export async function getStorageStatus(): Promise<{ indexedDb: boolean; usageMb?: number; quotaMb?: number; lastError: string | null }> {
  const status: { indexedDb: boolean; usageMb?: number; quotaMb?: number; lastError: string | null } = { indexedDb: !!db, lastError };
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      if (est.usage !== undefined) status.usageMb = Math.round(est.usage / 1048576);
      if (est.quota !== undefined) status.quotaMb = Math.round(est.quota / 1048576);
    }
  } catch {}
  return status;
}

/** Somente para testes: fecha o banco e limpa o estado. */
export function __resetLocalStoreForTests(): void {
  try { db?.close(); } catch {}
  try { channel?.close(); } catch {}
  db = null;
  channel = null;
  memory.clear();
  managedKeys = new Set();
}
