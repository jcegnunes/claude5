/**
 * Registro dos módulos da plataforma. Para incluir um módulo novo: crie a
 * pasta em src/modules/<nome>, exporte o manifesto e acrescente-o aqui
 * (e as chaves de armazenamento em src/modules/storageKeys.ts).
 */
import type { CompanyLabInfo } from '../types';
import type { PlatformModule } from './types';
import { treinamentosModule } from './treinamentos';

export const PLATFORM_MODULES: PlatformModule[] = [treinamentosModule];

/** Módulo ligado para a empresa (ligado por padrão; desligado em Configurações). */
export function isModuleEnabled(info: Pick<CompanyLabInfo, 'enabledModules'> | null | undefined, moduleId: string): boolean {
  return info?.enabledModules?.[moduleId] !== false;
}

export function getModule(id: string): PlatformModule | undefined {
  return PLATFORM_MODULES.find(m => m.id === id);
}
