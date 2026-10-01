import React, { useMemo, useState } from 'react';
import { Users, Plus, Pencil, Trash2, Award, ClipboardList, Download, Loader2, ClipboardPaste, Search } from 'lucide-react';
import { DielectricStorageService } from '../../../services/syncEngine';
import {
  canDeleteTraining, canEditTraining, currentCompanyId, deleteClass, getCertificates, getClasses, getCourse,
  getCourses, getInstructors, issueCertificatesForClass, saveClass
} from '../repository';
import { exportAttendanceList, exportTrainingCertificates } from '../certificatePdf';
import { formatCpf, formatDateBr, formatHours, isParticipantApproved, isValidCpf, newId, todayIso } from '../rules';
import type { TrainingClass, TrainingClassStatus, TrainingParticipant } from '../types';
import { alertError, btnPrimary, btnSecondary, cardCls, EmptyState, Field, inputCls, Modal } from './ui';

const STATUS_LABEL: Record<TrainingClassStatus, string> = {
  planejada: 'Planejada', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada'
};
const STATUS_CLS: Record<TrainingClassStatus, string> = {
  planejada: 'bg-slate-100 text-slate-700', em_andamento: 'bg-blue-50 text-blue-700',
  concluida: 'bg-emerald-50 text-emerald-700', cancelada: 'bg-red-50 text-red-700'
};

const newClass = (): TrainingClass => {
  const course = getCourses().find(c => c.active);
  return {
    id: '', companyId: '', createdAt: '', updatedAt: '', classNumber: '',
    courseId: course?.id || '', courseName: course?.name || '', clientId: '', clientName: '',
    startDate: todayIso(), endDate: todayIso(), location: '', modality: course?.modality || 'presencial',
    workloadHours: course?.workloadHours || 0, instructorIds: getInstructors().filter(i => i.active).slice(0, 1).map(i => i.id),
    participants: [], status: 'planejada', notes: ''
  };
};

