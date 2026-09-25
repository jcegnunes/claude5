import jsPDF from 'jspdf';

export type LocalFileCategory = 'laudo' | 'certificado' | 'relatorio_os' | 'backup' | 'csv' | 'etiqueta' | 'outro';

export interface LocalSavedFile {
  id: string;
  filename: string;
  title: string;
  category: LocalFileCategory;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  dataUrl?: string;
  isNativeSaved?: boolean;
}

declare global {
  interface Window {
    AndroidBridge?: {
      saveBase64File: (base64Data: string, mimeType: string, fileName: string, openAfterSave: boolean) => boolean;
      shareBase64File: (base64Data: string, mimeType: string, fileName: string, title: string) => boolean;
      saveTextFile: (content: string, mimeType: string, fileName: string) => boolean;
      isNativeApp: () => boolean;
      getStorageDirectory?: () => string;
      openLocalDownloads?: () => void;
      vibrate?: (ms: number) => void;
    };
    Android?: any;
  }
}

/**
 * Check if app is running inside the Android Native APK WebView
 */
export function isAndroidNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.AndroidBridge && typeof window.AndroidBridge.isNativeApp === 'function') {
    return window.AndroidBridge.isNativeApp();
  }
  if (window.Android && typeof window.Android.isNativeApp === 'function') {
    return window.Android.isNativeApp();
  }
  return navigator.userAgent.includes('JVMDielectricLab-Android-APK') || navigator.userAgent.includes('wv');
}

/**
 * Convert any data format (Blob, ArrayBuffer, text, Uint8Array) to base64 string
 */
export async function dataToBase64(data: string | Blob | ArrayBuffer | Uint8Array): Promise<{ base64: string; dataUrl: string; sizeBytes: number }> {
  if (typeof data === 'string') {
    if (data.startsWith('data:')) {
      const base64 = data.split(',')[1] || '';
      return { base64, dataUrl: data, sizeBytes: Math.round((base64.length * 3) / 4) };
    } else {
      // Plain text
      const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
      const base64 = btoa(unescape(encodeURIComponent(data)));
      return { base64, dataUrl: `data:text/plain;base64,${base64}`, sizeBytes: blob.size };
    }
  }

  let blob: Blob;
  if (data instanceof Blob) {
    blob = data;
  } else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
    blob = new Blob([data]);
  } else {
    blob = new Blob(['']);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ base64, dataUrl, sizeBytes: blob.size });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Cache offline dos documentos gerados (PDF, CSV, etiquetas) no aparelho.
 * Usa a Cache Storage do navegador (arquivos) + um índice leve no
 * localStorage. Não é banco de dados: os dados dos ensaios ficam no Supabase.
 */
const LOCAL_FILES_CACHE = 'jvm-local-files-v1';
const LOCAL_FILES_INDEX_KEY = 'jvm_local_files_index';
const localFileCacheUrl = (id: string) => `/__jvm_local_files__/${encodeURIComponent(id)}`;

