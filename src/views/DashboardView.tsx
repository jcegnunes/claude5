import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  FlaskConical, 
  FileText, 
  Award, 
  Clock, 
  TrendingUp, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Eye,
  Download,
  QrCode,
  Calendar,
  AlertCircle,
  Edit3,
  FileSpreadsheet
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { DielectricStorageService } from '../services/syncEngine';
import { StatusBadge } from '../components/StatusBadge';
import { TestRecord, Equipment } from '../types';
import { formatDateBR } from '../utils/dateUtils';
import { isTestEligibleForCertificate } from '../services/normsEngine';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
  onOpenTestLaudo: (test: TestRecord) => void;
  onOpenTestCertificado: (test: TestRecord) => void;
  onSelectEquipment: (eq: Equipment) => void;
  onStartNewTestWithEquipment?: (eqId: string) => void;
  onEditTest?: (test: TestRecord) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenTestLaudo,
  onOpenTestCertificado,
  onSelectEquipment,
  onStartNewTestWithEquipment,
  onEditTest
}) => {
  const clients = DielectricStorageService.getClients();
  const equipment = DielectricStorageService.getEquipment();
  const tests = DielectricStorageService.getTests();
  const orders = DielectricStorageService.getServiceOrders();
  const instruments = DielectricStorageService.getInstruments();

  const today = new Date().toISOString().split('T')[0];
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const in30DaysStr = in30Days.toISOString().split('T')[0];

  // Metrics
  const totalEquipment = equipment.length;
  const approvedTests = tests.filter(t => t.result === 'APROVADO').length;
  const reprovedTests = tests.filter(t => t.result === 'REPROVADO').length;
  
  const expiredEquipment = equipment.filter(e => e.nextTestDueDate && e.nextTestDueDate < today);
  const expiringSoonEquipment = equipment.filter(e => e.nextTestDueDate && e.nextTestDueDate >= today && e.nextTestDueDate <= in30DaysStr);
  const openOrders = orders.filter(o => o.status !== 'concluida' && o.status !== 'cancelada').length;

  const expiredInstruments = instruments.filter(i => i.calibrationExpiryDate < today);

  // Chart Data: Tests per month
  const monthlyData = [
    { month: 'Set', ensaios: 18, aprovados: 17, reprovados: 1 },
    { month: 'Out', ensaios: 24, aprovados: 22, reprovados: 2 },
    { month: 'Nov', ensaios: 32, aprovados: 30, reprovados: 2 },
    { month: 'Dez', ensaios: 28, aprovados: 27, reprovados: 1 },
    { month: 'Jan', ensaios: 35, aprovados: 33, reprovados: 2 },
    { month: 'Fev (Atual)', ensaios: tests.length + 15, aprovados: approvedTests + 14, reprovados: reprovedTests + 1 }
  ];

  // Chart Data: Approval Ratio
  const ratioData = [
    { name: 'Aprovados', value: approvedTests || 1, color: '#10B981' },
    { name: 'Reprovados', value: reprovedTests || 0, color: '#EF4444' }
  ];

  // Equipment by Type
  const equipmentByTypeMap: Record<string, number> = {};
  equipment.forEach(e => {
    const key = e.type.replace('_', ' ').toUpperCase();
    equipmentByTypeMap[key] = (equipmentByTypeMap[key] || 0) + 1;
  });
  const typeChartData = Object.entries(equipmentByTypeMap).map(([type, count]) => ({
    name: type,
    quantidade: count
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="bg-gradient-to-r from-[#0A2540] via-slate-900 to-blue-950 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-orange-400">
            Painel Geral de Controle
          </span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
            JVM Dielectric Lab • Ensaios & Certificação
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Rastreabilidade completa de ensaios dielétricos de rotina e periódicos para EPIs e EPCs conforme NR-10 e normas ABNT/IEC.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <button
            onClick={() => onNavigate('wizard')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-98 cursor-pointer"
          >
            <FlaskConical className="w-4 h-4" /> Novo Ensaio
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Emitir Relatório
          </button>
          <button
            onClick={() => onNavigate('service_orders')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" /> Ordens de Serviço ({openOrders})
          </button>
        </div>
      </div>

      {/* Critical Alerts Banner (if expired equipment or instruments) */}
      {(expiredEquipment.length > 0 || expiredInstruments.length > 0) && (
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Avisos Operacionais de Vencimento e Calibração
            </h3>
          </div>
          <div className="text-xs text-amber-800 space-y-1">
            {expiredEquipment.length > 0 && (
              <p>
                • <strong>{expiredEquipment.length} equipamento(s)</strong> com periodicidade de ensaio dielétrico vencida (necessita reensaio urgente).
              </p>
            )}
            {expiredInstruments.length > 0 && (
              <p>
                • <strong>{expiredInstruments.length} instrumento(s)</strong> de bancada com certificado de calibração RBC vencido.
              </p>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Equipment */}
        <div 
          onClick={() => onNavigate('equipment')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-blue-400 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Inventário EPI/EPC</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{totalEquipment}</span>
            <span className="text-xs text-slate-500 ml-1.5">itens cadastrados</span>
          </div>
          <div className="mt-2 text-[11px] text-blue-600 font-semibold flex items-center gap-1">
            Ver equipamentos <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Tests Realized */}
        <div 
          onClick={() => onNavigate('tests')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-emerald-400 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Ensaios Realizados</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FlaskConical className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{tests.length}</span>
            <span className="text-xs text-emerald-600 font-semibold ml-1.5">
              ({approvedTests} aprovados)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            Ver laudos emitidos <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Retest Due in 30 Days */}
        <div 
          onClick={() => onNavigate('equipment')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-amber-400 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Vencendo em 30d</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-600">{expiringSoonEquipment.length}</span>
            <span className="text-xs text-slate-500 ml-1.5">próximos do reensaio</span>
          </div>
          <div className="mt-2 text-[11px] text-amber-600 font-semibold flex items-center gap-1">
            Programar reensaios <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Expired / Overdue */}
        <div 
          onClick={() => onNavigate('equipment')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-red-400 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Ensaio Vencido</span>
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-red-600">{expiredEquipment.length}</span>
            <span className="text-xs text-slate-500 ml-1.5">fora de serviço</span>
          </div>
          <div className="mt-2 text-[11px] text-red-600 font-semibold flex items-center gap-1">
            Ver itens vencidos <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Activity Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Evolução Mensal de Ensaios</h3>
              <p className="text-xs text-slate-500">Volume de ensaios dielétricos realizados por mês</p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
              Total: {monthlyData.reduce((acc, curr) => acc + curr.ensaios, 0)} ensaios
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="aprovados" fill="#10B981" name="Aprovados" radius={[4, 4, 0, 0]} />
                <Bar dataKey="reprovados" fill="#EF4444" name="Reprovados" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Approval Pie Chart */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Conformidade Global</h3>
            <p className="text-xs text-slate-500">Índice de aprovação nos ensaios</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ratioData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {ratioData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Taxa de Aprovação:</span>
            <span className="font-bold text-emerald-600">
              {tests.length > 0 ? ((approvedTests / tests.length) * 100).toFixed(1) : 100}%
            </span>
          </div>
        </div>
      </div>

      {/* Recent Tests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Últimos Ensaios e Laudos Emitidos</h3>
            <p className="text-xs text-slate-500">Rastreabilidade imediata com laudos e certificados assinados</p>
          </div>
          <button
            onClick={() => onNavigate('tests')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            Ver todos ({tests.length}) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Nº Laudo</th>
                <th className="p-3.5">Equipamento / Tag</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Data do Ensaio</th>
                <th className="p-3.5">Tensão Aplicada</th>
                <th className="p-3.5">Fuga Medida</th>
                <th className="p-3.5">Resultado</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {tests.slice(0, 5).map(test => (
                <tr key={test.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 font-bold font-mono text-blue-700">
                    {test.reportNumber}
                  </td>
                  <td className="p-3.5">
                    <span className="font-bold text-slate-900 block">{test.equipmentTag}</span>
                    <span className="text-[11px] text-slate-500 uppercase">{test.equipmentType.replace('_', ' ')} (Classe {test.equipmentClass})</span>
                  </td>
                  <td className="p-3.5 text-slate-700">{test.clientName}</td>
                  <td className="p-3.5 text-slate-600">{formatDateBR(test.testDate)}</td>
                  <td className="p-3.5 text-slate-800 font-semibold">{test.appliedVoltage_kV} kV {test.voltageType}</td>
                  <td className="p-3.5 font-mono text-blue-600">{test.measuredLeakageCurrent_mA} {test.currentUnit}</td>
                  <td className="p-3.5">
                    <StatusBadge type="test" status={test.result} size="sm" />
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {onEditTest && (
                        <button
                          onClick={() => onEditTest(test)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Editar este Ensaio Concluído"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Editar
                        </button>
                      )}

                      <button
                        onClick={() => onOpenTestLaudo(test)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                        title="Visualizar Laudo Técnico"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600" /> Laudo
                      </button>

                      {isTestEligibleForCertificate(test) && (
                        <button
                          onClick={() => onOpenTestCertificado(test)}
                          className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Visualizar Certificado de Conformidade"
                        >
                          <Award className="w-3.5 h-3.5 text-orange-600" /> Certificado
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
