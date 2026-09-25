import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Archive, 
  Download, 
  Upload, 
  FileJson, 
  FileSpreadsheet, 
  Camera, 
  ShieldCheck, 
  HardDrive, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Sparkles, 
  FolderArchive, 
  FileText, 
  RefreshCw, 
  Image as ImageIcon,
  Check,
  Smartphone,
  Eye,
  Info
} from 'lucide-react';
import { FullBackupService, BackupStats, BackupProgressInfo, RestoreResult } from '../services/fullBackupService';
import { DielectricStorageService } from '../services/syncEngine';

interface CompleteBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'export' | 'import' | 'stats';
}

export const CompleteBackupModal: React.FC<CompleteBackupModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'export'
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'stats'>(initialTab);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Export / Progress State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BackupProgressInfo | null>(null);
  const [exportSuccess, setExportSuccess] = useState<{ filename: string; sizeMB: string; photoCount: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Import / Restore State
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [selectedRestoreFile, setSelectedRestoreFile] = useState<File | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const s = await FullBackupService.calculateBackupStats();
      setStats(s);
    } catch (err) {
      console.warn('Erro ao calcular estatísticas de backup:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
      setActiveTab(initialTab);
      setExportSuccess(null);
      setRestoreResult(null);
      setErrorMessage(null);
      setSelectedRestoreFile(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleExportZip = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setExportSuccess(null);

    try {
      const res = await FullBackupService.generateFullBackupZip((prog) => {
        setProgress(prog);
      });

      if (res.success) {
        setExportSuccess({
          filename: res.filename,
          sizeMB: (res.sizeBytes / (1024 * 1024)).toFixed(2),
          photoCount: res.stats.totalPhotos
        });
        loadStats();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao gerar pacote ZIP de backup completo.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleExportFullJSON = async (withPhotos: boolean) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setExportSuccess(null);

    try {
      setProgress({
        stage: 'zipping',
        message: withPhotos ? 'Empacotando todos os laudos e registros fotográficos em JSON...' : 'Gerando backup estrutural leve...',
        percent: 50
      });

      await FullBackupService.generateFullBackupJSON(withPhotos);

      setExportSuccess({
        filename: `jvm_dielectric_${withPhotos ? 'completo_com_fotos' : 'estrutural'}.json`,
        sizeMB: stats ? (withPhotos ? stats.estimatedSizeMB.toString() : '0.4') : '1.0',
        photoCount: withPhotos ? (stats?.totalPhotos || 0) : 0
      });
      loadStats();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao exportar arquivo JSON de backup.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = DielectricStorageService.exportTestsToCSV();
      const fileName = `jvm_laudos_ensaios_${new Date().toISOString().split('T')[0]}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMessage('Falha ao exportar CSV: ' + err.message);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    setErrorMessage(null);
    setRestoreResult(null);
    const nameLower = file.name.toLowerCase();
    if (!nameLower.endsWith('.zip') && !nameLower.endsWith('.json')) {
      setErrorMessage('Formato de arquivo inválido. Por favor, envie um arquivo .ZIP ou .JSON gerado pelo sistema.');
      return;
    }
    setSelectedRestoreFile(file);
  };

  const handleExecuteRestore = async () => {
    if (!selectedRestoreFile) return;

    if (!window.confirm(`Tem certeza de que deseja restaurar os dados do arquivo "${selectedRestoreFile.name}"? Todos os ensaios, fotos e cadastros serão mesclados e atualizados no banco local.`)) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setRestoreResult(null);

    try {
      const res = await FullBackupService.restoreBackupFile(selectedRestoreFile, (prog) => {
        setProgress(prog);
      });
      setRestoreResult(res);
      loadStats();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao restaurar arquivo de backup.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  return (
    <div id="complete-backup-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#0A2540] via-[#103860] to-[#0A2540] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-tight">Central de Backup Completo & Registros Fotográficos</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold uppercase">
                  Zero Data Loss
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Gere e restaure pacotes integrais contendo laudos, ensaios e todas as fotos de inspeção e teste
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-2 bg-slate-50 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Gerar Backup Completo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Restaurar Backup (.ZIP / .JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Diagnóstico do Banco & Fotos</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-100 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-blue-900 block">Ensaios / Laudos</span>
                <span className="text-lg font-black text-blue-950 font-mono">
                  {loadingStats ? '...' : stats?.totalTests || 0}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-100 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-emerald-900 block">Fotos & Evidências</span>
                <span className="text-lg font-black text-emerald-950 font-mono">
                  {loadingStats ? '...' : stats?.totalPhotos || 0}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-purple-50/80 rounded-2xl border border-purple-100 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-xs shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-purple-900 block">Equipamentos</span>
                <span className="text-lg font-black text-purple-950 font-mono">
                  {loadingStats ? '...' : stats?.totalEquipment || 0}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-100 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-600 text-white shadow-xs shrink-0">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-amber-900 block">Tamanho Estimado</span>
                <span className="text-lg font-black text-amber-950 font-mono">
                  {loadingStats ? '...' : `${stats?.estimatedSizeMB || 0} MB`}
                </span>
              </div>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
              <div className="flex-1">
                <strong className="block font-bold">Aviso de Operação:</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Progress Modal Overlay if Processing */}
          {isProcessing && progress && (
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                  <span className="font-bold text-sm text-emerald-300">{progress.message}</span>
                </div>
                <span className="font-mono text-xs font-black bg-slate-800 px-2.5 py-1 rounded-lg text-emerald-400">
                  {progress.percent}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              {progress.totalItems && progress.totalItems > 0 && (
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Itens processados: {progress.processedItems || 0} de {progress.totalItems}</span>
                  <span>Compactação sem perdas (ZIP Deflate)</span>
                </div>
              )}
            </div>
          )}

          {/* Success Banner */}
          {exportSuccess && !isProcessing && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-emerald-950 block">Backup Gerado com Sucesso!</span>
                  <span className="text-[11px] text-emerald-700">
                    Arquivo <strong>{exportSuccess.filename}</strong> ({exportSuccess.sizeMB} MB • {exportSuccess.photoCount} fotos integradas) salvo em seus Downloads.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: EXPORT SECTION */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-2xl p-5 bg-gradient-to-br from-slate-50 to-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span>Opção 1: Pacote Completo Compactado (.ZIP com Fotos em Alta Resolução)</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                        Recomendado
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Gera um arquivo .ZIP contendo o banco de dados em JSON, pastas organizadas com todas as fotografias (antes, durante, pós, defeito, identificação), oscilogramas, assinaturas do RT e documentos ART.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Fotografias de Ensaios</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">
                      {stats?.totalPhotos || 0} arquivos .jpg/.png
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Assinaturas Técnicas</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">
                      {stats?.totalSignatures || 0} assinaturas digitais
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Documentos & ART</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">
                      {stats?.totalAttachments || 0} anexos técnicos
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportZip}
                  disabled={isProcessing}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <FolderArchive className="w-5 h-5" />
                  <span>Gerar e Baixar Pacote Completo com Fotos (.ZIP)</span>
                </button>
              </div>

              {/* Secondary Export Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full JSON with embedded photos */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-blue-600 font-bold text-xs mb-1">
                      <FileJson className="w-4 h-4" />
                      <span>Arquivo Único JSON (com Fotos Embutidas)</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Arquivo .json padrão com todas as fotos codificadas em Base64. Ideal para backup rápido ou restauração direta em outro navegador.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExportFullJSON(true)}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar JSON com Fotos</span>
                  </button>
                </div>

                {/* Structural JSON without heavy photos */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-xs mb-1">
                      <FileJson className="w-4 h-4" />
                      <span>Backup Estrutural Leve (sem fotos)</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Gera arquivo leve contendo todos os clientes, equipamentos, laudos, medições e normas, sem os binários pesados de imagens.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExportFullJSON(false)}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar JSON Estrutural</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT / RESTORE SECTION */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                  isDraggingFile
                    ? 'border-purple-500 bg-purple-50/70 scale-[1.01]'
                    : 'border-slate-300 hover:border-purple-400 bg-slate-50/50 hover:bg-white'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processSelectedFile(f);
                  }}
                  accept=".zip,.json"
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>

                <h4 className="font-bold text-base text-slate-900 mb-1">
                  {selectedRestoreFile ? selectedRestoreFile.name : 'Selecione ou arraste o arquivo de backup aqui'}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Suporta arquivos <strong>.ZIP</strong> (Pacote completo com fotos) e <strong>.JSON</strong> gerados pelo sistema JVM Dielectric Lab.
                </p>

                {selectedRestoreFile && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 text-xs font-mono font-bold">
                    <span>Tamanho: {(selectedRestoreFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                )}
              </div>

              {selectedRestoreFile && (
                <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-xs text-purple-950 block">Arquivo Pronto para Restauração</span>
                    <span className="text-[11px] text-purple-700">
                      O sistema irá descompactar e reinjetar automaticamente todos os laudos, ensaios e fotos na memória do dispositivo.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Restaurando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmar & Restaurar Backup</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {restoreResult && (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>{restoreResult.message}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-emerald-200">
                    <div className="p-2 bg-white/80 rounded-lg">
                      <span className="text-slate-500 block text-[10px]">Laudos Restaurados</span>
                      <strong className="font-mono text-emerald-900">{restoreResult.details.tests}</strong>
                    </div>
                    <div className="p-2 bg-white/80 rounded-lg">
                      <span className="text-slate-500 block text-[10px]">Fotos Recuperadas</span>
                      <strong className="font-mono text-emerald-900">{restoreResult.details.photos}</strong>
                    </div>
                    <div className="p-2 bg-white/80 rounded-lg">
                      <span className="text-slate-500 block text-[10px]">Equipamentos</span>
                      <strong className="font-mono text-emerald-900">{restoreResult.details.equipment}</strong>
                    </div>
                    <div className="p-2 bg-white/80 rounded-lg">
                      <span className="text-slate-500 block text-[10px]">Clientes</span>
                      <strong className="font-mono text-emerald-900">{restoreResult.details.clients}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STATS & DIAGNOSTICS */}
          {activeTab === 'stats' && stats && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>Distribuição dos Registros Fotográficos por Categoria</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">Antes do Ensaio (Visual):</span>
                    <strong className="font-mono text-slate-900 font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                      {stats.photosByCategory.antes}
                    </strong>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">Durante o Ensaio (Hipot):</span>
                    <strong className="font-mono text-slate-900 font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200">
                      {stats.photosByCategory.durante}
                    </strong>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">Após Ensaio / Aprovado:</span>
                    <strong className="font-mono text-slate-900 font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                      {stats.photosByCategory.apos}
                    </strong>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">Identificação / CA:</span>
                    <strong className="font-mono text-slate-900 font-bold bg-purple-50 text-purple-800 px-2 py-0.5 rounded-md border border-purple-200">
                      {stats.photosByCategory.identificacao}
                    </strong>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">Defeitos / Reprovações:</span>
                    <strong className="font-mono text-slate-900 font-bold bg-red-50 text-red-800 px-2 py-0.5 rounded-md border border-red-200">
                      {stats.photosByCategory.defeito}
                    </strong>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">Inspeção Visual (Itens):</span>
                    <strong className="font-mono text-slate-900 font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                      {stats.photosByCategory.inspecao_visual}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Rastreabilidade Normativa NR-10 & ABNT:</strong>
                  <span>
                    Todas as fotos e registros fotográficos são armazenados em alta fidelidade com metadados de geolocalização (GPS), data/hora da captura e identificação do técnico executor. O backup completo (.ZIP) preserva integralmente essas evidências.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={loadStats}
            disabled={isProcessing}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
            <span>Atualizar Diagnóstico</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
