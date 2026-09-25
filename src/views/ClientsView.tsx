import React, { useState, useEffect } from 'react';
import { 
   Building2, 
   Search, 
   Plus, 
   Mail, 
   Phone, 
   MapPin, 
   FileText, 
   Shield, 
   Check, 
   X, 
   Loader2,
   CheckCircle2,
   AlertCircle,
   AlertTriangle,
   Edit3,
   User,
   Lock,
   ArrowRight,
   Trash2
 } from 'lucide-react';
import { Client } from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { lookupCep } from '../services/addressService';
import { lookupCnpj, formatCnpj } from '../services/cnpjService';

export const ClientsView: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);
  const [cnpjLookupError, setCnpjLookupError] = useState<string | null>(null);
  const [cnpjLookupSuccess, setCnpjLookupSuccess] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [addressBairro, setAddressBairro] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressZip, setAddressZip] = useState('');

  const loadClients = () => {
    setClients(DielectricStorageService.getClients());
  };

  useEffect(() => {
    loadClients();
  }, []);

  // Show temporary toast feedback
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedbackToast({ type, message });
    setTimeout(() => {
      setFeedbackToast(null);
    }, 4000);
  };

  // Helper to detect if a client already exists by clean CNPJ or exact Razão Social
  const findDuplicateClient = (
    cnpjToCheck: string, 
    nameToCheck: string, 
    excludeId?: string | null
  ): Client | undefined => {
    const cleanInputCnpj = cnpjToCheck.replace(/\D/g, '');
    const cleanInputName = nameToCheck.trim().toLowerCase();

    return clients.find(c => {
      if (excludeId && c.id === excludeId) return false;

      // 1. Primary check: CNPJ (if at least 11 digits)
      const cleanExistingCnpj = (c.cnpj || '').replace(/\D/g, '');
      if (cleanInputCnpj && cleanExistingCnpj && cleanInputCnpj.length >= 11 && cleanInputCnpj === cleanExistingCnpj) {
        return true;
      }

      // 2. Secondary check: Exact Razão Social match (if at least 4 chars)
      if (cleanInputName && cleanInputName.length >= 4 && c.razaoSocial) {
        const cleanExistingName = c.razaoSocial.trim().toLowerCase();
        if (cleanExistingName === cleanInputName) {
          return true;
        }
      }

      return false;
    });
  };

  // Check in real-time if a duplicate exists for the current inputs
  const duplicateClient = modalMode === 'create' 
    ? findDuplicateClient(cnpj, name, editingClientId)
    : null;

  const resetForm = () => {
    setName('');
    setTradeName('');
    setCnpj('');
    setStateRegistration('');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setAddressStreet('');
    setAddressNumber('');
    setAddressComplement('');
    setAddressBairro('');
    setAddressCity('');
    setAddressState('');
    setAddressZip('');
    setCnpjLookupError(null);
    setCnpjLookupSuccess(null);
    setEditingClientId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode('create');
    setIsAddModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setModalMode('edit');
    setEditingClientId(client.id);
    setName(client.razaoSocial || '');
    setTradeName(client.nomeFantasia || client.razaoSocial || '');
    setCnpj(client.cnpj || '');
    setStateRegistration(client.inscricaoEstadual || '');
    setContactName(client.responsavel || '');
    setContactEmail(client.email || '');
    setContactPhone(client.telefone || '');
    setAddressStreet(client.endereco || '');
    setAddressNumber(client.numero || '');
    setAddressComplement(client.complemento || '');
    setAddressBairro(client.bairro || '');
    setAddressCity(client.cidade || '');
    setAddressState(client.estado || '');
    setAddressZip(client.cep || '');
    setCnpjLookupError(null);
    setCnpjLookupSuccess(null);
    setIsAddModalOpen(true);
  };

  const handleSwitchToEditExisting = (existingClient: Client) => {
    setModalMode('edit');
    setEditingClientId(existingClient.id);
    setName(existingClient.razaoSocial || '');
    setTradeName(existingClient.nomeFantasia || existingClient.razaoSocial || '');
    setCnpj(existingClient.cnpj || '');
    setStateRegistration(existingClient.inscricaoEstadual || '');
    setContactName(existingClient.responsavel || '');
    setContactEmail(existingClient.email || '');
    setContactPhone(existingClient.telefone || '');
    setAddressStreet(existingClient.endereco || '');
    setAddressNumber(existingClient.numero || '');
    setAddressComplement(existingClient.complemento || '');
    setAddressBairro(existingClient.bairro || '');
    setAddressCity(existingClient.cidade || '');
    setAddressState(existingClient.estado || '');
    setAddressZip(existingClient.cep || '');
    setCnpjLookupError(null);
    setCnpjLookupSuccess(`Modo de edição habilitado para ${existingClient.nomeFantasia || existingClient.razaoSocial}.`);
  };

  const handleCnpjLookup = async () => {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    if (!cleanCNPJ) {
      setCnpjLookupError('Informe o número do CNPJ para realizar a consulta.');
      setCnpjLookupSuccess(null);
      return;
    }

    if (cleanCNPJ.length !== 14) {
      setCnpjLookupError(`O CNPJ deve conter 14 dígitos (você digitou ${cleanCNPJ.length}).`);
      setCnpjLookupSuccess(null);
      return;
    }

    setIsSearchingCNPJ(true);
    setCnpjLookupError(null);
    setCnpjLookupSuccess(null);

    try {
      const result = await lookupCnpj(cleanCNPJ);
      if (result.success && result.data) {
        const data = result.data;
        setName(data.razaoSocial || '');
        setTradeName(data.nomeFantasia || data.razaoSocial || '');
        setCnpj(data.cnpjFormatted || formatCnpj(cleanCNPJ));
        setAddressStreet(data.logradouro || '');
        setAddressNumber(data.numero || '');
        setAddressComplement(data.complemento || '');
        setAddressBairro(data.bairro || '');
        setAddressCity(data.municipio || '');
        setAddressState(data.uf || '');
        setAddressZip(data.cep || '');
        if (data.email) setContactEmail(data.email);
        if (data.telefone) setContactPhone(data.telefone);
        if (data.responsavelSocio && !contactName) setContactName(data.responsavelSocio);

        setCnpjLookupSuccess(`Dados obtidos com sucesso da Receita Federal (${data.situacaoCadastral || 'REGULAR'}).`);
      } else {
        setCnpjLookupError(result.error || 'Não foi possível localizar este CNPJ na Receita Federal.');
      }
    } catch {
      setCnpjLookupError('Falha ao conectar com o serviço de consulta de CNPJ. Verifique sua conexão ou preencha manualmente.');
    } finally {
      setIsSearchingCNPJ(false);
    }
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cnpj.trim()) {
      setCnpjLookupError('Preencha os campos obrigatórios: Razão Social e CNPJ.');
      return;
    }

    // Safety lock against duplicates in create mode
    if (modalMode === 'create') {
      const existing = findDuplicateClient(cnpj, name, null);
      if (existing) {
        setCnpjLookupError(`Trava de segurança: O cliente "${existing.razaoSocial}" (CNPJ ${existing.cnpj}) já está cadastrado. Utilize o botão "Editar Cliente" para atualizar os dados.`);
        return;
      }
    }

    const clientId = modalMode === 'edit' && editingClientId ? editingClientId : 'cli-' + Date.now();
    const existingClient = modalMode === 'edit' && editingClientId ? clients.find(c => c.id === editingClientId) : undefined;

    const clientPayload: Client = {
      id: clientId,
      razaoSocial: name.trim(),
      nomeFantasia: tradeName.trim() || name.trim(),
      cnpj: formatCnpj(cnpj.trim()),
      inscricaoEstadual: stateRegistration.trim() || undefined,
      responsavel: contactName.trim() || 'Gestor Responsável',
      cargoResponsavel: existingClient?.cargoResponsavel || 'Engenheiro / Gestor',
      email: contactEmail.trim(),
      telefone: contactPhone.trim(),
      endereco: addressStreet.trim() || 'Logradouro Principal',
      numero: addressNumber.trim() || 'S/N',
      complemento: addressComplement.trim() || undefined,
      bairro: addressBairro.trim() || 'Centro',
      cidade: addressCity.trim() || 'São Paulo',
      estado: addressState.trim().toUpperCase() || 'SP',
      cep: addressZip.trim() || '00000-000',
      createdAt: existingClient?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    DielectricStorageService.saveClient(clientPayload);
    loadClients();
    setIsAddModalOpen(false);

    showToast(
      modalMode === 'edit' 
        ? `Cliente "${clientPayload.nomeFantasia || clientPayload.razaoSocial}" atualizado com sucesso!`
        : `Cliente "${clientPayload.nomeFantasia || clientPayload.razaoSocial}" cadastrado com sucesso!`,
      'success'
    );

    resetForm();
  };

  const handleConfirmDelete = (client: Client) => {
    DielectricStorageService.deleteClient(client.id);
    loadClients();
    setClientToDelete(null);
    if (isAddModalOpen && editingClientId === client.id) {
      setIsAddModalOpen(false);
      resetForm();
    }
    showToast(`Cliente "${client.nomeFantasia || client.razaoSocial}" excluído com sucesso!`, 'success');
  };

  const filteredClients = clients.filter(c => 
    (c.razaoSocial && c.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.nomeFantasia && c.nomeFantasia.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.cnpj && c.cnpj.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.cidade && c.cidade.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.responsavel && c.responsavel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const equipmentList = DielectricStorageService.getEquipment();
  const testsList = DielectricStorageService.getTests();

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div className={`fixed top-5 right-5 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-bold transition-all border ${
          feedbackToast.type === 'success' 
            ? 'bg-emerald-900 text-emerald-100 border-emerald-700' 
            : 'bg-red-900 text-red-100 border-red-700'
        }`}>
          {feedbackToast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Cadastro de Empresas e Clientes</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
              {clients.length} {clients.length === 1 ? 'cadastrado' : 'cadastrados'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerenciamento de clientes com trava anti-duplicação e consulta de CNPJ na Receita Federal
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Razão Social, Nome Fantasia, CNPJ, Cidade ou Responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map(client => {
          const clientEqCount = equipmentList.filter(e => e.clientId === client.id).length;
          const clientTestsCount = testsList.filter(t => t.clientId === client.id).length;

          return (
            <div key={client.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-300 transition-all group">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md block w-fit">
                        {client.cnpj}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(client)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Editar informações do cliente"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientToDelete(client)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Excluir cliente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{client.nomeFantasia || client.razaoSocial}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1">{client.razaoSocial}</p>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{client.cidade} - {client.estado}</span>
                  </div>
                  {client.responsavel && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.responsavel}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{client.telefone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer with Stats and Quick Edit / Delete */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-slate-600" title="Equipamentos cadastrados">
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-bold text-slate-900">{clientEqCount}</span> EPIs
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600" title="Laudos emitidos">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-bold text-slate-900">{clientTestsCount}</span> Laudos
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(client)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[11px] font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientToDelete(client)}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                    title="Excluir cliente do laboratório"
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">Nenhum cliente encontrado</h3>
          <p className="text-xs text-slate-500 mt-1">
            {searchTerm ? 'Tente buscar por outro termo ou limpe o filtro.' : 'Cadastre seu primeiro cliente para começar os ensaios.'}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
            >
              Limpar Busca
            </button>
          )}
        </div>
      )}

      {/* MODAL: Cadastrar / Editar Cliente com Trava Anti-Duplicação e CNPJ Auto-Fill */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className={`px-6 py-4 flex items-center justify-between shrink-0 text-white ${
              modalMode === 'edit' ? 'bg-gradient-to-r from-[#0A2540] to-blue-900' : 'bg-[#0A2540]'
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">
                    {modalMode === 'edit' ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
                  </h3>
                  {modalMode === 'edit' && (
                    <span className="px-2 py-0.5 bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[10px] font-bold rounded-md">
                      Modo de Edição
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-blue-200">
                  {modalMode === 'edit' 
                    ? 'Atualize os dados cadastrais, contatos e endereço do cliente' 
                    : 'Consulte o CNPJ para preenchimento automático oficial na Receita Federal'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetForm();
                }} 
                className="p-1 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-6 overflow-y-auto space-y-4 text-xs">
              
              {/* TRAVA ANTI-DUPLICAÇÃO: ALERTA DE CLIENTE JÁ CADASTRADO COM BOTÃO DE EDITAR */}
              {duplicateClient && modalMode === 'create' && (
                <div className="bg-amber-50 border-2 border-amber-400/80 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Trava de Segurança
                        </span>
                        <h4 className="text-xs font-black text-amber-950">
                          Cliente Já Cadastrado no Sistema!
                        </h4>
                      </div>
                      
                      <p className="text-xs text-amber-900 mt-1">
                        Não é permitido cadastrar o mesmo cliente duas vezes para evitar duplicidade de registros e divergências em laudos técnicos.
                      </p>
                      
                      {/* Box com resumo do cliente existente */}
                      <div className="mt-2.5 p-3 bg-white/90 border border-amber-300/80 rounded-xl space-y-1 text-[11px] text-slate-700 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs">{duplicateClient.nomeFantasia || duplicateClient.razaoSocial}</span>
                          <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-[10px]">{duplicateClient.cnpj}</span>
                        </div>
                        <div className="text-slate-500 text-[10px] line-clamp-1">{duplicateClient.razaoSocial}</div>
                        <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-600">
                          <span>📍 {duplicateClient.cidade}/{duplicateClient.estado}</span>
                          <span>👤 {duplicateClient.responsavel || 'Responsável Geral'}</span>
                          {duplicateClient.telefone && <span>📞 {duplicateClient.telefone}</span>}
                        </div>
                      </div>

                      {/* Botão de Ação: Editar Cliente */}
                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-amber-200">
                        <span className="text-[11px] font-semibold text-amber-950">
                          Deseja alterar as informações deste cliente existente?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSwitchToEditExisting(duplicateClient)}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar Cliente</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CNPJ Input with Instant Search Button */}
              <div className="bg-blue-50/80 p-3.5 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-blue-950">
                    {modalMode === 'edit' ? 'CNPJ do Cliente:' : 'Consulta Automática por CNPJ (Receita Federal):'}
                  </label>
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    Receita Federal / BrasilAPI
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    value={cnpj}
                    onChange={(e) => {
                      const formatted = formatCnpj(e.target.value);
                      setCnpj(formatted);
                      if (cnpjLookupError) setCnpjLookupError(null);
                      if (cnpjLookupSuccess) setCnpjLookupSuccess(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCnpjLookup();
                      }
                    }}
                    className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleCnpjLookup}
                    disabled={isSearchingCNPJ}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold shadow-xs transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {isSearchingCNPJ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>{isSearchingCNPJ ? 'Buscando...' : 'Consultar CNPJ'}</span>
                  </button>
                </div>
                {cnpjLookupError && (
                  <div className="flex items-start gap-1.5 text-red-600 text-[11px] bg-red-50 p-2 rounded-lg border border-red-200">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{cnpjLookupError}</span>
                  </div>
                )}
                {cnpjLookupSuccess && (
                  <div className="flex items-start gap-1.5 text-emerald-700 text-[11px] bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>{cnpjLookupSuccess}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Razão Social *</label>
                  <input
                    type="text"
                    required
                    placeholder="Razão social completa..."
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (cnpjLookupError) setCnpjLookupError(null);
                    }}
                    className="w-full p-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome Fantasia</label>
                  <input
                    type="text"
                    placeholder="Nome comercial..."
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Inscrição Estadual (IE)</label>
                  <input
                    type="text"
                    placeholder="Isento ou Nº da IE"
                    value={stateRegistration}
                    onChange={(e) => setStateRegistration(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome do Contato / Responsável</label>
                  <input
                    type="text"
                    placeholder="Engenheiro, Diretor ou Gestor..."
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">E-mail de Contato</label>
                  <input
                    type="email"
                    placeholder="contato@empresa.com.br"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telefone / Celular</label>
                  <input
                    type="text"
                    placeholder="(11) 98765-4321"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">CEP</label>
                  <input
                    type="text"
                    placeholder="00000-000"
                    maxLength={9}
                    value={addressZip}
                    onChange={async (e) => {
                      let raw = e.target.value.replace(/\D/g, '').substring(0, 8);
                      let formatted = raw;
                      if (raw.length > 5) {
                        formatted = `${raw.substring(0, 5)}-${raw.substring(5)}`;
                      }
                      setAddressZip(formatted);
                      if (raw.length === 8) {
                        const res = await lookupCep(raw);
                        if (res) {
                          if (res.logradouro) setAddressStreet(res.logradouro);
                          if (res.bairro) setAddressBairro(res.bairro);
                          if (res.localidade) setAddressCity(res.localidade);
                          if (res.uf) setAddressState(res.uf);
                        }
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Logradouro & Número</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Rua, Avenida, Rodovia..."
                      value={addressStreet}
                      onChange={(e) => setAddressStreet(e.target.value)}
                      className="flex-1 p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <input
                      type="text"
                      placeholder="Nº"
                      value={addressNumber}
                      onChange={(e) => setAddressNumber(e.target.value)}
                      className="w-24 p-2 border border-slate-300 rounded-xl text-center focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bairro</label>
                  <input
                    type="text"
                    placeholder="Bairro ou Distrito Industrial..."
                    value={addressBairro}
                    onChange={(e) => setAddressBairro(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Complemento</label>
                  <input
                    type="text"
                    placeholder="Galpão, Sala, Bloco..."
                    value={addressComplement}
                    onChange={(e) => setAddressComplement(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={addressCity}
                    onChange={(e) => setAddressCity(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estado (UF)</label>
                  <input
                    type="text"
                    placeholder="SP, MG, RJ..."
                    maxLength={2}
                    value={addressState}
                    onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                    className="w-full p-2 border border-slate-300 rounded-xl uppercase font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
                {modalMode === 'edit' && editingClientId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const client = clients.find(c => c.id === editingClientId);
                      if (client) {
                        setClientToDelete(client);
                      }
                    }}
                    className="px-3.5 py-2 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <span>Excluir Cliente</span>
                  </button>
                ) : <div />}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(duplicateClient && modalMode === 'create')}
                    className={`px-5 py-2 text-white rounded-xl font-bold shadow-sm transition-colors inline-flex items-center gap-1.5 ${
                      duplicateClient && modalMode === 'create'
                        ? 'bg-slate-400 cursor-not-allowed opacity-60'
                        : modalMode === 'edit'
                        ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 cursor-pointer'
                        : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 cursor-pointer'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{modalMode === 'edit' ? 'Salvar Alterações' : 'Salvar Cliente'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CLIENTE */}
      {clientToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-red-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-base">
                <Trash2 className="w-5 h-5" />
                <span>Confirmar Exclusão de Cliente</span>
              </div>
              <button 
                onClick={() => setClientToDelete(null)}
                className="p-1 text-red-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl space-y-1.5">
                <div className="font-bold text-slate-900 text-sm">
                  {clientToDelete.nomeFantasia || clientToDelete.razaoSocial}
                </div>
                <div className="font-mono font-bold text-red-950 text-[11px]">
                  CNPJ: {clientToDelete.cnpj}
                </div>
                <div className="text-slate-500 text-[11px] line-clamp-1">
                  Razão Social: {clientToDelete.razaoSocial}
                </div>
              </div>

              {(() => {
                const eqCount = equipmentList.filter(e => e.clientId === clientToDelete.id).length;
                const testCount = testsList.filter(t => t.clientId === clientToDelete.id).length;
                return (
                  <div className="space-y-2">
                    {(eqCount > 0 || testCount > 0) && (
                      <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-[11px] flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">Atenção aos vínculos existentes:</span>
                          Este cliente possui <span className="font-bold">{eqCount} EPI(s)</span> e <span className="font-bold">{testCount} Laudo(s)</span> registrados no laboratório.
                        </div>
                      </div>
                    )}
                    <p className="text-slate-600 leading-relaxed">
                      Tem certeza que deseja remover este cliente? O registro será excluído do sistema local e a exclusão será sincronizada no banco de dados e auditoria.
                    </p>
                  </div>
                );
              })()}

              <div className="flex justify-end items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClientToDelete(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmDelete(clientToDelete)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl font-bold shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Sim, Excluir Cliente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
