import React, { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Download, Upload, Loader2, CheckCircle2, AlertTriangle, XCircle, Award } from 'lucide-react';
import { downloadParticipantsTemplate, readSpreadsheet } from '../spreadsheetFiles';
import { getCertificates, getCourses, getInstructors, issueFromImport } from '../repository';
import { exportTrainingCertificates } from '../certificatePdf';
import {
  MAX_IMPORT_ROWS, buildImportRows, groupImportRows, rowStatus, type ImportDefaults
} from '../spreadsheetImport';
import { formatDateBr, todayIso } from '../rules';
import type { TrainingCertificate } from '../types';
import { alertError, btnPrimary, btnSecondary, Field, inputCls, Modal } from './ui';

const STATUS_UI = {
  ok: { label: 'Emitir', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  reprovado: { label: 'Reprovado', cls: 'text-amber-700 bg-amber-50 border-amber-200', icon: AlertTriangle },
  erro: { label: 'Erro', cls: 'text-red-700 bg-red-50 border-red-200', icon: XCircle }
} as const;

export const ImportCertificatesDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const courses = getCourses().filter(c => c.active);
  const instructors = getInstructors().filter(i => i.active);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [raw, setRaw] = useState<Array<Record<string, unknown>> | null>(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [createClasses, setCreateClasses] = useState(true);
  const [filter, setFilter] = useState<'todas' | 'ok' | 'reprovado' | 'erro'>('todas');
  const [defaults, setDefaults] = useState<ImportDefaults>({ courseId: '', startDate: todayIso(), endDate: '', location: '', attendance: 100, grade: undefined, instructorIds: instructors.slice(0, 1).map(i => i.id) });
  const defaultCourse = courses.find(c => c.id === defaults.courseId);
  const [result, setResult] = useState<{ certificates: TrainingCertificate[]; classes: number; skipped: number } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const rows = useMemo(() => raw ? buildImportRows(raw, { courses: getCourses(), instructors: getInstructors(), defaults, existing: getCertificates() }) : [], [raw, defaults]);
  const counts = rows.reduce((acc, r) => { acc[rowStatus(r)]++; return acc; }, { ok: 0, reprovado: 0, erro: 0 });
  const groups = useMemo(() => groupImportRows(rows), [rows]);
  const shown = filter === 'todas' ? rows : rows.filter(r => rowStatus(r) === filter);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setReading(true);
    try {
      const data = await readSpreadsheet(file);
      setRaw(data);
      setFileName(file.name);
      setFilter('todas');
    } catch (err) {
      alertError(err, 'Não foi possível ler a planilha');
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleIssue = async () => {
    if (!counts.ok) return;
    const msg = `Emitir ${counts.ok} certificado(s)${createClasses ? ` em ${groups.length} turma(s)` : ''}?`
      + (counts.reprovado ? `\n${counts.reprovado} reprovado(s) não recebem certificado.` : '')
      + (counts.erro ? `\n${counts.erro} linha(s) com erro serão ignoradas.` : '');
    if (!window.confirm(msg)) return;
    setIssuing(true);
    // deixa a tela mostrar o "emitindo" antes do trabalho pesado
    await new Promise(r => setTimeout(r, 30));
    try {
      const res = issueFromImport(groups, createClasses);
      setResult({ certificates: res.certificates, classes: res.classes.length, skipped: counts.erro + counts.reprovado });
    } catch (err) {
      alertError(err, 'Falha na emissão');
    } finally {
      setIssuing(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!result?.certificates.length) return;
    setDownloading(true);
    try {
      await exportTrainingCertificates(result.certificates, `Certificados_importacao_${todayIso()}.pdf`);
    } catch (err) {
      alertError(err, 'Falha ao gerar o PDF');
    } finally {
      setDownloading(false);
    }
  };

  // ------------------------------------------------------------- resultado
  if (result) {
    return (
      <Modal title="Importação concluída" onClose={onClose} footer={<>
        <button type="button" className={btnSecondary} onClick={onClose}>Fechar</button>
        {result.certificates.length > 0 && (
          <button type="button" className={btnPrimary} disabled={downloading} onClick={handleDownloadAll}>
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Baixar PDF ({result.certificates.length})
          </button>
        )}
      </>}>
        <div className="text-center py-4">
          <Award className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
          <p className="font-bold text-slate-900">{result.certificates.length} certificado(s) emitido(s)</p>
          {result.classes > 0 && <p className="text-xs text-slate-600 mt-1">{result.classes} turma(s) criada(s), com lista de presença disponível em Turmas.</p>}
          {result.skipped > 0 && <p className="text-xs text-amber-700 mt-1">{result.skipped} linha(s) sem certificado (reprovados ou com erro).</p>}
          <p className="text-[11px] text-slate-500 mt-3">Os certificados já estão na lista e são enviados ao servidor na sincronização.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Emitir certificados a partir de planilha Excel"
      onClose={onClose}
      wide
      footer={<>
        <button type="button" className={btnSecondary} onClick={onClose}>Cancelar</button>
        <button type="button" className={btnPrimary} disabled={!counts.ok || issuing} onClick={handleIssue}>
          {issuing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
          {issuing ? 'Emitindo…' : `Emitir ${counts.ok || ''} certificado(s)`}
        </button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-start">
        <div className="text-xs text-slate-600 space-y-1">
          <p>1. Baixe o modelo e preencha uma pessoa por linha: <b>Nome, CPF e Colaborador da Empresa</b>.</p>
          <p>2. Escolha abaixo o curso, as datas, o local, o instrutor e a nota (valem para todos).</p>
          <p>3. Envie a planilha: a prévia mostra o que será emitido, quem foi reprovado e as linhas com erro.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} onClick={() => downloadParticipantsTemplate().catch(err => alertError(err, 'Falha ao gerar o modelo'))}>
            <Download className="w-3.5 h-3.5" /> Baixar modelo
          </button>
          <button type="button" className={btnPrimary} disabled={reading} onClick={() => fileRef.current?.click()}>
            {reading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {raw ? 'Trocar planilha' : 'Enviar planilha'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.ods" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-bold text-slate-700">Dados do treinamento (valem para todos os alunos da planilha)</p>
        <div className="grid gap-3 sm:grid-cols-4 mt-3">
          <Field label="Curso *" className="sm:col-span-2">
            <select className={`${inputCls} ${!defaults.courseId ? 'border-amber-400' : ''}`} value={defaults.courseId} onChange={e => setDefaults({ ...defaults, courseId: e.target.value })}>
              <option value="">Escolha o curso…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} – ` : ''}{c.name}</option>)}
            </select>
          </Field>
          <Field label="Início"><input type="date" className={inputCls} value={defaults.startDate} onChange={e => setDefaults({ ...defaults, startDate: e.target.value })} /></Field>
          <Field label="Término"><input type="date" className={inputCls} value={defaults.endDate} min={defaults.startDate} onChange={e => setDefaults({ ...defaults, endDate: e.target.value })} /></Field>
          <Field label="Local" className="sm:col-span-2"><input className={inputCls} value={defaults.location} onChange={e => setDefaults({ ...defaults, location: e.target.value })} placeholder="Cidade/UF ou endereço" /></Field>
          <Field label="Presença (%)"><input type="number" min={0} max={100} className={inputCls} value={defaults.attendance ?? ''} onChange={e => setDefaults({ ...defaults, attendance: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label={defaultCourse?.minGrade !== undefined ? `Nota * (mínima ${defaultCourse.minGrade})` : 'Nota'} hint="0 a 10">
            <input type="number" min={0} max={10} step={0.1}
              className={`${inputCls} ${defaultCourse?.minGrade !== undefined && defaults.grade === undefined ? 'border-amber-400' : ''}`}
              value={defaults.grade ?? ''} onChange={e => setDefaults({ ...defaults, grade: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </Field>
          <div className="sm:col-span-2">
            <span className="block font-bold text-slate-700 mb-1 text-xs">Instrutor(es)</span>
            <div className="flex flex-wrap gap-1.5">
              {instructors.map(i => {
                const on = defaults.instructorIds.includes(i.id);
                return (
                  <button key={i.id} type="button"
                    onClick={() => setDefaults({ ...defaults, instructorIds: on ? defaults.instructorIds.filter(x => x !== i.id) : [...defaults.instructorIds, i.id] })}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-700'}`}>{i.name}</button>
                );
              })}
              {!instructors.length && <span className="text-[11px] text-amber-700">Nenhum instrutor cadastrado.</span>}
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mt-3">
          <input type="checkbox" checked={createClasses} onChange={e => setCreateClasses(e.target.checked)} />
          Criar turma com lista de presença
        </label>
      </div>

      {!raw ? (
        <div className="mt-4 border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}>
          <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">Arraste a planilha aqui ou use "Enviar planilha"</p>
          <p className="text-[11px] text-slate-500 mt-1">Excel (.xlsx, .xls), CSV ou ODS · até {MAX_IMPORT_ROWS} linhas</p>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-xs text-slate-600">
              <b>{fileName}</b>: {rows.length} linha(s){raw.length > MAX_IMPORT_ROWS ? ` (só as ${MAX_IMPORT_ROWS} primeiras)` : ''}
              {createClasses && counts.ok > 0 ? ` · ${groups.length} turma(s)` : ''}
            </p>
            <div className="flex gap-1">
              {([['todas', `Todas (${rows.length})`], ['ok', `Emitir (${counts.ok})`], ['reprovado', `Reprovados (${counts.reprovado})`], ['erro', `Erros (${counts.erro})`]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setFilter(k)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${filter === k ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-auto max-h-[45vh]">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left text-slate-500">
                  <th className="p-2">Linha</th><th className="p-2">Nome</th><th className="p-2">CPF</th><th className="p-2">Curso</th>
                  <th className="p-2">Período</th><th className="p-2">Pres./Nota</th><th className="p-2">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map(r => {
                  const st = rowStatus(r);
                  const ui = STATUS_UI[st];
                  return (
                    <tr key={r.line} className="align-top">
                      <td className="p-2 text-slate-400">{r.line}</td>
                      <td className="p-2 font-semibold text-slate-800">{r.name || '—'}<div className="font-normal text-slate-500">{[r.role, r.company].filter(Boolean).join(' · ')}</div></td>
                      <td className="p-2 font-mono whitespace-nowrap">{r.cpf || '—'}</td>
                      <td className="p-2">{r.course ? (r.course.code || r.course.name) : '—'}</td>
                      <td className="p-2 whitespace-nowrap">{formatDateBr(r.startDate)}{r.endDate && r.endDate !== r.startDate ? ` a ${formatDateBr(r.endDate)}` : ''}</td>
                      <td className="p-2 whitespace-nowrap">{r.attendance}%{r.grade !== undefined ? ` · ${String(r.grade).replace('.', ',')}` : ''}</td>
                      <td className="p-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold ${ui.cls}`}><ui.icon className="w-3 h-3" />{ui.label}</span>
                        {[...r.errors, ...(st === 'erro' ? [] : r.warnings)].map(m => <div key={m} className={`mt-0.5 ${r.errors.includes(m) ? 'text-red-700' : 'text-slate-500'}`}>{m}</div>)}
                        {st === 'reprovado' && r.course && (r.grade === undefined && r.course.minGrade !== undefined
                          ? <div className="mt-0.5 text-amber-700">Sem nota: informe a Nota acima</div>
                          : <div className="mt-0.5 text-amber-700">Mínimo: presença {r.course.minAttendance}%{r.course.minGrade !== undefined ? `, nota ${r.course.minGrade}` : ''}</div>)}
                      </td>
                    </tr>
                  );
                })}
                {!shown.length && <tr><td colSpan={7} className="p-4 text-center text-slate-500">Nenhuma linha neste filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
};
