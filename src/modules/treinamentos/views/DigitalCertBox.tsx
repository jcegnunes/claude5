/** Quadro do certificado digital A1 (instrutor ou Responsável Técnico). */
import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert, Upload, Trash2, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import {
  canManageSigningCerts, deleteSigningCert, findSigningCert, loadSigningCerts, saveSigningCert, subscribeSigningCerts,
  type SigningOwnerType
} from '../signingCerts';
import { syncTraining } from '../sync';
import { btnPrimary, btnSecondary, inputCls } from './ui';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');
const maskDoc = (d: string) => (d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : d);

export function useSigningCerts() {
  const [, setV] = useState(0);
  useEffect(() => {
    const unsub = subscribeSigningCerts(() => setV(v => v + 1));
    void loadSigningCerts();
    return unsub;
  }, []);
}

/** Selo curto para listas (válido / vence / vencido). */
export const DigitalCertBadge: React.FC<{ ownerType: SigningOwnerType; ownerId: string }> = ({ ownerType, ownerId }) => {
  const c = findSigningCert(ownerType, ownerId);
  if (!c) return null;
  const expired = new Date(c.validTo).getTime() < Date.now();
  const soon = !expired && new Date(c.validTo).getTime() - Date.now() < 30 * 864e5;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${expired ? 'bg-red-50 text-red-700 border-red-200' : soon ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
      {expired ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
      {expired ? `Cert. digital vencido (${fmt(c.validTo)})` : `Cert. digital até ${fmt(c.validTo)}`}
    </span>
  );
};

export const DigitalCertBox: React.FC<{ ownerType: SigningOwnerType; ownerId: string; ownerName: string }> = ({ ownerType, ownerId, ownerName }) => {
  useSigningCerts();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cert = findSigningCert(ownerType, ownerId);
  const canManage = canManageSigningCerts();
  const expired = cert ? new Date(cert.validTo).getTime() < Date.now() : false;

  const handleSave = async () => {
    if (!file) return setError('Escolha o arquivo .pfx ou .p12.');
    if (!password) return setError('Informe a senha do certificado.');
    setBusy(true);
    setError(null);
    try {
      // o instrutor precisa estar no servidor antes do certificado
      if (ownerType === 'instructor') await syncTraining();
      const info = await saveSigningCert(ownerType, ownerId, file, password);
      setFile(null);
      setPassword('');
      if (fileRef.current) fileRef.current.value = '';
      const nameDiff = ownerName && info.holderName && !info.holderName.toLowerCase().includes(ownerName.split(' ')[0].toLowerCase());
      setNotice(`Certificado de ${info.holderName} cadastrado (válido até ${fmt(info.validTo)}).${nameDiff ? ` Atenção: o titular é diferente de "${ownerName}".` : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remover o certificado digital de ${cert?.holderName || ownerName}? Os próximos PDFs sairão sem a assinatura digital dele.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteSigningCert(ownerType, ownerId);
      setNotice('Certificado digital removido.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="w-4 h-4 text-blue-700" />
        <span className="text-xs font-bold text-slate-800">Certificado digital ICP-Brasil (A1)</span>
      </div>

      {cert ? (
        <div className={`text-[11px] rounded-lg border px-2 py-1.5 mb-2 ${expired ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
          <b>{cert.holderName}</b>{cert.holderDoc ? ` · ${maskDoc(cert.holderDoc)}` : ''}<br />
          {cert.issuer ? `Emitido por ${cert.issuer} · ` : ''}válido de {fmt(cert.validFrom)} a {fmt(cert.validTo)}{expired ? ' — VENCIDO' : ''}
          {cert.lastUsedAt && <><br />Último uso: {new Date(cert.lastUsedAt).toLocaleString('pt-BR')}</>}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500 mb-2">Sem certificado digital: o PDF leva só a assinatura em imagem.</p>
      )}

      {canManage ? (
        <>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
            <label className="block">
              <span className="block font-bold text-slate-700 mb-1 text-[11px]">{cert ? 'Trocar arquivo (.pfx/.p12)' : 'Arquivo (.pfx/.p12)'}</span>
              <input ref={fileRef} type="file" accept=".pfx,.p12,application/x-pkcs12" className="block w-full text-[11px]" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
            <label className="block">
              <span className="block font-bold text-slate-700 mb-1 text-[11px]">Senha do certificado</span>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className={`${inputCls} pr-8`} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </label>
            <div className="flex gap-1.5">
              <button type="button" className={btnPrimary} disabled={busy || !file} onClick={handleSave}>
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Salvar
              </button>
              {cert && <button type="button" className={btnSecondary} disabled={busy} onClick={handleDelete} title="Remover certificado digital"><Trash2 className="w-3.5 h-3.5 text-red-600" /></button>}
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            O arquivo e a senha ficam guardados criptografados no servidor e são usados para assinar automaticamente os PDFs.
            Quem emite certificados de treinamento na empresa assina em nome do titular. Exige internet.
          </p>
        </>
      ) : (
        <p className="text-[10px] text-slate-500">Somente o administrador ou o Responsável Técnico cadastra certificados digitais.</p>
      )}
      {error && <p className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1" role="alert">{error}</p>}
      {notice && <p className="mt-2 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1" role="status">{notice}</p>}
    </div>
  );
};
