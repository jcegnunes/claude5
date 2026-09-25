import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  User, 
  Terminal, 
  Filter, 
  HardDrive 
} from 'lucide-react';
import { AuditLog } from '../types';
import { DielectricStorageService } from '../services/syncEngine';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  useEffect(() => {
    setLogs(DielectricStorageService.getAuditLogs());
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.userName && log.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.actionCategory && log.actionCategory.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.targetEntity && log.targetEntity.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.targetId && log.targetId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAction = filterAction === 'all' || log.actionCategory === filterAction || log.actionType === filterAction;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Trilha de Auditoria & Segurança</h2>
          <p className="text-xs text-slate-500">
            Registro imutável de todas as ações operacionais, alterações em laudos, ensaios e acessos de usuários
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Descrição, Usuário, ID do Laudo/Equipamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="w-full sm:w-56">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas as Categorias</option>
            <option value="ENSAIO">Ensaios</option>
            <option value="LAUDO">Laudos Técnicos</option>
            <option value="CERTIFICADO">Certificados</option>
            <option value="CADASTRO">Cadastros</option>
            <option value="SINCRONIZACAO">Sincronização</option>
            <option value="AUTENTICACAO">Autenticação</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Usuário Responsável</th>
                <th className="p-3.5">Categoria / Ação</th>
                <th className="p-3.5">Entidade Alvo</th>
                <th className="p-3.5">Detalhes do Evento</th>
                <th className="p-3.5">Dispositivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                  </td>
                  <td className="p-3.5">
                    <span className="font-bold text-slate-900 block">{log.userName}</span>
                  </td>
                  <td className="p-3.5">
                    <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      {log.actionCategory} ({log.actionType})
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-800 font-medium">
                    {log.targetEntity} {log.targetId ? `(#${log.targetId})` : ''}
                  </td>
                  <td className="p-3.5 text-slate-700 max-w-md">
                    {log.details}
                  </td>
                  <td className="p-3.5 font-mono text-slate-500 text-[11px]">
                    {log.deviceId ? log.deviceId.substring(0, 10) + '...' : log.ipAddress || 'Local'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
