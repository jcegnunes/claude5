import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  QrCode, 
  Smartphone, 
  Monitor, 
  UserCircle, 
  Check, 
  ChevronDown,
  Bell,
  HardDrive,
  Camera,
  Building2,
  LogOut,
  Sparkles
} from 'lucide-react';
import { User, Company } from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { AuthService } from '../services/authService';

interface NavbarProps {
  currentUser: User;
  onUserChange: (user: User) => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  onOpenQRScanner: () => void;
  onOpenMobileCamera?: () => void;
  isFieldMode: boolean;
  onToggleFieldMode: () => void;
  onOpenInstallModal?: () => void;
  pendingSyncCount: number;
  onTriggerSync: () => void;
  isSyncing: boolean;
  onNavigate: (view: string) => void;
  activeView: string;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onUserChange,
  isOnline,
  onToggleOnline,
  onOpenQRScanner,
  onOpenMobileCamera,
  isFieldMode,
  onToggleFieldMode,
  onOpenInstallModal,
  pendingSyncCount,
  onTriggerSync,
  isSyncing,
  onNavigate,
  activeView,
  onLogout
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  
  const [companies, setCompanies] = useState<Company[]>(() => DielectricStorageService.getCompanies());
  const [activeCompany, setActiveCompany] = useState<Company>(() => DielectricStorageService.getActiveCompany());
  const [users, setUsers] = useState<User[]>(() => DielectricStorageService.getUsers());

  const refreshData = () => {
    setCompanies(DielectricStorageService.getCompanies());
    setActiveCompany(DielectricStorageService.getActiveCompany());
    setUsers(DielectricStorageService.getUsers());
  };

  useEffect(() => {
    refreshData();
    const handleDataChanged = () => refreshData();
    window.addEventListener('jvm-data-changed', handleDataChanged);
    return () => window.removeEventListener('jvm-data-changed', handleDataChanged);
  }, []);

  const handleSelectCompany = (comp: Company) => {
    DielectricStorageService.setActiveCompany(comp);
    setActiveCompany(comp);
    setCompanyDropdownOpen(false);
    
    // Also update current user's company context if needed
    if (currentUser.isMasterAdmin) {
      const updatedUser: User = {
        ...currentUser,
        companyId: comp.id,
        companyName: comp.name
      };
      onUserChange(updatedUser);
    }
  };

  return (
    <header className="bg-[#0A2540] text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Active Company Info */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
            {activeCompany.logoUrl ? (
              <div className="h-10 max-w-[120px] flex items-center justify-center rounded-xl bg-white/10 p-1 border border-white/15">
                <img 
                  src={activeCompany.logoUrl} 
                  alt={activeCompany.name} 
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md font-black text-white text-lg tracking-tighter">
                {activeCompany.name ? activeCompany.name.slice(0, 3).toUpperCase() : 'LAB'}
              </div>
            )}
            
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white uppercase truncate max-w-[160px] sm:max-w-[260px]">
                  {activeCompany.name || 'LABORATÓRIO DIELÉTRICO'}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-sm bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
                  NR-10
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium truncate max-w-[180px] sm:max-w-[300px]">
                {activeCompany.cnpj ? `CNPJ: ${activeCompany.cnpj}` : 'Laboratório de Ensaios & Certificação'}
              </p>
            </div>
          </div>

          {/* Center Action Toolbar */}
          <div className="hidden lg:flex items-center gap-2">
            
            {/* Multi-Company Dropdown Selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setCompanyDropdownOpen(!companyDropdownOpen);
                  setUserDropdownOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 transition-all cursor-pointer"
                title="Alternar entre empresas/laboratórios cadastrados"
              >
                <Building2 className="w-3.5 h-3.5 text-orange-400" />
                <span className="truncate max-w-[130px]">{activeCompany.name.split(' ')[0]}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {companyDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 py-2 z-50 text-slate-200 animate-in fade-in">
                  <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Empresas Cadastradas ({companies.length})
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-mono">
                      Multi-Tenant
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {companies.map(comp => (
                      <button
                        key={comp.id}
                        onClick={() => handleSelectCompany(comp)}
                        className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition-colors cursor-pointer ${
                          activeCompany.id === comp.id ? 'bg-orange-600/15 text-orange-300 font-bold border-l-2 border-orange-500' : 'text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="truncate font-semibold text-white">{comp.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{comp.cnpj || 'Sem CNPJ'}</p>
                        </div>
                        {activeCompany.id === comp.id && <Check className="w-4 h-4 text-orange-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Camera Bridge Quick Button */}
            {onOpenMobileCamera && (
              <button
                onClick={onOpenMobileCamera}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-sm transition-all cursor-pointer"
                title="Conectar smartphone via QR Code para usar câmera do celular direto no sistema"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Câmera Celular</span>
              </button>
            )}

            {/* Field / Desktop Mode Switcher */}
            <button
              onClick={onToggleFieldMode}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isFieldMode
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              title="Alternar entre visualização Desktop de Laboratório e Modo Aplicativo Android de Campo"
            >
              {isFieldMode ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
              {isFieldMode ? 'Modo Android' : 'Modo Desktop'}
            </button>

            {/* QR Code Scanner Quick Button */}
            <button
              onClick={onOpenQRScanner}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Code</span>
            </button>

            {/* Online / Offline Simulator Toggle */}
            <button
              onClick={onToggleOnline}
              className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isOnline
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/60 border-red-500/40 text-red-300'
              }`}
              title="Clique para simular modo offline/online"
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </button>

            {/* Sync Status Button */}
            <button
              onClick={onTriggerSync}
              disabled={isSyncing}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                pendingSyncCount > 0
                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Sincronização bidirecional com a nuvem"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? (
                '...'
              ) : pendingSyncCount > 0 ? (
                <span>{pendingSyncCount}</span>
              ) : (
                'Ok'
              )}
            </button>
          </div>

          {/* Right: User Profile & Quick Multi-User / Logout Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setCompanyDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {currentUser.name ? currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('') : 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-semibold text-white leading-tight flex items-center gap-1">
                  <span className="truncate max-w-[120px]">{currentUser.name}</span>
                  {currentUser.isMasterAdmin && (
                    <span className="text-[9px] px-1 bg-amber-500/20 text-amber-300 rounded font-bold">
                      Master
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">
                  {currentUser.cargo || currentUser.role}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {/* User Dropdown */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-800 animate-in fade-in">
                
                {/* User Card Header */}
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{currentUser.email}</p>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-orange-600 font-semibold">
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="truncate">{activeCompany.name}</span>
                  </div>
                </div>

                {/* Multiple Users Switcher */}
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Alternar Usuário
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {users.length} cadastrado(s)
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        onUserChange(u);
                        setUserDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                        currentUser.id === u.id ? 'bg-orange-50 font-bold text-orange-950' : 'text-slate-700'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-slate-900 truncate">{u.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{u.cargo || u.role}</div>
                      </div>
                      {currentUser.id === u.id && <Check className="w-4 h-4 text-orange-600 shrink-0" />}
                    </button>
                  ))}
                </div>

                {/* Bottom Actions */}
                <div className="p-2 border-t border-slate-100 space-y-1">
                  {onOpenInstallModal && (
                    <button
                      onClick={() => {
                        onOpenInstallModal();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-orange-500" />
                      <span>Instalar App Android</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onNavigate('validar');
                      setUserDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Portal de Validação Pública</span>
                  </button>

                  {/* Logout / Switch Company */}
                  {onLogout && (
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 cursor-pointer pt-2 border-t border-slate-100"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-500" />
                      <span>Sair / Trocar de Empresa</span>
                    </button>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
