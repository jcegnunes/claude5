import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Lock, 
  Mail, 
  KeyRound, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ArrowRight, 
  UserCheck, 
  Crown,
  Info,
  CheckCircle2,
  HelpCircle,
  Building2,
  Users,
  Plus,
  ChevronDown,
  Sparkles,
  Briefcase,
  FileCheck2,
  HardHat,
  BadgeCheck,
  X,
  Database
} from 'lucide-react';
import { AuthService, MASTER_ADMIN_CONFIG } from '../services/authService';
import { DielectricStorageService } from '../services/syncEngine';
import { SupabaseService } from '../services/supabaseService';
import { SupabaseDatabaseModal } from '../components/SupabaseDatabaseModal';
import { User, Company, UserRole } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('comp-jvm');
  const [users, setUsers] = useState<User[]>([]);
  
  const [email, setEmail] = useState<string>(MASTER_ADMIN_CONFIG.email);
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'credentials' | 'quick-users'>('credentials');
  
  // Modals for new company & new user & Supabase
  const [showNewCompanyModal, setShowNewCompanyModal] = useState<boolean>(false);
  const [showNewUserModal, setShowNewUserModal] = useState<boolean>(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState<boolean>(false);

  // New Company form
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [newCompanyCnpj, setNewCompanyCnpj] = useState<string>('');
  const [newCompanyCity, setNewCompanyCity] = useState<string>('');
  const [newCompanyState, setNewCompanyState] = useState<string>('SP');
  const [newCompanyPhone, setNewCompanyPhone] = useState<string>('');
  const [newCompanyEmail, setNewCompanyEmail] = useState<string>('');

  // New User form
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('tecnico');
  const [newUserCrea, setNewUserCrea] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('123456');

  // Load companies and users
  const loadData = () => {
    const comps = DielectricStorageService.getCompanies();
    setCompanies(comps);
    if (comps.length > 0 && !comps.some(c => c.id === selectedCompanyId)) {
      setSelectedCompanyId(comps[0].id);
    }

    const allUsers = DielectricStorageService.getUsers('ALL');
    setUsers(allUsers);
  };

  useEffect(() => {
    loadData();

    // Sincroniza logins e empresas do Supabase Cloud em segundo plano
    AuthService.syncFromSupabase()
      .then(res => {
        if (res.usersCount > 0 || res.companiesCount > 0) {
          loadData();
        }
      })
      .catch(() => {});

    const handleDataChanged = () => loadData();
    window.addEventListener('jvm-data-changed', handleDataChanged);
    return () => window.removeEventListener('jvm-data-changed', handleDataChanged);
  }, []);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId) || companies[0] || {
    id: 'comp-jvm',
    name: 'JVM Engenharia & Treinamentos',
    cnpj: '38.456.789/0001-12'
  };

  const filteredUsers = users.filter(u => 
    u.isMasterAdmin || (u.companyId || 'comp-jvm') === selectedCompanyId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await AuthService.loginAsync(email, password, selectedCompanyId, rememberMe);
      setIsLoading(false);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMessage(result.error || 'Credenciais inválidas. Verifique o e-mail, senha ou empresa selecionada.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Erro ao realizar login.');
    }
  };

  const handleSelectUser = (user: User) => {
    setEmail(user.email);
    setPassword(user.password || (user.isMasterAdmin ? MASTER_ADMIN_CONFIG.password : '123456'));
    if (user.companyId && companies.some(c => c.id === user.companyId)) {
      setSelectedCompanyId(user.companyId);
    }
    setErrorMessage(null);
    setActiveTab('credentials');
  };

  const handleDirectQuickLogin = (user: User) => {
    setIsLoading(true);
    setTimeout(() => {
      const result = AuthService.quickLogin(user, selectedCompanyId);
      setIsLoading(false);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      }
    }, 300);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    const newComp: Company = {
      id: 'comp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      name: newCompanyName.trim(),
      legalName: newCompanyName.trim(),
      cnpj: newCompanyCnpj.trim() || '00.000.000/0001-00',
      city: newCompanyCity.trim() || 'Campinas',
      state: newCompanyState.trim() || 'SP',
      phone: newCompanyPhone.trim(),
      email: newCompanyEmail.trim(),
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    DielectricStorageService.saveCompany(newComp);
    SupabaseService.autoPushToSupabase('companies', newComp).catch(() => {});

    setSelectedCompanyId(newComp.id);
    setShowNewCompanyModal(false);
    setNewCompanyName('');
    setNewCompanyCnpj('');
    setNewCompanyCity('');
    setNewCompanyPhone('');
    setNewCompanyEmail('');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    const newUser: User = {
      id: 'usr-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      companyId: selectedCompanyId,
      companyName: selectedCompany.name,
      name: newUserName.trim(),
      email: newUserEmail.trim().toLowerCase(),
      role: newUserRole,
      cargo: newUserRole === 'responsavel_tecnico' ? 'Engenheiro Eletricista / RT' : newUserRole === 'admin' ? 'Gerente / Administrador' : newUserRole === 'administrativo' ? 'Analista Administrativo' : 'Técnico Especialista em Ensaios',
      registrationNumber: newUserCrea.trim() || 'CFT/BR 12345',
      creaOrCft: newUserCrea.trim() || 'CFT/BR 12345',
      password: newUserPassword.trim() || '123456',
      active: true
    };

    DielectricStorageService.saveUser(newUser);
    SupabaseService.autoPushToSupabase('users', newUser).catch(() => {});

    setEmail(newUser.email);
    setPassword(newUser.password || '123456');
    setShowNewUserModal(false);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserCrea('');
    setNewUserPassword('123456');
    setActiveTab('credentials');
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'responsavel_tecnico': return 'Responsável Técnico';
      case 'admin': return 'Administrador / Gerente';
      case 'tecnico': return 'Técnico de Ensaios';
      case 'administrativo': return 'Administrativo';
      case 'cliente': return 'Visualizador / Cliente';
      default: return 'Usuário';
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center p-3 sm:p-6 relative overflow-x-hidden font-sans select-none">
      
      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Container */}
      <div className="w-full max-w-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl shadow-black/80 relative z-10 my-4">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-500/25 mb-3">
            <Zap className="w-8 h-8 fill-white stroke-orange-200" />
          </div>
          
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              DIELECTRIC <span className="text-orange-400 font-extrabold text-xs sm:text-sm px-2 py-0.5 rounded-md bg-orange-950/80 border border-orange-700/60 align-middle">MULTI-EMPRESA</span>
            </h1>
          </div>
          
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Acesso Unificado a Laboratórios, Ensaios Dielétricos e Certificação NR-10
          </p>
        </div>

        {/* Multi-Company Selector Card */}
        <div className="mb-5 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 relative">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-orange-400" />
              <span>Empresa / Laboratório Ativo</span>
            </label>
            <button
              type="button"
              onClick={() => setShowNewCompanyModal(true)}
              className="text-[11px] font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer transition-colors bg-orange-500/10 hover:bg-orange-500/20 px-2 py-0.5 rounded-md border border-orange-500/20"
            >
              <Plus className="w-3 h-3" />
              <span>Nova Empresa</span>
            </button>
          </div>

          <div className="relative">
            <select
              value={selectedCompanyId}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value);
                setErrorMessage(null);
              }}
              className="w-full pl-3.5 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 appearance-none cursor-pointer"
            >
              {companies.map((comp) => (
                <option key={comp.id} value={comp.id} className="bg-slate-900 text-white py-1">
                  {comp.name} {comp.cnpj ? `• CNPJ: ${comp.cnpj}` : ''}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>

          {/* Active Company Details badge */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="truncate">{selectedCompany.city ? `${selectedCompany.city}/${selectedCompany.state || 'BR'}` : 'Laboratório Operacional'}</span>
            </div>
            <span className="font-mono text-slate-400 shrink-0">CNPJ: {selectedCompany.cnpj || 'Sob Consulta'}</span>
          </div>
        </div>

        {/* Tab switcher: Direct Credentials vs Quick User Selector */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'credentials'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Login com Senha</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quick-users')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'quick-users'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Múltiplos Usuários ({filteredUsers.length})</span>
          </button>
        </div>

        {/* Tab 1: Credential Form */}
        {activeTab === 'credentials' && (
          <div>
            {/* Master Admin Notice Badge */}
            <div className="mb-4 p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-md bg-orange-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Crown className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-orange-300">Administrador Master</p>
                  <p className="text-[11px] text-slate-300 font-mono truncate max-w-[200px] sm:max-w-[250px]">
                    {MASTER_ADMIN_CONFIG.email}
                  </p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setEmail(MASTER_ADMIN_CONFIG.email);
                  setPassword(MASTER_ADMIN_CONFIG.password);
                  setSelectedCompanyId('comp-jvm');
                  setErrorMessage(null);
                }}
                className="text-[11px] font-bold text-orange-400 hover:text-orange-300 bg-orange-950/80 hover:bg-orange-900/80 px-2 py-1 rounded-md border border-orange-700/60 transition-all shrink-0 cursor-pointer active:scale-95"
              >
                Preencher
              </button>
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-950/80 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-100">Falha na autenticação</p>
                  <p className="text-red-300 mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              
              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  E-mail do Usuário
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@empresa.com.br"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Senha
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Padrão: <span className="text-orange-400 font-mono">123456</span> ou <span className="text-orange-400 font-mono">Jvm@141519</span>
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha de acesso"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 bg-slate-950 border-slate-700 focus:ring-orange-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <span className="text-xs text-slate-400 font-medium">Lembrar neste dispositivo</span>
                </label>
                
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Isolamento Ativo</span>
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Entrar em {selectedCompany.name.split(' ')[0]}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Quick Multi-User Selector */}
        {activeTab === 'quick-users' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400">
                Selecione um usuário para login direto ou preenchimento rápido:
              </p>
              <button
                type="button"
                onClick={() => setShowNewUserModal(true)}
                className="text-[11px] font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer bg-orange-500/10 hover:bg-orange-500/20 px-2 py-1 rounded-md border border-orange-500/20"
              >
                <Plus className="w-3 h-3" />
                <span>Novo Usuário</span>
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800">
                  <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold">Nenhum usuário cadastrado nesta empresa.</p>
                  <button
                    type="button"
                    onClick={() => setShowNewUserModal(true)}
                    className="mt-3 text-xs font-bold text-orange-400 hover:underline cursor-pointer"
                  >
                    + Cadastrar primeiro usuário
                  </button>
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isMaster = u.isMasterAdmin;
                  const isRT = u.role === 'responsavel_tecnico';
                  return (
                    <div
                      key={u.id}
                      className="p-3 bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-orange-500/40 rounded-xl flex items-center justify-between gap-3 transition-all group cursor-pointer"
                      onClick={() => handleSelectUser(u)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                          isMaster 
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs' 
                            : isRT 
                            ? 'bg-blue-600/30 text-blue-400 border border-blue-500/30' 
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {isMaster ? <Crown className="w-4 h-4" /> : isRT ? <FileCheck2 className="w-4 h-4" /> : <HardHat className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-white truncate">{u.name}</p>
                            {isMaster && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md">
                                Master
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{getRoleLabel(u.role)} • {u.email}</p>
                          {u.creaOrCft && (
                            <p className="text-[10px] text-orange-400/80 font-mono truncate">{u.creaOrCft}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDirectQuickLogin(u);
                          }}
                          className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                          title="Entrar imediatamente com este perfil"
                        >
                          <span>Entrar</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Multi-Tenant Scope Assurance Banner */}
        <div className="mt-5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5 text-left">
          <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <strong className="text-slate-300">Isolamento Multi-Empresa:</strong> Todos os ensaios, laudos, equipamentos, clientes e ordens de serviço ficam restritos e vinculados à empresa em operação.
          </p>
        </div>

        {/* Supabase Cloud Connection & SQL Button */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setShowSupabaseModal(true)}
            className="w-full py-2 px-3 rounded-xl bg-slate-950/80 hover:bg-slate-950 border border-emerald-500/30 hover:border-emerald-500/60 text-slate-300 hover:text-white transition-all flex items-center justify-between text-xs cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Database className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <span className="font-semibold text-emerald-300 block text-[11px]">Banco Supabase Cloud</span>
                <span className="text-[10px] text-slate-400">PostgreSQL • Multi-Empresa & Logins</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700/50 text-emerald-300 group-hover:bg-emerald-900 transition-colors">
              Configurar / SQL
            </span>
          </button>
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-400">
            {selectedCompany.name} • Laboratório de Ensaios Elétricos NR-10
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            NBR 16295 • IEC 60903 • ASTM F496 • NBR 10622 • NBR 14039
          </p>
        </div>

      </div>

      {/* Modal: Supabase Cloud Database */}
      {showSupabaseModal && (
        <SupabaseDatabaseModal
          isOpen={showSupabaseModal}
          onClose={() => setShowSupabaseModal(false)}
          onSyncComplete={() => loadData()}
        />
      )}

      {/* Modal: Nova Empresa / Laboratório */}
      {showNewCompanyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-600 text-white">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Cadastrar Nova Empresa</h3>
                  <p className="text-xs text-slate-400">Novo laboratório para segregação de ensaios</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewCompanyModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Razão Social / Nome da Empresa *</label>
                <input
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Ex: EletroVolt Ensaios Elétricos Ltda"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={newCompanyCnpj}
                    onChange={(e) => setNewCompanyCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={newCompanyPhone}
                    onChange={(e) => setNewCompanyPhone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={newCompanyCity}
                    onChange={(e) => setNewCompanyCity(e.target.value)}
                    placeholder="Ex: Campinas"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">UF</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={newCompanyState}
                    onChange={(e) => setNewCompanyState(e.target.value.toUpperCase())}
                    placeholder="SP"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-mono text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">E-mail de Contato</label>
                <input
                  type="email"
                  value={newCompanyEmail}
                  onChange={(e) => setNewCompanyEmail(e.target.value)}
                  placeholder="contato@eletrovolt.com.br"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewCompanyModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Salvar Empresa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Novo Usuário / Técnico */}
      {showNewUserModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-600 text-white">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Cadastrar Novo Usuário</h3>
                  <p className="text-xs text-slate-400">Vinculado a: {selectedCompany.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewUserModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ex: Carlos Mendes"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">E-mail de Login *</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="carlos.mendes@empresa.com.br"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Perfil / Função</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="tecnico">Técnico de Ensaios</option>
                    <option value="responsavel_tecnico">Responsável Técnico (RT)</option>
                    <option value="admin">Administrador / Gerente</option>
                    <option value="administrativo">Administrativo</option>
                    <option value="cliente">Cliente / Apenas Visualização</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Registro CREA / CFT</label>
                  <input
                    type="text"
                    value={newUserCrea}
                    onChange={(e) => setNewUserCrea(e.target.value)}
                    placeholder="CFT/SP 12345"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Senha de Acesso</label>
                <input
                  type="text"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cadastrar Usuário</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
