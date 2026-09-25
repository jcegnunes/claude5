import React, { useState, useEffect, useRef } from 'react';
import { 
  Sliders, 
  Download, 
  Upload, 
  RefreshCw, 
  Building2, 
  Check, 
  Database, 
  FileSpreadsheet, 
  AlertTriangle,
  AlertCircle,
  HardDrive,
  Search,
  Loader2,
  MapPin,
  CheckCircle2,
  Info,
  Image as ImageIcon,
  Trash2,
  RotateCcw,
  Link as LinkIcon,
  Sparkles,
  Instagram,
  Phone,
  Mail,
  Globe,
  Award,
  FileText,
  QrCode,
  CheckSquare,
  ShieldCheck,
  Calendar,
  Usb,
  Smartphone,
  Terminal,
  ArrowDownToLine,
  FileCode,
  Package,
  FolderArchive,
  Printer,
  Tag,
  PenTool,
  UserCheck,
  Code
} from 'lucide-react';
import { CompanyLabInfo, User } from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { cleanSignatureImage } from '../utils/signatureCleaner';
import { lookupCep } from '../services/addressService';
import { lookupCnpj, formatCnpj } from '../services/cnpjService';
import { USBInstallerService } from '../services/usbInstallerService';
import { saveFileLocally } from '../utils/nativeFileSaver';
import { ValidationPortalService, DEFAULT_VALIDATION_BASE_URL, PortalConnectionResult } from '../services/validationPortalService';
import { SupabaseDatabaseModal } from '../components/SupabaseDatabaseModal';
import { SupabaseService, SupabaseConnectionResult } from '../services/supabaseService';
import { CompleteBackupModal } from '../components/CompleteBackupModal';
import { FullBackupService, BackupStats, BackupProgressInfo } from '../services/fullBackupService';

