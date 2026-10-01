import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '../types';

/**
 * Módulo da plataforma: pasta própria (telas, regras, PDF, sincronização e
 * SQL em supabase/modules), ligado ao app só por este manifesto.
 */
export interface PlatformModule {
  /** Também é o id da tela no menu (activeView) */
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Perfis que veem o módulo no menu */
  roles: UserRole[];
  View: ComponentType<Record<string, never>>;
  /**
   * Ao escolher este módulo depois do login: blocos comuns do menu que também
   * aparecem (ex.: clientes, validação, configuração) e itens a esconder.
   */
  workspace?: { sharedGroups: string[]; hiddenItems?: string[] };
}
