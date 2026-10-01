import React from 'react';
import { Users } from 'lucide-react';
import { CompanyUsersPanel } from '../components/CompanyUsersPanel';

/**
 * Usuários e técnicos da empresa (menu "Usuários & Técnicos"): cadastro de
 * usuários com acesso ao sistema e de técnicos executores, sempre vinculados
 * à empresa de quem cadastra.
 */
export const UsersView: React.FC = () => (
  <div className="space-y-5">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
        <Users className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900">Usuários & Técnicos</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Cadastre quem acessa o sistema e os técnicos que executam os ensaios. Todos ficam vinculados à sua empresa.
        </p>
      </div>
    </div>
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
      <CompanyUsersPanel />
    </div>
  </div>
);
