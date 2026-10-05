import React, { useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2, ArrowUp, ArrowDown, RotateCcw, Copy } from 'lucide-react';
import {
  activeCourseCertificates, canDeleteTraining, canEditTraining, deleteCourse, deleteCourseAndCancelCertificates, getClasses, getCourses, restoreDefaultCourses, saveCourse
} from '../repository';
import { formatHours, newId, totalTopicHours } from '../rules';
import type { TrainingCourse } from '../types';
import { btnPrimary, btnSecondary, cardCls, EmptyState, Field, inputCls, Modal } from './ui';

const emptyCourse = (): TrainingCourse => ({
  id: '', companyId: '', createdAt: '', updatedAt: '',
  code: '', name: '', normReference: '', workloadHours: 8, validityMonths: 24, modality: 'presencial',
  minAttendance: 100, minGrade: 7, topics: [{ title: '', hours: 8 }], prerequisite: '', notes: '', active: true
});

export const CoursesPanel: React.FC = () => {
  const [editing, setEditing] = useState<TrainingCourse | null>(null);
  const courses = getCourses();
  const canEdit = canEditTraining();

  const handleDelete = (c: TrainingCourse) => {
    const classes = getClasses().filter(t => t.courseId === c.id);
    const openClasses = classes.filter(t => t.status === 'planejada' || t.status === 'em_andamento').length;
    const certs = activeCourseCertificates(c.id);
    const lines = [`Excluir o curso "${c.name}"?`];
    if (classes.length || certs.length) {
      lines.push('');
      if (classes.length) lines.push(`• ${classes.length} turma(s) usam este curso${openClasses ? ` (${openClasses} ativa(s))` : ''}: elas continuam cadastradas, mas para emitir novos certificados será preciso editar a turma e escolher outro curso.`);
      if (certs.length) {
        lines.push(`• ${certs.length} certificado(s) emitido(s) serão CANCELADOS (o QR Code passa a mostrar "cancelado"):`);
        certs.slice(0, 10).forEach(x => lines.push(`    ${x.certificateNumber} — ${x.participantName}`));
        if (certs.length > 10) lines.push(`    … e mais ${certs.length - 10}`);
        lines.push('', 'Esta ação não pode ser desfeita.');
      }
    }
    if (!window.confirm(lines.join('\n'))) return;
    if (!certs.length) { deleteCourse(c.id); return; }
    const reason = window.prompt('Motivo do cancelamento (aparece no validador):', `Curso ${c.name} excluído`);
    if (reason === null) return;
    const cancelled = deleteCourseAndCancelCertificates(c.id, reason.trim() || `Curso ${c.name} excluído`);
    window.alert(`Curso "${c.name}" excluído e ${cancelled.length} certificado(s) cancelado(s).`);
  };

  const handleRestore = () => {
    const n = restoreDefaultCourses();
    window.alert(n ? `${n} curso(s) padrão recolocado(s).` : 'Os cursos padrão já estão cadastrados.');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Cursos usados nas turmas e certificados. O conteúdo programático é impresso no verso do certificado.</p>
        {canEdit && (
          <div className="flex gap-2">
            <button type="button" className={btnSecondary} onClick={handleRestore}><RotateCcw className="w-3.5 h-3.5" /> Cursos padrão</button>
            <button type="button" className={btnPrimary} onClick={() => setEditing(emptyCourse())}><Plus className="w-3.5 h-3.5" /> Novo curso</button>
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nenhum curso cadastrado" text="Cadastre os cursos oferecidos ou recoloque os cursos padrão (NR-10 Básico, NR-10 SEP, NR-35 e EPI/EPC isolantes)." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {courses.map(c => {
            const topicsTotal = totalTopicHours(c.topics);
            return (
              <div key={c.id} className={`${cardCls} p-4 ${c.active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">{c.code || 'Curso'}{c.active ? '' : ' · inativo'}</span>
                    <h4 className="font-bold text-sm text-slate-900 leading-snug">{c.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{c.normReference}</p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 shrink-0">
                      <button type="button" title="Duplicar" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setEditing({ ...c, id: '', code: `${c.code} (cópia)`, topics: c.topics.map(t => ({ ...t })), serverUpdatedAt: undefined })}><Copy className="w-4 h-4" /></button>
                      <button type="button" title="Editar" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setEditing({ ...c, topics: c.topics.map(t => ({ ...t })) })}><Pencil className="w-4 h-4" /></button>
                      {canDeleteTraining() && <button type="button" title="Excluir" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" onClick={() => handleDelete(c)}><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-600">
                  <span><b>{formatHours(c.workloadHours)}</b> de carga horária</span>
                  <span>Validade: <b>{c.validityMonths ? `${c.validityMonths} meses` : 'sem vencimento'}</b></span>
                  <span>Aprovação: presença ≥ {c.minAttendance}%{c.minGrade !== undefined && c.minGrade !== null ? `, nota ≥ ${c.minGrade}` : ''}</span>
                  <span>{c.topics.length} tópico(s)</span>
                </div>
                {topicsTotal !== Number(c.workloadHours) && (
                  <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    A soma dos tópicos ({formatHours(topicsTotal)}) é diferente da carga horária do curso.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && <CourseEditor course={editing} onClose={() => setEditing(null)} />}
    </div>
  );
};

const CourseEditor: React.FC<{ course: TrainingCourse; onClose: () => void }> = ({ course, onClose }) => {
  const [c, setC] = useState<TrainingCourse>(course);
  const set = <K extends keyof TrainingCourse>(k: K, v: TrainingCourse[K]) => setC(prev => ({ ...prev, [k]: v }));
  const total = totalTopicHours(c.topics);

  const setTopic = (i: number, patch: Partial<TrainingCourse['topics'][number]>) =>
    set('topics', c.topics.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const moveTopic = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= c.topics.length) return;
    const topics = [...c.topics];
    [topics[i], topics[j]] = [topics[j], topics[i]];
    set('topics', topics);
  };

  const handleSave = () => {
    if (!c.name.trim()) return window.alert('Informe o nome do curso.');
    if (!(Number(c.workloadHours) > 0)) return window.alert('Informe a carga horária.');
    const topics = c.topics.filter(t => t.title.trim()).map(t => ({ title: t.title.trim(), hours: Number(t.hours) || 0 }));
    if (!topics.length) return window.alert('Inclua pelo menos um tópico no conteúdo programático.');
    saveCourse({
      ...c,
      id: c.id || newId('crs'),
      name: c.name.trim(),
      code: c.code.trim(),
      workloadHours: Number(c.workloadHours),
      validityMonths: Number(c.validityMonths) || 0,
      minAttendance: Math.min(100, Math.max(0, Number(c.minAttendance) || 0)),
      minGrade: c.minGrade === undefined || c.minGrade === null || (c.minGrade as any) === '' ? undefined : Number(c.minGrade),
      topics
    });
    onClose();
  };

  return (
    <Modal
      title={course.id ? 'Editar curso' : 'Novo curso'}
      onClose={onClose}
      wide
      footer={<>
        <button type="button" className={btnSecondary} onClick={onClose}>Cancelar</button>
        <button type="button" className={btnPrimary} onClick={handleSave}>Salvar curso</button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Sigla" className="sm:col-span-1"><input className={inputCls} value={c.code} onChange={e => set('code', e.target.value)} placeholder="NR-10 BÁSICO" /></Field>
        <Field label="Nome do curso *" className="sm:col-span-3"><input className={inputCls} value={c.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Norma / referência legal" className="sm:col-span-4"><input className={inputCls} value={c.normReference} onChange={e => set('normReference', e.target.value)} placeholder="NR-10, item 10.8.8" /></Field>
        <Field label="Carga horária (h) *"><input type="number" min={0.5} step={0.5} className={inputCls} value={c.workloadHours} onChange={e => set('workloadHours', e.target.value as any)} /></Field>
        <Field label="Validade (meses)" hint="0 = sem vencimento"><input type="number" min={0} className={inputCls} value={c.validityMonths} onChange={e => set('validityMonths', e.target.value as any)} /></Field>
        <Field label="Presença mínima (%)"><input type="number" min={0} max={100} className={inputCls} value={c.minAttendance} onChange={e => set('minAttendance', e.target.value as any)} /></Field>
        <Field label="Nota mínima (0–10)" hint="vazio = sem avaliação"><input type="number" min={0} max={10} step={0.1} className={inputCls} value={c.minGrade ?? ''} onChange={e => set('minGrade', (e.target.value === '' ? undefined : e.target.value) as any)} /></Field>
        <Field label="Modalidade">
          <select className={inputCls} value={c.modality} onChange={e => set('modality', e.target.value as any)}>
            <option value="presencial">Presencial</option>
            <option value="semipresencial">Semipresencial</option>
            <option value="ead">A distância (EAD)</option>
          </select>
        </Field>
        <Field label="Pré-requisito" className="sm:col-span-3"><input className={inputCls} value={c.prerequisite || ''} onChange={e => set('prerequisite', e.target.value)} placeholder="Ex.: NR-10 Básico válido" /></Field>
        <Field label="Observações impressas no verso" className="sm:col-span-4"><textarea rows={2} className={inputCls} value={c.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:col-span-4">
          <input type="checkbox" checked={c.active} onChange={e => set('active', e.target.checked)} /> Curso ativo (aparece para novas turmas)
        </label>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-xs text-slate-800">Conteúdo programático</h4>
          <span className={`text-[11px] font-semibold ${total === Number(c.workloadHours) ? 'text-emerald-700' : 'text-amber-700'}`}>
            Soma: {formatHours(total)} de {formatHours(Number(c.workloadHours))}
          </span>
        </div>
        <div className="space-y-2">
          {c.topics.map((t, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-[11px] font-bold text-slate-400 w-5 pt-2 text-right">{i + 1}</span>
              <textarea rows={2} className={`${inputCls} flex-1`} value={t.title} onChange={e => setTopic(i, { title: e.target.value })} placeholder="Tópico" />
              <input type="number" min={0} step={0.5} className={`${inputCls} w-20`} value={t.hours} onChange={e => setTopic(i, { hours: e.target.value as any })} title="Horas" />
              <div className="flex flex-col">
                <button type="button" className="p-1 text-slate-400 hover:text-slate-700" onClick={() => moveTopic(i, -1)} aria-label="Subir"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button type="button" className="p-1 text-slate-400 hover:text-slate-700" onClick={() => moveTopic(i, 1)} aria-label="Descer"><ArrowDown className="w-3.5 h-3.5" /></button>
              </div>
              <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => set('topics', c.topics.filter((_, idx) => idx !== i))} aria-label="Remover tópico"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
        <button type="button" className={`${btnSecondary} mt-2`} onClick={() => set('topics', [...c.topics, { title: '', hours: 1 }])}><Plus className="w-3.5 h-3.5" /> Tópico</button>
        {course.id && <p className="text-[10px] text-slate-400 mt-3">Alterações valem para os próximos certificados. Os já emitidos guardam o conteúdo da época.</p>}
      </div>
    </Modal>
  );
};