export const ClassesPanel: React.FC = () => {
  const [editing, setEditing] = useState<TrainingClass | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const canEdit = canEditTraining();
  const certificates = getCertificates();
  const classes = getClasses().filter(t => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [t.classNumber, t.courseName, t.clientName, t.location, ...t.participants.map(p => p.name)].some(v => (v || '').toLowerCase().includes(q));
  });

  const handleIssue = async (t: TrainingClass) => {
    const course = getCourse(t.courseId);
    if (!course) return window.alert('O curso desta turma não existe mais. Edite a turma e escolha o curso.');
    const pending = t.participants.filter(p => !p.certificateId && isParticipantApproved(p, course));
    if (!pending.length) return window.alert('Não há alunos aprovados sem certificado nesta turma. Confira presença e nota.');
    if (!t.instructorIds.length && !window.confirm('A turma está sem instrutor. Emitir mesmo assim?')) return;
    if (!window.confirm(`Emitir ${pending.length} certificado(s) para os aprovados da turma ${t.classNumber}?`)) return;
    setBusy(t.id);
    try {
      const created = issueCertificatesForClass(t.id);
      if (created.length && window.confirm(`${created.length} certificado(s) emitido(s). Baixar o PDF agora?`)) {
        await exportTrainingCertificates(created, `Certificados_${t.classNumber}.pdf`);
      }
    } catch (err) {
      alertError(err, 'Falha ao emitir os certificados');
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadAll = async (t: TrainingClass) => {
    const certs = certificates.filter(c => c.classId === t.id);
    if (!certs.length) return;
    setBusy(t.id);
    try { await exportTrainingCertificates(certs, `Certificados_${t.classNumber}.pdf`); } catch (err) { alertError(err, 'Falha ao gerar o PDF'); } finally { setBusy(null); }
  };

  const handleAttendance = async (t: TrainingClass) => {
    setBusy(t.id);
    try { await exportAttendanceList(t, getInstructors()); } catch (err) { alertError(err, 'Falha ao gerar a lista de presença'); } finally { setBusy(null); }
  };

  const handleDelete = (t: TrainingClass) => {
    if (certificates.some(c => c.classId === t.id)) {
      window.alert('A turma tem certificados emitidos. Cancele a turma (status "Cancelada") em vez de excluir.');
      return;
    }
    if (window.confirm(`Excluir a turma ${t.classNumber}?`)) deleteClass(t.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input className={`${inputCls} pl-8`} placeholder="Buscar turma, curso, cliente ou aluno" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {canEdit && (
          <button type="button" className={btnPrimary} onClick={() => {
            if (!getCourses().length) return window.alert('Cadastre um curso antes de criar a turma.');
            setEditing(newClass());
          }}><Plus className="w-3.5 h-3.5" /> Nova turma</button>
        )}
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={Users} title={query ? 'Nenhuma turma encontrada' : 'Nenhuma turma cadastrada'} text="Cadastre a turma com o curso, as datas, o instrutor e os alunos. Depois marque presença e nota e emita os certificados dos aprovados." />
      ) : (
        <div className="space-y-2">
          {classes.map(t => {
            const course = getCourse(t.courseId);
            const approved = course ? t.participants.filter(p => isParticipantApproved(p, course)).length : 0;
            const issued = certificates.filter(c => c.classId === t.id).length;
            const pending = course ? t.participants.filter(p => !p.certificateId && isParticipantApproved(p, course)).length : 0;
            return (
              <div key={t.id} className={`${cardCls} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-500">{t.classNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CLS[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 leading-snug mt-0.5">{t.courseName}</h4>
                    <p className="text-[11px] text-slate-500">
                      {formatDateBr(t.startDate)}{t.endDate && t.endDate !== t.startDate ? ` a ${formatDateBr(t.endDate)}` : ''} · {formatHours(t.workloadHours)}
                      {t.location ? ` · ${t.location}` : ''}{t.clientName ? ` · ${t.clientName}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {t.participants.length} aluno(s) · {approved} aprovado(s) · {issued} certificado(s)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {busy === t.id && <Loader2 className="w-4 h-4 animate-spin text-blue-600 self-center" />}
                    <button type="button" className={btnSecondary} disabled={!!busy} onClick={() => handleAttendance(t)}><ClipboardList className="w-3.5 h-3.5" /> Lista de presença</button>
                    {issued > 0 && <button type="button" className={btnSecondary} disabled={!!busy} onClick={() => handleDownloadAll(t)}><Download className="w-3.5 h-3.5" /> Certificados</button>}
                    {canEdit && pending > 0 && t.status !== 'cancelada' && (
                      <button type="button" className={btnPrimary} disabled={!!busy} onClick={() => handleIssue(t)}><Award className="w-3.5 h-3.5" /> Emitir {pending}</button>
                    )}
                    {canEdit && <button type="button" title="Editar" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setEditing(JSON.parse(JSON.stringify(t)))}><Pencil className="w-4 h-4" /></button>}
                    {canDeleteTraining() && <button type="button" title="Excluir" className="p-2 rounded-lg hover:bg-red-50 text-red-600" onClick={() => handleDelete(t)}><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && <ClassEditor turma={editing} onClose={() => setEditing(null)} />}
    </div>
  );
};

const emptyParticipant = (company = ''): TrainingParticipant => ({ id: newId('alu'), name: '', cpf: '', role: '', company, attendance: 100 });

const ClassEditor: React.FC<{ turma: TrainingClass; onClose: () => void }> = ({ turma, onClose }) => {
  const [t, setT] = useState<TrainingClass>(turma);
  const [pasting, setPasting] = useState(false);
  const set = <K extends keyof TrainingClass>(k: K, v: TrainingClass[K]) => setT(prev => ({ ...prev, [k]: v }));
  const courses = getCourses().filter(c => c.active || c.id === turma.courseId);
  const instructors = getInstructors().filter(i => i.active || turma.instructorIds.includes(i.id));
  const clients = useMemo(() => DielectricStorageService.getClients(currentCompanyId()), []);
  const course = getCourse(t.courseId);

  const chooseCourse = (id: string) => {
    const c = getCourse(id);
    setT(prev => ({ ...prev, courseId: id, courseName: c?.name || '', workloadHours: c?.workloadHours || prev.workloadHours, modality: c?.modality || prev.modality }));
  };

  const chooseClient = (id: string) => {
    const c = clients.find(x => x.id === id);
    const name = c ? (c.nomeFantasia || c.razaoSocial) : '';
    setT(prev => ({
      ...prev, clientId: id, clientName: name,
      // alunos sem empresa informada passam a ser do cliente escolhido
      participants: prev.participants.map(p => (!p.company || p.company === prev.clientName ? { ...p, company: name } : p))
    }));
  };

  const setP = (id: string, patch: Partial<TrainingParticipant>) =>
    set('participants', t.participants.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const handleSave = () => {
    if (!t.courseId || !course) return window.alert('Escolha o curso.');
    if (!t.startDate) return window.alert('Informe a data de início.');
    if (t.endDate && t.endDate < t.startDate) return window.alert('A data de término é anterior à de início.');
    const participants = t.participants.filter(p => p.name.trim()).map(p => ({ ...p, name: p.name.trim(), cpf: p.cpf ? formatCpf(p.cpf) : '' }));
    const badCpf = participants.filter(p => p.cpf && !isValidCpf(p.cpf));
    if (badCpf.length) return window.alert(`CPF inválido: ${badCpf.map(p => p.name).join(', ')}.`);
    const cpfs = participants.map(p => p.cpf).filter(Boolean);
    if (new Set(cpfs).size !== cpfs.length) return window.alert('Há CPF repetido na lista de alunos.');
    saveClass({ ...t, id: t.id || newId('tur'), endDate: t.endDate || t.startDate, workloadHours: Number(t.workloadHours) || course.workloadHours, participants });
    onClose();
  };

  return (
    <Modal
      title={turma.id ? `Turma ${turma.classNumber}` : 'Nova turma'}
      onClose={onClose}
      wide
      footer={<>
        <button type="button" className={btnSecondary} onClick={onClose}>Cancelar</button>
        <button type="button" className={btnPrimary} onClick={handleSave}>Salvar turma</button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Curso *" className="sm:col-span-3">
          <select className={inputCls} value={t.courseId} onChange={e => chooseCourse(e.target.value)}>
            <option value="">Escolha…</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} – ` : ''}{c.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={t.status} onChange={e => set('status', e.target.value as TrainingClassStatus)}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Início *"><input type="date" className={inputCls} value={t.startDate} onChange={e => set('startDate', e.target.value)} /></Field>
        <Field label="Término"><input type="date" className={inputCls} value={t.endDate} min={t.startDate} onChange={e => set('endDate', e.target.value)} /></Field>
        <Field label="Carga horária (h)"><input type="number" min={0.5} step={0.5} className={inputCls} value={t.workloadHours} onChange={e => set('workloadHours', e.target.value as any)} /></Field>
        <Field label="Modalidade">
          <select className={inputCls} value={t.modality} onChange={e => set('modality', e.target.value as any)}>
            <option value="presencial">Presencial</option>
            <option value="semipresencial">Semipresencial</option>
            <option value="ead">A distância (EAD)</option>
          </select>
        </Field>
        <Field label="Local" className="sm:col-span-2"><input className={inputCls} value={t.location} onChange={e => set('location', e.target.value)} placeholder="Cidade/UF ou endereço" /></Field>
        <Field label="Cliente (empresa contratante)" className="sm:col-span-2">
          <select className={inputCls} value={t.clientId || ''} onChange={e => chooseClient(e.target.value)}>
            <option value="">Turma aberta / sem cliente</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-4">
          <span className="block font-bold text-slate-700 mb-1 text-xs">Instrutor(es)</span>
          {instructors.length === 0 ? (
            <p className="text-[11px] text-amber-700">Nenhum instrutor cadastrado (aba Instrutores).</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {instructors.map(i => {
                const on = t.instructorIds.includes(i.id);
                return (
                  <button key={i.id} type="button" onClick={() => set('instructorIds', on ? t.instructorIds.filter(x => x !== i.id) : [...t.instructorIds, i.id])}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-700'}`}>
                    {i.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h4 className="font-bold text-xs text-slate-800">
            Alunos ({t.participants.length})
            {course && <span className="font-normal text-slate-500"> · aprovação: presença ≥ {course.minAttendance}%{course.minGrade !== undefined && course.minGrade !== null ? ` e nota ≥ ${course.minGrade}` : ''}</span>}
          </h4>
          <div className="flex gap-2">
            <button type="button" className={btnSecondary} onClick={() => setPasting(true)}><ClipboardPaste className="w-3.5 h-3.5" /> Colar lista</button>
            <button type="button" className={btnSecondary} onClick={() => set('participants', [...t.participants, emptyParticipant(t.clientName)])}><Plus className="w-3.5 h-3.5" /> Aluno</button>
          </div>
        </div>
        {t.participants.length === 0 ? (
          <p className="text-[11px] text-slate-500 border border-dashed border-slate-300 rounded-xl p-4 text-center">Nenhum aluno. Use "Aluno" ou cole uma lista copiada da planilha.</p>
        ) : (
          <div className="space-y-2">
            {t.participants.map((p, idx) => {
              const ok = course ? isParticipantApproved(p, course) : false;
              const cpfBad = !!p.cpf && !isValidCpf(p.cpf);
              return (
                <div key={p.id} className={`grid grid-cols-2 sm:grid-cols-12 gap-2 items-end p-2 rounded-xl border ${p.certificateId ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
                  <Field label={`${idx + 1}. Nome`} className="col-span-2 sm:col-span-3"><input className={inputCls} value={p.name} onChange={e => setP(p.id, { name: e.target.value })} disabled={!!p.certificateId} /></Field>
                  <Field label="CPF" className="sm:col-span-2"><input className={`${inputCls} ${cpfBad ? 'border-red-400' : ''}`} value={p.cpf} onChange={e => setP(p.id, { cpf: e.target.value })} onBlur={e => setP(p.id, { cpf: formatCpf(e.target.value) })} disabled={!!p.certificateId} inputMode="numeric" /></Field>
                  <Field label="Função" className="sm:col-span-2"><input className={inputCls} value={p.role || ''} onChange={e => setP(p.id, { role: e.target.value })} disabled={!!p.certificateId} /></Field>
                  <Field label="Empresa" className="sm:col-span-2"><input className={inputCls} value={p.company || ''} onChange={e => setP(p.id, { company: e.target.value })} disabled={!!p.certificateId} /></Field>
                  <Field label="Presença %"><input type="number" min={0} max={100} className={inputCls} value={p.attendance} onChange={e => setP(p.id, { attendance: Number(e.target.value) })} disabled={!!p.certificateId} /></Field>
                  <Field label="Nota" className="sm:col-span-2"><input type="number" min={0} max={10} step={0.1} className={inputCls} value={p.grade ?? ''} onChange={e => setP(p.id, { grade: e.target.value === '' ? undefined : Number(e.target.value) })} disabled={!!p.certificateId} /></Field>
                  <div className="col-span-2 sm:col-span-12 flex items-center gap-1 justify-end -mt-1">
                    {p.certificateId ? (
                      <span className="text-[10px] font-bold text-emerald-700">Certificado emitido</span>
                    ) : (
                      <>
                        <select
                          className={`text-[10px] font-bold rounded-lg border px-1 py-1.5 ${ok ? 'text-emerald-700 border-emerald-200' : 'text-red-700 border-red-200'}`}
                          value={p.approvedOverride === undefined ? 'auto' : p.approvedOverride ? 'sim' : 'nao'}
                          onChange={e => setP(p.id, { approvedOverride: e.target.value === 'auto' ? undefined : e.target.value === 'sim' })}
                          title="Aprovação"
                        >
                          <option value="auto">{ok ? 'Aprovado' : 'Reprovado'} (auto)</option>
                          <option value="sim">Aprovado</option>
                          <option value="nao">Reprovado</option>
                        </select>
                        <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => set('participants', t.participants.filter(x => x.id !== p.id))} aria-label="Remover aluno"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Field label="Observações internas" className="mt-4"><textarea rows={2} className={inputCls} value={t.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>

      {pasting && (
        <PasteParticipants
          defaultCompany={t.clientName || ''}
          onClose={() => setPasting(false)}
          onAdd={list => set('participants', [...t.participants.filter(p => p.name.trim()), ...list])}
        />
      )}
    </Modal>
  );
};

/** Lista copiada da planilha: Nome; CPF; Função; Empresa (separados por TAB, ; ou ,). */
const PasteParticipants: React.FC<{ defaultCompany: string; onClose: () => void; onAdd: (list: TrainingParticipant[]) => void }> = ({ defaultCompany, onClose, onAdd }) => {
  const [text, setText] = useState('');
  const parsed = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
    const cols = line.split(line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',').map(c => c.trim());
    return { ...emptyParticipant(defaultCompany), name: cols[0] || '', cpf: cols[1] ? formatCpf(cols[1]) : '', role: cols[2] || '', company: cols[3] || defaultCompany };
  }).filter(p => p.name && !/^nome$/i.test(p.name));

  return (
    <Modal
      title="Colar lista de alunos"
      onClose={onClose}
      footer={<>
        <button type="button" className={btnSecondary} onClick={onClose}>Cancelar</button>
        <button type="button" className={btnPrimary} disabled={!parsed.length} onClick={() => { onAdd(parsed); onClose(); }}>Incluir {parsed.length || ''} aluno(s)</button>
      </>}
    >
      <p className="text-xs text-slate-500 mb-2">Uma pessoa por linha, nas colunas <b>Nome, CPF, Função, Empresa</b> (copie direto do Excel ou separe por ponto e vírgula).</p>
      <textarea rows={10} className={`${inputCls} font-mono`} value={text} onChange={e => setText(e.target.value)} placeholder={'Maria Souza;123.456.789-09;Eletricista;Cliente X\nJoão Lima;98765432100;Técnico'} />
      {parsed.length > 0 && (
        <p className="text-[11px] text-slate-600 mt-2">
          {parsed.length} aluno(s) reconhecido(s){parsed.some(p => p.cpf && !isValidCpf(p.cpf)) ? ' — há CPF inválido; corrija antes de salvar a turma.' : '.'}
        </p>
      )}
    </Modal>
  );
};
