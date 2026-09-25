import React, { useState, useEffect, useRef } from 'react';
import { 
  Gauge, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Award, 
  FileText,
  X,
  Wrench,
  Upload,
  Image as ImageIcon,
  FileCheck,
  Eye,
  Download,
  Trash2,
  Edit3,
  Camera,
  ExternalLink,
  Paperclip,
  Check,
  Zap,
  Building2,
  Sparkles
} from 'lucide-react';
import { LabInstrument } from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { StatusBadge } from '../components/StatusBadge';
import { formatDateBR } from '../utils/dateUtils';

export const LabInstrumentsView: React.FC = () => {
  const [instruments, setInstruments] = useState<LabInstrument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<LabInstrument | null>(null);
  
  // Preview / Details Modal state
  const [viewingInstrument, setViewingInstrument] = useState<LabInstrument | null>(null);
  const [viewingCertModal, setViewingCertModal] = useState<LabInstrument | null>(null);
  const [viewingPhotoModal, setViewingPhotoModal] = useState<LabInstrument | null>(null);

  // Form State
  const [instrumentTypes, setInstrumentTypes] = useState<string[]>([
    'Hipot AC/DC Digital',
    'Mesa de Ensaios / Hipot CA',
    'Mesa Dielétrica de Campo Portátil',
    'Termohigrômetro Digital de Precisão',
    'Micro-ohmímetro Digital',
    'Miliamperímetro de Fuga',
    'Divisor de Alta Tensão',
    'Megômetro de Alta Tensão',
    'Fonte de Alta Tensão',
    'Calibrador de Tensão e Corrente'
  ]);
  const [isAddingNewType, setIsAddingNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  const [type, setType] = useState('Hipot AC/DC Digital');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [assetNumber, setAssetNumber] = useState('');
  const [calibrationCertNumber, setCalibrationCertNumber] = useState('');
  const [calibrationDate, setCalibrationDate] = useState('2025-06-01');
  const [calibrationExpiryDate, setCalibrationExpiryDate] = useState('2026-06-01');
  const [calibrationLab, setCalibrationLab] = useState('Laboratório Acreditado RBC/Inmetro');
  const [maxVoltageCapacity_kV, setMaxVoltageCapacity_kV] = useState(50);
  const [measurementRange, setMeasurementRange] = useState('');
  const [notes, setNotes] = useState('');
  
  // Image and Certificate attachment state
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [certFileUrl, setCertFileUrl] = useState<string | undefined>(undefined);
  const [certFileName, setCertFileName] = useState<string | undefined>(undefined);

  // File Input Refs
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const certInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const loadInstruments = () => {
    const instList = DielectricStorageService.getInstruments();
    setInstruments(instList);

    // Carregar tipos customizados salvos e tipos existentes nos instrumentos
    try {
      const savedTypes = localStorage.getItem('jvm_dielectric_instrument_types');
      const parsedTypes: string[] = savedTypes ? JSON.parse(savedTypes) : [];
      const instTypes = instList.map(i => i.type).filter(Boolean);
      
      setInstrumentTypes(prev => {
        const combined = Array.from(new Set([...prev, ...parsedTypes, ...instTypes]));
        return combined;
      });
    } catch {
      // fallback
    }
  };

  const handleAddNewType = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTypeName.trim();
    if (!trimmed) return;

    setInstrumentTypes(prev => {
      const updated = prev.includes(trimmed) ? prev : [...prev, trimmed];
      try {
        localStorage.setItem('jvm_dielectric_instrument_types', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    setType(trimmed);
    setNewTypeName('');
    setIsAddingNewType(false);
  };

  useEffect(() => {
    loadInstruments();
  }, []);

  const openCreateModal = () => {
    setEditingInstrument(null);
    setIsAddingNewType(false);
    setNewTypeName('');
    setType(instrumentTypes[0] || 'Hipot AC/DC Digital');
    setManufacturer('');
    setModel('');
    setSerialNumber('');
    setAssetNumber('');
    setCalibrationCertNumber('');
    setCalibrationDate('2025-06-01');
    setCalibrationExpiryDate('2026-06-01');
    setCalibrationLab('Laboratório Acreditado RBC/Inmetro');
    setMaxVoltageCapacity_kV(50);
    setMeasurementRange('0 a 50 kV CA / 0 a 100 mA');
    setNotes('Instrumento padrão verificado para ensaios dielétricos.');
    setImageUrl(undefined);
    setCertFileUrl(undefined);
    setCertFileName(undefined);
    setIsAddModalOpen(true);
  };

  const openEditModal = (inst: LabInstrument) => {
    setEditingInstrument(inst);
    setIsAddingNewType(false);
    setNewTypeName('');
    setType(inst.type);
    // Garantir que o tipo do instrumento editado esteja na lista
    setInstrumentTypes(prev => prev.includes(inst.type) ? prev : [...prev, inst.type]);
    setManufacturer(inst.manufacturer);
    setModel(inst.model);
    setSerialNumber(inst.serialNumber);
    setAssetNumber(inst.assetNumber || '');
    setCalibrationCertNumber(inst.calibrationCertNumber);
    setCalibrationDate(inst.calibrationDate);
    setCalibrationExpiryDate(inst.calibrationExpiryDate);
    setCalibrationLab(inst.calibratingLab);
    setMaxVoltageCapacity_kV(inst.maxVoltageCapacity_kV || 50);
    setMeasurementRange(inst.measurementRange || '');
    setNotes(inst.notes || '');
    setImageUrl(inst.imageUrl);
    setCertFileUrl(inst.certFileUrl);
    setCertFileName(inst.certFileName);
    setIsAddModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCertFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCertFileUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveInstrument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!model.trim() || !serialNumber.trim()) return;

    const instrumentData: LabInstrument = {
      id: editingInstrument ? editingInstrument.id : 'inst-' + Date.now(),
      type,
      manufacturer: manufacturer.trim() || 'Fabricante Homologado',
      model: model.trim(),
      serialNumber: serialNumber.trim(),
      assetNumber: assetNumber.trim() || undefined,
      calibrationCertNumber: calibrationCertNumber.trim() || 'CERT-RBC-' + Math.floor(Math.random() * 100000),
      calibrationDate,
      calibrationExpiryDate,
      calibratingLab: calibrationLab.trim(),
      measurementRange: measurementRange.trim() || `0 a ${maxVoltageCapacity_kV || 50} kV`,
      maxVoltageCapacity_kV: Number(maxVoltageCapacity_kV) || 50,
      active: editingInstrument ? editingInstrument.active : true,
      notes: notes.trim() || 'Instrumento de ensaio verificado.',
      imageUrl,
      certFileUrl,
      certFileName
    };

    DielectricStorageService.saveInstrument(instrumentData);
    loadInstruments();
    setIsAddModalOpen(false);
    setEditingInstrument(null);
  };

  const handleDeleteInstrument = (id: string, name: string) => {
    if (window.confirm(`Deseja realmente remover o instrumento "${name}" do cadastro?`)) {
      // Exclusão lógica sincronizada com o Supabase (antes gravava direto no
      // armazenamento e apagava os instrumentos das outras empresas)
      DielectricStorageService.deleteInstrument(id);
      loadInstruments();
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const filteredInstruments = instruments.filter(i => 
    i.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.calibrationCertNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Instrumentação do Laboratório & Hipot</h2>
          <p className="text-xs text-slate-500">
            Controle metrológico de equipamentos de ensaio, certificados RBC (Inmetro), fotos dos aparelhos e validade
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Cadastrar Instrumento
        </button>
      </div>

      {/* Search Input & Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-3 bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex items-center">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Modelo, Tipo, Fabricante, Nº de Série, Certificado RBC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Total Cadastrado</span>
            <span className="text-base font-bold">{instruments.length} instrumentos</span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Gauge className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Instruments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInstruments.map(inst => {
          const isExpired = inst.calibrationExpiryDate < today;
          const hasImage = !!inst.imageUrl;
          const hasCert = !!inst.certFileUrl || !!inst.certFileName;

          return (
            <div 
              key={inst.id} 
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all group"
            >
              {/* Image Preview Banner */}
              <div className="relative h-40 bg-slate-100 border-b border-slate-200 overflow-hidden flex items-center justify-center">
                {hasImage ? (
                  <>
                    <img 
                      src={inst.imageUrl} 
                      alt={inst.model}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                      onClick={() => setViewingPhotoModal(inst)}
                    />
                    <button
                      type="button"
                      onClick={() => setViewingPhotoModal(inst)}
                      className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 hover:bg-black/80 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition-colors"
                      title="Visualizar Foto Ampliada"
                    >
                      <Eye className="w-3 h-3" /> Ver Foto
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 space-y-1 p-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-200/80 flex items-center justify-center text-slate-400">
                      <Gauge className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-medium">Sem foto anexada</span>
                  </div>
                )}

                {/* Status Badge Over Image */}
                <div className="absolute top-3 right-3 shadow-md">
                  <StatusBadge type="calibration" status={isExpired ? 'expired' : 'valid'} size="sm" />
                </div>

                {/* Type Tag */}
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 bg-blue-900/80 text-white backdrop-blur-xs text-[10px] font-bold rounded-lg border border-blue-400/30">
                    {inst.type}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">{inst.manufacturer} - {inst.model}</h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        SN: <span className="font-semibold text-slate-700">{inst.serialNumber}</span>
                        {inst.assetNumber && <span className="ml-2 text-slate-400">| Pat: {inst.assetNumber}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Calibration Details Box */}
                  <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Certificado RBC:</span>
                      <span className="font-bold text-slate-900 font-mono">{inst.calibrationCertNumber}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px]">Laboratório:</span>
                      <span className="text-slate-700 font-medium truncate max-w-[150px]" title={inst.calibratingLab}>
                        {inst.calibratingLab}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Calibração</span>
                        <span className="font-semibold text-slate-800">{formatDateBR(inst.calibrationDate)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Validade RBC</span>
                        <span className={`font-mono font-bold ${isExpired ? 'text-red-600' : 'text-emerald-700'}`}>
                          {formatDateBR(inst.calibrationExpiryDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Certificate Attachment Pill */}
                  <div className="mt-2.5">
                    {hasCert ? (
                      <button
                        type="button"
                        onClick={() => setViewingCertModal(inst)}
                        className="w-full py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                        title="Ver Certificado de Calibração Anexado"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{inst.certFileName || 'Certificado RBC Anexado'}</span>
                        </div>
                        <span className="text-[10px] text-emerald-700 font-semibold underline shrink-0">Visualizar</span>
                      </button>
                    ) : (
                      <div className="py-1 px-2 bg-slate-100 border border-slate-200 text-slate-400 rounded-lg text-[11px] flex items-center gap-1.5 justify-center">
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span>Sem certificado em anexo</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Faixa: <strong className="text-slate-700">{inst.measurementRange || `${inst.maxVoltageCapacity_kV || 50} kV`}</strong>
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(inst)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Editar Instrumento e Anexos"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteInstrument(inst.id, inst.model)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Remover Instrumento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredInstruments.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Gauge className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-700 text-sm">Nenhum instrumento encontrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Não foram encontrados instrumentos correspondentes à busca. Clique no botão de cadastro para adicionar novos instrumentos ao laboratório.
          </p>
        </div>
      )}

      {/* MODAL: Add / Edit Instrument with Image & Certificate Attachment */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[92vh] flex flex-col border border-slate-200">
            {/* Header */}
            <div className="bg-[#0A2540] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {editingInstrument ? 'Editar Instrumento de Laboratório' : 'Cadastrar Instrumento de Laboratório'}
                  </h3>
                  <p className="text-[11px] text-slate-300">Controle metrológico, imagem e certificado de calibração</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveInstrument} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              
              {/* SECTION: Equipment Image Attachment */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    Imagem do Equipamento / Instrumento
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl(undefined)}
                      className="text-[11px] text-red-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Remover Foto
                    </button>
                  )}
                </div>

                {imageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-black/5 max-h-48 flex items-center justify-center">
                    <img 
                      src={imageUrl} 
                      alt="Prévia do Instrumento" 
                      referrerPolicy="no-referrer"
                      className="w-full h-44 object-contain"
                    />
                    <div className="absolute bottom-2 right-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="px-2.5 py-1 bg-black/70 hover:bg-black/90 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs cursor-pointer"
                      >
                        <Upload className="w-3 h-3" /> Trocar Imagem
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => imageInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-4 text-center cursor-pointer bg-white transition-colors flex flex-col items-center justify-center space-y-2 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-700 text-xs block">Clique para enviar a foto do equipamento</span>
                      <span className="text-[11px] text-slate-400">PNG, JPG ou JPEG (Máx 10MB)</span>
                    </div>
                  </div>
                )}

                <input 
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>

              {/* SECTION: Basic Identification */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Wrench className="w-3.5 h-3.5 text-slate-500" />
                  1. Identificação Técnica
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-blue-600" />
                        Tipo de Instrumento *
                      </label>
                      {!isAddingNewType && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingNewType(true);
                            setNewTypeName('');
                          }}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer hover:underline"
                        >
                          <Plus className="w-3 h-3" /> + Cadastrar Novo Tipo
                        </button>
                      )}
                    </div>

                    {isAddingNewType ? (
                      <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Cadastrar Novo Tipo de Instrumento
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingNewType(false);
                              setNewTypeName('');
                            }}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Ex: Chispômetro Digital / Década Capacitiva / Ponte Wheatstone"
                            value={newTypeName}
                            onChange={(e) => setNewTypeName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddNewType();
                              }
                            }}
                            className="flex-1 p-2 bg-white border border-blue-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddNewType()}
                            disabled={!newTypeName.trim()}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Salvar Tipo
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingNewType(false);
                              setNewTypeName('');
                            }}
                            className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                        <span className="text-[10px] text-blue-700/80 block">
                          O novo tipo será adicionado à lista e selecionado automaticamente para este e futuros cadastros.
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={type}
                          onChange={(e) => {
                            if (e.target.value === '__NEW_TYPE__') {
                              setIsAddingNewType(true);
                              setNewTypeName('');
                            } else {
                              setType(e.target.value);
                            }
                          }}
                          className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                        >
                          {instrumentTypes.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                          <option value="__NEW_TYPE__" className="font-bold text-blue-700 bg-blue-50">
                            ➕ + Cadastrar Novo Tipo de Instrumento...
                          </option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Fabricante</label>
                    <input
                      type="text"
                      placeholder="Ex: Hipotronics / Incoterm / Megabras"
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Modelo do Equipamento *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 7100-100CT / HVT-50kV-AC"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Número de Série *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: SN-2024-9988"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nº Patrimônio / Tag Interna</label>
                    <input
                      type="text"
                      placeholder="Ex: PAT-JVM-012"
                      value={assetNumber}
                      onChange={(e) => setAssetNumber(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Faixa / Escala de Medição</label>
                    <input
                      type="text"
                      placeholder="Ex: 0 a 100 kV CA / 0 a 100 mA"
                      value={measurementRange}
                      onChange={(e) => setMeasurementRange(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: Calibration RBC & Certificate Upload */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  2. Calibração RBC (Inmetro) & Certificado Anexo
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nº do Certificado de Calibração *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: CAL-RBC-2025-8812"
                      value={calibrationCertNumber}
                      onChange={(e) => setCalibrationCertNumber(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Laboratório Calibrador</label>
                    <input
                      type="text"
                      placeholder="Ex: CalibraTech Metrologia RBC Acreditado Cgcre nº 0412"
                      value={calibrationLab}
                      onChange={(e) => setCalibrationLab(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Data da Calibração *</label>
                    <input
                      type="date"
                      required
                      value={calibrationDate}
                      onChange={(e) => setCalibrationDate(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Data de Validade da Calibração *</label>
                    <input
                      type="date"
                      required
                      value={calibrationExpiryDate}
                      onChange={(e) => setCalibrationExpiryDate(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                </div>

                {/* Certificate File Attachment Box */}
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-emerald-900 flex items-center gap-1.5 text-xs">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      Anexo do Certificado de Calibração (PDF / Imagem)
                    </label>
                    {certFileUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setCertFileUrl(undefined);
                          setCertFileName(undefined);
                        }}
                        className="text-[11px] text-red-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Remover Anexo
                      </button>
                    )}
                  </div>

                  {certFileUrl ? (
                    <div className="bg-white p-3 rounded-xl border border-emerald-300 flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                          <FileCheck className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-slate-800 text-xs block truncate">
                            {certFileName || 'Certificado_Calibracao_RBC.pdf'}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Documento anexado com sucesso
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => certInputRef.current?.click()}
                          className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Substituir
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => certInputRef.current?.click()}
                      className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl p-3 text-center cursor-pointer bg-white transition-colors flex items-center justify-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Paperclip className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-slate-800 text-xs block">Anexar Certificado de Calibração</span>
                        <span className="text-[10px] text-slate-500">Selecione o arquivo PDF, JPG ou PNG emitido pelo laboratório RBC</span>
                      </div>
                    </div>
                  )}

                  <input 
                    ref={certInputRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={handleCertUpload}
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Observações Metrológicas</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações sobre calibração, incerteza de medição, rastreabilidade RBC ou restrições..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingInstrument ? 'Salvar Alterações' : 'Cadastrar Instrumento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Full View Certificate Modal */}
      {viewingCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col border border-slate-200">
            <div className="bg-[#0A2540] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Certificado de Calibração RBC</h3>
                  <p className="text-[11px] text-slate-300">
                    {viewingCertModal.manufacturer} - {viewingCertModal.model} ({viewingCertModal.calibrationCertNumber})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewingCertModal(null)} 
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center space-y-4">
              {viewingCertModal.certFileUrl ? (
                viewingCertModal.certFileUrl.startsWith('data:image/') ? (
                  <div className="max-h-[60vh] w-full flex items-center justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <img 
                      src={viewingCertModal.certFileUrl} 
                      alt="Certificado de Calibração" 
                      referrerPolicy="no-referrer"
                      className="max-h-[55vh] object-contain rounded-lg shadow-xs"
                    />
                  </div>
                ) : (
                  <div className="w-full p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <FileText className="w-16 h-16 text-blue-600 mx-auto" />
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{viewingCertModal.certFileName || 'Certificado_RBC.pdf'}</h4>
                      <p className="text-xs text-slate-500 mt-1">Documento PDF em formato digital anexado ao sistema</p>
                    </div>
                    <a
                      href={viewingCertModal.certFileUrl}
                      download={viewingCertModal.certFileName || `Certificado_RBC_${viewingCertModal.calibrationCertNumber}.pdf`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                    >
                      <Download className="w-4 h-4" /> Baixar Documento PDF
                    </a>
                  </div>
                )
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold">Nenhum arquivo digital anexado para este certificado.</p>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500">
                Validade RBC: <strong className="text-slate-800">{formatDateBR(viewingCertModal.calibrationExpiryDate)}</strong>
              </span>
              <button
                type="button"
                onClick={() => setViewingCertModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Full View Instrument Photo Modal */}
      {viewingPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col border border-slate-200">
            <div className="bg-[#0A2540] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{viewingPhotoModal.manufacturer} - {viewingPhotoModal.model}</h3>
                  <p className="text-[11px] text-slate-300">SN: {viewingPhotoModal.serialNumber} • {viewingPhotoModal.type}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingPhotoModal(null)} 
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center overflow-auto max-h-[65vh]">
              {viewingPhotoModal.imageUrl ? (
                <img 
                  src={viewingPhotoModal.imageUrl} 
                  alt={viewingPhotoModal.model}
                  referrerPolicy="no-referrer"
                  className="max-h-[60vh] max-w-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-slate-400 text-sm py-12">Nenhuma imagem disponível</div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">
                Laboratório Calibrador: <strong className="text-slate-800">{viewingPhotoModal.calibratingLab}</strong>
              </span>
              <button
                type="button"
                onClick={() => setViewingPhotoModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
