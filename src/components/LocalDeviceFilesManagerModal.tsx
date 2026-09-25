import React, { useState, useEffect } from 'react';
import { 
  FolderArchive, 
  FileText, 
  Download, 
  Share2, 
  Trash2, 
  X, 
  Smartphone, 
  HardDrive, 
  Search, 
  CheckCircle2, 
  FileSpreadsheet, 
  Tag, 
  Eye, 
  ExternalLink,
  RefreshCw,
  Clock,
  Shield,
  Layers,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { 
  LocalSavedFile, 
  LocalFileCategory, 
  getLocalSavedFiles, 
  deleteLocalSavedFile, 
  clearAllLocalSavedFiles, 
  shareSavedFile, 
  saveFileLocally, 
  isAndroidNativeApp 
} from '../utils/nativeFileSaver';
import { formatDateBR } from '../utils/dateUtils';

interface LocalDeviceFilesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LocalDeviceFilesManagerModal: React.FC<LocalDeviceFilesManagerModalProps> = ({
  isOpen,
  onClose
}) => {
  const [files, setFiles] = useState<LocalSavedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState<LocalSavedFile | null>(null);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const isNative = isAndroidNativeApp();

  const loadFiles = async () => {
    setLoading(true);
    const list = await getLocalSavedFiles();
    setFiles(list);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }

    const handleFileSaved = () => {
      loadFiles();
    };

    window.addEventListener('jvm-local-file-saved', handleFileSaved);
    window.addEventListener('jvm-local-file-deleted', handleFileSaved);
    window.addEventListener('jvm-local-file-cleared', handleFileSaved);

    return () => {
      window.removeEventListener('jvm-local-file-saved', handleFileSaved);
      window.removeEventListener('jvm-local-file-deleted', handleFileSaved);
      window.removeEventListener('jvm-local-file-cleared', handleFileSaved);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setActionNotice({ message, type });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleDelete = async (file: LocalSavedFile) => {
    if (window.confirm(`Deseja remover "${file.filename}" da memória local do dispositivo?`)) {
      await deleteLocalSavedFile(file.id);
      showToast(`Arquivo "${file.filename}" removido.`, 'info');
      await loadFiles();
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Tem certeza que deseja apagar todos os arquivos salvos localmente na memória do dispositivo? Os registros nos bancos de dados não serão afetados.')) {
      await clearAllLocalSavedFiles();
      showToast('Todos os arquivos locais foram removidos.', 'info');
      await loadFiles();
    }
  };

  const handleDownloadAgain = async (file: LocalSavedFile) => {
    if (!file.dataUrl) return;
    await saveFileLocally({
      filename: file.filename,
      data: file.dataUrl,
      mimeType: file.mimeType,
      title: file.title,
      category: file.category,
      cacheOffline: false,
      openAfterSave: true
    });
    showToast(`Arquivo "${file.filename}" salvo novamente em Downloads!`);
  };

  const handleShare = async (file: LocalSavedFile) => {
    const ok = await shareSavedFile(file);
    if (ok) {
      showToast(`Compartilhando "${file.filename}"...`);
    } else {
      showToast(`Arquivo pronto para download.`, 'info');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const totalBytes = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);

  const filteredFiles = files.filter((f) => {
    const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
    const matchesSearch = 
      searchQuery.trim() === '' ||
      f.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryBadge = (category: LocalFileCategory) => {
    switch (category) {
      case 'laudo':
        return <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200">Laudo PDF</span>;
      case 'certificado':
        return <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">Certificado</span>;
      case 'relatorio_os':
        return <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold border border-purple-200">Relatório OS</span>;
      case 'backup':
        return <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">Backup JSON</span>;
      case 'csv':
        return <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[10px] font-bold border border-teal-200">Planilha CSV</span>;
      case 'etiqueta':
        return <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[10px] font-bold border border-orange-200">Etiqueta Térmica</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">Documento</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0A2540] via-blue-900 to-slate-900 p-5 border-b border-slate-800 flex items-center justify-between relative overflow-hidden shrink-0">
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white font-black shadow-lg shadow-orange-500/20">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase tracking-wider border border-emerald-500/30">
                  {isNative ? 'APK Nativo Ativo' : 'Armazenamento Local'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 font-bold text-[10px] uppercase tracking-wider border border-orange-500/30">
                  100% Offline
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                Arquivos Salvos na Memória do Celular / Tablet
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Notice Bar */}
        {actionNotice && (
          <div className={`p-3 text-xs font-bold flex items-center gap-2 justify-between border-b ${
            actionNotice.type === 'success' 
              ? 'bg-emerald-950 text-emerald-200 border-emerald-800' 
              : 'bg-blue-950 text-blue-200 border-blue-800'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{actionNotice.message}</span>
            </div>
            <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Storage Stats & Directory Info */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Total de Arquivos:</span>
              <span className="font-extrabold text-white font-mono bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                {files.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Espaço Ocupado:</span>
              <span className="font-extrabold text-orange-300 font-mono bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                {formatFileSize(totalBytes)}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-slate-400">Diretório Android:</span>
              <span className="font-mono text-[11px] text-emerald-400 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                /Download/JVM_Laudos_Dieletricos/
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadFiles}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
            {files.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800/50 text-red-300 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Tudo</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row items-center gap-2.5">
          {/* Categories Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'laudo', label: 'Laudos PDF' },
              { id: 'certificado', label: 'Certificados' },
              { id: 'relatorio_os', label: 'Relatórios OS' },
              { id: 'backup', label: 'Backups' },
              { id: 'csv', label: 'Planilhas CSV' },
              { id: 'etiqueta', label: 'Etiquetas' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === tab.id
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64 sm:ml-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar arquivo local..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Files List Container */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
              <p className="text-sm font-medium">Carregando arquivos da memória local...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-center space-y-3 bg-slate-950/40 border border-dashed border-slate-800 rounded-3xl p-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500">
                <FolderArchive className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="font-bold text-white text-sm">Nenhum arquivo local encontrado</h4>
                <p className="text-xs text-slate-400">
                  {searchQuery 
                    ? 'Nenhum resultado corresponde aos termos da pesquisa.' 
                    : 'Ao emitir laudos, certificados, relatórios ou backups, eles serão salvos diretamente aqui na memória do seu celular/tablet e na pasta Downloads.'}
                </p>
              </div>
            </div>
          ) : (
            filteredFiles.map((file) => (
              <div
                key={file.id}
                className="p-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:shadow-lg"
              >
                {/* Left File Info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 text-orange-400">
                    {file.category === 'csv' ? (
                      <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                    ) : file.category === 'etiqueta' ? (
                      <Tag className="w-5 h-5 text-orange-400" />
                    ) : file.category === 'backup' ? (
                      <HardDrive className="w-5 h-5 text-amber-400" />
                    ) : (
                      <FileText className="w-5 h-5 text-blue-400" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-xs truncate max-w-md" title={file.filename}>
                        {file.filename}
                      </span>
                      {getCategoryBadge(file.category)}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-lg">
                      {file.title}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                      <span>{formatDateBR(file.createdAt)}</span>
                      <span>&bull;</span>
                      <span>{formatFileSize(file.sizeBytes)}</span>
                      <span>&bull;</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Salvo Localmente
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {file.dataUrl && file.mimeType === 'application/pdf' && (
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Visualizar documento"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span className="hidden md:inline">Ver</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDownloadAgain(file)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Baixar novamente para o dispositivo"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Baixar</span>
                  </button>

                  <button
                    onClick={() => handleShare(file)}
                    className="px-2.5 py-1.5 rounded-xl bg-orange-600/80 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Compartilhar via WhatsApp / Email / Bluetooth"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Enviar</span>
                  </button>

                  <button
                    onClick={() => handleDelete(file)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                    title="Excluir arquivo da memória local"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Todos os arquivos são gravados na memória Flash do celular/tablet sem necessidade de internet.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* PDF Quick Preview Lightbox Modal */}
      {previewFile && previewFile.dataUrl && (
        <div className="fixed inset-0 z-60 bg-black/90 flex flex-col p-2 sm:p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-2xl flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-5 h-5 text-blue-400 shrink-0" />
              <span className="font-bold text-xs sm:text-sm truncate">{previewFile.filename}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadAgain(previewFile)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar</span>
              </button>
              <button
                onClick={() => handleShare(previewFile)}
                className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartilhar</span>
              </button>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800">
            <iframe
              src={previewFile.dataUrl}
              className="w-full h-full border-0"
              title={previewFile.filename}
            />
          </div>
        </div>
      )}
    </div>
  );
};
