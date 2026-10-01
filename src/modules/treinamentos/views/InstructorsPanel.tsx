import React, { useState } from 'react';
import { GraduationCap, Plus, Pencil, Trash2, UserPlus } from 'lucide-react';
import { SignatureCanvas } from '../../../components/SignatureCanvas';
import { DielectricStorageService } from '../../../services/syncEngine';
import {
  canDeleteTraining, canEditTraining, currentCompanyId, deleteInstructor, getClasses, getInstructors, saveInstructor
} from '../repository';
import { newId } from '../rules';
import type { TrainingInstructor } from '../types';
import { btnPrimary, btnSecondary, cardCls, EmptyState, Field, inputCls, Modal } from './ui';
import { DigitalCertBadge, DigitalCertBox, useSigningCerts } from './DigitalCertBox';

const emptyInstructor = (): TrainingInstructor => ({
  id: '', companyId: '', createdAt: '', updatedAt: '',
  name: '', qualification: '', registration: '', email: '', phone: '', signatureUrl: '', active: true
});

export const InstructorsPanel: React.FC = () => {
  const [editing, setEditing] = useState<TrainingInstructor | null>(null);
  const [importing, setImporting] = useState(false);
  const instructors = getInstructors();
  useSigningCerts();
  const rt = DielectricStorageService.getCompanyInfo()?.technicalResponsible;
  const [editingRt, setEditingRt] = useState(false);
  const canEdit = canEditTraining();

  const handleDelete = (i: TrainingInstructor) => {
    if (getClasses().some(t => t.instructorIds.includes(i.id) && t.status !== 'concluida')) {
      window.alert('Este instrutor está em turmas não concluídas. Troque o instrutor nessas turmas ou desmarque "Ativo".');
      return;
    }
    if (window.confirm(`Excluir o instrutor ${i.name}? Certificados já emitidos guardam os dados dele.`)) deleteInstructor(i.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Nome, qualificação, registro profissional e assinatura impressos no certificado.</p>
        {canEdit && (
          <div className="flex gap-2">
            <button type="button" className={btnSecondary} onClick={() => setImporting(true)}><UserPlus className="w-3.5 h-3.5" /> Dos usuários e técnicos</button>
            <button type="button" className={btnPrimary} onClick={() => setEditing(emptyInstructor())}><Plus className="w-3.5 h-3.5" /> Novo instrutor</button>
          </div>
        )}
      </div>

      {/* Responsável Técnico (cadastro da empresa): também assina os certificados */}
      <div className={`${cardCls} p-4 flex flex-wrap items-center justify-between gap-2`}>
        <div className="min-w-0">
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">Responsável Técnico</span>
          <h4 className="font-bold text-sm text-slate-900">{rt?.name || 'Não cadastrado'}</h4>
          <p className="text-[11px] text-slate-500">{[rt?.title, rt?.creaNumber].filter(Boolean).join(' · ') || 'Cadastre em Configurações & Backup'}</p>
          <div className="mt-1"><DigitalCertBadge ownerType="rt" ownerId="rt" /></div>
        </div>
        {rt?.name && <button type="button" className={btnSecondary} onClick={() => setEditingRt(true)}>Certificado digital</button>}
      </div>

      {instructors.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Nenhum instrutor cadastrado" text="Cadastre quem ministra os treinamentos. A assinatura pode ser desenhada na tela ou enviada como imagem." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {instructors.map(i => (
            <div key={i.id} className={`${cardCls} p-4 ${i.active ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-slate-900">{i.name}{i.active ? '' : ' (inativo)'}</h4>
                  <p className="text-[11px] text-slate-600">{i.qualification || 'Qualificação não informada'}</p>
                  <p className="text-[11px] text-slate-500">{i.registration}</p>
                  <div className="mt-1"><DigitalCertBadge ownerType="instructor" ownerId={i.id} /></div>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <button type="button" title="Editar" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setEditing({ ...i })}><Pencil className="w-4 h-4" /></button>
                    {canDeleteTraining() && <button type="button" title="Excluir" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" onClick={() => handleDelete(i)}><Trash2 className="w-4 h-4" /></button>}
                  </div>
                )}
              </div>
              <div className="mt-2 h-12 border border-dashed border-slate-200 rounded-lg flex items-center justify-center bg-slate-50">
                {i.signatureUrl ? <img src={i.signatureUrl} alt={`Assinatura de ${i.name}`} className="max-h-11 object-contain" /> : <span className="text-[10px] text-slate-400">sem assinatura</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <InstructorEditor instructor={editing} onClose={() => setEditing(null)} />}
      {editingRt && rt?.name && (
        <Modal title={`Certificado digital — ${rt.name}`} onClose={() => setEditingRt(false)}
          footer={<button type="button" className={btnSecondary} onClick={() => setEditingRt(false)}>Fechar</button>}>
          <DigitalCertBox ownerType="rt" ownerId="rt" ownerName={rt.name} />
        </Modal>
      )}
      {importing && <ImportFromUsers onClose={() => setImporting(false)} />}
    </div>
  );
};

const InstructorEditor: React.FC<{ instructor: TrainingInstructor; onClose: () => void }> = ({ instructor, onClose }) => {
  const [i, setI] = useState<TrainingInstructor>(instructor);
  const set = <K extends keyof TrainingInstructor>(k: K, v: TrainingInstructor[K]) => setI(prev => ({ ...prev, [k]: v }));

  const handleSave = () => {
    if (!i.name.trim()) return window.alert('Informe o nome do instrutor.');
    saveInstructor({ ...i, id: i.id || newId('ins'), name: i.name.trim() });
    onClose();
  };

  return (
    <Modal
      title={instructor.id ? 'Editar instrutor' : 'Novo instrutor'}
      onClose={onClose}
      footer={<>
        <button type="button" className={btnSecondary} onClick={onClose}>Cancelar</button>
        <button type="button" className={btnPrimary} onClick={handleSave}>Salvar instrutor</button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome completo *" className="sm:col-span-2"><input className={inputCls} value={i.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Qualificação"><input className={inputCls} value={i.qualification} onChange={e => set('qualification', e.target.value)} placeholder="Engenheiro Eletricista" /></Field>
        <Field label="Registro profissional"><input className={inputCls} value={i.registration} onChange={e => set('registration', e.target.value)} placeholder="CREA-SP 0000000000" /></Field>
        <Field label="E-mail"><input type="email" className={inputCls} value={i.email || ''} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Telefone"><input className={inputCls} value={i.phone || ''} onChange={e => set('phone', e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={i.active} onChange={e => set('active', e.target.checked)} /> Ativo (aparece para novas turmas)
        </label>
      </div>
      <div className="mt-4">
        <SignatureCanvas
          title="Assinatura do instrutor"
          signerName={i.name || 'Instrutor'}
          signerRole={i.qualification || 'Instrutor'}
          initialSignature={i.signatureUrl}
          onSave={dataUrl => set('signatureUrl', dataUrl)}
        />
      </div>
      <div className="mt-4">
        {instructor.id
          ? <DigitalCertBox ownerType="instructor" ownerId={instructor.id} ownerName={i.name} />
          : <p className="text-[11px] text-slate-500">Salve o instrutor para cadastrar o certificado digital (A1).</p>}
      </div>
    </Modal>
  );
};

/** Aproveita os usuários e técnicos já cadastrados na empresa (com assinatura). */
const ImportFromUsers: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const existing = new Set(getInstructors().map(i => i.name.trim().toLowerCase()));
  const users = DielectricStorageService.getUsers(currentCompanyId())
    .filter(u => u.companyId === currentCompanyId() && u.active !== false && u.role !== 'cliente' && !existing.has((u.name || '').trim().toLowerCase()));
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const handleImport = () => {
    users.filter(u => chosen.has(u.id)).forEach(u => saveInstructor({
      id: newId('ins'), companyId: '', createdAt: '', updatedAt: '',
      name: u.name, qualification: u.cargo || '', registration: u.creaOrCft || u.registrationNumber || '',
      email: u.email && !u.email.endsWith('@sem-email.local') ? u.email : '', phone: u.phone || '',
      signatureUrl: u.signatureUrl || '', active: true
    }));
    onClose();
  };

  return (
    <Modal
      title="Instrutores a partir dos usuários e técnicos"
      onClose={onClose}
      footer={<>
        <button type="button" className={btnSecondary} onClick={onClose}>Cancelar</button>
        <button type="button" className={btnPrimary} disabled={!chosen.size} onClick={handleImport}>Incluir {chosen.size || ''}</button>
      </>}
    >
      {users.length === 0 ? (
        <p className="text-xs text-slate-500">Todos os usuários e técnicos da empresa já estão como instrutores.</p>
      ) : (
        <div className="space-y-1">
          {users.map(u => (
            <label key={u.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-xs">
              <input type="checkbox" checked={chosen.has(u.id)} onChange={e => {
                const next = new Set(chosen);
                if (e.target.checked) next.add(u.id); else next.delete(u.id);
                setChosen(next);
              }} />
              <span className="font-semibold text-slate-800">{u.name}</span>
              <span className="text-slate-500">{[u.cargo, u.creaOrCft].filter(Boolean).join(' · ')}</span>
              {u.signatureUrl && <span className="ml-auto text-[10px] text-emerald-700">com assinatura</span>}
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
};