function readLocalFilesIndex(): LocalSavedFile[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_FILES_INDEX_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeLocalFilesIndex(list: LocalSavedFile[]): void {
  try {
    localStorage.setItem(LOCAL_FILES_INDEX_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Local files index warning:', err);
  }
}

async function cacheLocalFile(record: LocalSavedFile, dataUrl: string): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('Cache Storage indisponível neste navegador');
  const blob = await (await fetch(dataUrl)).blob();
  const cache = await caches.open(LOCAL_FILES_CACHE);
  await cache.put(localFileCacheUrl(record.id), new Response(blob, { headers: { 'Content-Type': record.mimeType } }));
  const index = readLocalFilesIndex().filter(f => f.id !== record.id);
  index.unshift({ ...record, dataUrl: undefined });
  writeLocalFilesIndex(index.slice(0, 200));
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

/**
 * Universal Local File Saver
 * - Works natively on Android APK (writes directly to /Download/JVM_Laudos_Dieletricos/ with system notification)
 * - Works in Android Mobile browsers / PWA (triggers direct downloads and Web Share)
 * - Keeps an offline copy in the browser Cache Storage for later recall
 */
export async function saveFileLocally(options: {
  filename: string;
  data: string | Blob | ArrayBuffer | Uint8Array;
  mimeType: string;
  title?: string;
  category?: LocalFileCategory;
  openAfterSave?: boolean;
  cacheOffline?: boolean;
}): Promise<{ success: boolean; method: string; path?: string; id?: string }> {
  const {
    filename,
    data,
    mimeType,
    title = filename,
    category = 'outro',
    openAfterSave = false,
    cacheOffline = true
  } = options;

  const { base64, dataUrl, sizeBytes } = await dataToBase64(data);
  const fileId = `local_file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let isNativeSaved = false;
  let method = 'browser_download';

  // 1. Android Native APK Bridge execution
  const bridge = window.AndroidBridge || (window.Android as typeof window.AndroidBridge);
  if (bridge && typeof bridge.saveBase64File === 'function') {
    try {
      const nativeOk = bridge.saveBase64File(base64, mimeType, filename, openAfterSave);
      if (nativeOk) {
        isNativeSaved = true;
        method = 'android_native_storage';
      }
    } catch (err) {
      console.warn('Android native bridge save warning:', err);
    }
  }

  // 2. Browser & PWA standard local download
  if (!isNativeSaved && typeof window !== 'undefined') {
    try {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }, 500);
      method = 'browser_blob_download';
    } catch (err) {
      console.error('Browser download error:', err);
    }
  }

  // 3. Keep an offline copy (Cache Storage) for later access on Android & PC
  if (cacheOffline) {
    try {
      const fileRecord: LocalSavedFile = {
        id: fileId,
        filename,
        title,
        category,
        mimeType,
        sizeBytes,
        createdAt: new Date().toISOString(),
        dataUrl,
        isNativeSaved
      };
      await cacheLocalFile(fileRecord, dataUrl);

      // Notify any listening components (e.g. LocalDeviceFilesManager)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jvm-local-file-saved', { detail: fileRecord }));
      }
    } catch (err) {
      console.warn('Local file cache warning:', err);
    }
  }

  return {
    success: true,
    method,
    path: isNativeSaved ? `Downloads/JVM_Laudos_Dieletricos/${filename}` : `Downloads/${filename}`,
    id: fileId
  };
}

/**
 * Convenience helper to save jsPDF documents locally
 */
export async function saveDocLocally(
  doc: jsPDF,
  filename: string,
  title: string,
  category: LocalFileCategory = 'laudo'
): Promise<void> {
  const blob = doc.output('blob');
  await saveFileLocally({
    filename,
    data: blob,
    mimeType: 'application/pdf',
    title,
    category,
    openAfterSave: false,
    cacheOffline: true
  });
}

/**
 * Retrieve all files stored locally on this device
 */
export async function getLocalSavedFiles(): Promise<LocalSavedFile[]> {
  try {
    const index = readLocalFilesIndex();
    if (typeof caches === 'undefined') return [];
    const cache = await caches.open(LOCAL_FILES_CACHE);
    const files: LocalSavedFile[] = [];
    for (const meta of index) {
      const res = await cache.match(localFileCacheUrl(meta.id));
      if (!res) continue;
      files.push({ ...meta, dataUrl: await blobToDataUrl(await res.blob()) });
    }
    return files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn('Error fetching local saved files:', err);
    return [];
  }
}

/**
 * Delete a specific locally saved file from device storage
 */
export async function deleteLocalSavedFile(id: string): Promise<void> {
  try {
    writeLocalFilesIndex(readLocalFilesIndex().filter(f => f.id !== id));
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(LOCAL_FILES_CACHE);
      await cache.delete(localFileCacheUrl(id));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jvm-local-file-deleted', { detail: { id } }));
    }
  } catch (err) {
    console.error('Error deleting local saved file:', err);
  }
}

/**
 * Clear all locally saved files
 */
export async function clearAllLocalSavedFiles(): Promise<void> {
  try {
    writeLocalFilesIndex([]);
    if (typeof caches !== 'undefined') {
      await caches.delete(LOCAL_FILES_CACHE);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jvm-local-file-cleared'));
    }
  } catch (err) {
    console.error('Error clearing local files:', err);
  }
}

/**
 * Share a locally saved file using Android Native Share / Web Share API
 */
export async function shareSavedFile(file: LocalSavedFile): Promise<boolean> {
  if (!file.dataUrl) return false;

  const { base64 } = await dataToBase64(file.dataUrl);

  // 1. Android Native Bridge
  const bridge = window.AndroidBridge || (window.Android as typeof window.AndroidBridge);
  if (bridge && typeof bridge.shareBase64File === 'function') {
    try {
      return bridge.shareBase64File(base64, file.mimeType, file.filename, file.title);
    } catch (err) {
      console.warn('Native share error:', err);
    }
  }

  // 2. Web Share API with files support
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const res = await fetch(file.dataUrl);
      const blob = await res.blob();
      const jsFile = new File([blob], file.filename, { type: file.mimeType });
      if (navigator.canShare({ files: [jsFile] })) {
        await navigator.share({
          title: file.title,
          text: `Documento emitido pelo Laboratório Dielétrico JVM: ${file.title}`,
          files: [jsFile]
        });
        return true;
      }
    } catch (err) {
      console.warn('Web share file warning:', err);
    }
  }

  // Fallback: trigger download
  await saveFileLocally({
    filename: file.filename,
    data: file.dataUrl,
    mimeType: file.mimeType,
    title: file.title,
    category: file.category,
    cacheOffline: false
  });
  return true;
}
