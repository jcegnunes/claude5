import React from 'react';
import { Award, AlertTriangle, CalendarClock, Users } from 'lucide-react';
import { getCertificates, getClasses } from '../repository';
import { certificateSituation, daysBetween, formatDateBr, todayIso } from '../rules';
import { cardCls, SituationBadge } from './ui';

export const TrainingDashboard: React.FC<{ onOpen: (tab: 'turmas' | 'certificados', filter?: 'vencendo' | 'vencido') => void }> = ({ onOpen }) => {
  const today = todayIso();
  const certs = getCertificates();
  const classes = getClasses();
  const active = certs.filter(c => c.status !== 'cancelado');
  const expiring = active.filter(c => certificateSituation(c, today) === 'vencendo').sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
  const expired = active.filter(c => certificateSituation(c, today) === 'vencido');
  const openClasses = classes.filter(t => t.status === 'planejada' || t.status === 'em_andamento');
  const thisYear = today.slice(0, 4);
  const issuedYear = certs.filter(c => (c.issueDate || '').startsWith(thisYear)).length;

  // Reciclagem: só conta como vencido quem não tem certificado mais novo do mesmo curso
  const renewedKey = new Set(active.filter(c => certificateSituation(c, today) === 'valido').map(c => `${c.courseId}|${c.participantCpf || c.participantName}`));
  const pendingRenewal = expired.filter(c => !renewedKey.has(`${c.courseId}|${c.participantCpf || c.participantName}`));

  const cards = [
    { label: `Certificados emitidos em ${thisYear}`, value: issuedYear, icon: Award, cls: 'text-blue-700 bg-blue-50', onClick: () => onOpen('certificados') },
    { label: 'Turmas abertas', value: openClasses.length, icon: Users, cls: 'text-slate-700 bg-slate-100', onClick: () => onOpen('turmas') },
    { label: 'Vencem em 60 dias', value: expiring.length, icon: CalendarClock, cls: 'text-amber-700 bg-amber-50', onClick: () => onOpen('certificados', 'vencendo') },
    { label: 'Vencidos sem reciclagem', value: pendingRenewal.length, icon: AlertTriangle, cls: 'text-red-700 bg-red-50', onClick: () => onOpen('certificados', 'vencido') }
  ];

  const attention = [...expiring, ...pendingRenewal].slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <button key={c.label} type="button" onClick={c.onClick} className={`${cardCls} p-4 text-left hover:border-blue-300 transition-colors`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.cls}`}><c.icon className="w-5 h-5" /></div>
            <div className="text-2xl font-black text-slate-900 mt-2">{c.value}</div>
            <div className="text-[11px] font-semibold text-slate-500">{c.label}</div>
          </button>
        ))}
      </div>

      <div className={`${cardCls} p-4`}>
        <h3 className="font-bold text-sm text-slate-900 mb-1">Reciclagem</h3>
        <p className="text-[11px] text-slate-500 mb-3">Certificados vencidos ou que vencem nos próximos 60 dias (o vencimento conta a partir do término do treinamento).</p>
        {attention.length === 0 ? (
          <p className="text-xs text-emerald-700">Nenhum certificado vencendo.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {attention.map(c => {
              const days = c.expiryDate ? daysBetween(today, c.expiryDate) : 0;
              return (
                <div key={c.id} className="py-2 flex flex-wrap items-center gap-2 justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">{c.participantName}{c.participantCompany ? <span className="font-normal text-slate-500"> · {c.participantCompany}</span> : null}</p>
                    <p className="text-[11px] text-slate-500 truncate">{c.courseName}</p>
                  </div>
                  <div className="text-right">
                    <SituationBadge situation={certificateSituation(c, today)} />
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatDateBr(c.expiryDate)} ({days >= 0 ? `em ${days} dia(s)` : `há ${-days} dia(s)`})</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
