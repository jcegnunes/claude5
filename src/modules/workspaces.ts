/**
 * Módulo de trabalho escolhido depois do login. Cada um define a tela inicial
 * e os blocos do menu que aparecem (os demais ficam ocultos até trocar).
 */
import { FlaskConical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CompanyLabInfo, User, UserRole } from '../types';
import { PLATFORM_MODULES, isModuleEnabled } from './registry';

export interface Workspace {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tela aberta ao entrar no módulo */
  home: string;
  /** Blocos do menu lateral, na ordem */
  groups: string[];
  hiddenItems: string[];
  roles: UserRole[];
}

/** Ensaios dielétricos de EPI/EPC (parte original da plataforma). */
export const ENSAIOS_WORKSPACE: Workspace = {
  id: 'ensaios',
  label: 'Ensaios de EPI',
  description: 'Ensaios dielétricos de EPI/EPC, laudos, certificados, equipamentos, instrumentos, clientes e ordens de serviço.',
  icon: FlaskConical,
  home: 'dashboard',
  groups: ['inicio', 'clientes', 'ensaios', 'validacao', 'sistema'],
  hiddenItems: [],
  roles: ['admin', 'responsavel_tecnico', 'tecnico', 'administrativo', 'cliente']
};

/** O usuário pode usar o módulo? (administradores: todos; vazio no cadastro: todos) */
export function canUseModule(user: Pick<User, 'role' | 'isMasterAdmin' | 'allowedModules'>, moduleId: string): boolean {
  if (user.isMasterAdmin || user.role === 'admin') return true;
  if (!Array.isArray(user.allowedModules)) return true;
  return user.allowedModules.includes(moduleId);
}

/** Módulos que podem ser liberados no cadastro do usuário (os ligados para a empresa). */
export function getAssignableModules(info: Pick<CompanyLabInfo, 'enabledModules'> | null | undefined): Array<{ id: string; label: string }> {
  return [
    { id: ENSAIOS_WORKSPACE.id, label: ENSAIOS_WORKSPACE.label },
    ...PLATFORM_MODULES.filter(m => isModuleEnabled(info, m.id)).map(m => ({ id: m.id, label: m.label }))
  ];
}

export function getAvailableWorkspaces(
  info: Pick<CompanyLabInfo, 'enabledModules'> | null | undefined,
  user: Pick<User, 'role' | 'isMasterAdmin' | 'allowedModules'>
): Workspace[] {
  const role = user.role;
  const modules: Workspace[] = PLATFORM_MODULES
    .filter(m => isModuleEnabled(info, m.id) && m.roles.includes(role))
    .map(m => ({
      id: m.id,
      label: m.label,
      description: m.description,
      icon: m.icon,
      home: m.id,
      groups: [`mod-${m.id}`, ...(m.workspace?.sharedGroups || ['validacao', 'sistema'])],
      hiddenItems: m.workspace?.hiddenItems || [],
      roles: m.roles
    }));
  return [ENSAIOS_WORKSPACE, ...modules].filter(w => w.roles.includes(role) && canUseModule(user, w.id));
}

// ------------------------------------------------- escolha guardada no aparelho
const KEY = 'jvm_active_workspace';

export function loadSavedWorkspace(userId: string): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    return saved && saved.userId === userId ? saved.id : null;
  } catch {
    return null;
  }
}

export function saveWorkspace(userId: string, id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, JSON.stringify({ userId, id }));
    else localStorage.removeItem(KEY);
  } catch { /* só nesta sessão */ }
}
