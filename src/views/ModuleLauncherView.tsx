import React from 'react';
import { ArrowRight, LogOut } from 'lucide-react';
import type { User } from '../types';
import type { Workspace } from '../modules/workspaces';

interface ModuleLauncherViewProps {
  user: User;
  companyName: string;
  workspaces: Workspace[];
  lastWorkspaceId?: string | null;
  onSelect: (workspace: Workspace) => void;
  onLogout: () => void;
}

/** Depois do login: o usuário escolhe com qual módulo vai trabalhar. */
export const ModuleLauncherView: React.FC<ModuleLauncherViewProps> = ({ user, companyName, workspaces, lastWorkspaceId, onSelect, onLogout }) => {
  const firstName = (user.name || '').split(' ')[0];
  return (
    <div className="min-h-screen bg-[#EEF1F4] flex flex-col">
      <header className="bg-[#0A2540] text-white px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center font-black text-sm shrink-0">JVM</div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{companyName || 'JVM Dielectric Lab'}</p>
              <p className="text-[11px] text-slate-300 truncate">{user.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-black text-slate-900">Olá{firstName ? `, ${firstName}` : ''}!</h1>
        <p className="text-sm text-slate-600 mt-1 mb-6">Escolha o módulo do sistema que você vai utilizar. Dá para trocar a qualquer momento pelo menu.</p>

        {workspaces.length === 0 && (
          <div className="bg-white rounded-2xl border border-amber-200 p-5 text-sm text-amber-800">
            Nenhum módulo do sistema está liberado para o seu usuário. Fale com o administrador da empresa.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {workspaces.map(w => {
            const Icon = w.icon;
            const last = w.id === lastWorkspaceId;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => onSelect(w)}
                className={`group text-left bg-white rounded-2xl border-2 p-5 shadow-sm hover:shadow-md hover:border-blue-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${last ? 'border-blue-300' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6" />
                  </div>
                  {last && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">Último usado</span>}
                </div>
                <h2 className="font-black text-lg text-slate-900 mt-3">{w.label}</h2>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{w.description}</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 mt-4 group-hover:gap-2 transition-all">
                  Entrar <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
};
