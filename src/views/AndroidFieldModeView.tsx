import React, { useState } from 'react';
import { 
  Smartphone, 
  QrCode, 
  FlaskConical, 
  ShieldCheck, 
  Clock, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Camera, 
  ArrowRight,
  ClipboardList,
  AlertTriangle,
  FileText,
  Briefcase,
  Users,
  Gauge,
  BookOpen,
  Search,
  CheckCircle2,
  XCircle,
  Building2,
  User as UserIcon,
  Tag,
  Download,
  Sparkles,
  Layers,
  Shield,
  FileSpreadsheet,
  HardDrive,
  FolderArchive
} from 'lucide-react';
import { DielectricStorageService } from '../services/syncEngine';
import { User, Equipment, TestRecord } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { formatDateBR } from '../utils/dateUtils';

interface AndroidFieldModeViewProps {
  currentUser: User;
  onOpenQRScanner: () => void;
  onStartNewTest: (equipmentId?: string, osId?: string) => void;
  onNavigate: (view: string) => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  pendingSyncCount: number;
  onTriggerSync: () => void;
  isSyncing: boolean;
  onOpenTestLaudo: (test: TestRecord) => void;
  onOpenCertificado?: (test: TestRecord) => void;
  onOpenInstallModal?: () => void;
  onOpenDeviceFiles?: () => void;
}

