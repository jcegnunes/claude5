import { TestRecord } from '../types';
import { DielectricStorageService } from './syncEngine';
import {
  deletePhoto,
  getPhotoDataUrl,
  isLocalPhotoRef,
  isPhotoStoreAvailable,
  listPhotoRefs,
  savePhotoFromDataUrl
} from './photoStore';

/**
 * Move as fotos (em texto base64) de dentro dos ensaios para o armazenamento
 * de fotos do aparelho, trocando-as pela referência "jvm-foto:<id>".
 *
 * Ordem segura: a foto é gravada primeiro; só depois o ensaio passa a apontar
 * para ela. Se algo falhar no meio, a foto continua dentro do ensaio.
 */

const isInline = (url: unknown): url is string => typeof url === 'string' && url.startsWith('data:image/');

/** Fotos de um ensaio (evidências e inspeção visual), no formato em que estiverem. */
export function testPhotoUrls(test: Partial<TestRecord>): string[] {
  const urls: string[] = [];
  (test.photos || []).forEach(ph => {
    if (ph?.url) urls.push(ph.url);
    if (ph?.originalUrl) urls.push(ph.originalUrl);
  });
  (test.visualInspection || []).forEach((v: any) => { if (v?.photoUrl) urls.push(v.photoUrl); });
  return urls;
}

let chain: Promise<unknown> = Promise.resolve();

/** Executa em fila (nunca duas movimentações/limpezas ao mesmo tempo). */
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch(() => {});
  return next;
}

/** Move para o armazenamento de fotos as imagens ainda gravadas dentro dos ensaios. */
export function externalizePhotos(): Promise<number> {
  return exclusive(async () => {
    if (!(await isPhotoStoreAvailable())) return 0;
    let moved = 0;
    for (const test of DielectricStorageService.getAllTestsRaw()) {
      const inline = Array.from(new Set(testPhotoUrls(test).filter(isInline)));
      if (inline.length === 0) continue;
      const urlMap: Record<string, string> = {};
      for (const dataUrl of inline) {
        try {
          urlMap[dataUrl] = await savePhotoFromDataUrl(dataUrl);
        } catch (err) {
          console.warn('[Fotos] Não foi possível mover a foto para o armazenamento do aparelho:', err);
        }
      }
      if (Object.keys(urlMap).length > 0) {
        DielectricStorageService.replaceTestMediaUrls(test.id, urlMap);
        moved += Object.keys(urlMap).length;
      }
    }
    return moved;
  });
}

/**
 * Apaga fotos que nenhum ensaio (nem conflito pendente) usa mais: foto
 * removida de um ensaio ou já enviada à nuvem. Roda só na abertura do app,
 * quando os dados em memória são exatamente os gravados no aparelho.
 */
export function removeOrphanPhotos(): Promise<number> {
  return exclusive(async () => {
    const referenced = new Set<string>();
    DielectricStorageService.getAllTestsRaw().forEach(t => testPhotoUrls(t).forEach(u => referenced.add(u)));
    DielectricStorageService.getOpenConflicts().forEach(c => {
      testPhotoUrls(c.deviceA?.data || {}).forEach(u => referenced.add(u));
      testPhotoUrls(c.deviceB?.data || {}).forEach(u => referenced.add(u));
    });
    let removed = 0;
    for (const ref of await listPhotoRefs()) {
      if (!referenced.has(ref)) {
        await deletePhoto(ref);
        removed++;
      }
    }
    return removed;
  });
}

/**
 * Cópia do ensaio com as fotos locais embutidas (base64), para quando a foto
 * precisa sair do aparelho (envio sem Storage, backup em arquivo JSON).
 */
export async function inlineTestPhotos<T extends Partial<TestRecord>>(test: T): Promise<T> {
  if (!testPhotoUrls(test).some(isLocalPhotoRef)) return test;
  const resolve = async (url?: string) => (isLocalPhotoRef(url) ? (await getPhotoDataUrl(url)) || url : url);
  return {
    ...test,
    photos: test.photos
      ? await Promise.all(test.photos.map(async ph => ({
          ...ph,
          url: (await resolve(ph.url)) || ph.url,
          ...(ph.originalUrl ? { originalUrl: (await resolve(ph.originalUrl)) || ph.originalUrl } : {})
        })))
      : test.photos,
    visualInspection: test.visualInspection
      ? await Promise.all(test.visualInspection.map(async (v: any) => (v && v.photoUrl ? { ...v, photoUrl: await resolve(v.photoUrl) } : v)))
      : test.visualInspection
  };
}

let started = false;

/**
 * Na abertura: move as fotos antigas e apaga as que sobraram. Depois, a cada
 * alteração de dados, move as fotos novas (alguns segundos após salvar).
 */
export function startPhotoStorage(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  externalizePhotos()
    .then(() => removeOrphanPhotos())
    .catch(err => console.warn('[Fotos] Falha na organização inicial das fotos:', err));

  let timer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('jvm-data-changed', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      externalizePhotos().catch(() => {});
    }, 2000);
  });
}
