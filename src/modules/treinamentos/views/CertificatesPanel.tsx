import React, { useState } from 'react';
import { Award, Plus, Download, Link2, Ban, RotateCcw, Trash2, Loader2, Search } from 'lucide-react';
import { buildValidationUrl } from '../../../config/validationPortalConfig';
import { DielectricStorageService } from '../../../services/syncEngine';
import {
  canDeleteTraining, canEditTraining, cancelCertificate, currentCompanyId, deleteCertificate, getCertificates, getCourse,
  getCourses, getInstructors, issueIndividualCertificate, reactivateCertificate
} from '../repository';
import { exportTrainingCertificates } from '../certificatePdf';
import { certificateSituation, formatCpf, formatDateBr, isValidCpf, todayIso, type CertificateSituation } from '../rules';
import type { TrainingCertificate } from '../types';
import { alertError, btnPrimary, btnSecondary, cardCls, EmptyState, Field, inputCls, Modal, SituationBadge } from './ui';

type Filter = 'todos' | CertificateSituation;

export const CertificatesPanel: React.FC<{ initialFilter?: Filter }> = ({ initialFilter = 'todos' }) => {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const canEdit = canEditTraining();
  const today = todayIso();
  const all = getCertificates();
  const list = all.filter(c => {
    if (filter !== 'todos' && certificateSituation(c, today) !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const digits = q.replace(/\D/g, '');
    return [c.participantName, c.certificateNumber, c.validationCode, c.courseName, c.participantCompany, c.classNumber]
      .some(v => (v || '').toLowerCase().includes(q)) || (digits.length >= 3 && c.participantCpf.replace(/\D/g, '').includes(digits));
  });
  const companyInfo = DielectricStorageService.getCompanyInfo();

  const download = async (certs: TrainingCertificate[], key: string, name?: string) => {
    setBusy(key);
    try { await exportTrainingCertificates(certs, name); } catch (err) { alertError(err, 'Falha ao gerar o PDF'); } finally { setBusy(null); }
  };

  const copyLink = async (c: TrainingCertificate) => {
    const url = buildValidationUrl(companyInfo.validationBaseUrl, c.validationCode);
    try {
      await navigator.clipboard.writeText(url);
      window.alert(`Link de validação copiado:\n${url}`);
    } catch {
      window.prompt('Copie o link de validação:', url);
    }
  };

  const handleCancel = (c: TrainingCertificate) => {
    const reason = window.prompt(`Cancelar o certificado ${c.certificateNumber} de ${c.participantName}?\nO validador passará a mostrá-lo como CANCELADO.\n\nMotivo:`);
    if (reason === null) return;
    cancelCertificate(c.id, reason);
  };

  const counts = all.reduce<Record<string, number>>((acc, c) => {
    const s = certificateSituation(c, today);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input className={`${inputCls} pl-8`} placeholder="Nome, CPF, número, código ou curso" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <select className={`${inputCls} w-auto`} value={filter} onChange={e => setFilter(e.target.value as Filter)}>
          <option value="todos">Todos ({all.length})</option>
          <option value="valido">Válidos ({counts.valido || 0})</option>
          <option value="vencendo">Vencem em breve ({counts.vencendo || 0})</option>
          <option value="vencido">Vencidos ({counts.vencido || 0})</option>
          <option value="cancelado">Cancelados ({counts.cancelado || 0})</option>
        </select>
        {list.length > 1 && (
          <button type="button" className={btnSecondary} disabled={!!busy} onClick={() => download(list, 'lista', 'Certificados_treinamento.pdf')}>
            {busy === 'lista' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Baixar {list.length}
          </button>
        )}
        {canEdit && <button type="button" className={btnPrimary} onClick={() => {
          if (!getCourses().length) return window.alert('Cadastre um curso antes de emitir.');
          setIssuing(true);
        }}><Plus className="w-3.5 h-3.5" /> Emissão individual</button>}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Award} title="Nenhum certificado encontrado" text="Os certificados são emitidos pela turma (aprovados) ou individualmente." />
      ) : (
        <div className={`${cardCls} divide-y divide-slate-100`}>
          {list.map(c => {
            const s = certificateSituation(c, today);
            return (
              <div key={c.id} className="p-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{c.participantName}</span>
                    <SituationBadge situation={s} />
                  </div>
                  <p className="text-[11px] text-slate-600 truncate">{c.courseName}</p>
                  <p className="text-[10px] text-slate-500">
                    <span className="font-mono">{c.certificateNumber}</span> · emitido {formatDateBr(c.issueDate)}
                    {c.expiryDate ? ` · vence ${formatDateBr(c.expiryDate)}` : ' · sem vencimento'}
                    {c.participantCompany ? ` · ${c.participantCompany}` : ''}
                    {c.status === 'cancelado' && c.cancelReason ? ` · motivo: ${c.cancelReason}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button type="button" title="Baixar PDF" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" disabled={!!busy} onClick={() => download([c], c.id)}>
                    {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                  <button type="button" title="Copiar link de validação" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" onClick={() => copyLink(c)}><Link2 className="w-4 h-4" /></button>
                  {canEdit && (c.status === 'cancelado'
                    ? <button type="button" title="Reativar" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" onClick={() => window.confirm('Reativar este certificado?') && reactivateCertificate(c.id)}><RotateCcw className="w-4 h-4" /></button>
                    : <button type="button" title="Cancelar certificado" className="p-2 rounded-lg hover:bg-red-50 text-red-600" onClick={() => handleCancel(c)}><Ban className="w-4 h-4" /></button>)}
                  {canDeleteTraining() && c.status === 'cancelado' && (
                    <button type="button" title="Excluir definitivamente" className="p-2 rounded-lg hover:bg-red-50 text-red-600" onClick={() => window.confirm('Excluir este certificado? O código deixará de ser encontrado no validador.') && deleteCertificate(c.id)}><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {issuing && <IndividualIssue onClose={() => setIssuing(false)} onIssued={c => download([c], c.id)} />}
    </div>
  );
};

const IndividualIssue: React.FC<{ onClose: () => void; onIssued: (c: TrainingCertificate) => void }> = ({ onClose, onIssued }) => {
  const courses = getCourses().filter(c => c.active);
  const instructors = getInstructors().filter(i => i.active);
  const clients = DielectricStorageService.getClients(currentCompanyId());
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [location, setLocation] = useState('');
  const [grade, setGrade] = useState('');
  const [instructorIds, setInstructorIds] = useState<string[]>(instructors.slice(0, 1).map(i => i.id));
  const course = getCourse(courseId);

  const handleIssue = () => {
    if (!course) return window.alert('Escolha o curso.');
    if (!name.trim()) return window.alert('Informe o nome do participante.');
    if (cpf && !isValidCpf(cpf)) return window.alert('CPF inválido.');
    if (endDate < startDate) return window.alert('A data de término é anterior à de início.');
    if (getCertificates().some(c => c.courseId === courseId && c.status === 'valido' && cpf && c.participantCpf.replace(/\D/g, '') === cpf.replace(/\D/g, '') && c.endDate === endDate)
      && !window.confirm('Já existe certificado válido deste curso para este CPF com a mesma data. Emitir outro?')) return;
    try {
      const cert = issueIndividualCertificate({
        courseId, participant: { name, cpf: cpf ? formatCpf(cpf) : '', role, company, grade: grade === '' ? undefined : Number(grade) },
        startDate, endDate, location, instructorIds
      });
      onClose();
      if (window.confirm(`Certificado ${cert.certificateNumber} emitido. Baixar o PDF agora?`)) onIssued(cert);
    } catch (err) {
      alertError(err, 'Falha ao emitir');
    }
  };

  return (
    <Modal
      title="Emissão individual de certificado"
      onClose={onClose}
      footer={<>
        <button type="button" className={btnSecondary} onClick={onClose}>Cancelar</button>
        <button type="button" className={btnPrimary} onClick={handleIssue}><Award className="w-3.5 h-3.5" /> Emitir certificado</button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Curso *" className="sm:col-span-2">
          <select className={inputCls} value={courseId} onChange={e => setCourseId(e.target.value)}>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} – ` : ''}{c.name}</option>)}
          </select>
        </Field>
        <Field label="Nome do participante *" className="sm:col-span-2"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="CPF"><input className={inputCls} value={cpf} onChange={e => setCpf(e.target.value)} onBlur={e => setCpf(formatCpf(e.target.value))} inputMode="numeric" /></Field>
        <Field label="Função"><input className={inputCls} value={role} onChange={e => setRole(e.target.value)} /></Field>
        <Field label="Empresa" className="sm:col-span-2">
          <input className={inputCls} value={company} onChange={e => setCompany(e.target.value)} list="trn-clientes" />
          <datalist id="trn-clientes">{clients.map(c => <option key={c.id} value={c.nomeFantasia || c.razaoSocial} />)}</datalist>
        </Field>
        <Field label="Início *"><input type="date" className={inputCls} value={startDate} onChange={e => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} /></Field>
        <Field label="Término *"><input type="date" className={inputCls} value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} /></Field>
        <Field label="Local"><input className={inputCls} value={location} onChange={e => setLocation(e.target.value)} /></Field>
        <Field label="Nota" hint={course?.minGrade !== undefined ? `mínima ${course.minGrade}` : undefined}><input type="number" min={0} max={10} step={0.1} className={inputCls} value={grade} onChange={e => setGrade(e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <span className="block font-bold text-slate-700 mb-1 text-xs">Instrutor(es)</span>
          <div className="flex flex-wrap gap-2">
            {instructors.map(i => {
              const on = instructorIds.includes(i.id);
              return (
                <button key={i.id} type="button" onClick={() => setInstructorIds(on ? instructorIds.filter(x => x !== i.id) : [...instructorIds, i.id])}
                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-700'}`}>{i.name}</button>
              );
            })}
            {!instructors.length && <span className="text-[11px] text-amber-700">Nenhum instrutor cadastrado.</span>}
          </div>
        </div>
      </div>
      {course && course.minGrade !== undefined && grade !== '' && Number(grade) < course.minGrade && (
        <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">A nota está abaixo da mínima do curso ({course.minGrade}).</p>
      )}
    </Modal>
  );
};
