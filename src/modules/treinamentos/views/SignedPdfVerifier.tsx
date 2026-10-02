/**
 * Validador do sistema: confere as assinaturas digitais de um PDF (padrão
 * ICP-Brasil) e o código de validação impresso nele. O arquivo é lido só no
 * navegador; nada é enviado ao servidor.
 */
import React, { useRef, useState } from 'react';
import { FileCheck2, Loader2, ShieldCheck, ShieldAlert, AlertTriangle, Upload, Search } from 'lucide-react';
import type { PdfSignatureReport, SignatureCheck } from '../pades';
import { ICP_POLICY } from '../icpBrasil';

const STATUS = {
  ok: { title: 'Assinatura digital válida — padrão ICP-Brasil', cls: 'border-emerald-300 bg-emerald-50 text-emerald-900', icon: ShieldCheck },
  aviso: { title: 'Assinatura íntegra, mas não confirmada como ICP-Brasil', cls: 'border-amber-300 bg-amber-50 text-amber-900', icon: AlertTriangle },
  erro: { title: 'Assinatura inválida', cls: 'border-red-300 bg-red-50 text-red-900', icon: ShieldAlert }
} as const;

const yes = (v: boolean | null | undefined, ok: string, no: string) => (v ? `✔ ${ok}` : `✘ ${no}`);

const SignatureCard: React.FC<{ s: SignatureCheck }> = ({ s }) => {
  const st = STATUS[s.status];
  const rows: Array<[string, string | undefined]> = [
    ['Assinado por', s.signerCn],
    ['ND do signatário', s.signerDn],
    ['Emitido por', s.issuerCn],
    ['Cadeia', s.chain.length ? s.chain.join(' → ') : undefined],
    ['Data da assinatura', s.signingTime ? new Date(s.signingTime).toLocaleString('pt-BR') : undefined],
    ['Padrão', [s.subFilter, s.policyName ? `Política ICP-Brasil ${s.policyName}` : ''].filter(Boolean).join(' · ')],
    ['Integridade', yes(s.integrity, 'documento não alterado após a assinatura', 'documento alterado após a assinatura')],
    ['Assinatura criptográfica', yes(s.cryptoValid, 'confere com o certificado', 'não confere')],
    ['Certificado do signatário', yes(s.certValidAtSigning, 'válido na data da assinatura', 'fora da validade na data da assinatura')],
    ['Cadeia ICP-Brasil', yes(s.chainTrusted, `confirmada até ${s.chain[s.chain.length - 1] || 'a AC Raiz'}`, 'não confirmada')],
    ['Política de assinatura', s.policyOid ? yes(s.policyHashOk, `${s.policyName || s.policyOid} (resumo da política confere)`, `${s.policyName || s.policyOid} (resumo da política incorreto)`) : '✘ ausente'],
    ['Abrangência', s.coversWholeDocument ? 'cobre o documento inteiro' : 'há atualizações posteriores (outras assinaturas)']
  ];
  return (
    <div className={`rounded-xl border p-3 ${st.cls}`}>
      <p className="font-bold text-sm flex items-center gap-1.5"><st.icon className="w-4 h-4" /> Assinatura {s.index}: {st.title}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="font-bold opacity-80 whitespace-nowrap">{k}</dt>
            <dd className="break-words">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      {s.messages.length > 0 && (
        <ul className="mt-2 text-[11px] list-disc pl-4 opacity-90">
          {s.messages.map(m => <li key={m}>{m}</li>)}
        </ul>
      )}
    </div>
  );
};

export const SignedPdfVerifier: React.FC<{ onConsultCode?: (code: string) => void }> = ({ onConsultCode }) => {
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<PdfSignatureReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      if (file.size > 30_000_000) throw new Error('Arquivo grande demais.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') throw new Error('O arquivo não é um PDF.');
      const { verifyPdfSignatures } = await import('../pades');
      setReport(verifyPdfSignatures(bytes));
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  const allOk = report && report.signatures.length > 0 && report.signatures.every(s => s.status === 'ok');

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 mb-6">
      <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
        <FileCheck2 className="w-4 h-4 text-blue-600" /> Verificar assinatura digital do PDF
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Envie o PDF do certificado para conferir as assinaturas digitais (padrão ICP-Brasil, {ICP_POLICY.label}).
        O arquivo é conferido no seu navegador e não é enviado a lugar nenhum.
      </p>
      <div
        className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400"
        onClick={() => ref.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
      >
        {busy ? <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" /> : <Upload className="w-6 h-6 text-slate-400 mx-auto" />}
        <p className="text-xs font-semibold text-slate-700 mt-1">{busy ? 'Conferindo…' : 'Clique ou arraste o PDF aqui'}</p>
        <input ref={ref} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
      </div>

      {error && <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">{error}</p>}

      {report && (
        <div className="mt-4 space-y-3">
          <p className={`text-sm font-bold ${allOk ? 'text-emerald-700' : report.signatures.length ? 'text-amber-700' : 'text-red-700'}`}>
            {fileName}: {report.signatures.length === 0
              ? 'nenhuma assinatura digital encontrada.'
              : allOk
                ? `${report.signatures.length} assinatura(s) digital(is) válida(s) no padrão ICP-Brasil.`
                : `${report.signatures.length} assinatura(s) encontrada(s) — confira os detalhes.`}
          </p>
          {report.signatures.map(s => <SignatureCard key={s.index} s={s} />)}
          {report.validationCodes.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-bold text-slate-700 mb-2">Código(s) de validação impresso(s) no PDF</p>
              <div className="flex flex-wrap gap-2">
                {report.validationCodes.map(code => (
                  <button key={code} type="button" onClick={() => onConsultCode?.(code)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
                    <Search className="w-3.5 h-3.5" /> Consultar {code}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">A consulta mostra a situação do certificado no sistema (válido, vencido ou cancelado).</p>
            </div>
          )}
          <p className="text-[10px] text-slate-400">
            A situação de revogação do certificado do signatário (LCR) não é consultada aqui. Para o laudo oficial do ITI, use validar.iti.gov.br.
          </p>
        </div>
      )}
    </div>
  );
};

export default SignedPdfVerifier;
