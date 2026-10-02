/**
 * Backup dos módulos (src/modules) dentro do backup completo da plataforma.
 * Para um módulo novo: acrescente aqui as funções de exportar e restaurar.
 */
import { exportTrainingBackup, restoreTrainingBackup } from './treinamentos/backup';

const MODULE_BACKUPS: Array<{ id: string; exportData: () => unknown; restore: (data: unknown) => number }> = [
  { id: 'treinamentos', exportData: exportTrainingBackup, restore: restoreTrainingBackup }
];

/** Seção "modules" do arquivo de backup. */
export function exportModuleBackups(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  MODULE_BACKUPS.forEach(m => {
    try { out[m.id] = m.exportData(); } catch (err) { console.warn(`[Backup] módulo ${m.id}:`, err); }
  });
  return out;
}

/** Restaura a seção "modules" (backups antigos, sem a seção, são aceitos). */
export function restoreModuleBackups(modules: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!modules || typeof modules !== 'object') return result;
  MODULE_BACKUPS.forEach(m => {
    const data = (modules as Record<string, unknown>)[m.id];
    if (data === undefined) return;
    try { result[m.id] = m.restore(data); } catch (err) { console.warn(`[Backup] restauração do módulo ${m.id}:`, err); }
  });
  return result;
}
