import React, { useEffect, useState } from 'react';
import { HardDrive, Image as ImageIcon, ShieldCheck, ShieldAlert, RefreshCw, AlertTriangle } from 'lucide-react';
import { getStorageStatus } from '../services/localStore';
import { getPhotoStoreStats, isPhotoStoreAvailable } from '../services/photoStore';
import { externalizePhotos } from '../services/photoExternalizer';
import { DielectricStorageService } from '../services/syncEngine';

interface StorageInfo {
  indexedDb: boolean;
  usageMb?: number;
  quotaMb?: number;
  persisted: boolean | null;
  photosAvailable: boolean;
  photoCount: number;
  photoMb: number;
  pendingPhotos: number;
  lastError: string | null;
}

export function formatMb(mb?: number): string {
  if (mb === undefined || !Number.isFinite(mb)) return '—';
  if (mb >= 1024) return `${(mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;
  return `${mb.toLocaleString('pt-BR', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
}

/** Percentual usado do espaço que o navegador libera para o app. */
export function usagePercent(usageMb?: number, quotaMb?: number): number | null {
  if (!usageMb && usageMb !== 0) return null;
  if (!quotaMb) return null;
  return Math.min(100, Math.round((usageMb / quotaMb) * 1000) / 10);
}

async function loadInfo(): Promise<StorageInfo> {
  const [status, photosAvailable, photos] = await Promise.all([
    getStorageStatus(),
    isPhotoStoreAvailable(),
    getPhotoStoreStats()
  ]);
  let persisted: boolean | null = null;
  try {
    if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted();
  } catch {}
  return {
    ...status,
    persisted,
    photosAvailable,
    photoCount: photos.count,
    photoMb: photos.bytes / 1048576,
    pendingPhotos: DielectricStorageService.getPendingStats().pendingPhotos || 0
  };
}

/**
 * Armazenamento deste aparelho (Central de Sincronização): espaço usado e
 * disponível, fotos guardadas no aparelho e proteção contra limpeza automática.
 */
export const StorageStatusCard: React.FC = () => {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => loadInfo().then(setInfo).catch(() => {});

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener('jvm-data-changed', onChange);
    return () => window.removeEventListener('jvm-data-changed', onChange);
  }, []);

  const organize = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const moved = await externalizePhotos();
      setMessage(moved > 0 ? `${moved} foto(s) movida(s) para o armazenamento de fotos.` : 'Todas as fotos já estão organizadas.');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const requestPersistence = async () => {
    try {
      const ok = navigator.storage?.persist ? await navigator.storage.persist() : false;
      setMessage(ok
        ? 'Armazenamento protegido: o navegador não apagará os dados deste aparelho sozinho.'
        : 'O navegador não concedeu a proteção agora. Instale o app na tela inicial e use-o com frequência.');
      await refresh();
    } catch {}
  };

  const pct = usagePercent(info?.usageMb, info?.quotaMb);
  const freeMb = info?.quotaMb !== undefined && info?.usageMb !== undefined ? Math.max(0, info.quotaMb - info.usageMb) : undefined;
  const critical = pct !== null && pct >= 80;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5" aria-labelledby="armazenamento-titulo">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 id="armazenamento-titulo" className="font-bold text-slate-900 text-sm">Armazenamento deste aparelho</h3>
            <p className="text-xs text-slate-500">Dados e fotos guardados para uso sem internet</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={organize}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Organizar fotos
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            Atualizar
          </button>
        </div>
      </div>

      {!info ? (
        <p className="text-xs text-slate-500 pt-3">Calculando…</p>
      ) : (
        <div className="pt-3 space-y-3">
          <div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-semibold text-slate-700">Espaço usado pelo app</span>
              <span className="font-mono text-slate-900">
                {formatMb(info.usageMb)} {info.quotaMb !== undefined && <>de {formatMb(info.quotaMb)}</>}
                {pct !== null && <span className="text-slate-500"> ({pct.toLocaleString('pt-BR')}%)</span>}
              </span>
            </div>
            <div
              className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden"
              role="progressbar"
              aria-label="Espaço usado pelo app"
              aria-valuenow={pct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={`h-full rounded-full ${critical ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${Math.max(pct ?? 0, pct ? 1 : 0)}%` }} />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Disponível para o app: <strong>{formatMb(freeMb)}</strong> (limite definido pelo navegador conforme o espaço livre do aparelho)</p>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <dt className="text-slate-500 flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> Fotos no aparelho</dt>
              <dd className="font-bold text-slate-900 mt-0.5">
                {info.photosAvailable ? `${info.photoCount} (${formatMb(info.photoMb)})` : 'Indisponível neste navegador'}
              </dd>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <dt className="text-slate-500">Fotos aguardando envio</dt>
              <dd className="font-bold text-slate-900 mt-0.5">{info.pendingPhotos}</dd>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <dt className="text-slate-500">Banco local</dt>
              <dd className="font-bold text-slate-900 mt-0.5">{info.indexedDb ? 'IndexedDB (alta capacidade)' : 'Armazenamento simples (~5 MB)'}</dd>
            </div>
          </dl>

          <div className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${info.persisted ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
            {info.persisted ? <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" /> : <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />}
            <div className="flex-1">
              {info.persisted
                ? 'Armazenamento protegido: o navegador não apaga os dados deste aparelho por falta de espaço.'
                : 'Armazenamento sem proteção: se o aparelho ficar sem espaço, o navegador pode apagar os dados do app. Sincronize com frequência.'}
              {!info.persisted && info.persisted !== null && (
                <button type="button" onClick={requestPersistence} className="ml-1 underline font-semibold">Pedir proteção</button>
              )}
            </div>
          </div>

          {(critical || !info.indexedDb || info.lastError) && (
            <div className="p-2.5 rounded-xl border border-red-200 bg-red-50 text-red-900 text-xs flex items-start gap-2" role="alert">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {critical && 'Espaço quase cheio: conecte-se à internet e sincronize para enviar as fotos e liberar espaço. '}
                {!info.indexedDb && 'Este navegador não permitiu o banco de alta capacidade (ex.: janela anônima): o limite é ~5 MB. '}
                {info.lastError && `Última falha ao gravar: ${info.lastError}`}
              </span>
            </div>
          )}

          {message && <p className="text-xs text-slate-600" role="status">{message}</p>}
        </div>
      )}
    </section>
  );
};
