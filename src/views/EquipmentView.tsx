import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  Plus, 
  Filter, 
  QrCode as QrCodeIcon, 
  History, 
  Calendar, 
  FlaskConical, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Building,
  Tag,
  FileText,
  Download,
  X,
  Printer,
  User as UserIcon,
  Briefcase,
  IdCard,
  Wrench,
  Trash2,
  CheckSquare,
  Square,
  MinusSquare,
  AlertOctagon,
  Check
} from 'lucide-react';
import { Equipment, EquipmentType, DielectricClass, EquipmentStatus, Client, TestRecord, IsolatedToolItem } from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { StatusBadge } from '../components/StatusBadge';
import { generateQRCodeDataUrl } from '../services/pdfGenerator';
import { IsolatedToolsSelector } from '../components/IsolatedToolsSelector';
import { NiimbotLabelModal } from '../components/NiimbotLabelModal';
import { EQUIPMENT_NORM_SPECIFICATIONS } from './TestWizardView';
import { formatDateBR } from '../utils/dateUtils';

interface EquipmentViewProps {
  onStartNewTest: (equipmentId: string) => void;
  onOpenTestLaudo: (test: TestRecord) => void;
  initialSelectedEquipment?: Equipment | null;
}

export const EquipmentView: React.FC<EquipmentViewProps> = ({
  onStartNewTest,
  onOpenTestLaudo,
  initialSelectedEquipment
}) => {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');

  // Multi-selection & Deletion States
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccessToast, setDeleteSuccessToast] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEquipmentForDetails, setSelectedEquipmentForDetails] = useState<Equipment | null>(initialSelectedEquipment || null);
  const [qrCodeModalData, setQrCodeModalData] = useState<{ equipment: Equipment; qrUrl: string } | null>(null);
  const [isNiimbotModalOpen, setIsNiimbotModalOpen] = useState(false);
  const [niimbotModalTests, setNiimbotModalTests] = useState<TestRecord[]>([]);

  const company = DielectricStorageService.getCompanyInfo();

  // Form State for new equipment
  const [newTag, setNewTag] = useState('');
  const [newType, setNewType] = useState<EquipmentType>('luva_isolante');
  const [newClass, setNewClass] = useState<DielectricClass>('2');
  const [newClientId, setNewClientId] = useState('');
  const [newManufacturer, setNewManufacturer] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newSerial, setNewSerial] = useState('');
  const [newCaNumber, setNewCaNumber] = useState('');
  const [newFabricationDate, setNewFabricationDate] = useState('2025-01-15');
  const [newCollaboratorName, setNewCollaboratorName] = useState('');
  const [newCollaboratorRegistration, setNewCollaboratorRegistration] = useState('');
  const [newCollaboratorSector, setNewCollaboratorSector] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newIsolatedTools, setNewIsolatedTools] = useState<IsolatedToolItem[]>([]);

  const loadData = () => {
    setEquipmentList(DielectricStorageService.getEquipment());
    setClients(DielectricStorageService.getClients());
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialSelectedEquipment) {
      setSelectedEquipmentForDetails(initialSelectedEquipment);
    }
  }, [initialSelectedEquipment]);

  // Filtering
  const filteredEquipment = equipmentList.filter(eq => {
    const matchesSearch = 
      eq.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (eq.caNumber && eq.caNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      eq.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (eq.clientName && eq.clientName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === 'all' || eq.type === filterType;
    const matchesStatus = filterStatus === 'all' || eq.status === filterStatus;
    const matchesClient = filterClient === 'all' || eq.clientId === filterClient;

    return matchesSearch && matchesType && matchesStatus && matchesClient;
  });

  // Multi-selection computed values
  const isAllFilteredSelected = filteredEquipment.length > 0 && filteredEquipment.every(eq => selectedEquipmentIds.includes(eq.id));
  const isSomeFilteredSelected = filteredEquipment.some(eq => selectedEquipmentIds.includes(eq.id));
  const selectedFilteredCount = filteredEquipment.filter(eq => selectedEquipmentIds.includes(eq.id)).length;

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Deselect filtered items
      const filteredIdSet = new Set(filteredEquipment.map(e => e.id));
      setSelectedEquipmentIds(prev => prev.filter(id => !filteredIdSet.has(id)));
    } else {
      // Select all filtered items
      const currentSet = new Set(selectedEquipmentIds);
      filteredEquipment.forEach(eq => currentSet.add(eq.id));
      setSelectedEquipmentIds(Array.from(currentSet));
    }
  };

  const handleToggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedEquipmentIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedEquipmentIds([]);
  };

  const handleOpenDeleteConfirmForSingle = (eq: Equipment, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEquipmentToDelete([eq]);
  };

  const handleOpenDeleteConfirmForSelected = () => {
    const selectedObjs = equipmentList.filter(eq => selectedEquipmentIds.includes(eq.id));
    if (selectedObjs.length === 0) return;
    setEquipmentToDelete(selectedObjs);
  };

  const handleExecuteDelete = () => {
    if (!equipmentToDelete || equipmentToDelete.length === 0) return;
    setIsDeleting(true);
    try {
      const ids = equipmentToDelete.map(eq => eq.id);
      const count = DielectricStorageService.deleteMultipleEquipment(ids);
      
      // Update selection
      setSelectedEquipmentIds(prev => prev.filter(id => !ids.includes(id)));
      
      // Close details modal if the active equipment was deleted
      if (selectedEquipmentForDetails && ids.includes(selectedEquipmentForDetails.id)) {
        setSelectedEquipmentForDetails(null);
      }
      
      loadData();
      setDeleteSuccessToast(`${count} equipamento(s) excluído(s) com sucesso do inventário.`);
      setTimeout(() => setDeleteSuccessToast(null), 4000);
    } catch (err: any) {
      alert('Erro ao excluir equipamento(s): ' + (err?.message || 'Falha na exclusão'));
    } finally {
      setIsDeleting(false);
      setEquipmentToDelete(null);
    }
  };

  const handleCreateEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim() || !newClientId) return;

    const client = clients.find(c => c.id === newClientId);

    const newEq: Equipment = {
      id: 'eq-' + Date.now(),
      uuid: 'uuid-' + Math.random().toString(36).substring(2, 9),
      clientId: newClientId,
      clientName: client?.nomeFantasia || client?.razaoSocial || 'Cliente',
      type: newType,
      tag: newTag.trim().toUpperCase(),
      serialNumber: newSerial.trim() || 'S/N-' + Math.floor(Math.random() * 10000),
      caNumber: newCaNumber.trim(),
      manufacturer: newManufacturer.trim() || 'Fabricante Homologado',
      model: newModel.trim() || 'Modelo Padrão',
      dielectricClass: newClass,
      collaboratorName: newCollaboratorName.trim() || undefined,
      collaboratorSector: newCollaboratorSector.trim() || undefined,
      isolatedTools: newType === 'ferramenta_isolada' ? newIsolatedTools : undefined,
      acquisitionDate: newFabricationDate,
      retestIntervalMonths: 6,
      status: 'disponivel',
      qrCode: newTag.trim().toUpperCase(),
      notes: newNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    DielectricStorageService.saveEquipment(newEq);
    loadData();
    setIsAddModalOpen(false);

    // Reset Form
    setNewTag('');
    setNewSerial('');
    setNewCaNumber('');
    setNewCollaboratorName('');
    setNewCollaboratorSector('');
    setNewNotes('');
    setNewIsolatedTools([]);
  };

  const handleShowQRCode = async (eq: Equipment) => {
    const qrUrl = await generateQRCodeDataUrl(eq.tag);
    setQrCodeModalData({ equipment: eq, qrUrl });
  };

  const handleOpenNiimbotForEquipment = (eq: Equipment) => {
    const allTests = DielectricStorageService.getTests();
    const existingTest = allTests.find(t => t.equipmentId === eq.id || t.equipmentTag === eq.tag);
    if (existingTest) {
      setNiimbotModalTests([existingTest]);
    } else {
      const syntheticTest: TestRecord = {
        id: `synth-${eq.id}`,
        uuid: `uuid-synth-${eq.id}`,
        testNumber: `ENS-${eq.tag}`,
        reportNumber: `LDT-${eq.tag}`,
        certificateNumber: `CERT-${eq.tag}`,
        clientId: eq.clientId,
        clientName: eq.clientName || 'Cliente',
        collaboratorName: eq.collaboratorName,
        collaboratorSector: eq.collaboratorSector,
        equipmentId: eq.id,
        equipmentTag: eq.tag,
        equipmentType: eq.type,
        equipmentClass: eq.dielectricClass,
        equipmentSerial: eq.serialNumber,
        equipmentCa: eq.caNumber,
        serviceOrderId: 'OS-INVENTARIO',
        serviceOrderNumber: 'OS-INVENTARIO',
        technicianId: 'tech-1',
        technicianName: 'Analista Executor',
        technicianCftOrCrea: 'CFT-SP 123456',
        techResponsibleId: 'rt-1',
        techResponsibleName: company.technicalResponsible?.name || 'Eng. Responsável Técnico',
        techResponsibleCrea: company.technicalResponsible?.creaNumber || 'CREA-SP 987654',
        testDate: eq.lastTestDate || new Date().toISOString().split('T')[0],
        testTime: '09:00',
        location: 'Laboratório Móvel JVM',
        normCode: EQUIPMENT_NORM_SPECIFICATIONS[eq.type]?.norm || 'NBR 16295 / IEC 60903',
        appliedClass: eq.dielectricClass,
        appliedVoltage_kV: 10,
        voltageType: 'AC',
        applicationDurationSeconds: 60,
        measuredLeakageCurrent_mA: 3.5,
        leakageCurrentLimit_mA: 10,
        currentUnit: 'mA',
        withstandWithoutPuncture: true,
        environmental: {
          temperatureC: 24,
          relativeHumidityPercent: 55,
          measurementDateTime: new Date().toISOString()
        },
        visualInspection: [],
        visualInspectionPassed: true,
        instrumentsUsed: [],
        result: eq.status === 'reprovado' ? 'REPROVADO' : 'APROVADO',
        resultRationale: 'Equipamento em conformidade dielétrica.',
        technicalNotes: eq.notes || 'Equipamento do inventário.',
        retestDueDate: eq.nextTestDueDate || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        photos: [],
        validationCode: eq.tag.replace(/[^A-Z0-9]/gi, '').slice(0, 8) || 'VAL12345',
        documentHash: 'hash-synth-' + eq.tag,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
        syncVersion: 1,
        deviceId: 'local-device'
      };
      setNiimbotModalTests([syntheticTest]);
    }
    setIsNiimbotModalOpen(true);
  };

  const handleBatchPrintNiimbotForSelected = () => {
    const selectedObjs = equipmentList.filter(eq => selectedEquipmentIds.includes(eq.id));
    if (selectedObjs.length === 0) return;

    const allTests = DielectricStorageService.getTests();
    const batchTests: TestRecord[] = selectedObjs.map(eq => {
      const existing = allTests.find(t => t.equipmentId === eq.id || t.equipmentTag === eq.tag);
      if (existing) return existing;

      return {
        id: `synth-${eq.id}`,
        uuid: `uuid-synth-${eq.id}`,
        testNumber: `ENS-${eq.tag}`,
        reportNumber: `LDT-${eq.tag}`,
        certificateNumber: `CERT-${eq.tag}`,
        clientId: eq.clientId,
        clientName: eq.clientName || 'Cliente',
        collaboratorName: eq.collaboratorName,
        collaboratorSector: eq.collaboratorSector,
        equipmentId: eq.id,
        equipmentTag: eq.tag,
        equipmentType: eq.type,
        equipmentClass: eq.dielectricClass,
        equipmentSerial: eq.serialNumber,
        equipmentCa: eq.caNumber,
        serviceOrderId: 'OS-INVENTARIO',
        serviceOrderNumber: 'OS-INVENTARIO',
        technicianId: 'tech-1',
        technicianName: 'Analista Executor',
        technicianCftOrCrea: 'CFT-SP 123456',
        techResponsibleId: 'rt-1',
        techResponsibleName: company.technicalResponsible?.name || 'Eng. Responsável Técnico',
        techResponsibleCrea: company.technicalResponsible?.creaNumber || 'CREA-SP 987654',
        testDate: eq.lastTestDate || new Date().toISOString().split('T')[0],
        testTime: '09:00',
        location: 'Laboratório Móvel JVM',
        normCode: EQUIPMENT_NORM_SPECIFICATIONS[eq.type]?.norm || 'NBR 16295 / IEC 60903',
        appliedClass: eq.dielectricClass,
        appliedVoltage_kV: 10,
        voltageType: 'AC',
        applicationDurationSeconds: 60,
        measuredLeakageCurrent_mA: 3.5,
        leakageCurrentLimit_mA: 10,
        currentUnit: 'mA',
        withstandWithoutPuncture: true,
        environmental: {
          temperatureC: 24,
          relativeHumidityPercent: 55,
          measurementDateTime: new Date().toISOString()
        },
        visualInspection: [],
        visualInspectionPassed: true,
        instrumentsUsed: [],
        result: eq.status === 'reprovado' ? 'REPROVADO' : 'APROVADO',
        resultRationale: 'Equipamento em conformidade dielétrica.',
        technicalNotes: eq.notes || 'Equipamento do inventário.',
        retestDueDate: eq.nextTestDueDate || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        photos: [],
        validationCode: eq.tag.replace(/[^A-Z0-9]/gi, '').slice(0, 8) || 'VAL12345',
        documentHash: 'hash-synth-' + eq.tag,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
        syncVersion: 1,
        deviceId: 'local-device'
      };
    });

    setNiimbotModalTests(batchTests);
    setIsNiimbotModalOpen(true);
  };

  // Get tests history for selected equipment
  const equipmentTests = selectedEquipmentForDetails
    ? DielectricStorageService.getTests().filter(t => t.equipmentId === selectedEquipmentForDetails.id || t.equipmentTag === selectedEquipmentForDetails.tag)
    : [];

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {deleteSuccessToast && (
        <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>{deleteSuccessToast}</span>
          </div>
          <button onClick={() => setDeleteSuccessToast(null)} className="p-1 hover:bg-emerald-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Catálogo & Inventário de EPI / EPC</h2>
          <p className="text-xs text-slate-500">
            Gerenciamento de luvas, mangas, mantas, bastões e coberturas dielétricas com seleção múltipla, exclusão em lote e controle de validade
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedEquipmentIds.length > 0 && (
            <button
              onClick={handleOpenDeleteConfirmForSelected}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir Selecionados ({selectedEquipmentIds.length})</span>
            </button>
          )}

          <button
            onClick={() => {
              if (clients.length > 0) setNewClientId(clients[0].id);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Cadastrar Novo Equipamento
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        {/* Quick Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase mr-1 shrink-0">Categorias:</span>
          {[
            { id: 'all', label: 'Todos os Equipamentos' },
            { id: 'luva_isolante', label: '🧤 Luvas Isolantes (NBR 16295 Tabela 4)' },
            { id: 'manga_isolante', label: '🛡️ Mangas Isolantes' },
            { id: 'manta_isolante', label: '🟨 Mantas de Cobertura (ASTM D1048)' },
            { id: 'tapete_isolante', label: '🟩 Tapetes Isolantes (ASTM D178-22)' },
            { id: 'bastao_manobra', label: '🦯 Bastões de Manobra' },
            { id: 'ferramenta_isolada', label: '🔧 Ferramentas Isoladas (NBR 9699)' },
            { id: 'capacete_classe_b', label: '⛑️ Capacetes Classe B' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterType(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                filterType === cat.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Tag, Série, CA, Fabricante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="all">Todos os Tipos de EPI / EPC</option>
              <option value="luva_isolante">Luvas Isolantes de Borracha (NBR 16295 Tabela 4)</option>
              <option value="manga_isolante">Mangas Isolantes (NBR 10624)</option>
              <option value="manta_isolante">Mantas de Cobertura (ASTM D1048)</option>
              <option value="tapete_isolante">Tapetes Isolantes de Borracha (ASTM D178-22)</option>
              <option value="bastao_manobra">Bastões de Manobra e Salvamento</option>
              <option value="vara_manobra">Varas de Manobra Telescópicas</option>
              <option value="ferramenta_isolada">Ferramentas Manuais Isoladas (NBR 9699)</option>
              <option value="capacete_classe_b">Capacetes Classe B (NBR 8221)</option>
              <option value="cobertura_rigida">Coberturas Rígidas de Linha Viva</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os Status</option>
              <option value="em_uso">Em Uso / Aprovado</option>
              <option value="disponivel">Disponível</option>
              <option value="em_manutencao">Em Manutenção</option>
              <option value="fora_de_servico">Fora de Serviço (Vencido)</option>
              <option value="reprovado">Reprovado</option>
              <option value="descartado">Descartado</option>
            </select>
          </div>

          {/* Client Filter */}
          <div>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os Clientes</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nomeFantasia || c.razaoSocial || 'Cliente'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Batch Selection Action Bar */}
      {selectedEquipmentIds.length > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3 border border-slate-800 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/40">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black flex items-center gap-2">
                <span>{selectedEquipmentIds.length} equipamento(s) selecionado(s)</span>
                {selectedFilteredCount < selectedEquipmentIds.length && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    ({selectedFilteredCount} visíveis nesta filtragem)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Ações em massa disponíveis para os itens marcados
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isAllFilteredSelected && filteredEquipment.length > 0 && (
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                Selecionar Todos ({filteredEquipment.length})
              </button>
            )}

            <button
              type="button"
              onClick={handleBatchPrintNiimbotForSelected}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Gerar etiquetas térmicas Niimbot para os selecionados"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Etiquetas Niimbot ({selectedEquipmentIds.length})</span>
            </button>

            <button
              type="button"
              onClick={handleOpenDeleteConfirmForSelected}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Selecionados ({selectedEquipmentIds.length})</span>
            </button>

            <button
              type="button"
              onClick={handleClearSelection}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Desmarcar
            </button>
          </div>
        </div>
      )}

      {/* Equipment Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-12 text-center">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer inline-flex items-center justify-center"
                    title={isAllFilteredSelected ? "Desmarcar todos" : "Selecionar todos os filtrados"}
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : isSomeFilteredSelected ? (
                      <MinusSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3.5">Tag / Patrimônio</th>
                <th className="p-3.5">Tipo & Classe</th>
                <th className="p-3.5">Cliente Proprietário</th>
                <th className="p-3.5">Fabricante / Série / CA</th>
                <th className="p-3.5">Último Ensaio</th>
                <th className="p-3.5">Próximo Vencimento</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredEquipment.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    <p className="font-semibold text-sm">Nenhum equipamento encontrado com os filtros atuais.</p>
                    <p className="text-xs mt-1">Cadastre um novo equipamento ou altere a busca.</p>
                  </td>
                </tr>
              ) : (
                filteredEquipment.map(eq => {
                  const isSelected = selectedEquipmentIds.includes(eq.id);
                  return (
                    <tr 
                      key={eq.id} 
                      className={`transition-colors ${
                        isSelected 
                          ? 'bg-blue-50/70 hover:bg-blue-100/60' 
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="p-3.5 w-12 text-center">
                        <button
                          type="button"
                          onClick={(e) => handleToggleSelectOne(eq.id, e)}
                          className="p-1 rounded hover:bg-slate-200/80 text-slate-600 transition-colors cursor-pointer inline-flex items-center justify-center"
                          title={isSelected ? "Desmarcar equipamento" : "Selecionar equipamento"}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => setSelectedEquipmentForDetails(eq)}
                          className="font-bold text-blue-700 font-mono hover:underline text-left block"
                        >
                          {eq.tag}
                        </button>
                        <span className="text-[10px] text-slate-400 font-mono">{eq.uuid}</span>
                      </td>
                      <td className="p-3.5">
                        {eq.type === 'manta_isolante' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-extrabold text-[11px] border border-amber-300">
                              🟨 Manta Isolante
                            </span>
                            <span className="text-[10px] text-amber-800 font-bold block mt-0.5">ASTM D1048 • Cl {eq.dielectricClass}</span>
                          </div>
                        ) : eq.type === 'tapete_isolante' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-extrabold text-[11px] border border-emerald-300">
                              🟩 Tapete Isolante
                            </span>
                            <span className="text-[10px] text-emerald-800 font-bold block mt-0.5">ASTM D178-22 • Cl {eq.dielectricClass}</span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-900 block uppercase">{eq.type.replace('_', ' ')}</span>
                            <span className="text-[11px] text-blue-800 font-semibold">Classe {eq.dielectricClass}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-700">
                        <span className="font-semibold block">{eq.clientName}</span>
                        {eq.collaboratorName && (
                          <span className="text-[10px] text-orange-700 font-medium block truncate max-w-[160px]" title={`${eq.collaboratorName} (${eq.collaboratorSector || ''})`}>
                            👤 {eq.collaboratorName}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="text-slate-800 font-medium block">{eq.manufacturer} - {eq.model}</span>
                        <span className="text-[10px] text-slate-500 font-mono">SN: {eq.serialNumber} • CA: {eq.caNumber || 'N/A'}</span>
                      </td>
                      <td className="p-3.5 text-slate-600">{eq.lastTestDate ? formatDateBR(eq.lastTestDate) : 'Pendente'}</td>
                      <td className="p-3.5 font-bold font-mono">
                        {eq.nextTestDueDate ? (
                          <span className={eq.nextTestDueDate < new Date().toISOString().split('T')[0] ? 'text-red-600' : 'text-slate-800'}>
                            {formatDateBR(eq.nextTestDueDate)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Não ensaiado</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <StatusBadge type="equipment" status={eq.status} size="sm" />
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleShowQRCode(eq)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Etiqueta QR Code"
                          >
                            <QrCodeIcon className="w-4 h-4 text-slate-700" />
                          </button>

                          <button
                            onClick={() => handleOpenNiimbotForEquipment(eq)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors cursor-pointer"
                            title="Etiqueta Térmica Niimbot B1 (203 DPI)"
                          >
                            <Tag className="w-4 h-4 text-amber-600" />
                          </button>

                          <button
                            onClick={() => setSelectedEquipmentForDetails(eq)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Ver Linha do Tempo & Histórico"
                          >
                            <History className="w-4 h-4 text-blue-600" />
                          </button>

                          <button
                            onClick={() => onStartNewTest(eq.id)}
                            className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                            title="Iniciar Ensaio Dielétrico deste Equipamento"
                          >
                            <FlaskConical className="w-3.5 h-3.5" /> Ensaio
                          </button>

                          <button
                            onClick={(e) => handleOpenDeleteConfirmForSingle(eq, e)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="Excluir Equipamento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Add New Equipment */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden">
            <div className="bg-[#0A2540] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Cadastrar Novo Equipamento Dielétrico</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-slate-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tag / Identificador Único *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: LUV-VALE-008"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl uppercase font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cliente Proprietário *</label>
                  <select
                    value={newClientId}
                    onChange={(e) => setNewClientId(e.target.value)}
                    required
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nomeFantasia || c.razaoSocial || 'Cliente'} (CNPJ: {c.cnpj})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Equipamento / EPI *</label>
                  <select
                    value={newType}
                    onChange={(e) => {
                      const t = e.target.value as EquipmentType;
                      setNewType(t);
                      if (t === 'ferramenta_isolada' && newClass !== '0') {
                        setNewClass('0');
                        if (!newManufacturer) setNewManufacturer('Gedore');
                      } else if (t === 'capacete_classe_b') {
                        setNewClass('2');
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="luva_isolante">🧤 Luvas Isolantes de Borracha (NBR 16295 Tabela 4)</option>
                    <option value="manga_isolante">🛡️ Mangas Isolantes de Borracha (ABNT NBR 10624 / ASTM D1051)</option>
                    <option value="manta_isolante">🟨 Mantas de Cobertura / Lençóis Isolantes (ASTM D1048)</option>
                    <option value="tapete_isolante">🟩 Tapetes Isolantes de Borracha (ASTM D178-22)</option>
                    <option value="bastao_manobra">🦯 Bastões de Manobra e Salvamento (ABNT NBR 16613 / ASTM F711)</option>
                    <option value="vara_manobra">🎋 Varas de Manobra Telescópicas (ABNT NBR 16613)</option>
                    <option value="capacete_classe_b">⛑️ Capacetes de Segurança Classe B — Classe 2 (ABNT NBR 8221 / ANSI Z89.1)</option>
                    <option value="bota_dielétrica">🥾 Calçados / Botas Dielétricas (ABNT NBR 16603)</option>
                    <option value="ferramenta_isolada">🔧 Ferramentas Manuais Isoladas 1000V (ABNT NBR 9699 / IEC 60900)</option>
                    <option value="escada_isolada">🪜 Escadas Isoladas em Fibra de Vidro (ABNT NBR IEC 61478)</option>
                    <option value="detector_tensao">⚡ Detectores de Tensão (ABNT NBR IEC 61243-1)</option>
                    <option value="ponteira_prova">🔌 Ponteiras de Prova (IEC 61010-031)</option>
                    <option value="outro">📦 Outros Dispositivos Dielétricos</option>
                  </select>
                  {EQUIPMENT_NORM_SPECIFICATIONS[newType] && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-50 px-2 py-1 rounded-lg font-medium border border-blue-100">
                      <span className="font-bold">Norma Técnica de Referência:</span>
                      <span>{EQUIPMENT_NORM_SPECIFICATIONS[newType].norm}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Classe Dielétrica *</label>
                  <select
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value as DielectricClass)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="00">Classe 00 (500V CA)</option>
                    <option value="0">Classe 0 (1.000V CA)</option>
                    <option value="1">Classe 1 (7.500V CA)</option>
                    <option value="2">Classe 2 (17.000V CA)</option>
                    <option value="3">Classe 3 (26.500V CA)</option>
                    <option value="4">Classe 4 (36.000V CA)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fabricante</label>
                  <input
                    type="text"
                    placeholder="Ex: Orion / Novax / Gedore / Salisbury"
                    value={newManufacturer}
                    onChange={(e) => setNewManufacturer(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº de Série</label>
                  <input
                    type="text"
                    placeholder="Ex: SN-889422"
                    value={newSerial}
                    onChange={(e) => setNewSerial(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">CA (Certificado de Aprovação)</label>
                  <input
                    type="text"
                    placeholder="Ex: CA 29774"
                    value={newCaNumber}
                    onChange={(e) => setNewCaNumber(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data de Fabricação</label>
                  <input
                    type="date"
                    value={newFabricationDate}
                    onChange={(e) => setNewFabricationDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-orange-500" />
                    Nome / Colaborador (Usuário do EPI)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Eduardo Silva"
                    value={newCollaboratorName}
                    onChange={(e) => setNewCollaboratorName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-orange-500" />
                    Matrícula / Setor
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: MAT-4892 / Linha Viva"
                    value={newCollaboratorSector}
                    onChange={(e) => setNewCollaboratorSector(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Se for Ferramenta Isolada, exibir o seletor de ferramentas com quantidade e fabricante */}
              {newType === 'ferramenta_isolada' && (
                <IsolatedToolsSelector
                  tools={newIsolatedTools}
                  onChange={setNewIsolatedTools}
                  defaultManufacturer={newManufacturer || 'Gedore'}
                />
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observações do Equipamento</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Equipamento alocado no caminhão de linha viva 04..."
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm cursor-pointer"
                >
                  Salvar Equipamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete Single or Multiple Equipment */}
      {equipmentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-200" />
                <h3 className="font-bold text-base">
                  {equipmentToDelete.length === 1 ? 'Excluir Equipamento' : `Excluir ${equipmentToDelete.length} Equipamentos`}
                </h3>
              </div>
              <button 
                onClick={() => setEquipmentToDelete(null)}
                disabled={isDeleting}
                className="p-1 text-red-200 hover:text-white cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-red-900 space-y-1">
                <p className="font-bold text-sm">
                  {equipmentToDelete.length === 1
                    ? `Deseja realmente excluir o equipamento "${equipmentToDelete[0].tag}"?`
                    : `Deseja realmente excluir os ${equipmentToDelete.length} equipamentos selecionados?`}
                </p>
                <p className="text-[11px] text-red-700">
                  Esta ação removerá o(s) equipamento(s) do inventário ativo. Os registros de laudos anteriores emitidos permanecerão preservados nos arquivos para histórico normativo.
                </p>
              </div>

              {/* List of items to delete */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Equipamentos a serem removidos ({equipmentToDelete.length}):
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {equipmentToDelete.map(eq => (
                    <div key={eq.id} className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
                      <div>
                        <span className="font-bold font-mono text-slate-900 block">{eq.tag}</span>
                        <span className="text-[10px] text-slate-500">
                          {eq.type.replace('_', ' ').toUpperCase()} • Cl {eq.dielectricClass} • {eq.clientName}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">SN: {eq.serialNumber}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEquipmentToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDelete}
                  disabled={isDeleting}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Equipment Details & Timeline of Tests */}
      {selectedEquipmentForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0A2540] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-400" />
                <div>
                  <h3 className="font-bold text-base">Ficha do Equipamento & Histórico de Ensaios</h3>
                  <p className="text-xs text-slate-300 font-mono">Tag: {selectedEquipmentForDetails.tag}</p>
                </div>
              </div>
              <button onClick={() => setSelectedEquipmentForDetails(null)} className="p-1 text-slate-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Equipment Info Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500 block">Tipo:</span>
                  <span className="font-bold text-slate-900 uppercase">{selectedEquipmentForDetails.type.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Classe Dielétrica:</span>
                  <span className="font-bold text-blue-700">Classe {selectedEquipmentForDetails.dielectricClass}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Cliente:</span>
                  <span className="font-bold text-slate-900">{selectedEquipmentForDetails.clientName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Fabricante / Série:</span>
                  <span className="font-semibold text-slate-800">{selectedEquipmentForDetails.manufacturer} ({selectedEquipmentForDetails.serialNumber})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Certificado de Aprovação:</span>
                  <span className="font-semibold text-slate-800">{selectedEquipmentForDetails.caNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status Operacional:</span>
                  <StatusBadge type="equipment" status={selectedEquipmentForDetails.status} size="sm" />
                </div>
                <div>
                  <span className="text-slate-500 block">Colaborador / Usuário:</span>
                  <span className="font-semibold text-slate-800">{selectedEquipmentForDetails.collaboratorName || 'Não atribuído'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Matrícula / Setor:</span>
                  <span className="font-semibold text-slate-800">{selectedEquipmentForDetails.collaboratorSector || selectedEquipmentForDetails.sector || 'Geral'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Ordem de Serviço (OS):</span>
                  <span className="font-semibold text-blue-700 font-mono">
                    {selectedEquipmentForDetails.serviceOrderNumber || (selectedEquipmentForDetails.serviceOrderId ? `OS: ${selectedEquipmentForDetails.serviceOrderId}` : 'Ensaio Avulso')}
                  </span>
                </div>
              </div>

              {/* Retest Status Banner */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 flex items-center justify-between">
                <div>
                  <span className="text-slate-600 block">Periodicidade de Reensaio:</span>
                  <span className="font-extrabold text-blue-900 text-sm font-mono">
                    {selectedEquipmentForDetails.nextTestDueDate 
                      ? `Próximo vencimento: ${formatDateBR(selectedEquipmentForDetails.nextTestDueDate)}` 
                      : 'Sem registro de ensaio'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const eq = selectedEquipmentForDetails;
                      handleOpenDeleteConfirmForSingle(eq);
                    }}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-red-200"
                    title="Excluir este equipamento"
                  >
                    <Trash2 className="w-4 h-4" /> Excluir
                  </button>

                  <button
                    onClick={() => {
                      const eqId = selectedEquipmentForDetails.id;
                      setSelectedEquipmentForDetails(null);
                      onStartNewTest(eqId);
                    }}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FlaskConical className="w-4 h-4" /> Realizar Novo Ensaio
                  </button>
                </div>
              </div>

              {/* Se houver composição de Ferramentas Isoladas */}
              {selectedEquipmentForDetails.isolatedTools && selectedEquipmentForDetails.isolatedTools.length > 0 && (
                <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2 text-xs">
                    <Wrench className="w-4 h-4 text-orange-600" />
                    Composição do Jogo de Ferramentas Manuais Isoladas 1000V ({selectedEquipmentForDetails.isolatedTools.reduce((s, i) => s + (Number(i.quantity) || 1), 0)} peças)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedEquipmentForDetails.isolatedTools.map((t, idx) => (
                      <div key={t.id || idx} className="bg-white p-2.5 rounded-lg border border-orange-100 flex items-center justify-between shadow-2xs">
                        <div>
                          <span className="font-bold text-slate-800 block">{t.toolName}</span>
                          <span className="text-[11px] text-slate-500">{t.sizeOrSpec || 'Isolação 1000V'} • Fabr.: <strong>{t.manufacturer}</strong></span>
                        </div>
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded font-bold font-mono text-xs">
                          {t.quantity} un
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline of All Tests */}
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  Linha do Tempo de Ensaios Realizados ({equipmentTests.length})
                </h4>

                {equipmentTests.length > 0 ? (
                  <div className="space-y-3">
                    {equipmentTests.map((t, idx) => (
                      <div key={t.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StatusBadge type="test" status={t.result} size="sm" />
                            <span className="font-bold text-slate-900 font-mono">{t.reportNumber}</span>
                          </div>
                          <span className="text-slate-500 text-[11px]">{formatDateBR(t.testDate)} às {t.testTime}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                          <div>
                            <span className="text-slate-400 block">Tensão:</span>
                            <span className="font-bold text-slate-800">{t.appliedVoltage_kV} kV {t.voltageType}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Fuga Medida:</span>
                            <span className="font-bold text-blue-700">{t.measuredLeakageCurrent_mA} {t.currentUnit}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Analista:</span>
                            <span className="font-semibold text-slate-800">{t.technicianName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Reensaio:</span>
                            <span className="font-mono font-bold text-slate-800">{formatDateBR(t.retestDueDate)}</span>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => {
                              setSelectedEquipmentForDetails(null);
                              onOpenTestLaudo(t);
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" /> Ver Laudo Técnico
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Nenhum ensaio registrado para este equipamento.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Printable QR Code Badge */}
      {qrCodeModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Etiqueta de Identificação</span>
              <button onClick={() => setQrCodeModalData(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-300 p-4 rounded-xl bg-slate-50 space-y-2">
              <span className="text-xs font-black text-[#0A2540] block">JVM ENGENHARIA</span>
              <img src={qrCodeModalData.qrUrl} alt="QR Code" className="w-36 h-36 mx-auto bg-white p-1 rounded-lg border border-slate-200 shadow-xs" />
              <div className="text-xs font-mono font-bold text-blue-700">{qrCodeModalData.equipment.tag}</div>
              <p className="text-[10px] text-slate-500 uppercase">
                {qrCodeModalData.equipment.type.replace('_', ' ')} • Classe {qrCodeModalData.equipment.dielectricClass}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const eq = qrCodeModalData.equipment;
                    setQrCodeModalData(null);
                    handleOpenNiimbotForEquipment(eq);
                  }}
                  className="flex-1 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-xs shadow-xs hover:from-orange-600 hover:to-amber-600 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Tag className="w-4 h-4" /> Etiqueta Niimbot B1 (Térmica)
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs hover:bg-slate-900 inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Imprimir A4
                </button>
                <button
                  onClick={() => setQrCodeModalData(null)}
                  className="py-2 px-4 bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs hover:bg-slate-200 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Etiquetas Niimbot B1 */}
      <NiimbotLabelModal
        isOpen={isNiimbotModalOpen}
        onClose={() => setIsNiimbotModalOpen(false)}
        tests={niimbotModalTests}
        company={company}
      />
    </div>
  );
};
