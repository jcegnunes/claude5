/**
 * Fotos dos ensaios guardadas no aparelho como ARQUIVOS BINÁRIOS, separadas
 * dos dados (banco local próprio no disco do aparelho, área privada do app).
 *
 * - O ensaio guarda só a referência "jvm-foto:<id>"; a imagem é lida apenas
 *   quando for exibida, impressa (PDF/Word), copiada para backup ou enviada.
 * - O limite passa a ser o espaço livre em disco (não a memória do aparelho).
 * - Binário ocupa ~25% menos que a foto em texto (base64).
 * - Após o envio à nuvem, a cópia local é apagada (a foto fica no Storage).
 */

export const PHOTO_REF_PREFIX = 'jvm-foto:';

const DB_NAME = 'jvm_dielectric_photos';
const STORE = 'fotos';

let dbPromise: Promise<IDBDatabase | null> | null = null;
let factoryOverride: IDBFactory | undefined;
const objectUrls = new Map<string, string>();

export function isLocalPhotoRef(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(PHOTO_REF_PREFIX);
}

function photoId(ref: string): string {
  return ref.slice(PHOTO_REF_PREFIX.length);
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  const factory = factoryOverride || (typeof indexedDB !== 'undefined' ? indexedDB : undefined);
  if (!factory) return (dbPromise = Promise.resolve(null));
  dbPromise = new Promise(resolve => {
    try {
      const req = factory.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(db => {
    if (!db) throw new Error('Armazenamento de fotos indisponível neste navegador.');
    return new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transação cancelada'));
    });
  });
}

/** O armazenamento de fotos está disponível neste navegador? */
export async function isPhotoStoreAvailable(): Promise<boolean> {
  return !!(await openDb());
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return null;
  const mime = match[1] || 'image/jpeg';
  try {
    if (match[2]) {
      const bin = atob(match[3]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(match[3])], { type: mime });
  } catch {
    return null;
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(bin)}`;
}

/** Grava a foto (data URL) como arquivo binário e devolve a referência local. */
export async function savePhotoFromDataUrl(dataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) throw new Error('Imagem inválida.');
  const id = `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(2)).join('')}`;
  await run('readwrite', store => store.put(blob, id));
  return PHOTO_REF_PREFIX + id;
}

export async function getPhotoBlob(ref: string): Promise<Blob | null> {
  if (!isLocalPhotoRef(ref)) return null;
  try {
    const blob = await run<Blob>('readonly', store => store.get(photoId(ref)));
    return blob instanceof Blob ? blob : null;
  } catch {
    return null;
  }
}

/** Foto em data URL (para PDF, Word, backup e envio). '' se não existir. */
export async function getPhotoDataUrl(ref: string): Promise<string> {
  const blob = await getPhotoBlob(ref);
  return blob ? blobToDataUrl(blob) : '';
}

/**
 * Endereço exibível pelo <img>: referências locais viram um endereço
 * temporário (object URL); os demais endereços são devolvidos como estão.
 */
export async function resolvePhotoUrl(url: string | undefined | null): Promise<string> {
  if (!url) return '';
  if (!isLocalPhotoRef(url)) return url;
  const cached = objectUrls.get(url);
  if (cached) return cached;
  const blob = await getPhotoBlob(url);
  if (!blob) return '';
  const objectUrl = URL.createObjectURL(blob);
  objectUrls.set(url, objectUrl);
  return objectUrl;
}

export async function deletePhoto(ref: string): Promise<void> {
  if (!isLocalPhotoRef(ref)) return;
  const cached = objectUrls.get(ref);
  if (cached) {
    URL.revokeObjectURL(cached);
    objectUrls.delete(ref);
  }
  try {
    await run('readwrite', store => store.delete(photoId(ref)));
  } catch {}
}

/** Referências de todas as fotos guardadas no aparelho. */
export async function listPhotoRefs(): Promise<string[]> {
  try {
    const keys = await run<IDBValidKey[]>('readonly', store => store.getAllKeys());
    return (keys || []).map(k => PHOTO_REF_PREFIX + String(k));
  } catch {
    return [];
  }
}

/** Quantidade e tamanho das fotos guardadas no aparelho. */
export async function getPhotoStoreStats(): Promise<{ count: number; bytes: number }> {
  try {
    const blobs = await run<Blob[]>('readonly', store => store.getAll());
    const list = blobs || [];
    return { count: list.length, bytes: list.reduce((sum, b) => sum + (b?.size || 0), 0) };
  } catch {
    return { count: 0, bytes: 0 };
  }
}

/** Somente para testes. */
export function __setPhotoStoreFactoryForTests(factory: IDBFactory | undefined): void {
  factoryOverride = factory;
  dbPromise = null;
  objectUrls.clear();
}
