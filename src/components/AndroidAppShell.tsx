import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Tablet, 
  Maximize2, 
  Minimize2, 
  Wifi, 
  WifiOff, 
  Battery, 
  BatteryCharging, 
  Signal, 
  QrCode, 
  FlaskConical, 
  ShieldCheck, 
  Clock, 
  RefreshCw, 
  ChevronLeft, 
  Home, 
  FileText, 
  Briefcase, 
  Users, 
  Gauge, 
  BookOpen, 
  Settings, 
  Download, 
  Share2, 
  Menu, 
  X, 
  UserCheck, 
  CheckCircle2, 
  AlertTriangle,
  Search,
  Sparkles,
  Layers,
  ArrowRight,
  Shield,
  HelpCircle,
  FolderArchive
} from 'lucide-react';
import { User, TestRecord, Equipment } from '../types';
import { DielectricStorageService } from '../services/syncEngine';

interface AndroidAppShellProps {
  currentUser: User;
  onUserChange: (user: User) => void;
  activeView: string;
  onNavigate: (view: string) => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  pendingSyncCount: number;
  onTriggerSync: () => void;
  isSyncing: boolean;
  onOpenQRScanner: () => void;
  onStartNewTest: (equipmentId?: string, osId?: string) => void;
  onOpenLaudo: (test: TestRecord) => void;
  onOpenCertificado: (test: TestRecord) => void;
  onSelectEquipment: (equipment: Equipment) => void;
  onOpenInstallModal: () => void;
  onOpenDeviceFilesModal?: () => void;
  onExitAndroidMode: () => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

export const AndroidAppShell: React.FC<AndroidAppShellProps> = ({
  currentUser,
  onUserChange,
  activeView,
  onNavigate,
  isOnline,
  onToggleOnline,
  pendingSyncCount,
  onTriggerSync,
  isSyncing,
  onOpenQRScanner,
  onStartNewTest,
  onOpenLaudo,
  onOpenCertificado,
  onSelectEquipment,
  onOpenInstallModal,
  onOpenDeviceFilesModal,
  onExitAndroidMode,
  onLogout,
  children
}) => {
  // Device simulation frame type
  const [deviceFrame, setDeviceFrame] = useState<'mobile' | 'tablet' | 'fullscreen'>('mobile');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('08:30');

  const users = DielectricStorageService.getUsers();
  const company = DielectricStorageService.getCompanyInfo();

  // Keep time updated
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  const getViewTitle = () => {
    switch (activeView) {
      case 'dashboard':
      case 'android_home':
        return 'JVM Ensaios • Painel de Campo';
      case 'wizard':
        return 'Assistente de Ensaio Elétrico';
      case 'tests':
        return 'Laudos & Certificados';
      case 'equipment':
        return 'Inventário de EPIs & EPCs';
      case 'service_orders':
        return 'Ordens de Serviço (OS)';
      case 'clients':
        return 'Clientes & Empresas';
      case 'instruments':
        return 'Instrumentos de Laboratório';
      case 'norms':
        return 'Normas Técnicas (NBR/IEC)';
      case 'sync':
        return 'Sincronização Offline';
      case 'audit':
        return 'Logs de Auditoria';
      case 'backup':
        return 'Backup & Configurações';
      default:
        return 'JVM Ensaios Dielétricos';
    }
  };

  const navMenuItems = [
    { id: 'dashboard', label: 'Painel Geral (Dashboard)', icon: Home, badge: null },
    { id: 'wizard', label: 'Novo Ensaio Dielétrico (4 Passos)', icon: FlaskConical, badge: 'Novo' },
    { id: 'tests', label: 'Laudos & Certificados Técnicos', icon: FileText, badge: null },
    { id: 'equipment', label: 'Inventário de EPIs / EPCs', icon: Shield, badge: null },
    { id: 'service_orders', label: 'Ordens de Serviço (OS)', icon: Briefcase, badge: null },
    { id: 'clients', label: 'Clientes & Empresas', icon: Users, badge: null },
    { id: 'instruments', label: 'Instrumentos & Calibração', icon: Gauge, badge: null },
    { id: 'norms', label: 'Normas & Parâmetros Dielétricos', icon: BookOpen, badge: null },
    { id: 'sync', label: 'Central de Sincronização', icon: RefreshCw, badge: pendingSyncCount > 0 ? `${pendingSyncCount}` : null },
    { id: 'backup', label: 'Backup & Dados do App', icon: Settings, badge: null },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start p-0 sm:p-4 md:p-6 text-slate-900 select-none">
      {/* Top Floating Control Bar for Device Mode (Desktop only) */}
      <div className="w-full max-w-5xl mb-3 hidden sm:flex items-center justify-between bg-slate-900/90 border border-slate-800 text-white px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center font-black text-white text-xs shadow-md">
            JVM
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-white">Aplicativo Android JVM Ensaios</span>
              <span className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold rounded-md uppercase">
                Modo Nativo
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Mantendo 100% dos campos, relatórios, cálculos e normas da versão Web
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Frame selector */}
          <div className="bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-700 text-xs">
            <button
              onClick={() => setDeviceFrame('mobile')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceFrame === 'mobile'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Visualizar em formato Smartphone Android (Galaxy / Pixel)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Smartphone</span>
            </button>

            <button
              onClick={() => setDeviceFrame('tablet')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceFrame === 'tablet'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Visualizar em formato Tablet Industrial / Rugged de Campo"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Tablet Campo</span>
            </button>

            <button
              onClick={() => setDeviceFrame('fullscreen')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceFrame === 'fullscreen'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Tela Cheia Android (PWA)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Tela Cheia</span>
            </button>
          </div>

          {/* Install PWA / APK Guide */}
          <button
            onClick={onOpenInstallModal}
            className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            title="Como instalar no celular Android"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Instalar no Celular</span>
          </button>

          {/* Exit Android mode back to standard desktop */}
          <button
            onClick={onExitAndroidMode}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
            title="Voltar para o Modo Web Desktop Completo"
          >
            Voltar p/ Desktop
          </button>
        </div>
      </div>

      {/* DEVICE FRAME CONTAINER */}
      <div 
        className={`w-full transition-all duration-300 ${
          deviceFrame === 'mobile' 
            ? 'max-w-[430px] rounded-[44px] border-[10px] border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]' 
            : deviceFrame === 'tablet'
              ? 'max-w-3xl rounded-[36px] border-[12px] border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]'
              : 'max-w-5xl rounded-2xl border border-slate-800'
        } bg-slate-100 flex flex-col overflow-hidden relative min-h-[750px] max-h-[92vh]`}
      >
        {/* ANDROID SYSTEM STATUS BAR */}
        <div className="bg-[#0A2540] text-white px-5 pt-3 pb-2 flex items-center justify-between text-[11px] font-semibold select-none shrink-0 border-b border-blue-950/40">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight">{currentTime}</span>
            <div className="flex items-center gap-1 opacity-80 text-[10px]">
              <Signal className="w-3 h-3 text-emerald-400" />
              <span>5G</span>
            </div>
          </div>

          {/* Camera Punch-Hole Simulation on Mobile Frame */}
          {deviceFrame === 'mobile' && (
            <div className="w-3.5 h-3.5 rounded-full bg-slate-950 border border-slate-800 shadow-inner shrink-0" />
          )}

          <div className="flex items-center gap-2.5">
            <button
              onClick={onToggleOnline}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded cursor-pointer ${
                isOnline ? 'text-emerald-300 bg-emerald-900/40' : 'text-red-300 bg-red-900/40'
              }`}
              title={isOnline ? 'Online (Conectado)' : 'Offline (Modo Sem Sinal)'}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </button>

            {pendingSyncCount > 0 && (
              <button
                onClick={onTriggerSync}
                className="flex items-center gap-0.5 text-amber-300 bg-amber-900/40 px-1 py-0.5 rounded text-[10px] animate-pulse cursor-pointer"
                title={`${pendingSyncCount} ensaios aguardando envio`}
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{pendingSyncCount}</span>
              </button>
            )}

            <div className="flex items-center gap-1 text-slate-200">
              <span className="text-[10px]">98%</span>
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* ANDROID TOP APP BAR */}
        <div className="bg-[#0A2540] text-white px-3.5 py-2.5 flex items-center justify-between border-b border-slate-800 shadow-md shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white cursor-pointer"
              title="Abrir Menu de Navegação do App"
            >
              <Menu className="w-5 h-5" />
            </button>

            {activeView !== 'dashboard' && activeView !== 'android_home' && (
              <button
                onClick={() => onNavigate('dashboard')}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
                title="Voltar ao início"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            <div className="leading-tight">
              <span className="text-[9px] uppercase tracking-wider font-bold text-orange-400 block">
                JVM ENGENHARIA • ANDROID
              </span>
              <h1 className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[200px] sm:max-w-[280px]">
                {getViewTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick QR Scanner button in Header */}
            <button
              onClick={onOpenQRScanner}
              className="p-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white shadow-xs cursor-pointer"
              title="Escanear QR Code da Tag"
            >
              <QrCode className="w-4 h-4" />
            </button>

            {/* Sync button */}
            <button
              onClick={onTriggerSync}
              disabled={isSyncing}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white cursor-pointer"
              title="Sincronizar dados agora"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-orange-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* ANDROID SLIDE-OVER NAVIGATION DRAWER */}
        {isDrawerOpen && (
          <div className="absolute inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex animate-fadeIn">
            <div className="w-4/5 max-w-xs bg-slate-900 text-white h-full flex flex-col shadow-2xl border-r border-slate-800 animate-slideRight">
              {/* Drawer Header */}
              <div className="p-4 bg-gradient-to-br from-[#0A2540] to-blue-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center font-black text-white shadow-md">
                    JVM
                  </div>
                  <div>
                    <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block">App Android</span>
                    <span className="font-extrabold text-sm text-white">Menu Principal</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-xl bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Technician Info */}
              <div className="p-3 bg-slate-950/60 border-b border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Técnico Operador:</span>
                    <span className="font-bold text-white block">{currentUser.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{currentUser.creaOrCft || currentUser.cargo}</span>
                  </div>
                  <button
                    onClick={() => {
                      const nextUser = users.find(u => u.id !== currentUser.id) || users[0];
                      onUserChange(nextUser);
                    }}
                    className="p-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                    title="Trocar operador ativo"
                  >
                    Trocar
                  </button>
                </div>
              </div>

              {/* Nav Items List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
                {navMenuItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'bg-orange-500 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-orange-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                          isActive ? 'bg-white text-orange-600' : 'bg-orange-500/20 text-orange-300'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
                {onOpenDeviceFilesModal && (
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenDeviceFilesModal();
                    }}
                    className="w-full py-2 bg-blue-900/40 hover:bg-blue-800/60 text-blue-200 border border-blue-700/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <FolderArchive className="w-3.5 h-3.5 text-blue-400" />
                    <span>Arquivos Salvos no Celular</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onOpenInstallModal();
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-orange-400" />
                  <span>Instalar App no Android</span>
                </button>
                {onLogout && (
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onLogout();
                    }}
                    className="w-full py-2 bg-red-950/60 hover:bg-red-900/60 text-red-200 border border-red-800/50 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Sair / Trocar de Empresa</span>
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1" onClick={() => setIsDrawerOpen(false)} />
          </div>
        )}

        {/* MAIN ANDROID CONTENT AREA (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 bg-slate-100 pb-20">
          {children}
        </div>

        {/* ANDROID MATERIAL 3 BOTTOM NAVIGATION BAR */}
        <div className="bg-[#0A2540] border-t border-slate-800 text-white px-2 py-1.5 flex items-center justify-around shrink-0 relative z-30 shadow-2xl safe-area-pb">
          {/* Início */}
          <button
            onClick={() => onNavigate('dashboard')}
            className={`flex flex-col items-center justify-center w-14 py-1 gap-1 transition-colors cursor-pointer ${
              activeView === 'dashboard' ? 'text-orange-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Início</span>
          </button>

          {/* EPIs */}
          <button
            onClick={() => onNavigate('equipment')}
            className={`flex flex-col items-center justify-center w-14 py-1 gap-1 transition-colors cursor-pointer ${
              activeView === 'equipment' ? 'text-orange-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px]">EPI/EPC</span>
          </button>

          {/* FLOATING ACTION BUTTON (CENTRAL SCAN / ENVIAR) */}
          <button
            onClick={onOpenQRScanner}
            className="flex flex-col items-center justify-center -translate-y-4 w-13 h-13 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-xl border-4 border-slate-900 transition-transform active:scale-90 cursor-pointer"
            title="Escanear QR Code de Tag / EPI"
          >
            <QrCode className="w-6 h-6" />
          </button>

          {/* Novo Ensaio */}
          <button
            onClick={() => onNavigate('wizard')}
            className={`flex flex-col items-center justify-center w-14 py-1 gap-1 transition-colors cursor-pointer ${
              activeView === 'wizard' ? 'text-orange-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-5 h-5" />
            <span className="text-[10px]">Ensaio</span>
          </button>

          {/* Laudos */}
          <button
            onClick={() => onNavigate('tests')}
            className={`flex flex-col items-center justify-center w-14 py-1 gap-1 transition-colors cursor-pointer ${
              activeView === 'tests' ? 'text-orange-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px]">Laudos</span>
          </button>
        </div>

        {/* ANDROID SYSTEM BOTTOM GESTURE PILL SIMULATION */}
        <div className="bg-[#0A2540] pb-1.5 flex items-center justify-center shrink-0">
          <div className="w-28 h-1 bg-slate-600/70 rounded-full" />
        </div>
      </div>
    </div>
  );
};
