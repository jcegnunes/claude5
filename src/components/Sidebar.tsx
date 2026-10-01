import React, { useState } from 'react';
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
  FileSpreadsheet,
  Users,
  Briefcase,
  Settings,
  ChevronDown,
  ArrowLeftRight
} from 'lucide-react';
import { UserRole } from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { PLATFORM_MODULES, isModuleEnabled } from '../modules/registry';
import type { Workspace } from '../modules/workspaces';

type NavItem = { id: string; label: string; icon: React.ElementType; roles: UserRole[]; badge?: string; highlight?: boolean };
type NavGroup = { id: string; label?: string; icon?: React.ElementType; items: NavItem[] };

/** Blocos do menu recolhidos (preferência deste aparelho). */
const GROUPS_KEY = 'jvm_menu_closed_groups';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  userRole: UserRole;
  pendingSyncCount: number;
  onToggleFieldMode?: () => void;
  onOpenInstallModal?: () => void;
  /** 'drawer': menu lateral aberto pelo botão "Menu" no celular. */
  variant?: 'desktop' | 'drawer';
  /** Módulo escolhido depois do login: o menu mostra só os blocos dele. */
  workspace?: Workspace;
  /** Volta para a tela de escolha do módulo (quando há mais de um). */
  onSwitchWorkspace?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  userRole,
  pendingSyncCount,
  onToggleFieldMode,
  onOpenInstallModal,
  variant = 'desktop',
  workspace,
  onSwitchWorkspace
}) => {
  const [closedGroups, setClosedGroups] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'); } catch { return []; }
  });
  const toggleGroup = (id: string) => {
    const next = closedGroups.includes(id) ? closedGroups.filter(g => g !== id) : [...closedGroups, id];
    setClosedGroups(next);
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(next)); } catch { /* só nesta sessão */ }
  };

  const ALL: UserRole[] = ['admin', 'responsavel_tecnico', 'tecnico', 'administrativo', 'cliente'];
  const STAFF: UserRole[] = ['admin', 'responsavel_tecnico', 'tecnico', 'administrativo'];
  const MANAGERS: UserRole[] = ['admin', 'responsavel_tecnico'];

  // Módulos (src/modules): cada um vira um bloco do menu quando ligado para a empresa
  const companyInfo = DielectricStorageService.getCompanyInfo();
  const moduleGroups: NavGroup[] = PLATFORM_MODULES
    .filter(m => isModuleEnabled(companyInfo, m.id))
    .map(m => ({ id: `mod-${m.id}`, label: m.label, icon: m.icon, items: [{ id: m.id, label: m.label, icon: m.icon, roles: m.roles }] }));

  const groupDefs: NavGroup[] = [
    { id: 'inicio', items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL }
    ] },
    { id: 'clientes', label: 'Clientes & OS', icon: Briefcase, items: [
      { id: 'clients', label: 'Clientes', icon: Building2, roles: STAFF },
      { id: 'service_orders', label: 'Ordens de Serviço', icon: ClipboardList, roles: STAFF }
    ] },
    { id: 'ensaios', label: 'Ensaios de EPI', icon: FlaskConical, items: [
      { id: 'wizard', label: 'Novo Ensaio', icon: FlaskConical, badge: 'Etapas', roles: ['admin', 'responsavel_tecnico', 'tecnico'], highlight: true },
      { id: 'tests', label: 'Ensaios & Laudos', icon: FileText, roles: ALL },
      { id: 'reports', label: 'Emissão de Relatório', icon: FileSpreadsheet, roles: ALL },
      { id: 'equipment', label: 'Equipamentos (EPI/EPC)', icon: Shield, roles: ALL },
      { id: 'instruments', label: 'Instrumentos & Hipot', icon: Gauge, roles: ['admin', 'responsavel_tecnico', 'tecnico'] },
      { id: 'norms', label: 'Normas & Critérios', icon: BookOpen, roles: MANAGERS }
    ] },
    ...moduleGroups,
    { id: 'sistema', label: 'Configuração do Sistema', icon: Settings, items: [
      { id: 'sync', label: 'Sincronização & Conflitos', icon: RefreshCw, badge: pendingSyncCount > 0 ? String(pendingSyncCount) : undefined, roles: STAFF },
      { id: 'audit', label: 'Auditoria & Logs', icon: History, roles: MANAGERS },
      { id: 'usuarios', label: 'Usuários & Técnicos', icon: Users, roles: MANAGERS },
      { id: 'backup', label: 'Configurações & Backup', icon: Sliders, roles: MANAGERS }
    ] },
    { id: 'validacao', items: [
      { id: 'validar', label: 'Validação de QR Code', icon: QrCode, roles: ALL }
    ] }
  ];
  const groups = groupDefs
    .map(g => ({ ...g, items: g.items.filter(item => item.roles.includes(userRole)) }))
    .filter(g => g.items.length > 0);

  // Só os blocos do módulo escolhido, na ordem dele
  const visibleGroups = workspace
    ? workspace.groups
        .map(id => groups.find(g => g.id === id))
        .filter((g): g is NavGroup => !!g)
        .map(g => ({ ...g, items: g.items.filter(item => !workspace.hiddenItems.includes(item.id)) }))
        .filter(g => g.items.length > 0)
    : groups;
  const WorkspaceIcon = workspace?.icon;

  const renderItem = (item: NavItem, nested: boolean) => {
    const Icon = item.icon;
    const isActive = activeView === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className={`w-full flex items-center justify-between ${nested ? 'pl-4 pr-3 py-2' : 'px-3 py-2.5'} rounded-xl text-xs font-semibold transition-all ${
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
  };

  return (
    <aside className={variant === 'drawer'
      ? 'w-72 max-w-[85vw] h-full bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 shadow-2xl'
      : 'w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 hidden md:flex min-h-[calc(100vh-4rem)]'}>
      <div className="p-4 flex-1 space-y-1 overflow-y-auto">
        {workspace && (
          <div className="mb-2 p-3 rounded-2xl bg-slate-800/70 border border-slate-700 flex items-center gap-2.5">
            {WorkspaceIcon && (
              <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0">
                <WorkspaceIcon className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Módulo</span>
              <span className="block text-xs font-bold text-white truncate">{workspace.label}</span>
            </div>
            {onSwitchWorkspace && (
              <button
                type="button"
                onClick={onSwitchWorkspace}
                title="Trocar de módulo"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-orange-300 hover:bg-slate-700"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> Trocar
              </button>
            )}
          </div>
        )}

        {visibleGroups.map(group => {
          // bloco com um item só (Dashboard, Validação, módulo de uma tela): item direto
          if (!group.label || group.items.length === 1) {
            return <div key={group.id} className="pt-1">{group.items.map(item => renderItem(item, false))}</div>;
          }
          const hasActive = group.items.some(item => item.id === activeView);
          const isOpen = hasActive || !closedGroups.includes(group.id);
          const GroupIcon = group.icon || LayoutDashboard;
          const groupBadge = group.items.find(item => item.badge && !item.highlight)?.badge;
          return (
            <div key={group.id} className="pt-2">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              >
                <span className="flex items-center gap-2">
                  <GroupIcon className="w-3.5 h-3.5" />
                  {group.label}
                </span>
                <span className="flex items-center gap-1.5">
                  {!isOpen && groupBadge && <span className="text-[10px] font-bold px-1.5 rounded-md bg-amber-500 text-slate-950 normal-case">{groupBadge}</span>}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                </span>
              </button>
              {isOpen && (
                <div className="mt-1 space-y-1 border-l border-slate-800 ml-3 pl-1">
                  {group.items.map(item => renderItem(item, true))}
                </div>
              )}
            </div>
          );
        })}
        {/* App Android Quick Banner in Sidebar */}
        {(!workspace || workspace.id === 'ensaios') && (
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
        )}
      </div>

      {/* Footer Info Box */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div className="truncate">
            <span className="font-semibold text-slate-200 block">JVM Dielectric Lab</span>
            <span className="text-[10px] text-slate-400">v{__APP_VERSION__} • NR-10 Conforme</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
