import React, { useEffect, useState } from 'react';
import { GitMerge, Smartphone, Cloud } from 'lucide-react';
import { DielectricStorageService } from '../services/syncEngine';
import { SyncConflict } from '../types';

const ENTITY_LABEL: Record<SyncConflict['entityType'], string> = {
  client: 'Cliente',
  equipment: 'Equipamento',
  service_order: 'Ordem de serviço',
  test: 'Ensaio / laudo',
  norm: 'Norma',
  instrument: 'Instrumento',
  report: 'Relatório'
};

/** Campos técnicos que não interessam na comparação. */
const IGNORED_FIELDS = new Set(['syncStatus', '_serverUpdatedAt', 'updatedAt', 'createdAt', 'deviceId']);

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') return Array.isArray(value) ? `${value.length} item(ns)` : '(dados detalhados)';
  const text = String(value);
  if (text.startsWith('data:')) return '(imagem)';
  return text.length > 80 ? text.slice(0, 77) + '…' : text;
}

/** Campos com valores diferentes entre as duas versões. */
export function diffFields(a: Record<string, any>, b: Record<string, any>): Array<{ field: string; local: string; remote: string }> {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out: Array<{ field: string; local: string; remote: string }> = [];
  keys.forEach(field => {
    if (IGNORED_FIELDS.has(field)) return;
    const va = a?.[field];
    const vb = b?.[field];
    if (JSON.stringify(va ?? null) === JSON.stringify(vb ?? null)) return;
    out.push({ field, local: formatValue(va), remote: formatValue(vb) });
  });
  return out;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR');
}

/**
 * Conflitos de edição: o mesmo registro foi alterado em dois aparelhos.
 * O usuário escolhe qual versão fica valendo (a outra é descartada).
 */
export const ConflictsPanel: React.FC = () => {
  const [conflicts, setConflicts] = useState<SyncConflict[]>(() => DielectricStorageService.getOpenConflicts());
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const reload = () => setConflicts(DielectricStorageService.getOpenConflicts());
    window.addEventListener('jvm-data-changed', reload);
    return () => window.removeEventListener('jvm-data-changed', reload);
  }, []);

  if (conflicts.length === 0) return null;

  const resolve = (conflict: SyncConflict, choice: 'keep_a' | 'keep_b') => {
    const label = choice === 'keep_a' ? 'a versão DESTE aparelho' : 'a versão do OUTRO aparelho';
    if (!window.confirm(`Manter ${label} para "${conflict.entityName}"? A outra versão será descartada.`)) return;
    DielectricStorageService.resolveConflict(conflict.id, choice);
    setConflicts(DielectricStorageService.getOpenConflicts());
  };

  return (
    <section className="bg-white rounded-2xl border-2 border-amber-300 shadow-xs p-5" aria-labelledby="conflitos-titulo">
      <div className="flex items-start gap-3 pb-3 border-b border-amber-100">
        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <GitMerge className="w-5 h-5" />
        </div>
        <div>
          <h3 id="conflitos-titulo" className="font-bold text-slate-900 text-sm">
            Conflitos de edição ({conflicts.length})
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Estes registros foram alterados em outro aparelho enquanto este também os editava.
            Escolha qual versão fica valendo — nada é enviado até a escolha.
          </p>
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {conflicts.map(conflict => {
          const fields = diffFields(conflict.deviceA.data, conflict.deviceB.data);
          const isOpen = expanded === conflict.id;
          return (
            <li key={conflict.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {ENTITY_LABEL[conflict.entityType] || conflict.entityType}
                  </p>
                  <p className="text-sm font-bold text-slate-900 truncate">{conflict.entityName}</p>
                  <p className="text-[11px] text-slate-500">
                    {fields.length} campo(s) diferente(s) ·{' '}
                    <button type="button" className="underline text-blue-700" onClick={() => setExpanded(isOpen ? null : conflict.id)}>
                      {isOpen ? 'ocultar diferenças' : 'ver diferenças'}
                    </button>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => resolve(conflict, 'keep_a')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Manter a deste aparelho
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve(conflict, 'keep_b')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-800 hover:bg-slate-50"
                  >
                    <Cloud className="w-3.5 h-3.5" /> Manter a do outro aparelho
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-1 pr-3 font-semibold">Campo</th>
                        <th className="py-1 pr-3 font-semibold">Este aparelho<br /><span className="font-normal">{formatDate(conflict.deviceA.updatedAt)}</span></th>
                        <th className="py-1 font-semibold">Outro aparelho<br /><span className="font-normal">{formatDate(conflict.deviceB.updatedAt)}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map(f => (
                        <tr key={f.field} className="border-t border-slate-100 align-top">
                          <td className="py-1 pr-3 font-mono text-slate-600">{f.field}</td>
                          <td className="py-1 pr-3 text-slate-900">{f.local}</td>
                          <td className="py-1 text-slate-900">{f.remote}</td>
                        </tr>
                      ))}
                      {fields.length === 0 && (
                        <tr><td colSpan={3} className="py-1 text-slate-500">As duas versões têm o mesmo conteúdo.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
