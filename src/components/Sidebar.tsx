import React from 'react';
import { 
  LayoutDashboard, 
  FlaskConical, 
  FileText, 
  Shield, 
  ClipboardList, 
  Building2, 
  Gauge, 
  BookOpen, 
  RefreshCw, 
  History, 
  Sliders, 
  CheckCircle,
  QrCode,
  Smartphone,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  userRole: UserRole;
  pendingSyncCount: number;
  onToggleFieldMode?: () => void;
  onOpenInstallModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  userRole,
  pendingSyncCount,
  onToggleFieldMode,
  onOpenInstallModal
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'responsavel_tecnico', 'tecnico', 'administrativo', 'cliente'] },
    { id: 'wizard', label: 'Novo Ensaio', icon: FlaskConical, badge: 'Etapas', roles: ['admin', 'responsavel_tecnico', 'tecnico'], highlight: true },
    { id: 'tests', label: 'Ensaios & Laudos', icon: FileText, roles: ['admin', 'responsavel_tecnico', 'tecnico', 'administrativo', 'cliente'] },
    { id: 'reports', label: 'Emissão de Relatório', icon: FileSpreadsheet, roles: ['admin', 'responsavel_tecnico', 'tecnico', 'administrativo', 'cliente'] },
    { id: 'equipment', label: 'Equipamentos (EPI/EPC)', icon: Shield, roles: ['admin', 'responsavel_tecnico', 'tecnico', 'administrativo', 'cliente'] },
    { id: 'service_orders', label: 'Ordens de Serviço', icon: ClipboardList, roles: ['admin', 'responsavel_tecnico', 'tecnico', 'administrativo'] },
    { id: 'clients', label: 'Clientes', icon: Building2, roles: ['admin', 'responsavel_tecnico', 'tecnico', 'administrativo'] },
    { id: 'instruments', label: 'Instrumentos & Hipot', icon: Gauge, roles: ['admin', 'responsavel_tecnico', 'tecnico'] },
    { id: 'norms', label: 'Normas & Critérios', icon: BookOpen, roles: ['admin', 'responsavel_tecnico'] },
    { id: 'sync', label: 'Sincronização & Conflitos', icon: RefreshCw, badge: pendingSyncCount > 0 ? String(pendingSyncCount) : undefined, roles: ['admin', 'responsavel_tecnico', 'tecnico', 'administrativo'] },
    { id: 'audit', label: 'Auditoria & Logs', icon: History, roles: ['admin', 'responsavel_tecnico'] },
    { id: 'backup', label: 'Configurações & Backup', icon: Sliders, roles: ['admin', 'responsavel_tecnico'] },
    { id: 'validar', label: 'Validação de QR Code', icon: QrCode, roles: ['admin', 'responsavel_tecnico', 'tecnico', 'administrativo', 'cliente'] }
  ];

  const allowedItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 hidden md:flex min-h-[calc(100vh-4rem)]">
      <div className="p-4 flex-1 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Módulos do Sistema
        </div>

        {allowedItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md font-bold'
                  : item.highlight
                  ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-orange-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  item.highlight
                    ? 'bg-orange-500 text-white'
                    : 'bg-amber-500 text-slate-950'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
        {/* App Android Quick Banner in Sidebar */}
        <div className="pt-2 pb-1">
          <div className="p-3 bg-gradient-to-br from-blue-950/80 to-slate-950 border border-blue-800/50 rounded-2xl space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-orange-500 flex items-center justify-center text-white">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-white block">App Android JVM</span>
                <span className="text-[9px] text-orange-300">Modo Campo & PWA</span>
              </div>
            </div>
            {onToggleFieldMode && (
              <button
                onClick={onToggleFieldMode}
                className="w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <span>Abrir Modo Android</span>
              </button>
            )}
            {onOpenInstallModal && (
              <button
                onClick={onOpenInstallModal}
                className="w-full py-1 px-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3 h-3 text-white" />
                <span>Gerar APK / Instalar App</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info Box */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div className="truncate">
            <span className="font-semibold text-slate-200 block">JVM Dielectric Lab</span>
            <span className="text-[10px] text-slate-400">v1.0.0 • NR-10 Conforme</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