export const BackupSettingsView: React.FC = () => {
  const [company, setCompany] = useState<CompanyLabInfo>(DielectricStorageService.getCompanyInfo());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [cepFeedback, setCepFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [cnpjFeedback, setCnpjFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Portal Público de Validação & Sincronização Supabase
  const [isTestingPortal, setIsTestingPortal] = useState(false);
  const [portalTestFeedback, setPortalTestFeedback] = useState<PortalConnectionResult | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<string | null>(null);

  // Supabase Sync & DB State
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseTestFeedback, setSupabaseTestFeedback] = useState<SupabaseConnectionResult | null>(null);

  // Complete Backup Modal State
  const [isCompleteBackupModalOpen, setIsCompleteBackupModalOpen] = useState(false);
  const [completeBackupInitialTab, setCompleteBackupInitialTab] = useState<'export' | 'import' | 'stats'>('export');
  const [isGeneratingQuickZip, setIsGeneratingQuickZip] = useState(false);
  const [quickZipFeedback, setQuickZipFeedback] = useState<string | null>(null);
  const [backupStatsQuick, setBackupStatsQuick] = useState<BackupStats | null>(null);
  const [usersList, setUsersList] = useState<User[]>(DielectricStorageService.getUsers());
  const rtSignatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    FullBackupService.calculateBackupStats()
      .then(s => setBackupStatsQuick(s))
      .catch(() => {});
    setUsersList(DielectricStorageService.getUsers());
  }, []);

  const handleRtSignatureUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Selecione uma imagem válida (PNG, JPG, SVG ou WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        const cleaned = await cleanSignatureImage(dataUrl);
        const updated: CompanyLabInfo = {
          ...company,
          technicalResponsible: {
            ...company.technicalResponsible,
            name: company.technicalResponsible?.name || 'Eng. João Victor Medeiros',
            title: company.technicalResponsible?.title || 'Engenheiro Eletricista e de Segurança do Trabalho',
            creaNumber: company.technicalResponsible?.creaNumber || 'CREA-SP 5069874211/D',
            rnp: company.technicalResponsible?.rnp || '2614897500',
            signatureUrl: cleaned
          }
        };
        setCompany(updated);
        DielectricStorageService.saveCompanyInfo(updated);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveRtSignature = () => {
    const updated: CompanyLabInfo = {
      ...company,
      technicalResponsible: {
        ...company.technicalResponsible,
        name: company.technicalResponsible?.name || 'Eng. João Victor Medeiros',
        signatureUrl: ''
      }
    };
    setCompany(updated);
    DielectricStorageService.saveCompanyInfo(updated);
  };

  const handleUserSignatureUpload = (userId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Selecione uma imagem válida (PNG, JPG, SVG ou WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        const cleaned = await cleanSignatureImage(dataUrl);
        const targetUser = usersList.find(u => u.id === userId);
        if (targetUser) {
          const updatedUser: User = { ...targetUser, signatureUrl: cleaned };
          DielectricStorageService.saveUser(updatedUser);
          setUsersList(prev => prev.map(u => u.id === userId ? updatedUser : u));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveUserSignature = (userId: string) => {
    const targetUser = usersList.find(u => u.id === userId);
    if (targetUser) {
      const updatedUser: User = { ...targetUser, signatureUrl: '' };
      DielectricStorageService.saveUser(updatedUser);
      setUsersList(prev => prev.map(u => u.id === userId ? updatedUser : u));
    }
  };

  const processLogoFile = (file: File) => {
    setLogoError(null);
    if (!file.type.startsWith('image/')) {
      setLogoError('Formato inválido. Selecione uma imagem (PNG, JPG, SVG ou WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Tamanho máximo permitido: 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawData = e.target?.result as string;
      if (!rawData) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        const maxDim = 500;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const isPng = file.type.includes('png') || file.type.includes('svg');
          const optimizedDataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.92);
          setCompany(prev => ({ ...prev, logoUrl: optimizedDataUrl }));
        } else {
          setCompany(prev => ({ ...prev, logoUrl: rawData }));
        }
      };
      img.onerror = () => {
        setCompany(prev => ({ ...prev, logoUrl: rawData }));
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  const handleCepSearch = async (cepToSearch?: string) => {
    const raw = (cepToSearch || company.cep || '').replace(/\D/g, '');
    if (raw.length !== 8) {
      if (raw.length > 0) {
        setCepFeedback({ type: 'error', message: 'O CEP deve conter 8 dígitos.' });
      }
      return;
    }

    setIsSearchingCep(true);
    setCepFeedback(null);

    try {
      const result = await lookupCep(raw);
      if (result && result.localidade && result.uf) {
        setCompany(prev => {
          return {
            ...prev,
            cep: result.cep,
            city: result.localidade,
            state: result.uf.toUpperCase(),
            address: result.logradouro || prev.address,
            neighborhood: result.bairro || prev.neighborhood || '',
          };
        });

        setCepFeedback({
          type: 'success',
          message: `Endereço localizado: ${result.logradouro ? `${result.logradouro}, ` : ''}${result.localidade} - ${result.uf}${result.bairro ? ` (${result.bairro})` : ''}`
        });
      } else {
        setCepFeedback({
          type: 'error',
          message: 'CEP não localizado na base pública dos Correios/ViaCEP. Preencha manualmente.'
        });
      }
    } catch (e) {
      setCepFeedback({
        type: 'error',
        message: 'Não foi possível consultar o CEP no momento.'
      });
    } finally {
      setIsSearchingCep(false);
    }
  };

  const handleCnpjSearch = async (cnpjToSearch?: string) => {
    const raw = (cnpjToSearch || company.cnpj || '').replace(/\D/g, '');
    if (raw.length !== 14) {
      if (raw.length > 0) {
        setCnpjFeedback({ type: 'error', message: `O CNPJ deve conter 14 dígitos (informado: ${raw.length}).` });
      }
      return;
    }

    setIsSearchingCnpj(true);
    setCnpjFeedback(null);

    try {
      const result = await lookupCnpj(raw);
      if (result.success && result.data) {
        const data = result.data;
        setCompany(prev => ({
          ...prev,
          name: data.nomeFantasia || prev.name,
          legalName: data.razaoSocial || prev.legalName,
          cnpj: data.cnpjFormatted,
          address: data.logradouro ? `${data.logradouro}, ${data.numero}` : prev.address,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.municipio || prev.city,
          state: data.uf || prev.state,
          cep: data.cep || prev.cep,
          email: data.email || prev.email,
          phone: data.telefone || prev.phone
        }));

        setCnpjFeedback({
          type: 'success',
          message: `Dados da empresa atualizados com sucesso da Receita Federal (${data.situacaoCadastral || 'ATIVA'}).`
        });
      } else {
        setCnpjFeedback({
          type: 'error',
          message: result.error || 'CNPJ não localizado na Receita Federal.'
        });
      }
    } catch {
      setCnpjFeedback({
        type: 'error',
        message: 'Não foi possível consultar o CNPJ no momento.'
      });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    DielectricStorageService.saveCompanyInfo(company);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportJSON = async () => {
    try {
      setQuickZipFeedback('Exportando arquivo JSON com fotos...');
      await FullBackupService.generateFullBackupJSON(true);
      setQuickZipFeedback('Backup JSON exportado com sucesso!');
      setTimeout(() => setQuickZipFeedback(null), 4000);
    } catch (err: any) {
      setQuickZipFeedback('Erro ao exportar JSON: ' + err.message);
    }
  };

  const handleExportCompleteZip = async () => {
    setIsGeneratingQuickZip(true);
    setQuickZipFeedback('Catalogando laudos e compactando registros fotográficos...');
    try {
      const res = await FullBackupService.generateFullBackupZip((prog) => {
        setQuickZipFeedback(`${prog.message} (${prog.percent}%)`);
      });
      if (res.success) {
        setQuickZipFeedback(`Backup completo ZIP gerado com sucesso (${res.stats.totalPhotos} fotos)!`);
        FullBackupService.calculateBackupStats().then(s => setBackupStatsQuick(s)).catch(() => {});
        setTimeout(() => setQuickZipFeedback(null), 5000);
      }
    } catch (err: any) {
      setQuickZipFeedback('Erro ao gerar backup ZIP: ' + err.message);
    } finally {
      setIsGeneratingQuickZip(false);
    }
  };

  const handleUniversalRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm(`Deseja restaurar o backup do arquivo "${file.name}"? Os registros e fotos serão mesclados e sincronizados.`)) {
      e.target.value = '';
      return;
    }

    setImportStatus('Processando e restaurando arquivo de backup...');
    try {
      const res = await FullBackupService.restoreBackupFile(file, (prog) => {
        setImportStatus(`${prog.message} (${prog.percent}%)`);
      });
      if (res.success) {
        setImportStatus(`Restauração concluída com sucesso! (${res.details.tests} laudos, ${res.details.photos} fotos). Recarregando...`);
        setTimeout(() => window.location.reload(), 1800);
      }
    } catch (err: any) {
      setImportStatus('Erro na restauração: ' + err.message);
    }
  };

  const handleTestPortal = async () => {
    setIsTestingPortal(true);
    setPortalTestFeedback(null);
    try {
      const res = await ValidationPortalService.testPortal(company.validationBaseUrl || DEFAULT_VALIDATION_BASE_URL);
      setPortalTestFeedback(res);
    } finally {
      setIsTestingPortal(false);
    }
  };

  const handleSyncNowCloud = async () => {
    setIsSyncingCloud(true);
    setCloudSyncStatus('Sincronizando com o banco de dados Supabase...');
    try {
      const res = await DielectricStorageService.syncWithCentralServer(navigator.onLine);
      setCloudSyncStatus(res.success ? (res.message || 'Sincronização concluída.') : (res.error || 'Falha na sincronização.'));
      setTimeout(() => setCloudSyncStatus(null), 5000);
    } catch (err: any) {
      setCloudSyncStatus('Erro: ' + (err.message || err));
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseTestFeedback(null);
    try {
      const res = await SupabaseService.testConnection({
        url: company.supabaseUrl || 'https://cdtbzbshylrcprvmjpgc.supabase.co',
        anonKey: company.supabaseAnonKey || 'sb_publishable_j3sUJcAb-zBEQI_S09u2Cg_X1-WJ-8M'
      });
      setSupabaseTestFeedback(res);
    } catch (err: any) {
      setSupabaseTestFeedback({
        success: false,
        latencyMs: 0,
        url: company.supabaseUrl || 'https://cdtbzbshylrcprvmjpgc.supabase.co',
        message: err.message || 'Falha ao testar conexão Supabase',
        isReady: false
      });
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleExportCSV = async () => {
    const csv = DielectricStorageService.exportTestsToCSV();
    const fileName = `jvm_laudos_ensaios_${new Date().toISOString().split('T')[0]}.csv`;
    await saveFileLocally({
      filename: fileName,
      data: csv,
      mimeType: 'text/csv;charset=utf-8;',
      title: `Exportação CSV de Ensaios - ${new Date().toLocaleDateString('pt-BR')}`,
      category: 'csv'
    });
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const res = DielectricStorageService.importBackupJSON(content);
        if (res.success) {
          setImportStatus('Backup restaurado com sucesso! Recarregando...');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setImportStatus('Erro ao importar: ' + res.error);
        }
      } catch (err: any) {
        setImportStatus('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDemoData = () => {
    if (window.confirm('Tem certeza de que deseja restaurar os dados de demonstração da JVM Engenharia? Todas as alterações serão substituídas pelos dados de fábrica.')) {
      DielectricStorageService.resetToSeedData();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Configurações & Gestão de Backup</h2>
        <p className="text-xs text-slate-500">
          Dados cadastrais da empresa para laudos, exportação/importação de banco e restauração
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Settings Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">Dados do Laboratório & Cabeçalho dos Laudos</h3>
          </div>

          <form onSubmit={handleSaveCompany} className="space-y-4 text-xs">
            {/* Seção de Logotipo da Empresa */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-orange-100 text-orange-600">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">Logotipo Oficial da Empresa / Laboratório</h4>
                    <p className="text-[11px] text-slate-500">Exibido na barra superior do sistema, laudos técnicos e certificados de conformidade</p>
                  </div>
                </div>
                {company.logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setCompany(prev => ({ ...prev, logoUrl: '' }));
                      setLogoError(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer self-start sm:self-auto"
                    title="Remover logotipo personalizado"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover Logo</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* Visual Previews */}
                <div className="lg:col-span-5 flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-slate-600 block">Prévia em Tempo Real:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Light Background Preview (Laudos / Certificados) */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 text-center flex flex-col items-center justify-center min-h-[90px] shadow-2xs">
                      {company.logoUrl ? (
                        <img 
                          src={company.logoUrl} 
                          alt="Logo da Empresa" 
                          className="max-h-12 max-w-full object-contain"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-[#0A2540] flex items-center justify-center text-white font-black text-lg tracking-tighter">
                          JVM
                        </div>
                      )}
                      <span className="text-[10px] text-slate-400 mt-1.5 font-medium">Em Laudos e PDFs</span>
                    </div>

                    {/* Dark Background Preview (Topbar / Header) */}
                    <div className="bg-[#0A2540] p-3 rounded-xl border border-slate-800 text-center flex flex-col items-center justify-center min-h-[90px] shadow-2xs">
                      {company.logoUrl ? (
                        <img 
                          src={company.logoUrl} 
                          alt="Logo da Empresa" 
                          className="max-h-12 max-w-full object-contain filter brightness-105"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md font-black text-white text-lg tracking-tighter">
                          JVM
                        </div>
                      )}
                      <span className="text-[10px] text-slate-300 mt-1.5 font-medium">Na Barra Superior</span>
                    </div>
                  </div>
                </div>

                {/* Upload & Link Controls */}
                <div className="lg:col-span-7 space-y-3">
                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processLogoFile(file);
                    }}
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    className="hidden"
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingLogo(true);
                    }}
                    onDragLeave={() => setIsDraggingLogo(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingLogo(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processLogoFile(file);
                    }}
                    onClick={() => logoInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      isDraggingLogo
                        ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                        : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2 text-blue-600 font-bold text-xs mb-1">
                      <Upload className="w-4 h-4" />
                      <span>{company.logoUrl ? 'Trocar Imagem do Logotipo' : 'Carregar Imagem do Computador / Celular'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Clique ou arraste a imagem aqui (PNG, JPG, SVG ou WebP • Max: 5MB)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        placeholder="Ou cole o link direto da imagem (https://...)"
                        value={company.logoUrl || ''}
                        onChange={(e) => {
                          setCompany(prev => ({ ...prev, logoUrl: e.target.value }));
                          setLogoError(null);
                        }}
                        className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono"
                      />
                    </div>
                    {company.logoUrl && (
                      <button
                        type="button"
                        onClick={() => setCompany(prev => ({ ...prev, logoUrl: '' }))}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors shrink-0"
                        title="Limpar link"
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  {logoError && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{logoError}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>Recomendado: Logotipo com fundo transparente (PNG ou SVG) e proporção retangular/quadrada.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome Fantasia do Laboratório</label>
                <input
                  type="text"
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Razão Social Completa</label>
                <input
                  type="text"
                  value={company.legalName}
                  onChange={(e) => setCompany({ ...company, legalName: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="sm:col-span-2 bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block font-bold text-slate-800">
                    CNPJ da Empresa (Busca Automática na Receita Federal)
                  </label>
                  <span className="text-[11px] text-blue-700 font-medium">
                    Preenche razão social, endereço e contato automaticamente
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Building2 className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      value={company.cnpj || ''}
                      onChange={(e) => {
                        const formatted = formatCnpj(e.target.value);
                        setCompany(prev => ({ ...prev, cnpj: formatted }));
                        if (cnpjFeedback) setCnpjFeedback(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCnpjSearch();
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCnpjSearch()}
                    disabled={isSearchingCnpj}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-2xs shrink-0 cursor-pointer"
                  >
                    {isSearchingCnpj ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>{isSearchingCnpj ? 'Buscando...' : 'Consultar CNPJ'}</span>
                  </button>
                </div>

                {cnpjFeedback && (
                  <div className={`p-2 rounded-lg text-xs flex items-center gap-1.5 ${
                    cnpjFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                    cnpjFeedback.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                    'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {cnpjFeedback.type === 'success' && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    {cnpjFeedback.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                    <span>{cnpjFeedback.message}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Registro da Empresa no CREA</label>
                <input
                  type="text"
                  value={company.creaCompanyRegister}
                  onChange={(e) => setCompany({ ...company, creaCompanyRegister: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                />
              </div>

              {/* CEP com Consulta Automática */}
              <div className="sm:col-span-2 bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block font-bold text-slate-800">
                    CEP do Laboratório (Busca Automática)
                  </label>
                  <span className="text-[11px] text-blue-700 font-medium">
                    Preenche endereço, cidade e UF automaticamente
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="00000-000"
                      maxLength={9}
                      value={company.cep || ''}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/\D/g, '').substring(0, 8);
                        let formatted = raw;
                        if (raw.length > 5) {
                          formatted = `${raw.substring(0, 5)}-${raw.substring(5)}`;
                        }
                        setCompany(prev => ({ ...prev, cep: formatted }));
                        if (raw.length === 8) {
                          handleCepSearch(raw);
                        }
                      }}
                      onBlur={() => {
                        const raw = (company.cep || '').replace(/\D/g, '');
                        if (raw.length === 8) {
                          handleCepSearch(raw);
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCepSearch()}
                    disabled={isSearchingCep}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer shrink-0"
                    title="Buscar dados do CEP"
                  >
                    {isSearchingCep ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Buscando...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Buscar CEP</span>
                      </>
                    )}
                  </button>
                </div>

                {cepFeedback && (
                  <div className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    cepFeedback.type === 'success' 
                      ? 'bg-emerald-100/90 text-emerald-800 border border-emerald-200' 
                      : 'bg-red-100/90 text-red-800 border border-red-200'
                  }`}>
                    {cepFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    )}
                    <span>{cepFeedback.message}</span>
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Logradouro / Rua / Avenida</label>
                  <input
                    type="text"
                    placeholder="Ex: Av. das Indústrias Tecnológicas"
                    value={company.address}
                    onChange={(e) => setCompany({ ...company, address: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Número / Lote
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 1420 ou Lote 04"
                    value={company.number || ''}
                    onChange={(e) => setCompany({ ...company, number: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Bairro</label>
                <input
                  type="text"
                  placeholder="Ex: Distrito Industrial"
                  value={company.neighborhood || ''}
                  onChange={(e) => setCompany({ ...company, neighborhood: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Complemento / Bloco</label>
                <input
                  type="text"
                  placeholder="Ex: Módulo 04, Galpão A"
                  value={company.complement || ''}
                  onChange={(e) => setCompany({ ...company, complement: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cidade</label>
                <input
                  type="text"
                  placeholder="Ex: Campinas"
                  value={company.city || ''}
                  onChange={(e) => setCompany({ ...company, city: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Estado (UF)</label>
                <select
                  value={company.state || ''}
                  onChange={(e) => setCompany({ ...company, state: e.target.value.toUpperCase() })}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-900"
                >
                  <option value="">Selecione...</option>
                  {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  <span>Telefone / WhatsApp</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: (19) 3844-9000"
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>E-mail do Laboratório</span>
                </label>
                <input
                  type="email"
                  placeholder="laboratorio@empresa.com.br"
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>Website Oficial</span>
                </label>
                <input
                  type="text"
                  placeholder="www.empresa.com.br"
                  value={company.website}
                  onChange={(e) => setCompany({ ...company, website: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Instagram className="w-3.5 h-3.5 text-pink-600" />
                  <span>Instagram Oficial</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="@jvmengenharia ou https://instagram.com/..."
                    value={company.instagram || ''}
                    onChange={(e) => setCompany({ ...company, instagram: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-slate-900 font-medium"
                  />
                  {company.instagram && (
                    <a
                      href={company.instagram.startsWith('http') ? company.instagram : `https://instagram.com/${company.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-pink-600 hover:text-pink-700 font-bold bg-pink-50 hover:bg-pink-100 px-2 py-0.5 rounded-md transition-colors"
                      title="Abrir perfil no Instagram"
                    >
                      Abrir
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Responsável Técnico */}
            <div className="pt-3 border-t border-slate-100">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-2.5">
                Responsável Técnico Principal (RT)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome do Responsável Técnico</label>
                  <input
                    type="text"
                    value={company.technicalResponsible?.name || ''}
                    onChange={(e) => setCompany({
                      ...company,
                      technicalResponsible: {
                        ...company.technicalResponsible,
                        name: e.target.value
                      }
                    })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cargo / Especialidade</label>
                  <input
                    type="text"
                    value={company.technicalResponsible?.title || ''}
                    onChange={(e) => setCompany({
                      ...company,
                      technicalResponsible: {
                        ...company.technicalResponsible,
                        title: e.target.value
                      }
                    })}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº Registro CREA do RT</label>
                  <input
                    type="text"
                    value={company.technicalResponsible?.creaNumber || ''}
                    onChange={(e) => setCompany({
                      ...company,
                      technicalResponsible: {
                        ...company.technicalResponsible,
                        creaNumber: e.target.value
                      }
                    })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">RNP / Registro Nacional</label>
                  <input
                    type="text"
                    value={company.technicalResponsible?.rnp || ''}
                    onChange={(e) => setCompany({
                      ...company,
                      technicalResponsible: {
                        ...company.technicalResponsible,
                        rnp: e.target.value
                      }
                    })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Assinatura Padrão do Responsável Técnico */}
              <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">Assinatura Padrão do RT para Laudos & Certificados</span>
                  </div>
                  {company.technicalResponsible?.signatureUrl ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      <Check className="w-3 h-3" /> Assinatura Ativa (Padrão Carregada)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      Nenhuma imagem padrão vinculada
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-full sm:w-48 h-20 bg-white border border-slate-300 rounded-lg flex items-center justify-center overflow-hidden p-1 shadow-inner">
                    {company.technicalResponsible?.signatureUrl ? (
                      <img 
                        src={company.technicalResponsible.signatureUrl} 
                        alt="Assinatura RT Padrão" 
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400 italic text-center px-2">Sem imagem padrão cadastrada</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5 text-xs">
                    <p className="text-slate-600 text-[11px] leading-snug">
                      Carregue o arquivo de assinatura (PNG, JPG, SVG). Este arquivo será carregado automaticamente como padrão em todos os laudos e certificados assinados pelo Responsável Técnico.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <input 
                        ref={rtSignatureInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleRtSignatureUpload(file);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => rtSignatureInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Carregar Assinatura do RT</span>
                      </button>

                      {company.technicalResponsible?.signatureUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveRtSignature}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold cursor-pointer"
                          title="Remover assinatura padrão"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO: ASSINATURAS PADRÃO DOS ANALISTAS EXECUTORES */}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    Assinaturas Padrão dos Analistas Executores
                  </h4>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">
                  {usersList.filter(u => u.role === 'tecnico' || u.role === 'admin').length} analista(s) cadastrado(s)
                </span>
              </div>

              <div className="space-y-2">
                {usersList
                  .filter(u => u.role === 'tecnico' || u.role === 'admin' || u.role === 'responsavel_tecnico')
                  .map(user => (
                    <div 
                      key={user.id}
                      className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-12 bg-white border border-slate-300 rounded-md flex items-center justify-center p-0.5 overflow-hidden shrink-0 shadow-inner">
                          {user.signatureUrl ? (
                            <img src={user.signatureUrl} alt={user.name} className="max-h-full max-w-full object-contain" />
                          ) : (
                            <span className="text-[9px] text-slate-400 italic">Sem foto</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{user.name}</span>
                            {user.signatureUrl ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Padrão Ativo
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">
                                Sem Assinatura
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {user.cargo || user.role} {user.creaOrCft ? `• ${user.creaOrCft}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{user.signatureUrl ? 'Trocar Imagem' : 'Carregar Imagem'}</span>
                          <input 
                            type="file"
                            accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUserSignatureUpload(user.id, file);
                              e.target.value = '';
                            }}
                          />
                        </label>

                        {user.signatureUrl && (
                          <button
                            type="button"
                            onClick={() => handleRemoveUserSignature(user.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remover assinatura padrão"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* SEÇÃO: CONFIGURAÇÕES DE EMISSÃO DE CERTIFICADO & LAUDO */}
            <div className="pt-4 border-t-2 border-blue-100 bg-gradient-to-br from-blue-50/50 to-slate-50 p-4 rounded-2xl border border-blue-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-blue-200/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 leading-tight flex items-center gap-2">
                      <span>Parâmetros de Emissão de Certificados & Laudos</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md uppercase tracking-wider">
                        Módulo do Sistema
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Configuração das regras de geração de documentos técnicos, numeração, pareceres e assinaturas (NR-10)
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Modo de Emissão */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Modo Padrão de Emissão de Documentos</span>
                  </label>
                  <select
                    value={company.certificateEmissionSettings?.defaultEmissionMode || 'laudo_e_certificado'}
                    onChange={(e) => setCompany({
                      ...company,
                      certificateEmissionSettings: {
                        ...company.certificateEmissionSettings!,
                        defaultEmissionMode: e.target.value as any
                      }
                    })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="laudo_e_certificado">Laudo Técnico Dielétrico + Certificado de Conformidade</option>
                    <option value="apenas_laudo">Apenas Laudo Técnico Dielétrico</option>
                    <option value="apenas_certificado">Apenas Certificado de Conformidade</option>
                  </select>
                </div>

                {/* Validade Padrão */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Validade / Periodicidade Padrão de Reensaio</span>
                  </label>
                  <select
                    value={company.certificateEmissionSettings?.defaultValidityMonths || 6}
                    onChange={(e) => setCompany({
                      ...company,
                      certificateEmissionSettings: {
                        ...company.certificateEmissionSettings!,
                        defaultValidityMonths: Number(e.target.value)
                      }
                    })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={3}>3 meses (Condições Severas / Offshore)</option>
                    <option value={6}>6 meses (Padrão NR-10 & NBR 10622)</option>
                    <option value={12}>12 meses (Ferramental e Tapetes Isolantes)</option>
                  </select>
                </div>

                {/* Prefixo do Laudo */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Prefixo de Numeração do Laudo Técnico
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: LAU-"
                    value={company.certificateEmissionSettings?.reportPrefix || 'LAU-'}
                    onChange={(e) => setCompany({
                      ...company,
                      certificateEmissionSettings: {
                        ...company.certificateEmissionSettings!,
                        reportPrefix: e.target.value
                      }
                    })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 bg-white"
                  />
                  <p className="text-xs text-slate-500 mt-1">Padrão: <span className="font-mono font-semibold text-blue-700">LAU-AAMM-0001</span> (Ano abreviado AA, Mês e 4 dígitos)</p>
                </div>

                {/* Prefixo do Certificado */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Prefixo de Numeração do Certificado
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: CERT-"
                    value={company.certificateEmissionSettings?.certificatePrefix || 'CERT-'}
                    onChange={(e) => setCompany({
                      ...company,
                      certificateEmissionSettings: {
                        ...company.certificateEmissionSettings!,
                        certificatePrefix: e.target.value
                      }
                    })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 bg-white"
                  />
                  <p className="text-xs text-slate-500 mt-1">Padrão: <span className="font-mono font-semibold text-emerald-700">CERT-AAMM-0001</span> (Ano abreviado AA, Mês e 4 dígitos)</p>
                </div>

                {/* Título do Cabeçalho do Certificado */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-800 mb-1">
                    Título Oficial Exibido no Cabeçalho do Certificado
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: CERTIFICADO DE CONFORMIDADE DIELÉTRICA DE EPI/EPC"
                    value={company.certificateEmissionSettings?.headerCustomTitle || 'CERTIFICADO DE CONFORMIDADE DIELÉTRICA DE EPI/EPC'}
                    onChange={(e) => setCompany({
                      ...company,
                      certificateEmissionSettings: {
                        ...company.certificateEmissionSettings!,
                        headerCustomTitle: e.target.value
                      }
                    })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                  />
                </div>

                {/* Parecer Técnico Padrão de Aprovação */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Texto / Parecer Técnico Padrão para Itens APROVADOS</span>
                  </label>
                  <textarea
                    rows={2}
                    value={company.certificateEmissionSettings?.defaultApprovalText || ''}
                    onChange={(e) => setCompany({
                      ...company,
                      certificateEmissionSettings: {
                        ...company.certificateEmissionSettings!,
                        defaultApprovalText: e.target.value
                      }
                    })}
                    className="w-full p-2 border border-emerald-300 rounded-xl bg-white text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Parecer Técnico Padrão de Reprovação */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-red-900 mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    <span>Texto / Parecer Técnico Padrão para Itens REPROVADOS</span>
                  </label>
                  <textarea
                    rows={2}
                    value={company.certificateEmissionSettings?.defaultRejectionText || ''}
                    onChange={(e) => setCompany({
                      ...company,
                      certificateEmissionSettings: {
                        ...company.certificateEmissionSettings!,
                        defaultRejectionText: e.target.value
                      }
                    })}
                    className="w-full p-2 border border-red-300 rounded-xl bg-white text-slate-800 text-xs focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {/* Observações e Termos Normativos Padrão */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-800 mb-1">
                    Termo de Responsabilidade e Observações Normativas Padrão (Rodapé do Laudo / Certificado)
                  </label>
                  <textarea
                    rows={2}
                    value={company.certificateEmissionSettings?.standardObservationNote || ''}
                    onChange={(e) => setCompany({
                      ...company,
                      certificateEmissionSettings: {
                        ...company.certificateEmissionSettings!,
                        standardObservationNote: e.target.value
                      }
                    })}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Opções de Assinatura e QR Code */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={company.certificateEmissionSettings?.requireDigitalSignature ?? true}
                      onChange={(e) => setCompany({
                        ...company,
                        certificateEmissionSettings: {
                          ...company.certificateEmissionSettings!,
                          requireDigitalSignature: e.target.checked
                        }
                      })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Exigir Assinatura Digital do RT</span>
                      <span className="text-[10px] text-slate-500">Bloqueia emissão definitiva sem assinatura do responsável</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={company.certificateEmissionSettings?.enableQrCodeValidation ?? true}
                      onChange={(e) => setCompany({
                        ...company,
                        certificateEmissionSettings: {
                          ...company.certificateEmissionSettings!,
                          enableQrCodeValidation: e.target.checked
                        }
                      })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Gerar QR Code de Validação Pública</span>
                      <span className="text-[10px] text-slate-500">Permite verificação instantânea por fiscalização e clientes</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* SEÇÃO: PORTAL PÚBLICO DE VALIDAÇÃO & SINCRONIZAÇÃO SUPABASE */}
            <div className="pt-4 border-t-2 border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-blue-50/30 to-slate-50 p-4 rounded-2xl border border-emerald-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 leading-tight flex items-center gap-2">
                      <span>Portal Público de Validação & Sincronização</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md uppercase tracking-wider">
                        Online
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Endereço oficial para consulta e autenticação de laudos via QR Code (dados consultados no Supabase)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestPortal}
                    disabled={isTestingPortal}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isTestingPortal ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span>Testando...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                        <span>Testar Conexão</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncNowCloud}
                    disabled={isSyncingCloud}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                    <span>{isSyncingCloud ? 'Sincronizando...' : 'Sincronizar'}</span>
                  </button>
                </div>
              </div>

              {portalTestFeedback && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 ${
                  portalTestFeedback.success
                    ? 'bg-emerald-100/90 text-emerald-900 border border-emerald-300'
                    : 'bg-amber-100/90 text-amber-900 border border-amber-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {portalTestFeedback.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span className="font-semibold">{portalTestFeedback.message}</span>
                  </div>
                  {portalTestFeedback.latencyMs > 0 && (
                    <span className="font-mono text-[10px] bg-white/70 px-2 py-0.5 rounded-md font-bold">
                      {portalTestFeedback.latencyMs}ms
                    </span>
                  )}
                </div>
              )}

              {cloudSyncStatus && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{cloudSyncStatus}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* URL do Portal de Validação */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-800 mb-1">
                    URL do Portal de Validação (Domínio de Hospedagem do App)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={company.validationBaseUrl || DEFAULT_VALIDATION_BASE_URL}
                      onChange={(e) => setCompany({
                        ...company,
                        validationBaseUrl: e.target.value
                      })}
                      placeholder="https://mediumvioletred-bison-595566.hostingersite.com"
                      className="flex-1 p-2 border border-slate-300 rounded-xl bg-white font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setCompany({
                        ...company,
                        validationBaseUrl: DEFAULT_VALIDATION_BASE_URL
                      })}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold shrink-0"
                    >
                      Padrão
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Endereço configurado: <strong className="font-mono text-blue-700">{company.validationBaseUrl || DEFAULT_VALIDATION_BASE_URL}</strong>
                  </p>
                </div>

                {/* Validation URL Prefix */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-800 mb-1">
                    Exemplo de Link de Validação Pública (QR Code)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`${(company.validationBaseUrl || DEFAULT_VALIDATION_BASE_URL).replace(/\/+$/, '')}/validar/VAL-JVM-0000-XXXXXX`}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-slate-50 font-mono text-xs text-slate-600"
                  />
                </div>

                {/* Auto Sync Toggle */}
                <div className="sm:col-span-2 pt-1">
                  <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-emerald-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={company.supabaseAutoSync ?? true}
                      onChange={(e) => setCompany({ ...company, supabaseAutoSync: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Sincronização Automática em Segundo Plano</span>
                      <span className="text-[10px] text-slate-500">Envia ensaios e laudos automaticamente ao Supabase logo após serem salvos</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Supabase Cloud Database Section */}
            <div className="p-5 bg-gradient-to-r from-emerald-50/70 via-teal-50/70 to-slate-50 rounded-2xl border border-emerald-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">Banco de Dados Supabase (PostgreSQL Cloud)</h4>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-600 text-white shadow-2xs">
                        Ativo
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Sincronização na nuvem com Postgres, RLS e suporte a multi-usuários
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestSupabase}
                    disabled={isTestingSupabase}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                    <span>{isTestingSupabase ? 'Testando...' : 'Testar Conexão'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSupabaseModalOpen(true)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Code className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Script SQL & Opções</span>
                  </button>
                </div>
              </div>

              {supabaseTestFeedback && (
                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  supabaseTestFeedback.success
                    ? 'bg-emerald-100/90 border-emerald-300 text-emerald-900'
                    : 'bg-amber-100/90 border-amber-300 text-amber-900'
                }`}>
                  <div className="flex items-center gap-2">
                    {supabaseTestFeedback.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span className="font-semibold">{supabaseTestFeedback.message}</span>
                  </div>
                  {supabaseTestFeedback.latencyMs > 0 && (
                    <span className="font-mono text-[10px] bg-white/70 px-2 py-0.5 rounded-md font-bold">
                      {supabaseTestFeedback.latencyMs}ms
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={company.supabaseUrl || 'https://cdtbzbshylrcprvmjpgc.supabase.co'}
                    onChange={(e) => setCompany({ ...company, supabaseUrl: e.target.value })}
                    placeholder="https://cdtbzbshylrcprvmjpgc.supabase.co"
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Supabase Anon Public Key
                  </label>
                  <input
                    type="password"
                    value={company.supabaseAnonKey || 'sb_publishable_j3sUJcAb-zBEQI_S09u2Cg_X1-WJ-8M'}
                    onChange={(e) => setCompany({ ...company, supabaseAnonKey: e.target.value })}
                    placeholder="sb_publishable_..."
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white font-mono text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2 pt-1">
                  <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-emerald-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={company.supabaseAutoSync ?? true}
                      onChange={(e) => setCompany({ ...company, supabaseAutoSync: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Sincronização Automática com Supabase</span>
                      <span className="text-[10px] text-slate-500">Envia cópia instantânea dos laudos, EPIs e clientes para as tabelas PostgreSQL do Supabase</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              {savedSuccess && (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <Check className="w-4 h-4" /> Configurações salvas com sucesso!
                </span>
              )}
              <div className="ml-auto">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm"
                >
                  Salvar Dados da Empresa
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Backup & Tools Card */}
        <div className="space-y-4">
          {/* APK & USB Android Tools Card */}
          <div className="bg-gradient-to-br from-slate-900 via-emerald-950/50 to-slate-900 rounded-2xl p-6 border border-emerald-700/60 shadow-md text-white space-y-3.5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Gerador de APK & Android Studio</h3>
                <span className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider">Compilação APK & Modo USB (ADB)</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Gere o projeto Android nativo completo com Gradle, AndroidManifest, WebView otimizada e scripts para compilar o arquivo <strong>.apk</strong> em 1 clique.
            </p>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const url = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-yqilyfejsx2or3ikkcoi5q-596527859900.us-east1.run.app';
                  USBInstallerService.generateAndDownloadAndroidStudioZip(url);
                }}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <FolderArchive className="w-4 h-4" />
                <span>Gerar e Baixar Pacote Completo APK V5.2 (.ZIP)</span>
              </button>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const url = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-yqilyfejsx2or3ikkcoi5q-596527859900.us-east1.run.app';
                    USBInstallerService.downloadFile('install-via-usb.bat', USBInstallerService.getWindowsADBScript(url), 'application/x-bat');
                  }}
                  className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-orange-400" />
                  <span>USB (.bat)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    USBInstallerService.downloadFile('build-apk-windows.bat', USBInstallerService.getBuildApkWindowsBat(), 'application/x-bat');
                  }}
                  className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Compilar APK</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    USBInstallerService.downloadFile('gradle.properties', USBInstallerService.getGradleProperties(), 'text/plain;charset=utf-8');
                  }}
                  className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Baixar gradle.properties com fix para caminhos acentuados (ex: João Carlos)"
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>gradle.props</span>
                </button>
              </div>
            </div>
          </div>

          {/* Niimbot B1 Thermal Printer Integration Card */}
          <div className="bg-gradient-to-br from-slate-900 via-amber-950/40 to-slate-900 rounded-2xl p-6 border border-amber-500/50 shadow-md text-white space-y-3.5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Impressora Térmica Niimbot B1</h3>
                <span className="text-[10px] text-amber-300 font-semibold uppercase tracking-wider">Etiquetas 203 DPI • Rolo 50x30 / 50x50 mm</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              O sistema gera etiquetas com fidelidade milimétrica e alta resolução nativa (203 DPI) para a impressora térmica <strong>Niimbot B1</strong> via Bluetooth, USB ou aplicativo Oficial Niimbot (PC / Android / iOS).
            </p>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-amber-500/20 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Formatos Homologados:</span>
                <span className="font-mono font-bold text-amber-300">50x30, 50x50, 50x40, 40x30, 50x80 mm</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Resolução do Cabeçote:</span>
                <span className="font-mono font-bold text-emerald-400">203 DPI (8 dots/mm)</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Formatos de Exportação:</span>
                <span className="font-bold text-amber-300">Projeto .JCPS (Oficial), PNG 203 DPI, PDF 1:1, CSV Lote</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 italic">
              💡 Dica: Abra os arquivos <strong>.JCPS</strong> no software Niimbot PC ou App Niimbot para carregar o modelo completo com textos e QR Code pré-configurados para impressão direta em lote.
            </div>
          </div>

          {/* Backup & Registros Fotográficos Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Backup & Registros Fotográficos</h3>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                    {backupStatsQuick ? `${backupStatsQuick.totalPhotos} fotos salvas • ${backupStatsQuick.totalTests} laudos` : 'Pacote Completo'}
                  </span>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                Zero Perda
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Exporte e restaure com 1 clique a base integral de dados com todas as fotografias em alta resolução, ensaios, assinaturas digitais do RT e cadastros de clientes.
            </p>

            <div className="space-y-2.5">
              {/* Primary Action: Gerar Backup Completo com Fotos (.ZIP) */}
              <button
                type="button"
                onClick={handleExportCompleteZip}
                disabled={isGeneratingQuickZip}
                className="w-full py-3 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black flex items-center justify-between shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  {isGeneratingQuickZip ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <FolderArchive className="w-4 h-4 text-emerald-200" />
                  )}
                  <span>{isGeneratingQuickZip ? 'Compactando Fotos & Laudos...' : 'Gerar Backup Completo com Fotos (.ZIP)'}</span>
                </span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md text-white font-bold">
                  ZIP Completo
                </span>
              </button>

              {/* Secondary Action: Abrir Central de Backup Completo */}
              <button
                type="button"
                onClick={() => {
                  setCompleteBackupInitialTab('export');
                  setIsCompleteBackupModalOpen(true);
                }}
                className="w-full py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" /> Abrir Central de Backup & Diagnóstico
                </span>
                <span className="text-[10px] bg-blue-200/60 px-2 py-0.5 rounded-md text-blue-900 font-semibold">
                  Opções Avançadas
                </span>
              </button>

              {/* Action: Export JSON */}
              <button
                type="button"
                onClick={handleExportJSON}
                className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" /> Exportar Arquivo JSON (com Fotos)
                </span>
              </button>

              {/* Action: Export CSV */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Ensaios em Planilha (CSV)
                </span>
              </button>

              {/* Universal Restore: .ZIP or .JSON */}
              <label className="w-full py-2.5 px-3 bg-purple-50/70 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer">
                <span className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-purple-600" /> Restaurar Backup (.ZIP ou .JSON)
                </span>
                <input 
                  type="file" 
                  accept=".zip,.json" 
                  onChange={handleUniversalRestoreFile} 
                  className="hidden" 
                />
              </label>

              {quickZipFeedback && (
                <div className="text-xs text-emerald-800 font-semibold p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{quickZipFeedback}</span>
                </div>
              )}

              {importStatus && (
                <div className="text-xs text-blue-800 font-semibold p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{importStatus}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reset Demo Data */}
          <div className="bg-red-50/70 rounded-2xl p-6 border border-red-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="font-bold text-xs text-red-900 uppercase">Restaurar Dados de Fábrica</h3>
            </div>
            <p className="text-xs text-red-700 leading-relaxed">
              Recarrega os equipamentos, laudos, clientes e normas originais de demonstração da JVM Engenharia.
            </p>
            <button
              onClick={handleResetDemoData}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              Restaurar Base de Demonstração
            </button>
          </div>
        </div>
      </div>

      {/* Supabase Database & SQL Modal */}
      <SupabaseDatabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />

      {/* Complete Backup & Photographic Records Modal */}
      <CompleteBackupModal
        isOpen={isCompleteBackupModalOpen}
        onClose={() => {
          setIsCompleteBackupModalOpen(false);
          FullBackupService.calculateBackupStats().then(s => setBackupStatsQuick(s)).catch(() => {});
        }}
        initialTab={completeBackupInitialTab}
      />
    </div>
  );
};
