/**
 * Resultado do validador público para certificados de treinamento
 * (códigos VAL-TRE-...). Sem login: dados vêm de jvm_validar_treinamento,
 * com o CPF mascarado. Logado na empresa emissora: usa o dado do aparelho.
 */
import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Loader2, GraduationCap } from 'lucide-react';
import { getCertificates } from '../repository';
import { fetchPublicTrainingCertificate } from '../sync';
import { certificateSituation, formatDateBr, formatHours, maskCpf } from '../rules';
import type { PublicTrainingCertificate, TrainingCertificate } from '../types';

function fromLocal(c: TrainingCertificate): PublicTrainingCertificate {
  return {
    certificateNumber: c.certificateNumber, validationCode: c.validationCode, participantName: c.participantName,
    participantCpfMasked: maskCpf(c.participantCpf), participantCompany: c.participantCompany, courseName: c.courseName,
    normReference: c.normReference, workloadHours: c.workloadHours, modality: c.modality, startDate: c.startDate,
    endDate: c.endDate, issueDate: c.issueDate, expiryDate: c.expiryDate, status: c.status, cancelReason: c.cancelReason,
    instructorNames: c.instructorNames, technicalResponsibleName: c.technicalResponsibleName
  };
}

export const TrainingValidationResult: React.FC<{ code: string }> = ({ code }) => {
  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<PublicTrainingCertificate | null>(null);

  useEffect(() => {
    let alive = true;
    const clean = code.trim().toUpperCase();
    const mine = getCertificates().find(c => c.validationCode === clean) || null;
    setLoading(true);
    (async () => {
      const remote = typeof navigator !== 'undefined' && navigator.onLine !== false ? await fetchPublicTrainingCertificate(clean) : null;
      if (!alive) return;
      setCert(remote || (mine ? fromLocal(mine) : null));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [code]);

  if (loading) {
    return <div className="bg-white rounded-2xl p-8 shadow-md border border-slate-200 text-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" /></div>;
  }

  if (!cert) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-md border border-slate-200 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h3 className="font-bold text-slate-900">Certificado não encontrado</h3>
        <p className="text-xs text-slate-500 mt-1">Confira o código impresso junto ao QR Code. Sem internet, a consulta não pode ser feita.</p>
      </div>
    );
  }

  const situation = certificateSituation({ status: cert.status, expiryDate: cert.expiryDate });
  const valid = situation === 'valido' || situation === 'vencendo';
  const banner = situation === 'cancelado' ? 'bg-red-600' : situation === 'vencido' ? 'bg-amber-600' : 'bg-emerald-600';
  const title = situation === 'cancelado' ? 'CERTIFICADO CANCELADO' : situation === 'vencido' ? 'CERTIFICADO VENCIDO' : 'CERTIFICADO VÁLIDO & AUTÊNTICO';

  const rows: Array<[string, string | undefined]> = [
    ['Participante', cert.participantName],
    ['CPF', cert.participantCpfMasked],
    ['Empresa', cert.participantCompany],
    ['Treinamento', cert.courseName],
    ['Norma / referência', cert.normReference],
    ['Carga horária', cert.workloadHours ? formatHours(Number(cert.workloadHours)) : undefined],
    ['Período', cert.startDate ? `${formatDateBr(cert.startDate)}${cert.endDate && cert.endDate !== cert.startDate ? ` a ${formatDateBr(cert.endDate)}` : ''}` : undefined],
    ['Emissão', formatDateBr(cert.issueDate)],
    ['Validade', cert.expiryDate ? formatDateBr(cert.expiryDate) : 'Sem vencimento'],
    ['Instrutor(es)', (cert.instructorNames || []).join(', ')],
    ['Responsável técnico', cert.technicalResponsibleName],
    ['Emitido por', [cert.companyLegalName || cert.companyName, cert.companyCnpj ? `CNPJ ${cert.companyCnpj}` : ''].filter(Boolean).join(' – ')],
    ['Nº do certificado', cert.certificateNumber],
    ['Código de validação', cert.validationCode]
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      <div className={`p-6 text-white ${banner}`}>
        <div className="flex items-center gap-3">
          {valid ? <ShieldCheck className="w-10 h-10 shrink-0" /> : situation === 'vencido' ? <AlertTriangle className="w-10 h-10 shrink-0" /> : <ShieldAlert className="w-10 h-10 shrink-0" />}
          <div>
            <span className="text-[11px] uppercase tracking-widest font-bold opacity-90 flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> Certificado de treinamento</span>
            <h3 className="text-xl font-black">{title}</h3>
            {situation === 'cancelado' && cert.cancelReason && <p className="text-xs opacity-90 mt-0.5">Motivo: {cert.cancelReason}</p>}
            {situation === 'vencendo' && <p className="text-xs opacity-90 mt-0.5">Vence em {formatDateBr(cert.expiryDate)}: programe a reciclagem.</p>}
          </div>
        </div>
      </div>
      <dl className="p-6 grid sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className={k === 'Treinamento' || k === 'Emitido por' ? 'sm:col-span-2' : ''}>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{k}</dt>
            <dd className={`text-sm text-slate-900 ${k.startsWith('Código') || k.startsWith('Nº') ? 'font-mono' : 'font-semibold'}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default TrainingValidationResult;
