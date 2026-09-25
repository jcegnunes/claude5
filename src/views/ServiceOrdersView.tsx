import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Calendar, 
  Building2, 
  FlaskConical, 
  Shield, 
  X, 
  UserCheck, 
  MapPin, 
  Phone, 
  Mail, 
  User as UserIcon, 
  CheckSquare, 
  Square, 
  AlertCircle, 
  Eye, 
  Award, 
  FileText, 
  FileCheck, 
  ExternalLink, 
  Edit3, 
  Save, 
  Trash2, 
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  Database,
  UploadCloud
} from 'lucide-react';
import { ServiceOrder, ServiceOrderStatus, Client, Equipment, User } from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { StatusBadge } from '../components/StatusBadge';
import { QuickTechnicianModal } from '../components/QuickTechnicianModal';
import { formatDateBR } from '../utils/dateUtils';

interface ServiceOrdersViewProps {
  onStartTestForOS: (osId: string, equipmentId?: string) => void;
  onOpenReportForOS?: (osId: string, clientId?: string) => void;
}

export const ServiceOrdersView: React.FC<ServiceOrdersViewProps> = ({ onStartTestForOS, onOpenReportForOS }) => {
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQuickTechModalOpen, setIsQuickTechModalOpen] = useState(false);
  const [selectedOSForDetails, setSelectedOSForDetails] = useState<ServiceOrder | null>(null);
  const [osToDelete, setOSToDelete] = useState<ServiceOrder | null>(null);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [clientId, setClientId] = useState('');
  const [clientSearchFilter, setClientSearchFilter] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('Ensaio de rotina e periódico em EPIs/EPCs dielétricos');
  const [artNumber, setArtNumber] = useState('');
  const [artFileUrl, setArtFileUrl] = useState<string | undefined>(undefined);
  const [artFileName, setArtFileName] = useState<string | undefined>(undefined);
  const [selectedEqIds, setSelectedEqIds] = useState<string[]>([]);
  
  // Details Modal ART edit state
  const [isEditingDetailsArt, setIsEditingDetailsArt] = useState(false);
  const [detailsArtNumber, setDetailsArtNumber] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedbackToast({ type, message });
    setTimeout(() => {
      setFeedbackToast(null);
    }, 4500);
  };

  const loadData = () => {
    // Carrega todas as Ordens de Serviço (evitando que filtros de empresa ocultem OS já cadastradas ou sincronizadas)
    const loadedServiceOrders = DielectricStorageService.getServiceOrders('ALL');
    const loadedClients = DielectricStorageService.getClients('ALL');
    const loadedEquipment = DielectricStorageService.getEquipment('ALL');
    let loadedUsers = DielectricStorageService.getUsers('ALL');

    setServiceOrders(loadedServiceOrders);
    setClients(loadedClients);
    setEquipmentList(loadedEquipment);
    setUsers(loadedUsers);

    if (loadedClients.length > 0 && !clientId) {
      setClientId(loadedClients[0].id);
    }
    if (loadedUsers.length > 0 && !technicianId) {
      setTechnicianId(loadedUsers[0].id);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-carrega dados do Supabase na abertura da visualização caso online
    if (navigator.onLine) {
      import('../services/supabaseService')
        .then(({ SupabaseService }) => {
          SupabaseService.pullFromSupabase().then(() => loadData()).catch(() => {});
        })
        .catch(() => {});
    }

    const handleDataChanged = () => loadData();
    window.addEventListener('jvm-data-changed', handleDataChanged);
    return () => {
      window.removeEventListener('jvm-data-changed', handleDataChanged);
    };
  }, []);

  const handleManualSyncSupabase = async () => {
    setIsSyncingSupabase(true);
    try {
      const { SupabaseService } = await import('../services/supabaseService');
      // Sincronização incremental: envia só o que está pendente e baixa as novidades
      const res = await SupabaseService.syncNow();
      loadData();
      if (res.errors.length > 0 && res.pushed === 0 && res.pulled === 0) {
        showToast(`Aviso de sincronização: ${res.errors[0]}`, 'error');
      } else {
        showToast(`Supabase: ${res.pushed} registro(s) enviado(s) e ${res.pulled} recebido(s)!`, 'success');
      }
    } catch (err: any) {
      showToast(`Aviso de sincronização: ${err.message || 'Falha ao sincronizar'}`, 'error');
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleOpenAddModal = () => {
    const currentClients = DielectricStorageService.getClients('ALL');
    let currentUsers = DielectricStorageService.getUsers('ALL');
    setClients(currentClients);
    setUsers(currentUsers);
    setEquipmentList(DielectricStorageService.getEquipment('ALL'));

    if (currentClients.length > 0) {
      setClientId(currentClients[0].id);
    }
    if (currentUsers.length > 0) {
      setTechnicianId(currentUsers[0].id);
    }
    setClientSearchFilter('');
    setArtNumber('');
    setArtFileUrl(undefined);
    setArtFileName(undefined);
    setSelectedEqIds([]);
    setIsAddModalOpen(true);
  };

  const handleCreateOS = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      showToast('Selecione um cliente para abrir a Ordem de Serviço.', 'error');
      return;
    }

    const client = clients.find(c => c.id === clientId) || DielectricStorageService.getClients('ALL').find(c => c.id === clientId);
    const allUsers = users.length > 0 ? users : DielectricStorageService.getUsers('ALL');
    const tech = allUsers.find(u => u.id === technicianId) || allUsers[0];
    const techId = tech?.id || 'usr-master-admin-001';
    const techName = tech?.name || 'Técnico Responsável';

    const nextNum = DielectricStorageService.generateNextOSNumber();

    const newOS: ServiceOrder = {
      id: 'os-' + Date.now(),
      companyId: (client as any)?.companyId || DielectricStorageService.getActiveCompany().id || 'comp-jvm',
      osNumber: nextNum,
      clientId,
      clientName: client?.nomeFantasia || client?.razaoSocial || 'Cliente Geral',
      openDate: new Date().toISOString().split('T')[0],
      scheduledDate,
      responsibleId: techId,
      responsibleName: techName,
      technicianId: techId,
      technicianName: techName,
      status: 'aberta',
      notes: description,
      artNumber: artNumber.trim() || undefined,
      artFileUrl,
      artFileName,
      equipmentIds: selectedEqIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const savedOS = DielectricStorageService.saveServiceOrder(newOS);
    loadData();
    setIsAddModalOpen(false);

    showToast(`Ordem de Serviço ${savedOS.osNumber} aberta e sincronizada com sucesso!`, 'success');

    // Transmissão direta ao Supabase Cloud com feedback
    import('../services/supabaseService')
      .then(({ SupabaseService }) => {
        SupabaseService.pushRecord('service_orders', savedOS).then(ok => {
          if (ok) {
            showToast(`OS ${savedOS.osNumber} salva e sincronizada no Supabase Cloud!`, 'success');
          }
        });
      })
      .catch(() => {});

    // Reset
    setDescription('Ensaio de rotina e periódico em EPIs/EPCs dielétricos');
    setArtNumber('');
    setArtFileUrl(undefined);
    setArtFileName(undefined);
    setSelectedEqIds([]);
  };

  const handleUpdateStatus = (os: ServiceOrder, status: ServiceOrderStatus) => {
    const updated = { ...os, status, updatedAt: new Date().toISOString() };
    DielectricStorageService.saveServiceOrder(updated);
    loadData();
    if (selectedOSForDetails && selectedOSForDetails.id === os.id) {
      setSelectedOSForDetails(updated);
    }
  };

  const handleSaveDetailsArt = (os: ServiceOrder) => {
    const updated: ServiceOrder = {
      ...os,
      artNumber: detailsArtNumber.trim() || undefined,
      updatedAt: new Date().toISOString()
    };
    DielectricStorageService.saveServiceOrder(updated);
    loadData();
    setSelectedOSForDetails(updated);
    setIsEditingDetailsArt(false);
  };

  const filteredOS = serviceOrders.filter(os => {
    const matchesSearch = 
      os.osNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (os.clientName && os.clientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (os.technicianName && os.technicianName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (os.notes && os.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (os.artNumber && os.artNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || os.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const selectedClient = clients.find(c => c.id === clientId);
  const selectedTechnician = users.find(u => u.id === technicianId);
  const clientEquipment = clientId ? equipmentList.filter(e => e.clientId === clientId) : [];

  const filteredClientOptions = clients.filter(c => {
    if (!clientSearchFilter.trim()) return true;
    const term = clientSearchFilter.toLowerCase();
    const nome = (c.nomeFantasia || '').toLowerCase();
    const razao = (c.razaoSocial || '').toLowerCase();
    const cnpj = (c.cnpj || '').toLowerCase();
    const cidade = (c.cidade || '').toLowerCase();
    return nome.includes(term) || razao.includes(term) || cnpj.includes(term) || cidade.includes(term);
  });

  const handleSelectAllEquipment = () => {
    if (selectedEqIds.length === clientEquipment.length) {
      setSelectedEqIds([]);
    } else {
      setSelectedEqIds(clientEquipment.map(e => e.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Ordens de Serviço (OS)</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-[10px] font-bold">
              <Database className="w-3 h-3 text-emerald-600" /> Supabase Cloud Ativo
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Acompanhamento de solicitações de ensaios, agendamentos em campo e transmissão para o banco Supabase
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualSyncSupabase}
            disabled={isSyncingSupabase}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl shadow-xs transition-colors active:scale-98 disabled:opacity-60 cursor-pointer"
            title="Sincronizar todas as Ordens de Serviço com o Supabase Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingSupabase ? 'animate-spin' : ''}`} />
            <span>{isSyncingSupabase ? 'Sincronizando...' : 'Sincronizar Supabase'}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors active:scale-98 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nova Ordem de Serviço
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackToast && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm'
              : 'bg-red-50 border-red-300 text-red-900 shadow-sm'
          }`}
        >
          {feedbackToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span className="flex-1">{feedbackToast.message}</span>
          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Nº da OS, Cliente, Técnico, Colaborador, Setor ou Matrícula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="w-full sm:w-60">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos os Status</option>
            <option value="aberta">Aberta</option>
            <option value="agendada">Agendada</option>
            <option value="em_execucao">Em Execução</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {/* OS Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredOS.map(os => (
          <div key={os.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-300 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold font-mono text-blue-700 text-sm">{os.osNumber}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium" title="Sincronizada com o banco de dados Supabase">
                    <Database className="w-2.5 h-2.5 text-emerald-600" /> Nuvem
                  </span>
                </div>
                <StatusBadge type="os" status={os.status} size="sm" />
              </div>

              <h3 className="font-bold text-slate-900 text-sm mt-2">{os.clientName}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{os.notes || 'Sem observações adicionais'}</p>

              {/* Informações de Agendamento, Técnico & ART */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Data: {formatDateBR(os.scheduledDate)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{os.technicianName}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  <span>{os.equipmentIds.length} equipamento(s) vinculado(s)</span>
                </div>

                {os.artNumber ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-300/80 text-amber-800 rounded-md font-mono text-[10px] font-bold">
                    <Award className="w-3 h-3 text-amber-600 shrink-0" />
                    ART: {os.artNumber}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">Sem ART informada</span>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {os.status !== 'concluida' && (
                  <select
                    value={os.status}
                    onChange={(e) => handleUpdateStatus(os, e.target.value as ServiceOrderStatus)}
                    className="p-1.5 text-[11px] font-medium border border-slate-300 rounded-lg bg-slate-50 text-slate-800"
                  >
                    <option value="aberta">Aberta</option>
                    <option value="agendada">Agendada</option>
                    <option value="em_execucao">Em Execução</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedOSForDetails(os)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                  title="Ver detalhes da OS"
                >
                  <Eye className="w-3.5 h-3.5" /> Detalhes
                </button>

                {onOpenReportForOS && (
                  <button
                    type="button"
                    onClick={() => onOpenReportForOS(os.id, os.clientId)}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                    title="Emitir Relatório Consolidado desta OS"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Relatório
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setOSToDelete(os)}
                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                  title="Excluir esta Ordem de Serviço"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" /> Excluir
                </button>
              </div>

              <button
                onClick={() => onStartTestForOS(os.id)}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <FlaskConical className="w-3.5 h-3.5" /> Executar Ensaios
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredOS.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-800 text-sm">Nenhuma Ordem de Serviço encontrada</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchTerm || filterStatus !== 'all'
              ? 'Tente alterar os termos de busca ou o filtro de status selecionado.'
              : 'Não há ordens de serviço cadastradas no momento. Clique em "Nova Ordem de Serviço" para abrir a primeira OS.'}
          </p>
        </div>
      )}

      {/* MODAL: Visualizar Detalhes da OS */}
      {selectedOSForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-[#0A2540] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-5 h-5 text-orange-400" />
                <div>
                  <h3 className="font-bold text-base leading-tight">Ordem de Serviço: {selectedOSForDetails.osNumber}</h3>
                  <p className="text-xs text-slate-300">{selectedOSForDetails.clientName}</p>
                </div>
              </div>
              <button onClick={() => setSelectedOSForDetails(null)} className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Item 1: Cliente */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Item 1 • Dados do Cliente</span>
                <span className="text-sm font-bold text-slate-900 block">{selectedOSForDetails.clientName}</span>
                <div className="text-slate-600 text-[11px]">
                  Data de Abertura: {formatDateBR(selectedOSForDetails.openDate)} • Status Atual: <span className="font-bold uppercase">{selectedOSForDetails.status}</span>
                </div>
              </div>

              {/* Item 2: Técnico & Data */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Item 2 • Analista Executor</span>
                  <span className="font-bold text-slate-900">{selectedOSForDetails.technicianName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Data Prevista</span>
                  <span className="font-bold text-slate-900">{formatDateBR(selectedOSForDetails.scheduledDate)}</span>
                </div>
              </div>

              {/* Item 3: Escopo */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Item 3 • Descrição / Escopo</span>
                <p className="text-slate-700 leading-relaxed">{selectedOSForDetails.notes || 'Sem observações'}</p>
              </div>

              {/* CAMPO ABAIXO DO ITEM 3: ANOTAÇÃO DE RESPONSABILIDADE TÉCNICA (ART) */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" />
                    Número da ART (CREA / CFT)
                  </span>

                  {!isEditingDetailsArt && (
                    <button
                      type="button"
                      onClick={() => {
                        setDetailsArtNumber(selectedOSForDetails.artNumber || '');
                        setIsEditingDetailsArt(true);
                      }}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 bg-amber-100/70 hover:bg-amber-200/80 px-2 py-0.5 rounded-md transition-colors"
                    >
                      <Edit3 className="w-3 h-3" /> {selectedOSForDetails.artNumber ? 'Editar ART' : 'Informar ART'}
                    </button>
                  )}
                </div>

                {isEditingDetailsArt ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={detailsArtNumber}
                      onChange={(e) => setDetailsArtNumber(e.target.value)}
                      placeholder="Ex: ART-CREA-SP-2026-9812401"
                      className="flex-1 p-2 text-xs font-mono font-bold bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveDetailsArt(selectedOSForDetails)}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" /> Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingDetailsArt(false)}
                      className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div>
                      {selectedOSForDetails.artNumber ? (
                        <span className="text-sm font-mono font-bold text-slate-900 tracking-wide block">
                          {selectedOSForDetails.artNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Nenhum número de ART informado para esta OS</span>
                      )}
                    </div>

                    {selectedOSForDetails.artFileUrl && (
                      <a
                        href={selectedOSForDetails.artFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white px-2.5 py-1 rounded-lg border border-blue-200 hover:border-blue-300 transition-colors shrink-0"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>{selectedOSForDetails.artFileName || 'Ver Documento da ART'}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Item 4: Equipamentos */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Item 4 • Equipamentos Vinculados ({selectedOSForDetails.equipmentIds.length})
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold">
                    Clique em um item para ensaiar diretamente
                  </span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedOSForDetails.equipmentIds.map(eqId => {
                    const eq = equipmentList.find(e => e.id === eqId);
                    return (
                      <div 
                        key={eqId} 
                        onClick={() => {
                          const osId = selectedOSForDetails.id;
                          setSelectedOSForDetails(null);
                          onStartTestForOS(osId, eqId);
                        }}
                        className="p-2.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg flex items-center justify-between text-[11px] cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-blue-700 group-hover:underline">{eq?.tag || eqId}</span>
                          <span className="text-slate-600">{eq?.type.replace('_', ' ')} (Classe {eq?.dielectricClass})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-mono text-[10px]">{eq?.serialNumber || 'S/N'}</span>
                          <span className="px-2 py-0.5 bg-orange-50 text-orange-700 group-hover:bg-orange-500 group-hover:text-white rounded font-bold text-[10px] transition-colors">
                            Ensaiar
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOSForDetails(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = selectedOSForDetails;
                    setSelectedOSForDetails(null);
                    setOSToDelete(toDelete);
                  }}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-red-200 cursor-pointer transition-colors"
                  title="Excluir esta Ordem de Serviço"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" /> Excluir OS
                </button>
              </div>

              <div className="flex items-center gap-2">
                {onOpenReportForOS && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedOSForDetails.id;
                      const cId = selectedOSForDetails.clientId;
                      setSelectedOSForDetails(null);
                      onOpenReportForOS(id, cId);
                    }}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-1.5 text-xs shadow-xs cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Emitir Relatório da OS
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const id = selectedOSForDetails.id;
                    setSelectedOSForDetails(null);
                    onStartTestForOS(id);
                  }}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center gap-1.5 text-xs shadow-xs cursor-pointer transition-colors"
                >
                  <FlaskConical className="w-4 h-4" /> Executar Ensaios Desta OS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: New Service Order */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-[#0A2540] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-5 h-5 text-orange-400" />
                <div>
                  <h3 className="font-bold text-base leading-tight">Abrir Nova Ordem de Serviço (OS)</h3>
                  <p className="text-xs text-slate-300">Preencha os itens da ordem de serviço em sequência</p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOS} className="p-6 overflow-y-auto space-y-5 text-xs">
              
              {/* ITEM 1: SELEÇÃO DO CLIENTE CADASTRADO */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    Item 1 • Cliente Cadastrado *
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {clients.length} cliente(s) no sistema
                  </span>
                </div>

                {/* Filter input if multiple clients */}
                {clients.length > 4 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar cliente por nome, CNPJ ou cidade..."
                      value={clientSearchFilter}
                      onChange={(e) => setClientSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}

                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setSelectedEqIds([]);
                  }}
                  required
                  className="w-full p-2.5 border-2 border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-xs"
                >
                  <option value="">-- Selecione o Cliente Cadastrado --</option>
                  {filteredClientOptions.map(c => {
                    const displayName = c.nomeFantasia || c.razaoSocial || 'Cliente';
                    const legal = c.razaoSocial && c.razaoSocial !== c.nomeFantasia ? ` (${c.razaoSocial})` : '';
                    const cnpjStr = c.cnpj ? ` • CNPJ: ${c.cnpj}` : '';
                    const cityStr = c.cidade ? ` • ${c.cidade}/${c.estado}` : '';
                    return (
                      <option key={c.id} value={c.id}>
                        {displayName}{legal}{cnpjStr}{cityStr}
                      </option>
                    );
                  })}
                </select>

                {/* Selected Client Information Card */}
                {selectedClient && (
                  <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-blue-100 pb-2">
                      <div>
                        <span className="font-bold text-blue-950 text-sm block">
                          {selectedClient.nomeFantasia || selectedClient.razaoSocial}
                        </span>
                        {selectedClient.razaoSocial && selectedClient.razaoSocial !== selectedClient.nomeFantasia && (
                          <span className="text-slate-600 text-[11px] block">{selectedClient.razaoSocial}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-blue-100 border border-blue-300 text-blue-800 rounded-md font-mono text-[11px] font-bold">
                          CNPJ: {selectedClient.cnpj}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {selectedClient.endereco}, {selectedClient.numero} - {selectedClient.cidade}/{selectedClient.estado}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {selectedClient.responsavel} {selectedClient.cargoResponsavel ? `(${selectedClient.cargoResponsavel})` : ''}
                        </span>
                      </div>
                      {selectedClient.telefone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{selectedClient.telefone} {selectedClient.whatsapp ? `• Whats: ${selectedClient.whatsapp}` : ''}</span>
                        </div>
                      )}
                      {selectedClient.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{selectedClient.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ITEM 2: RESPONSÁVEL TÉCNICO & DATA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col justify-between space-y-2">
                  <div>
                    <label className="font-bold text-slate-700 flex items-center gap-1.5 mb-1.5 text-xs">
                      <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      Item 2 • Analista Executor Responsável
                    </label>
                    <select
                      value={technicianId}
                      onChange={(e) => setTechnicianId(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold text-xs bg-white text-slate-900"
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {u.cargo || u.role} {u.creaOrCft ? `(${u.creaOrCft})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Parte Inferior da Caixa: Exibição do Nome dos Analistas e Botão de Cadastrar Analista */}
                  <div className="pt-2 border-t border-slate-200/90 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {selectedTechnician ? (
                        <div className="text-[11px] text-slate-700 truncate flex items-center gap-1.5" title={`${selectedTechnician.name} • ${selectedTechnician.cargo || selectedTechnician.role} ${selectedTechnician.creaOrCft ? `(${selectedTechnician.creaOrCft})` : ''}`}>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="font-bold text-slate-800 truncate">{selectedTechnician.name}</span>
                          {selectedTechnician.cargo && (
                            <span className="text-slate-500 text-[10px] hidden md:inline truncate">
                              • {selectedTechnician.cargo}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Nenhum analista selecionado</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsQuickTechModalOpen(true)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-white hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200/90 hover:border-blue-300 transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 shrink-0"
                      title="Cadastrar um novo analista executor no sistema"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Cadastrar Analista</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col justify-between space-y-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      Data Prevista de Realização
                    </label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium text-xs bg-white text-slate-900"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/90 flex items-center justify-between">
                    <span>Cronograma de Execução</span>
                    <span className="font-semibold text-slate-700">Rotina Periódica</span>
                  </div>
                </div>
              </div>

              {/* ITEM 3: DESCRIÇÃO / ESCOPO DO SERVIÇO */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Item 3 • Descrição / Escopo do Serviço
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Ensaio de rotina e periódico em EPIs/EPCs dielétricos da subestação..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-xs"
                />
              </div>

              {/* CAMPO ABAIXO DO ITEM 3: NÚMERO DA ART (ANOTAÇÃO DE RESPONSABILIDADE TÉCNICA) */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600 shrink-0" />
                    Número da ART (Anotação de Responsabilidade Técnica - CREA / CFT)
                  </label>
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md self-start sm:self-auto">
                    Opcional / Campo Técnico
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={artNumber}
                      onChange={(e) => setArtNumber(e.target.value)}
                      placeholder="Ex: ART-CREA-SP-2026-9812401 ou 28027230260012345"
                      className="w-full p-2.5 border border-amber-300/90 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono font-bold text-slate-900 bg-white text-xs placeholder:font-sans placeholder:font-normal"
                    />
                  </div>

                  <div>
                    <label className="relative flex items-center justify-center gap-1.5 p-2.5 border border-dashed border-amber-400 hover:border-amber-600 bg-white hover:bg-amber-50/80 rounded-xl cursor-pointer transition-colors text-xs font-semibold text-amber-900 text-center shadow-2xs">
                      <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">{artFileName ? artFileName : 'Anexar ART (PDF/Img)'}</span>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setArtFileName(file.name);
                            const reader = new FileReader();
                            reader.onload = () => {
                              setArtFileUrl(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {artFileName && (
                  <div className="flex items-center justify-between text-[11px] text-amber-950 bg-white px-3 py-1.5 rounded-lg border border-amber-200 shadow-2xs">
                    <span className="truncate flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> 
                      Arquivo selecionado: <strong className="font-semibold">{artFileName}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => { setArtFileName(undefined); setArtFileUrl(undefined); }}
                      className="text-red-600 hover:text-red-800 font-bold ml-2 text-xs cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 leading-normal">
                  Identificação da Anotação de Responsabilidade Técnica registrada no conselho de classe (CREA/CFT) referente aos serviços prestados nesta OS.
                </p>
              </div>

              {/* ITEM 4: SELEÇÃO DE EQUIPAMENTOS DO CLIENTE PARA ENSAIO */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-blue-600" />
                    Item 4 • Equipamentos do Cliente para Ensaio:
                  </label>
                  {clientEquipment.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllEquipment}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {selectedEqIds.length === clientEquipment.length ? (
                        <>
                          <Square className="w-3.5 h-3.5" /> Desmarcar Todos
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-3.5 h-3.5" /> Selecionar Todos ({clientEquipment.length})
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1.5 bg-slate-50">
                  {clientEquipment.length > 0 ? (
                    clientEquipment.map(eq => {
                      const isSelected = selectedEqIds.includes(eq.id);
                      return (
                        <div
                          key={eq.id}
                          onClick={() => {
                            setSelectedEqIds(prev => 
                              isSelected ? prev.filter(id => id !== eq.id) : [...prev, eq.id]
                            );
                          }}
                          className={`p-2.5 rounded-xl text-xs flex items-center justify-between cursor-pointer border transition-all ${
                            isSelected 
                              ? 'bg-blue-50 border-blue-400 text-blue-950 font-bold shadow-xs' 
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={isSelected} 
                              readOnly 
                              className="rounded-sm text-blue-600 focus:ring-blue-500 pointer-events-none" 
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-blue-700 font-bold">{eq.tag}</span>
                                <span>•</span>
                                <span className="uppercase">{eq.type.replace('_', ' ')} (Classe {eq.dielectricClass})</span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-normal">
                                {eq.manufacturer} • SN: {eq.serialNumber || 'N/A'} {eq.caNumber ? `• CA: ${eq.caNumber}` : ''}
                                {eq.collaboratorName ? ` • Usuário: ${eq.collaboratorName}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-slate-100 text-slate-600">
                              {eq.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center space-y-1">
                      <AlertCircle className="w-5 h-5 text-slate-400 mx-auto" />
                      <p className="text-slate-500 font-semibold">Nenhum equipamento cadastrado para este cliente.</p>
                      <p className="text-[11px] text-slate-400">Você ainda pode abrir a OS e cadastrar ou ensaiar os equipamentos posteriormente.</p>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                  <span>{selectedEqIds.length} equipamento(s) selecionado(s)</span>
                  <span>Total no cliente: {clientEquipment.length}</span>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!clientId}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-sm transition-all active:scale-98"
                >
                  Gerar Ordem de Serviço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Cadastro Rápido de Analista Executor */}
      <QuickTechnicianModal
        isOpen={isQuickTechModalOpen}
        onClose={() => setIsQuickTechModalOpen(false)}
        onTechnicianCreated={(newTech) => {
          const updatedUsers = DielectricStorageService.getUsers();
          setUsers(updatedUsers);
          setTechnicianId(newTech.id);
        }}
      />

      {/* MODAL: Confirmação de Exclusão de OS */}
      {osToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-xl text-red-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Excluir Ordem de Serviço</h4>
                <p className="text-xs text-red-700 font-medium">Esta ação removerá a OS do laboratório</p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-blue-700 text-sm">{osToDelete.osNumber}</span>
                  <StatusBadge type="os" status={osToDelete.status} size="sm" />
                </div>
                <p className="font-bold text-slate-900">{osToDelete.clientName}</p>
                <div className="text-slate-500 text-[11px] grid grid-cols-2 gap-1 pt-1">
                  <span>Data: {formatDateBR(osToDelete.scheduledDate)}</span>
                  <span>{osToDelete.equipmentIds.length} equipamentos</span>
                </div>
                {osToDelete.artNumber && (
                  <p className="text-[11px] text-amber-700 font-mono">ART: {osToDelete.artNumber}</p>
                )}
              </div>

              <p className="text-slate-600 leading-relaxed">
                Tem certeza de que deseja excluir a Ordem de Serviço <strong>{osToDelete.osNumber}</strong>? O registro será marcado como excluído e o histórico de auditoria do laboratório será atualizado.
              </p>

              <div className="flex justify-end items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOSToDelete(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const deletedNum = osToDelete.osNumber;
                    DielectricStorageService.deleteServiceOrder(osToDelete.id);
                    loadData();
                    if (selectedOSForDetails && selectedOSForDetails.id === osToDelete.id) {
                      setSelectedOSForDetails(null);
                    }
                    setOSToDelete(null);
                    showToast(`Ordem de Serviço ${deletedNum} excluída com sucesso!`, 'success');
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl font-bold shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Sim, Excluir OS</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
