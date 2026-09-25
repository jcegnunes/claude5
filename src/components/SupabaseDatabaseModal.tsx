import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Server, 
  Download, 
  Copy, 
  Check, 
  Globe, 
  ShieldCheck, 
  Code, 
  RefreshCw, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  Key, 
  Eye,
  EyeOff,
  Save,
  X,
  UploadCloud,
  DownloadCloud,
  CheckCheck,
  Layers,
  ArrowRight,
  FileJson,
  FileCode
} from 'lucide-react';
import { 
  SupabaseService, 
  SupabaseConfig, 
  SupabaseConnectionResult, 
  DEFAULT_SUPABASE_CONFIG,
  SupabaseSyncStats,
  normalizeSupabaseUrl
} from '../services/supabaseService';
import { DielectricStorageService } from '../services/syncEngine';
import { CompanyLabInfo } from '../types';

interface SupabaseDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export const SupabaseDatabaseModal: React.FC<SupabaseDatabaseModalProps> = ({ 
  isOpen, 
  onClose,
  onSyncComplete 
}) => {
  const [config, setConfig] = useState<SupabaseConfig>(DEFAULT_SUPABASE_CONFIG);
  const [showAnonKey, setShowAnonKey] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'status' | 'schema' | 'config' | 'sync' | 'settings'>('status');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [testResult, setTestResult] = useState<SupabaseConnectionResult | null>(null);
  const [syncStats, setSyncStats] = useState<SupabaseSyncStats | null>(null);
  const [pullStats, setPullStats] = useState<{
    pulledCompanies: number;
    pulledUsers: number;
    pulledClients: number;
    pulledEquipment: number;
    pulledServiceOrders: number;
    pulledTests: number;
    pulledInstruments: number;
    totalPulled: number;
    errors: string[];
    syncedAt: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const currentConfig = SupabaseService.getConfig();
      setConfig(currentConfig);
      handleTestConnection(currentConfig);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sqlSchema = SupabaseService.generateSupabaseSchema();

  const configJsonObject = {
    projectId: 'cdtbzbshylrcprvmjpgc',
    projectRef: 'cdtbzbshylrcprvmjpgc',
    appName: 'JVM Dielectric Lab',
    supabaseUrl: config.url || 'https://cdtbzbshylrcprvmjpgc.supabase.co',
    restUrl: `${(config.url || 'https://cdtbzbshylrcprvmjpgc.supabase.co').replace(/\/+$/, '')}/rest/v1`,
    authUrl: `${(config.url || 'https://cdtbzbshylrcprvmjpgc.supabase.co').replace(/\/+$/, '')}/auth/v1`,
    storageUrl: `${(config.url || 'https://cdtbzbshylrcprvmjpgc.supabase.co').replace(/\/+$/, '')}/storage/v1`,
    graphqlUrl: `${(config.url || 'https://cdtbzbshylrcprvmjpgc.supabase.co').replace(/\/+$/, '')}/graphql/v1`,
    anonKey: config.anonKey,
    platform: 'web',
    database: {
      engine: 'PostgreSQL',
      version: '15',
      schemas: ['public'],
      tables: [
        'companies',
        'users',
        'clients',
        'equipment',
        'service_orders',
        'test_records',
        'lab_instruments'
      ]
    },
    features: {
      rowLevelSecurity: true,
      realtime: true,
      autoSync: config.autoSync ?? true,
      offlineFirst: true,
      bidirectionalSync: true
    }
  };

  const configJsonString = JSON.stringify(configJsonObject, null, 2);

  const configTomlString = `# ==============================================================================
# JVM Dielectric Lab - Supabase Project Configuration
# ==============================================================================
project_id = "cdtbzbshylrcprvmjpgc"

[api]
enabled = true
port = 54321
schemas = ["public", "storage", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 15

[auth]
enabled = true
site_url = "${config.url || 'https://cdtbzbshylrcprvmjpgc.supabase.co'}"
jwt_expiry = 3600
enable_signup = true

[storage]
enabled = true
file_size_limit = "50MiB"
`;

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 3000);
  };

  const handleDownloadSQL = () => {
    const blob = new Blob([sqlSchema], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema_supabase_jvm_dielectric.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadConfigJson = () => {
    const blob = new Blob([configJsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supabase-applet-config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadConfigToml = () => {
    const blob = new Blob([configTomlString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config.toml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTestConnection = async (customCfg?: SupabaseConfig) => {
    setIsTesting(true);
    try {
      const res = await SupabaseService.testConnection(customCfg || config);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        url: config.url,
        message: err.message || 'Falha ao testar conexão',
        isReady: false
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = () => {
    const company = DielectricStorageService.getCompanyInfo();
    const updatedCompany: CompanyLabInfo = {
      ...company,
      supabaseUrl: normalizeSupabaseUrl(config.url),
      supabaseAnonKey: config.anonKey.trim(),
      supabaseAutoSync: config.autoSync,
      supabaseEnabled: config.enabled
    };
    DielectricStorageService.saveCompanyInfo(updatedCompany);
    setSaveSuccessMsg('Configurações do Supabase salvas com sucesso!');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
    handleTestConnection();
  };

  const handleExecuteFullSync = async () => {
    setIsSyncing(true);
    try {
      const stats = await SupabaseService.syncAllToSupabase();
      setSyncStats(stats);
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setSyncStats({
        companiesUploaded: 0,
        usersUploaded: 0,
        clientsUploaded: 0,
        equipmentUploaded: 0,
        testsUploaded: 0,
        ordersUploaded: 0,
        instrumentsUploaded: 0,
        errors: [err.message || 'Falha na sincronização'],
        syncedAt: new Date().toISOString()
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExecutePullSync = async () => {
    setIsPulling(true);
    try {
      const stats = await SupabaseService.pullFromSupabase({ full: true });
      setPullStats({
        ...stats,
        syncedAt: new Date().toISOString()
      });
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setPullStats({
        pulledCompanies: 0,
        pulledUsers: 0,
        pulledClients: 0,
        pulledEquipment: 0,
        pulledServiceOrders: 0,
        pulledTests: 0,
        pulledInstruments: 0,
        totalPulled: 0,
        errors: [err.message || 'Falha ao baixar dados do Supabase'],
        syncedAt: new Date().toISOString()
      });
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">Integração Supabase Cloud Database</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  PostgreSQL Cloud
                </span>
              </div>
              <p className="text-xs text-emerald-200/80">
                Sincronização em tempo real de Laudos, Clientes, EPIs e Ordens de Serviço
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'status'
                ? 'bg-white border-emerald-600 text-emerald-800 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Status & Conexão
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'sync'
                ? 'bg-white border-emerald-600 text-emerald-800 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Sincronizar Dados
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'schema'
                ? 'bg-white border-emerald-600 text-emerald-800 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Script SQL (DDL)
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'config'
                ? 'bg-white border-emerald-600 text-emerald-800 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            Arquivo de Configuração
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'settings'
                ? 'bg-white border-emerald-600 text-emerald-800 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            Credenciais & Chaves
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB: STATUS & CONEXÃO */}
          {activeTab === 'status' && (
            <div className="space-y-6">
              {/* Connection Status Card */}
              <div className={`p-5 rounded-2xl border ${
                testResult?.success 
                  ? 'bg-emerald-50/80 border-emerald-200' 
                  : testResult 
                  ? 'bg-amber-50/80 border-amber-200' 
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      testResult?.success 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'bg-amber-500 text-white'
                    }`}>
                      {testResult?.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">
                          {testResult?.success ? 'Conexão Supabase Ativa' : 'Verificando Conexão Supabase'}
                        </h4>
                        {testResult?.latencyMs ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 shadow-2xs">
                            {testResult.latencyMs} ms
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {testResult?.message || 'Clique no botão abaixo para testar a comunicação com seu projeto Supabase.'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTestConnection()}
                    disabled={isTesting}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-xs shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    {isTesting ? 'Testando...' : 'Testar Conexão'}
                  </button>
                </div>
              </div>

              {/* Endpoint Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    Project URL (Endpoint)
                  </div>
                  <div className="font-mono text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-800 break-all select-all">
                    {config.url}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Endpoint REST normalizado e compatível
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Key className="w-4 h-4 text-emerald-600" />
                    Anon Public Key
                  </div>
                  <div className="font-mono text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-800 truncate select-all flex items-center justify-between">
                    <span>
                      {showAnonKey ? config.anonKey : (config.anonKey.slice(0, 14) + '••••••••••••••••••••••••' + config.anonKey.slice(-6))}
                    </span>
                    <button 
                      onClick={() => setShowAnonKey(!showAnonKey)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      {showAnonKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Chave segura de publicação (RLS ativado)
                  </div>
                </div>
              </div>

              {/* Ready Status / Quick Action */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Próximo Passo Recomendado
                  </h5>
                  <p className="text-xs text-slate-600 mt-1">
                    {testResult?.isReady 
                      ? 'O banco de dados está pronto para sincronização. Clique em "Sincronizar Dados" para enviar os ensaios e laudos.' 
                      : 'Execute o script SQL no painel do Supabase para criar as tabelas com RLS e índices otimizados.'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab(testResult?.isReady ? 'sync' : 'schema')}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-xs shrink-0"
                >
                  <span>{testResult?.isReady ? 'Ir para Sincronização' : 'Abrir Script SQL'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB: SINCRONIZAR DADOS */}
          {activeTab === 'sync' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Sincronização Bidirecional com Supabase</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Transfira dados entre este dispositivo e o banco de dados PostgreSQL na nuvem Supabase.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleExecutePullSync}
                      disabled={isPulling || isSyncing}
                      className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-xs shrink-0 disabled:opacity-50"
                      title="Baixa dados do Supabase e atualiza empresas, usuários, laudos e clientes na plataforma"
                    >
                      <DownloadCloud className={`w-4 h-4 ${isPulling ? 'animate-bounce' : ''}`} />
                      {isPulling ? 'Atualizando...' : 'Baixar do Supabase (Pull)'}
                    </button>
                    <button
                      onClick={handleExecuteFullSync}
                      disabled={isSyncing || isPulling}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-xs shrink-0 disabled:opacity-50"
                      title="Envia empresas, usuários, laudos e equipamentos locais para o banco Supabase"
                    >
                      <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                      {isSyncing ? 'Enviando...' : 'Enviar para Nuvem (Push)'}
                    </button>
                  </div>
                </div>

                {/* Local Inventory Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="block text-lg font-black text-slate-800">
                      {DielectricStorageService.getCompanies().length}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Empresas</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="block text-lg font-black text-slate-800">
                      {DielectricStorageService.getUsers('ALL').length}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Usuários</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="block text-lg font-black text-slate-800">
                      {DielectricStorageService.getClients().length}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Clientes</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="block text-lg font-black text-slate-800">
                      {DielectricStorageService.getEquipment().length}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">EPIs / Equip.</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="block text-lg font-black text-slate-800">
                      {DielectricStorageService.getServiceOrders().length}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Ordens Serv.</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="block text-lg font-black text-emerald-700">
                      {DielectricStorageService.getTests().length}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 uppercase">Laudos</span>
                  </div>
                </div>
              </div>

              {/* Pull Results Card (Plataforma Atualizada) */}
              {pullStats && (
                <div className={`p-5 rounded-2xl border ${
                  pullStats.errors.length === 0 
                    ? 'bg-teal-50/70 border-teal-200' 
                    : 'bg-amber-50/70 border-amber-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      pullStats.errors.length === 0 ? 'bg-teal-600 text-white' : 'bg-amber-600 text-white'
                    }`}>
                      <CheckCheck className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-slate-900 text-sm">
                          Plataforma Atualizada com Dados do Supabase
                        </h5>
                        <span className="text-[10px] text-teal-800 font-semibold bg-teal-100/70 px-2 py-0.5 rounded">
                          Total: {pullStats.totalPulled} registros
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Os dados inseridos no banco de dados Supabase foram aplicados na aplicação local com sucesso.
                      </p>
                      <div className="mt-2 text-xs text-slate-700 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200 text-center">
                          <strong className="block text-teal-900">{pullStats.pulledCompanies}</strong>
                          <span className="text-[10px] text-slate-500">Empresas</span>
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200 text-center">
                          <strong className="block text-teal-900">{pullStats.pulledUsers}</strong>
                          <span className="text-[10px] text-slate-500">Usuários</span>
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200 text-center">
                          <strong className="block text-teal-900">{pullStats.pulledClients}</strong>
                          <span className="text-[10px] text-slate-500">Clientes</span>
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200 text-center">
                          <strong className="block text-teal-900">{pullStats.pulledEquipment}</strong>
                          <span className="text-[10px] text-slate-500">EPIs</span>
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200 text-center">
                          <strong className="block text-teal-900">{pullStats.pulledServiceOrders}</strong>
                          <span className="text-[10px] text-slate-500">Ordens</span>
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200 text-center">
                          <strong className="block text-teal-900">{pullStats.pulledTests}</strong>
                          <span className="text-[10px] text-slate-500">Laudos</span>
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200 text-center">
                          <strong className="block text-teal-900">{pullStats.pulledInstruments}</strong>
                          <span className="text-[10px] text-slate-500">Instrumentos</span>
                        </div>
                      </div>

                      {pullStats.errors.length > 0 && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-1">
                          <strong>Avisos durante download:</strong>
                          {pullStats.errors.map((err, i) => (
                            <div key={i}>• {err}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sync Results Card */}
              {syncStats && (
                <div className={`p-5 rounded-2xl border ${
                  syncStats.errors.length === 0 
                    ? 'bg-emerald-50/70 border-emerald-200' 
                    : 'bg-amber-50/70 border-amber-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      syncStats.errors.length === 0 ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                    }`}>
                      <CheckCheck className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-bold text-slate-900 text-sm">
                        {syncStats.errors.length === 0 
                          ? 'Sincronização com Supabase Concluída!' 
                          : 'Sincronização Realizada com Alertas'}
                      </h5>
                      <div className="mt-2 text-xs text-slate-700 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200">
                          <strong>{syncStats.companiesUploaded}</strong> empresas
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200">
                          <strong>{syncStats.usersUploaded}</strong> usuários
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200">
                          <strong>{syncStats.clientsUploaded}</strong> clientes
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200">
                          <strong>{syncStats.equipmentUploaded}</strong> equipamentos
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200">
                          <strong>{syncStats.ordersUploaded}</strong> ordens de serviço
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg border border-slate-200">
                          <strong>{syncStats.testsUploaded}</strong> laudos
                        </div>
                      </div>

                      {syncStats.errors.length > 0 && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-1">
                          <strong>Avisos durante envio:</strong>
                          {syncStats.errors.map((err, i) => (
                            <div key={i}>• {err}</div>
                          ))}
                          <div className="mt-2 text-[11px] text-red-600">
                            Dica: se alguma tabela ainda não existe no Supabase, execute o Script SQL na aba "Script SQL (DDL)".
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: SCRIPT SQL */}
          {activeTab === 'schema' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                    Script DDL para PostgreSQL no Supabase SQL Editor
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Cria as tabelas <code className="font-mono text-emerald-800">clients</code>, <code className="font-mono text-emerald-800">equipment</code>, <code className="font-mono text-emerald-800">service_orders</code>, <code className="font-mono text-emerald-800">test_records</code> e <code className="font-mono text-emerald-800">lab_instruments</code> com índices e políticas de segurança RLS.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopy(sqlSchema, 'schema')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    {copiedSection === 'schema' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedSection === 'schema' ? 'Copiado!' : 'Copiar SQL'}
                  </button>
                  <button
                    onClick={handleDownloadSQL}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar .sql
                  </button>
                </div>
              </div>

              {/* Instructions steps */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                <span className="font-bold text-emerald-800">Como aplicar:</span>
                <span>1. Acesse o painel do Supabase</span>
                <span>→</span>
                <span>2. Vá em <strong>SQL Editor</strong></span>
                <span>→</span>
                <span>3. Cole o script e clique em <strong>Run</strong>.</span>
              </div>

              {/* SQL Code View */}
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-xs text-emerald-400 p-4 max-h-[380px] overflow-y-auto">
                <pre>{sqlSchema}</pre>
              </div>
            </div>
          )}

          {/* TAB: ARQUIVO DE CONFIGURAÇÃO (JSON / TOML) */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 rounded-2xl border border-emerald-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <FileJson className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Arquivos de Configuração do Supabase
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        Estrutura oficial do projeto contendo Project ID, URLs de API e schemas PostgreSQL.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadConfigJson}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar JSON</span>
                    </button>
                    <button
                      onClick={handleDownloadConfigToml}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar config.toml</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Endpoint Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Project Reference</span>
                  <span className="font-mono text-xs font-bold text-emerald-800">cdtbzbshylrcprvmjpgc</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">REST API v1</span>
                  <span className="font-mono text-[11px] text-slate-700 truncate block">/rest/v1</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">PostgreSQL Engine</span>
                  <span className="font-mono text-xs font-bold text-teal-800">v15 (Cloud Managed)</span>
                </div>
              </div>

              {/* JSON File Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800">supabase-applet-config.json</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-mono">
                      Raiz do Projeto
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(configJsonString, 'config-json')}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                    >
                      {copiedSection === 'config-json' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSection === 'config-json' ? 'Copiado!' : 'Copiar JSON'}</span>
                    </button>
                  </div>
                </div>

                <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-xs text-emerald-400 p-4 max-h-[250px] overflow-y-auto">
                  <pre>{configJsonString}</pre>
                </div>
              </div>

              {/* TOML File Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800">supabase/config.toml</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-mono">
                      Supabase CLI
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(configTomlString, 'config-toml')}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                    >
                      {copiedSection === 'config-toml' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSection === 'config-toml' ? 'Copiado!' : 'Copiar TOML'}</span>
                    </button>
                  </div>
                </div>

                <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-xs text-teal-300 p-4 max-h-[220px] overflow-y-auto">
                  <pre>{configTomlString}</pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CREDENCIAIS & CONFIGURAÇÕES */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {saveSuccessMsg}
                </div>
              )}

              <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={config.url}
                    onChange={(e) => setConfig({ ...config, url: e.target.value })}
                    placeholder="https://cdtbzbshylrcprvmjpgc.supabase.co"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    URL do seu projeto no Supabase (aceita formato padrão ou /rest/v1/).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supabase Anon Public Key (Publishable)
                  </label>
                  <div className="relative">
                    <input
                      type={showAnonKey ? 'text' : 'password'}
                      value={config.anonKey}
                      onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
                      placeholder="sb_publishable_..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAnonKey(!showAnonKey)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showAnonKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Chave pública anônima do projeto com permissões RLS.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.autoSync ?? true}
                      onChange={(e) => setConfig({ ...config, autoSync: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Sincronização Automática ao salvar novos laudos e EPIs
                    </span>
                  </label>

                  <button
                    onClick={handleSaveConfig}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-full ${testResult?.success ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span>Supabase: {config.url.replace('https://', '')}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
