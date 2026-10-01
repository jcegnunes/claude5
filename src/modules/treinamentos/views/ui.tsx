/** Peças visuais do módulo Treinamentos (mesmo padrão das demais telas). */
import React from 'react';
import { X } from 'lucide-react';
import type { CertificateSituation } from '../rules';
import { SITUATION_LABEL } from '../rules';

export const inputCls = 'w-full p-2 border border-slate-300 rounded-xl bg-white text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100';
export const labelCls = 'block font-bold text-slate-700 mb-1 text-xs';
export const btnPrimary = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors';
export const btnSecondary = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors';
export const btnDanger = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-semibold rounded-xl transition-colors';
export const cardCls = 'bg-white rounded-2xl border border-slate-200 shadow-sm';

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string; hint?: string }> = ({ label, children, className, hint }) => (
  <label className={`block ${className || ''}`}>
    <span className={labelCls}>{label}</span>
    {children}
    {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
  </label>
);

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, footer, wide }) => (
  <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
    <div
      className={`bg-white w-full ${wide ? 'sm:max-w-4xl' : 'sm:max-w-xl'} max-h-[94vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl`}
      onClick={e => e.stopPropagation()}
      role="dialog"
      aria-label={title}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="font-bold text-sm text-slate-900">{title}</h3>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 overflow-y-auto flex-1">{children}</div>
      {footer && <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap justify-end gap-2">{footer}</div>}
    </div>
  </div>
);

const SITUATION_CLS: Record<CertificateSituation, string> = {
  valido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  vencendo: 'bg-amber-50 text-amber-700 border-amber-200',
  vencido: 'bg-red-50 text-red-700 border-red-200',
  cancelado: 'bg-slate-100 text-slate-600 border-slate-300'
};

export const SituationBadge: React.FC<{ situation: CertificateSituation }> = ({ situation }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${SITUATION_CLS[situation]}`}>
    {SITUATION_LABEL[situation]}
  </span>
);

export const EmptyState: React.FC<{ icon: React.ElementType; title: string; text?: string; action?: React.ReactNode }> = ({ icon: Icon, title, text, action }) => (
  <div className={`${cardCls} p-8 text-center`}>
    <Icon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
    <p className="font-bold text-sm text-slate-700">{title}</p>
    {text && <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{text}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export function alertError(err: unknown, prefix = 'Não foi possível concluir') {
  const msg = err instanceof Error ? err.message : String(err);
  window.alert(`${prefix}: ${msg}`);
}
