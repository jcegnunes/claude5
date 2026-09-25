import React from 'react';
import { CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck, ShieldAlert, Archive, Wrench } from 'lucide-react';
import { EquipmentStatus, TestResult, ServiceOrderStatus } from '../types';

interface StatusBadgeProps {
  type: 'equipment' | 'test' | 'os' | 'calibration';
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2'
  }[size];

  if (type === 'test') {
    const testStatus = status as TestResult;
    if (testStatus === 'APROVADO') {
      return (
        <span className={`inline-flex items-center font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 ${sizeClasses}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          APROVADO
        </span>
      );
    }
    if (testStatus === 'REPROVADO') {
      return (
        <span className={`inline-flex items-center font-semibold rounded-full bg-red-100 text-red-800 border border-red-300 ${sizeClasses}`}>
          <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          REPROVADO
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300 ${sizeClasses}`}>
        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        PENDENTE
      </span>
    );
  }

  if (type === 'equipment') {
    const eqStatus = status as EquipmentStatus;
    switch (eqStatus) {
      case 'em_uso':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            Em Uso / Aprovado
          </span>
        );
      case 'disponivel':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses}`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            Disponível
          </span>
        );
      case 'em_manutencao':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses}`}>
            <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            Em Manutenção
          </span>
        );
      case 'reprovado':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-red-50 text-red-700 border border-red-200 ${sizeClasses}`}>
            <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
            Reprovado
          </span>
        );
      case 'descartado':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses}`}>
            <Archive className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            Descartado
          </span>
        );
      case 'fora_de_servico':
      default:
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-200 ${sizeClasses}`}>
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            Fora de Serviço (Vencido)
          </span>
        );
    }
  }

  if (type === 'os') {
    const osStatus = status as ServiceOrderStatus;
    switch (osStatus) {
      case 'aberta':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses}`}>
            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Aberta
          </span>
        );
      case 'agendada':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200 ${sizeClasses}`}>
            <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" /> Agendada
          </span>
        );
      case 'em_execucao':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses}`}>
            <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Em Execução
          </span>
        );
      case 'concluida':
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Concluída
          </span>
        );
      case 'cancelada':
      default:
        return (
          <span className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses}`}>
            <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" /> Cancelada
          </span>
        );
    }
  }

  if (type === 'calibration') {
    const isValid = status === 'valid';
    return isValid ? (
      <span className={`inline-flex items-center font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Calibração RBC Válida
      </span>
    ) : (
      <span className={`inline-flex items-center font-medium rounded-full bg-red-50 text-red-700 border border-red-200 ${sizeClasses}`}>
        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" /> Calibração Vencida
      </span>
    );
  }

  return <span>{status}</span>;
};