export const AndroidFieldModeView: React.FC<AndroidFieldModeViewProps> = ({
  currentUser,
  onOpenQRScanner,
  onStartNewTest,
  onNavigate,
  isOnline,
  onToggleOnline,
  pendingSyncCount,
  onTriggerSync,
  isSyncing,
  onOpenTestLaudo,
  onOpenCertificado,
  onOpenInstallModal,
  onOpenDeviceFiles
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const equipment = DielectricStorageService.getEquipment();
  const tests = DielectricStorageService.getTests();
  const serviceOrders = DielectricStorageService.getServiceOrders();
  const clients = DielectricStorageService.getClients();
  
  const today = new Date().toISOString().split('T')[0];
  const dueEquipment = equipment.filter(e => !e.nextTestDueDate || e.nextTestDueDate <= today);
  const openOrders = serviceOrders.filter(os => os.status === 'aberta' || os.status === 'em_execucao' || os.status === 'aguardando');

  // Filtered equipment by quick search
  const filteredQuickEquipment = searchQuery.trim() === ''
    ? []
    : equipment.filter(eq => 
        eq.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        eq.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (eq.collaboratorName && eq.collaboratorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (eq.collaboratorRegistration && eq.collaboratorRegistration.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (eq.caNumber && eq.caNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 5);

  return (
    <div className="space-y-4 pb-6 select-none">
      {/* Technician Cockpit Header */}
      <div className="bg-gradient-to-br from-[#0A2540] via-blue-950 to-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-xl space-y-3.5 border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center font-black text-white text-base shadow-md shadow-orange-500/20">
              JVM
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-orange-400 tracking-wider block">
                Aplicativo Android de Campo
              </span>
              <h2 className="font-black text-base text-white leading-tight">
                Painel do Analista Executor
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleOnline}
              className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                isOnline
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-red-950/80 border-red-500/50 text-red-300'
              }`}
              title="Alternar simulação Online/Offline"
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="text-[10px]">{isOnline ? 'Online' : 'Offline'}</span>
            </button>
          </div>
        </div>

        {/* Technician Info & Sync Bar */}
        <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs flex items-center justify-between text-xs border border-white/10">
          <div>
            <span className="text-slate-300 block text-[10px] uppercase tracking-wider font-semibold">Técnico Responsável:</span>
            <span className="font-extrabold text-white text-sm block">{currentUser.name}</span>
            <span className="text-[10px] text-orange-300 font-mono">{currentUser.creaOrCft || currentUser.cargo}</span>
          </div>

          <button
            onClick={onTriggerSync}
            disabled={isSyncing}
            className="p-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : pendingSyncCount > 0 ? `${pendingSyncCount} Pendente(s)` : 'Sincronizado'}</span>
          </button>
        </div>

        {/* Local-First Storage & Offline Guarantee Card */}
        <div className="p-3 bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-orange-500/20 border border-orange-500/30 rounded-2xl text-white space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-[11px] font-bold text-orange-200 uppercase tracking-wider">
                Armazenamento Local Ativo (APK / Offline)
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-300">
              {pendingSyncCount > 0 ? `${pendingSyncCount} arquivo(s) local(is)` : '100% Sincronizado'}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Seus ensaios, laudos, fotos e assinaturas são gravados primeiro na <strong>memória local do aparelho</strong> e enviados com segurança para a plataforma quando você clica em <strong>Sincronizar</strong>.
          </p>
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
            {onOpenDeviceFiles && (
              <button
                onClick={onOpenDeviceFiles}
                className="px-2.5 py-1 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
              >
                <FolderArchive className="w-3.5 h-3.5 text-amber-300" />
                <span>Gerenciar Arquivos Locais</span>
              </button>
            )}
            {pendingSyncCount > 0 ? (
              <button
                onClick={onTriggerSync}
                disabled={isSyncing}
                className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sincronizar ({pendingSyncCount})</span>
              </button>
            ) : (
              <span className="text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Memória local 100% íntegra
              </span>
            )}
          </div>
        </div>

        {/* Quick KPI Stats Pill Row */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div 
            onClick={() => onNavigate('equipment')}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-center cursor-pointer transition-colors"
          >
            <span className="text-[10px] text-slate-300 block">EPIs Vencidos</span>
            <span className="font-black text-amber-400 text-sm">{dueEquipment.length}</span>
          </div>

          <div 
            onClick={() => onNavigate('service_orders')}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-center cursor-pointer transition-colors"
          >
            <span className="text-[10px] text-slate-300 block">OS Abertas</span>
            <span className="font-black text-blue-300 text-sm">{openOrders.length}</span>
          </div>

          <div 
            onClick={() => onNavigate('tests')}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-center cursor-pointer transition-colors"
          >
            <span className="text-[10px] text-slate-300 block">Laudos Emitidos</span>
            <span className="font-black text-emerald-300 text-sm">{tests.length}</span>
          </div>
        </div>
      </div>

      {/* Main Giant Touch Action Buttons for Field Operations */}
      <div className="grid grid-cols-2 gap-3">
        {/* QR Code Scanner (Camera) */}
        <button
          onClick={onOpenQRScanner}
          className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 active:scale-95 text-white rounded-3xl shadow-lg shadow-blue-600/20 flex flex-col items-center justify-center gap-2 text-center transition-all min-h-[110px] cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <QrCode className="w-7 h-7 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-sm block">Escanear QR Tag</span>
            <span className="text-[10px] text-blue-100 opacity-80">Identificação instantânea</span>
          </div>
        </button>

        {/* Start New Test (Wizard) */}
        <button
          onClick={() => onStartNewTest()}
          className="p-4 bg-gradient-to-br from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 active:scale-95 text-white rounded-3xl shadow-lg shadow-orange-500/20 flex flex-col items-center justify-center gap-2 text-center transition-all min-h-[110px] cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <FlaskConical className="w-7 h-7 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-sm block">Novo Ensaio (4 Passos)</span>
            <span className="text-[10px] text-orange-100 opacity-80">Laudo & Certificado NR-10</span>
          </div>
        </button>
      </div>

      {/* Quick Search Tag or Collaborator */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Tag, Colaborador, CA ou Cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-slate-50 font-medium"
          />
        </div>

        {filteredQuickEquipment.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Resultados rápidos:</span>
            {filteredQuickEquipment.map(eq => (
              <div
                key={eq.id}
                onClick={() => onStartNewTest(eq.id)}
                className="p-2.5 bg-orange-50/60 border border-orange-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-orange-100/60 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-blue-700 text-xs">{eq.tag}</span>
                    <span className="text-[11px] font-semibold text-slate-800">{eq.type.replace('_', ' ')} (Cl. {eq.dielectricClass})</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {eq.clientName} {eq.collaboratorName ? `• ${eq.collaboratorName}` : ''}
                  </span>
                </div>
                <div className="px-2 py-1 bg-orange-500 text-white rounded-lg text-[10px] font-bold">
                  Ensaio
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Module Shortcuts Grid (All 10 modules preserved) */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Módulos do Aplicativo (Completos)</span>
          </h3>
          <span className="text-[10px] font-bold text-slate-400">100% dos Campos</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <button
            onClick={() => onNavigate('tests')}
            className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-2xl flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800 text-[11px]">Laudos & Certificados</span>
            <span className="text-[9px] text-slate-400">Filtros & Emissão</span>
          </button>

          <button
            onClick={() => onNavigate('reports')}
            className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-2xl flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800 text-[11px]">Relatório Consolidado</span>
            <span className="text-[9px] text-slate-400">Dossiê NR-10</span>
          </button>

          <button
            onClick={() => onNavigate('equipment')}
            className="p-3 bg-slate-50 hover:bg-orange-50 border border-slate-200 rounded-2xl flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800 text-[11px]">EPIs & EPCs</span>
            <span className="text-[9px] text-slate-400">{equipment.length} cadastrados</span>
          </button>

          <button
            onClick={() => onNavigate('service_orders')}
            className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-2xl flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800 text-[11px]">Ordens de Serviço</span>
            <span className="text-[9px] text-slate-400">{serviceOrders.length} ordens</span>
          </button>

          <button
            onClick={() => onNavigate('clients')}
            className="p-3 bg-slate-50 hover:bg-purple-50 border border-slate-200 rounded-2xl flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800 text-[11px]">Empresas / Clientes</span>
            <span className="text-[9px] text-slate-400">{clients.length} empresas</span>
          </button>

          <button
            onClick={() => onNavigate('instruments')}
            className="p-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 rounded-2xl flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Gauge className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800 text-[11px]">Instrumentos Lab</span>
            <span className="text-[9px] text-slate-400">Calibração RBC</span>
          </button>

          <button
            onClick={() => onNavigate('norms')}
            className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-2xl flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800 text-[11px]">Normas Técnicas</span>
            <span className="text-[9px] text-slate-400">NBR / IEC / ASTM</span>
          </button>

          <button
            onClick={() => onNavigate('sync')}
            className="p-3 bg-slate-50 hover:bg-teal-50 border border-slate-200 rounded-2xl flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800 text-[11px]">Sincronização</span>
            <span className="text-[9px] text-slate-400">Fila Offline</span>
          </button>

          {onOpenDeviceFiles && (
            <button
              onClick={onOpenDeviceFiles}
              className="p-3 bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200 rounded-2xl flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <FolderArchive className="w-4 h-4" />
              </div>
              <span className="font-bold text-amber-950 text-[11px]">Arquivos no Celular</span>
              <span className="text-[9px] text-amber-700">PDFs / Memória</span>
            </button>
          )}

          <button
            onClick={onOpenInstallModal}
            className="p-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-2xl flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs">
              <Download className="w-4 h-4" />
            </div>
            <span className="font-bold text-orange-900 text-[11px]">Instalar App Android</span>
            <span className="text-[9px] text-orange-600">PWA & APK</span>
          </button>
        </div>
      </div>

      {/* EPIs Vencidos ou a Vencer (Card de Ação Rápida) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
              EPIs Vencidos / Sem Ensaio ({dueEquipment.length})
            </h3>
          </div>
          <button
            onClick={() => onNavigate('equipment')}
            className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
          >
            Ver todos ({equipment.length})
          </button>
        </div>

        <div className="space-y-2">
          {dueEquipment.slice(0, 4).map(eq => (
            <div
              key={eq.id}
              onClick={() => onStartNewTest(eq.id)}
              className="p-3 bg-slate-50 hover:bg-orange-50/70 border border-slate-200 hover:border-orange-300 rounded-2xl flex items-center justify-between cursor-pointer transition-all active:scale-98"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-blue-700 text-xs">{eq.tag}</span>
                  <span className="text-[11px] text-slate-800 uppercase font-bold">
                    {eq.type.replace('_', ' ')} (Classe {eq.dielectricClass})
                  </span>
                </div>
                <span className="text-[11px] text-slate-600 block">
                  🏢 {eq.clientName}
                </span>
                {eq.collaboratorName && (
                  <span className="text-[10px] text-orange-700 font-semibold block">
                    👤 {eq.collaboratorName} {eq.collaboratorRegistration ? `(Mat: ${eq.collaboratorRegistration})` : ''} {eq.collaboratorSector ? `• ${eq.collaboratorSector}` : ''}
                  </span>
                )}
              </div>
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Últimos Laudos Emitidos no Celular */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
              Últimos Laudos & Certificados
            </h3>
          </div>
          <button
            onClick={() => onNavigate('tests')}
            className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
          >
            Ver todos ({tests.length})
          </button>
        </div>

        <div className="space-y-2">
          {tests.slice(0, 3).map(t => (
            <div
              key={t.id}
              onClick={() => onOpenTestLaudo(t)}
              className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <StatusBadge type="test" status={t.result} size="sm" />
                  <span className="font-bold font-mono text-xs text-slate-900">{t.reportNumber}</span>
                </div>
                <span className="text-[11px] text-slate-700 block mt-0.5 font-medium">
                  {t.equipmentTag} • {t.clientName}
                </span>
                {t.collaboratorName && (
                  <span className="text-[10px] text-orange-600 block">
                    👤 {t.collaboratorName} {t.collaboratorRegistration ? `(Mat: ${t.collaboratorRegistration})` : ''}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">{formatDateBR(t.testDate)}</span>
                <span className="text-[10px] font-bold text-blue-600 hover:underline">Ver Laudo</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* USB Developer Mode Quick Action Banner */}
      {onOpenInstallModal && (
        <div className="p-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-slate-800 rounded-3xl text-white space-y-2.5 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                USB
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Instalação via Cabo USB (ADB)</span>
                <span className="text-[10px] text-slate-400">Modo Desenvolvedor & Depuração USB</span>
              </div>
            </div>
            <button
              onClick={onOpenInstallModal}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Abrir Ferramentas USB
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
