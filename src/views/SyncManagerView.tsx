import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Database, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Server, 
  Smartphone, 
  Layers, 
  GitMerge, 
  Trash2, 
  Send,
  HardDrive,
  Globe,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  Check,
  ExternalLink,
  Shield,
  Download,
  Settings,
  Sparkles,
  FileCheck,
  UploadCloud
} from 'lucide-react';
import { DielectricStorageService, SyncQueueItem, getDeviceId } from '../services/syncEngine';
import { ValidationPortalService, DEFAULT_VALIDATION_BASE_URL, PortalConnectionResult } from '../services/validationPortalService';
import { SupabaseService, SupabaseConnectionResult } from '../services/supabaseService';
import { SupabaseDatabaseModal } from '../components/SupabaseDatabaseModal';
import { CompleteBackupModal } from '../components/CompleteBackupModal';
import { FolderArchive } from 'lucide-react';

interface SyncManagerViewProps {
  isOnline: boolean;
  onToggleOnline: () => void;
  onManualSync: () => Promise<void>;
  isSyncing: boolean;
}

export const SyncManagerView: React.FC<SyncManagerViewProps> = ({
  isOnline,
  onToggleOnline,
  onManualSync,
  isSyncing
}) => {
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Ainda não sincronizado');
  const [syncLogs, setSyncLogs] = useState<string[]>([
    'Iniciando verificação de integridade local...',
    'Cache offline do aparelho operacional (fila de envio ativa).',
    `Banco de dados Supabase configurado: ${SupabaseService.getConfig().url}`,
    'Sincronização bidirecional ativa (envio automático + Realtime).'
  ]);

  // Portal Público de Validação (QR Code) — hospedagem do app, sem banco próprio
  const [portalUrl, setPortalUrl] = useState<string>(DEFAULT_VALIDATION_BASE_URL);
  const [isTestingPortal, setIsTestingPortal] = useState<boolean>(false);
  const [portalStatus, setPortalStatus] = useState<PortalConnectionResult | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCompleteBackupOpen, setIsCompleteBackupOpen] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  // Supabase Connection State
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [isTestingSupabase, setIsTestingSupabase] = useState<boolean>(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState<boolean>(false);
  const [isPullingSupabase, setIsPullingSupabase] = useState<boolean>(false);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConnectionResult | null>(null);

  const company = DielectricStorageService.getCompanyInfo();

  const loadData = () => {
    const q = DielectricStorageService.getSyncQueue().filter(item => item.entityType !== 'audit');
    setQueue(q);
    const info = DielectricStorageService.getCompanyInfo();
    setPortalUrl(info.validationBaseUrl || DEFAULT_VALIDATION_BASE_URL);
    if (info.lastSupabaseSyncTime) {
      const d = new Date(info.lastSupabaseSyncTime);
      setLastSyncTime(`${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`);
    }
  };

  useEffect(() => {
    loadData();
    // Testa a conexão com o Supabase e o portal público em segundo plano
    testSupabaseConn();
    testPortalConn();
    const onDataChanged = () => loadData();
    window.addEventListener('jvm-data-changed', onDataChanged);
    return () => window.removeEventListener('jvm-data-changed', onDataChanged);
  }, []);

  const testSupabaseConn = async () => {
    setIsTestingSupabase(true);
    try {
      const res = await SupabaseService.testConnection();
      setSupabaseStatus(res);
      setSyncLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Ping Supabase (${res.url.replace('https://', '')}): ${res.success ? `Ativo (${res.latencyMs}ms)` : `Aviso (${res.message})`}`
      ]);
    } catch (err: any) {
      setSupabaseStatus({
        success: false,
        latencyMs: 0,
        url: SupabaseService.getConfig().url,
        message: err.message || 'Falha ao conectar ao Supabase',
        isReady: false
      });
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleSyncSupabase = async () => {
    if (!isOnline) {
      setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Aviso: Dispositivo em modo offline.`]);
      return;
    }
    setIsSyncingSupabase(true);
    setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Reenviando a base local completa ao Supabase (fotos para o Storage)...`]);

    try {
      const stats = await SupabaseService.syncAllToSupabase();
      if (stats.errors.length === 0) {
        setSyncLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] SUPABASE OK: ${stats.companiesUploaded || 0} empresas, ${stats.usersUploaded || 0} usuários, ${stats.clientsUploaded} clientes, ${stats.equipmentUploaded} EPIs, ${stats.ordersUploaded} OS, ${stats.testsUploaded} laudos e ${stats.instrumentsUploaded} instrumentos sincronizados.`
        ]);
        setSaveSuccessMsg(`Supabase: ${stats.companiesUploaded || 0} empresas, ${stats.clientsUploaded} clientes, ${stats.equipmentUploaded} EPIs, ${stats.ordersUploaded} OS e ${stats.testsUploaded} laudos enviados com sucesso!`);
      } else {
        setSyncLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] SUPABASE: ${stats.companiesUploaded + stats.usersUploaded + stats.clientsUploaded + stats.equipmentUploaded + stats.ordersUploaded + stats.testsUploaded + stats.instrumentsUploaded} registros enviados. Avisos: ${stats.errors.join(' | ')}`
        ]);
        setSaveSuccessMsg(`Sincronização realizada (${stats.equipmentUploaded} EPIs, ${stats.testsUploaded} laudos). Alguns registros reportaram avisos.`);
      }
      setTimeout(() => setSaveSuccessMsg(''), 5000);
      loadData();
      testSupabaseConn();
    } catch (err: any) {
      setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Erro no sync Supabase: ${err.message || err}`]);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handlePullSupabase = async () => {
    if (!isOnline) {
      setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Aviso: Dispositivo em modo offline.`]);
      return;
    }
    setIsPullingSupabase(true);
    setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Baixando dados atualizados do Supabase Cloud (Empresas, Usuários, Clientes, EPIs, OS, Ensaios)...`]);

    try {
      const stats = await SupabaseService.pullFromSupabase({ full: true });
      if (stats.errors.length === 0) {
        setSyncLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] SUPABASE PULL OK: ${stats.totalPulled} registros obtidos (${stats.pulledCompanies} empresas, ${stats.pulledUsers} usuários, ${stats.pulledClients} clientes, ${stats.pulledEquipment} EPIs, ${stats.pulledServiceOrders} OS, ${stats.pulledTests} laudos, ${stats.pulledInstruments} instrumentos).`
        ]);
        setSaveSuccessMsg(`Plataforma atualizada com sucesso: ${stats.totalPulled} registros sincronizados do Supabase!`);
      } else {
        setSyncLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] SUPABASE PULL: ${stats.totalPulled} registros obtidos com avisos: ${stats.errors.join(' | ')}`
        ]);
        setSaveSuccessMsg(`Plataforma atualizada: ${stats.totalPulled} registros obtidos do Supabase.`);
      }
      setTimeout(() => setSaveSuccessMsg(''), 5000);
      loadData();
    } catch (err: any) {
      setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Erro no download do Supabase: ${err.message || err}`]);
    } finally {
      setIsPullingSupabase(false);
    }
  };

  const testPortalConn = async (urlToTest?: string) => {
    setIsTestingPortal(true);
    try {
      const res = await ValidationPortalService.testPortal(urlToTest || portalUrl);
      setPortalStatus(res);
      setSyncLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Portal de validação (${res.url.replace('https://', '')}): ${res.success ? `Ativo (${res.latencyMs}ms)` : `Aviso (${res.message})`}`
      ]);
    } finally {
      setIsTestingPortal(false);
    }
  };

  /** Sincronização com o Supabase: 'push' envia a fila, 'pull' baixa alterações, 'all' faz os dois. */
  const handleSyncCloud = async (mode: 'push' | 'pull' | 'all' = 'all') => {
    if (!isOnline) {
      setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Aviso: Dispositivo em modo offline.`]);
      return;
    }
    setIsSyncingCloud(true);
    setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Iniciando sincronização (${mode.toUpperCase()}) com o Supabase...`]);

    try {
      if (mode === 'push') {
        const res = await SupabaseService.flushQueue({ force: true });
        setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] PUSH: ${res.pushed} registro(s) enviado(s), ${res.details.photos} foto(s) no Storage${res.failed ? `, ${res.failed} com falha (nova tentativa automática)` : ''}.${res.errors.length ? ' ' + res.errors.slice(0, 2).join(' | ') : ''}`]);
      } else if (mode === 'pull') {
        const res = await SupabaseService.pullFromSupabase();
        setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] PULL: ${res.totalPulled} registro(s) recebido(s) (${res.pulledTests} ensaios, ${res.pulledEquipment} EPIs, ${res.pulledServiceOrders} OS).${res.errors.length ? ' Avisos: ' + res.errors.slice(0, 2).join(' | ') : ''}`]);
      } else {
        await onManualSync();
        setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] SYNC TOTAL concluído com o Supabase.`]);
      }

      loadData();
      setLastSyncTime(`Agora (${new Date().toLocaleTimeString()})`);
    } catch (err: any) {
      setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Erro na sincronização: ${err.message || err}`]);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleSaveSettings = () => {
    const info = DielectricStorageService.getCompanyInfo();
    const updated = {
      ...info,
      validationBaseUrl: portalUrl.trim() || DEFAULT_VALIDATION_BASE_URL
    };
    DielectricStorageService.saveCompanyInfo(updated);
    setSaveSuccessMsg('Endereço do portal público de validação salvo com sucesso!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
    setIsSettingsOpen(false);
    testPortalConn(updated.validationBaseUrl);
  };

  const handleClearQueue = () => {
    if (!window.confirm('Limpar a fila descarta o envio dos registros pendentes ao Supabase. Deseja continuar?')) return;
    DielectricStorageService.clearSyncQueue();
    loadData();
    setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Fila de sincronização zerada manualmente.`]);
  };

  const handleExportJson = () => {
    const jsonStr = DielectricStorageService.exportFullBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jvm-supabase-sync-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Pacote JSON completo exportado.`]);
  };

  const portalHost = portalUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const supabaseHost = SupabaseService.getConfig().url.replace(/^https?:\/\//, '');

  const tests = DielectricStorageService.getTests();
  const equipment = DielectricStorageService.getEquipment();
  const serviceOrders = DielectricStorageService.getServiceOrders();
  const clients = DielectricStorageService.getClients();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Central de Sincronização & Nuvem Supabase</h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Globe className="w-3 h-3 text-blue-600" /> Supabase Ativo
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Sincronização bidirecional em tempo real entre o app móvel/desktop e o banco de dados central Supabase.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={onToggleOnline}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              isOnline
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-red-50 border-red-300 text-red-800'
            }`}
          >
            {isOnline ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-red-600" />}
            {isOnline ? 'Online (Conectado)' : 'Offline (Simulado)'}
          </button>

          <button
            onClick={() => setIsSupabaseModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Supabase Cloud (PostgreSQL)</span>
          </button>

          <button
            onClick={() => setIsCompleteBackupOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Backup completo com todas as fotos e evidências em arquivo ZIP"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Backup com Fotos (.ZIP)</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            Configurar URL
          </button>

          <button
            onClick={() => handleSyncCloud('all')}
            disabled={isSyncing || isSyncingCloud}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${(isSyncing || isSyncingCloud) ? 'animate-spin' : ''}`} />
            {isSyncing || isSyncingCloud ? 'Sincronizando...' : 'Sincronizar com Supabase'}
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Supabase Cloud Database Hero Card */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-emerald-500/30 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        {/* Left: Project Info */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0 shadow-inner">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Banco de Dados Cloud</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Supabase
              </span>
            </div>
            <h4 className="font-bold text-sm text-slate-100">PostgreSQL JVM Dielectric Lab</h4>
            <a 
              href={SupabaseService.getConfig().url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1 mt-0.5"
            >
              <span>{supabaseHost}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </div>

        {/* Center: Real-time Status & Ping */}
        <div className="flex flex-col items-center justify-center text-center py-2 lg:border-x border-slate-800 px-4">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${supabaseStatus?.success ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400'}`} />
            <span className="text-xs font-bold text-slate-100">
              {supabaseStatus?.success ? 'Conexão Supabase Ativa' : 'Supabase Configurado'}
            </span>
            {supabaseStatus?.latencyMs ? (
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                {supabaseStatus.latencyMs}ms
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {supabaseStatus?.message || 'Pronto para sincronização bidirecional'}
          </p>

          <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
            <button
              onClick={() => handlePullSupabase()}
              disabled={isPullingSupabase || isSyncingSupabase}
              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold border border-teal-500 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Baixar dados do banco Supabase e atualizar a plataforma"
            >
              <ArrowDownLeft className={`w-3.5 h-3.5 ${isPullingSupabase ? 'animate-bounce' : ''}`} />
              <span>{isPullingSupabase ? 'Baixando...' : 'Baixar (Pull)'}</span>
            </button>
            <button
              onClick={() => handleSyncSupabase()}
              disabled={isSyncingSupabase || isPullingSupabase}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold border border-emerald-500 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Enviar dados locais para o banco Supabase"
            >
              <UploadCloud className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-bounce' : ''}`} />
              <span>{isSyncingSupabase ? 'Enviando...' : 'Enviar (Push)'}</span>
            </button>
            <button
              onClick={() => testSupabaseConn()}
              disabled={isTestingSupabase}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isTestingSupabase ? 'animate-spin' : ''}`} />
              <span>{isTestingSupabase ? 'Testando...' : 'Ping'}</span>
            </button>
          </div>
        </div>

        {/* Right: SQL & Management */}
        <div className="flex items-center gap-3.5 justify-start lg:justify-end">
          <div className="text-left lg:text-right space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">DDL & Tabelas PostgreSQL</span>
            <div className="text-xs text-slate-300">
              clients • equipment • test_records • service_orders • norms
            </div>
            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-bold bg-emerald-950/60 hover:bg-emerald-900/80 px-3 py-1.5 rounded-lg border border-emerald-500/30 transition-all cursor-pointer mt-1"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Abrir Gerenciador & Script SQL</span>
            </button>
          </div>
        </div>
      </div>

      {/* Topologia: Aparelho -> Supabase -> Portal Público */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        {/* Left: Device Info */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Armazenamento Local</span>
            <h4 className="font-bold text-sm text-slate-100">Dispositivo / App Campo</h4>
            <p className="text-[11px] text-slate-400 font-mono">ID: {getDeviceId().substring(0, 14)}...</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-medium">Cache Offline + Fila Ativa</span>
            </div>
          </div>
        </div>

        {/* Center: Sync Pipeline */}
        <div className="flex flex-col items-center justify-center text-center py-2 lg:border-x border-slate-800 px-4">
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-5 h-5 text-blue-400 ${(isSyncing || isSyncingCloud) ? 'animate-spin' : ''}`} />
            <span className="text-xs font-bold text-slate-100">
              {queue.length > 0 ? `${queue.length} alterações na fila local` : 'Dados 100% Sincronizados'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Último Sync: {lastSyncTime}</span>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => handleSyncCloud('push')}
              disabled={isSyncingCloud}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-lg text-[10px] font-bold border border-slate-700 flex items-center gap-1 transition-colors"
              title="Enviar a fila local para o Supabase"
            >
              <ArrowUpRight className="w-3 h-3 text-blue-400" /> Enviar (Push)
            </button>
            <button
              onClick={() => handleSyncCloud('pull')}
              disabled={isSyncingCloud}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg text-[10px] font-bold border border-slate-700 flex items-center gap-1 transition-colors"
              title="Receber novos registros do Supabase"
            >
              <ArrowDownLeft className="w-3 h-3 text-emerald-400" /> Baixar (Pull)
            </button>
          </div>
        </div>

        {/* Right: Portal Público de Validação (QR Code) */}
        <div className="flex items-center gap-3.5 justify-start lg:justify-end">
          <div className="text-left lg:text-right">
            <div className="flex items-center gap-1.5 justify-start lg:justify-end">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Portal Público (QR Code)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h4 className="font-bold text-sm text-slate-100">Validação de Laudos</h4>
            <a 
              href={portalUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[11px] text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 justify-start lg:justify-end break-all"
            >
              <span>{portalHost}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
            <div className="mt-1 flex items-center gap-2 justify-start lg:justify-end">
              <button
                onClick={() => testPortalConn()}
                disabled={isTestingPortal}
                className="text-[10px] text-slate-300 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 transition-colors"
              >
                {isTestingPortal ? 'Testando...' : (portalStatus?.latencyMs ? `Ping: ${portalStatus.latencyMs}ms` : 'Testar Conexão')}
              </button>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold shrink-0">
            <Globe className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Synchronized Records Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Ensaios & Laudos</span>
            <FileCheck className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2">{tests.length}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Sincronização habilitada</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Equipamentos / Tags</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2">{equipment.length}</p>
          <span className="text-[10px] text-slate-400 font-mono">Com QR / Niimbot</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Ordens de Serviço</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2">{serviceOrders.length}</p>
          <span className="text-[10px] text-slate-400">Fluxo de aprovação</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Clientes & Empresas</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2">{clients.length}</p>
          <span className="text-[10px] text-slate-400">Cadastro central</span>
        </div>
      </div>

      {/* Pending Queue & Console Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Mutations Queue */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Fila de Mutações Locais ({queue.length})</h3>
                <p className="text-xs text-slate-500">Alterações realizadas em campo aguardando envio ao Supabase</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportJson}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                  title="Baixar pacote JSON completo"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar JSON
                </button>
                {queue.length > 0 && (
                  <button
                    onClick={handleClearQueue}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                    title="Limpar fila"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Limpar
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
              {queue.length > 0 ? (
                queue.map(item => (
                  <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold uppercase text-[10px] px-1.5 py-0.5 rounded-sm ${
                          item.action === 'create' ? 'bg-emerald-100 text-emerald-800' :
                          item.action === 'update' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {item.action}
                        </span>
                        <span className="font-bold text-slate-900 uppercase font-mono">{item.entityType}</span>
                      </div>
                      <span className="text-slate-500 text-[11px] block mt-0.5">ID: {item.entityId}</span>
                      {item.lastError && (
                        <span className="text-amber-700 text-[10px] block mt-0.5 break-all">
                          Tentativa {item.retryCount}: {item.lastError}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-medium text-slate-600">Fila limpa! Todos os dados locais estão sincronizados com a nuvem.</p>
                  <p className="text-[11px] text-slate-400">Qualquer laudo ou ensaio salvo no tablet/computador é consolidado automaticamente.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Criptografia e integridade SHA-256
            </span>
            <span className="font-mono text-[11px]">{supabaseHost}</span>
          </div>
        </div>

        {/* Sync Console Output */}
        <div className="bg-slate-950 text-slate-300 rounded-2xl p-5 border border-slate-800 font-mono text-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Console de Sincronização Supabase
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="text-[10px] text-slate-500 font-sans">v3.4.0</span>
            </div>

            <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto text-[11px]">
              {syncLogs.map((log, index) => (
                <div key={index} className="text-slate-300 flex items-start gap-1.5">
                  <span className="text-blue-400 select-none">supabase-sync&gt;</span> 
                  <span className="break-all">{log}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <span>Status API: {supabaseStatus?.success ? '🟢 Conectado' : '🟡 Verificando'}</span>
            <span>Target: {supabaseHost.split('.')[0]}</span>
          </div>
        </div>
      </div>

      {/* Portal Público de Validação - Configuração */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Portal Público de Validação</h3>
                  <p className="text-xs text-slate-500">Endereço do app usado nos QR Codes dos laudos e certificados</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  URL do Portal de Validação (Domínio Oficial)
                </label>
                <input
                  type="text"
                  value={portalUrl}
                  onChange={(e) => setPortalUrl(e.target.value)}
                  placeholder="https://mediumvioletred-bison-595566.hostingersite.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  URL padrão: <span className="font-mono text-blue-600">{DEFAULT_VALIDATION_BASE_URL}</span>
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                <p className="font-bold text-[11px] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Validação Pública de Laudos & QR Codes
                </p>
                <p className="text-[10px] text-blue-700 leading-relaxed">
                  Os QR Codes gerados nas etiquetas térmicas Niimbot e nos certificados PDF apontarão para este domínio ({portalUrl}/validar/...). A consulta do laudo é feita diretamente no banco de dados Supabase.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPortalUrl(DEFAULT_VALIDATION_BASE_URL);
                }}
                className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Restaurar Padrão
              </button>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Database & SQL Modal */}
      <SupabaseDatabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onSyncComplete={loadData}
      />

      {/* Complete Backup Modal with Photos */}
      <CompleteBackupModal
        isOpen={isCompleteBackupOpen}
        onClose={() => {
          setIsCompleteBackupOpen(false);
          loadData();
        }}
        initialTab="export"
      />
    </div>
  );
};
