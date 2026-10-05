import React, { useEffect, useState } from 'react';
import { GraduationCap, RefreshCw, AlertTriangle, CloudOff, LayoutDashboard, Users, Award, BookOpen, UserCheck, Palette } from 'lucide-react';
import { ensureDefaultCourses, getTrainingConflicts, pendingTrainingCount, subscribeTraining } from '../repository';
import {
  getTrainingSyncStatus, resolveConflictKeepMine, resolveConflictUseServer, startTrainingSync, subscribeTrainingSync, syncTraining
} from '../sync';
import { TrainingDashboard } from './TrainingDashboard';
import { ClassesPanel } from './ClassesPanel';
import { CertificatesPanel } from './CertificatesPanel';
import { CoursesPanel } from './CoursesPanel';
import { InstructorsPanel } from './InstructorsPanel';
import { LayoutPanel } from './LayoutPanel';
import { alertError, btnSecondary, cardCls } from './ui';

type Tab = 'painel' | 'turmas' | 'certificados' | 'cursos' | 'instrutores' | 'layout';

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'painel', label: 'Painel', icon: LayoutDashboard },
  { id: 'turmas', label: 'Turmas', icon: Users },
  { id: 'certificados', label: 'Certificados', icon: Award },
  { id: 'cursos', label: 'Cursos', icon: BookOpen },
  { id: 'instrutores', label: 'Instrutores', icon: UserCheck },
  { id: 'layout', label: 'Layout do certificado', icon: Palette }
];

/** Tela principal do módulo Treinamentos. */
export const TrainingModuleView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('painel');
  const [certFilter, setCertFilter] = useState<'todos' | 'vencendo' | 'vencido'>('todos');
  const [, setVersion] = useState(0);
  const [sync, setSync] = useState(getTrainingSyncStatus());

  useEffect(() => {
    ensureDefaultCourses();
    const unsubData = subscribeTraining(() => setVersion(v => v + 1));
    const unsubSync = subscribeTrainingSync(setSync);
    const stop = startTrainingSync();
    return () => { unsubData(); unsubSync(); stop(); };
  }, []);

  const pending = pendingTrainingCount();
  const conflicts = getTrainingConflicts();

  const openTab = (t: 'turmas' | 'certificados', filter?: 'vencendo' | 'vencido') => {
    setCertFilter(filter || 'todos');
    setTab(t);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center"><GraduationCap className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Treinamentos</h2>
            <p className="text-xs text-slate-500">Turmas, certificados com QR Code de validação e controle de reciclagem</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            {typeof navigator !== 'undefined' && navigator.onLine === false && <CloudOff className="w-3.5 h-3.5" />}
            {pending > 0 ? `${pending} alteração(ões) a enviar` : sync.lastSyncAt ? `Sincronizado ${new Date(sync.lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Dados no aparelho'}
          </span>
          <button type="button" className={btnSecondary} disabled={sync.running} onClick={() => syncTraining()}>
            <RefreshCw className={`w-3.5 h-3.5 ${sync.running ? 'animate-spin' : ''}`} /> Sincronizar
          </button>
        </div>
      </div>

      {sync.lastError && (
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{sync.lastError}</div>
      )}

      {conflicts.length > 0 && (
        <div className={`${cardCls} p-3 border-amber-300`}>
          <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5 mb-2"><AlertTriangle className="w-4 h-4" /> Alterado em outro aparelho ao mesmo tempo</p>
          {conflicts.map(c => (
            <div key={`${c.table}|${c.id}`} className="flex flex-wrap items-center justify-between gap-2 py-1">
              <span className="text-xs text-slate-700">{c.label}</span>
              <div className="flex gap-2">
                <button type="button" className={btnSecondary} onClick={() => resolveConflictKeepMine(c.table, c.id).catch(err => alertError(err))}>Manter a deste aparelho</button>
                <button type="button" className={btnSecondary} onClick={() => resolveConflictUseServer(c.table, c.id).catch(err => alertError(err))}>Usar a do servidor</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); if (t.id === 'certificados') setCertFilter('todos'); }}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${tab === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'painel' && <TrainingDashboard onOpen={openTab} />}
      {tab === 'turmas' && <ClassesPanel />}
      {tab === 'certificados' && <CertificatesPanel key={certFilter} initialFilter={certFilter} />}
      {tab === 'cursos' && <CoursesPanel />}
      {tab === 'instrutores' && <InstructorsPanel />}
      {tab === 'layout' && <LayoutPanel />}
    </div>
  );
};

export default TrainingModuleView;
