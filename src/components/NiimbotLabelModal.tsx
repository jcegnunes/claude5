import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Tag, 
  Layers, 
  FileSpreadsheet, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  HelpCircle, 
  CheckCircle2, 
  Sliders, 
  Smartphone, 
  Laptop, 
  FileText,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { TestRecord, CompanyLabInfo } from '../types';
import { 
  NiimbotRollSize, 
  NIIMBOT_ROLL_CONFIGS, 
  renderNiimbotLabelToCanvas,
  exportNiimbotPNG,
  exportNiimbotBatchZIP,
  exportNiimbotCSV,
  exportNiimbotPDF,
  exportNiimbotJCPS,
  exportNiimbotBatchJCPS,
  printNiimbotDirect
} from '../services/niimbotLabelService';
import { formatDateBR } from '../utils/dateUtils';

interface NiimbotLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  tests: TestRecord[];
  company: CompanyLabInfo;
  initialRollSize?: NiimbotRollSize;
}

export const NiimbotLabelModal: React.FC<NiimbotLabelModalProps> = ({
  isOpen,
  onClose,
  tests,
  company,
  initialRollSize = '50x30'
}) => {
  const [rollSize, setRollSize] = useState<NiimbotRollSize>(initialRollSize);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [helpTab, setHelpTab] = useState<'app' | 'pc_csv' | 'jcps' | 'direct'>('jcps');

  const currentTest = tests[currentIndex] || tests[0];
  const config = NIIMBOT_ROLL_CONFIGS[rollSize] || NIIMBOT_ROLL_CONFIGS['50x30'];

  // Update preview canvas whenever test or roll size changes
  useEffect(() => {
    if (!isOpen || !currentTest) return;

    let isMounted = true;
    setIsLoadingPreview(true);

    renderNiimbotLabelToCanvas(currentTest, company, rollSize)
      .then(canvas => {
        if (isMounted) {
          setPreviewDataUrl(canvas.toDataURL('image/png'));
          setIsLoadingPreview(false);
        }
      })
      .catch(err => {
        console.error('Erro ao renderizar preview Niimbot:', err);
        if (isMounted) setIsLoadingPreview(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentTest, rollSize, company]);

  if (!isOpen || !tests || tests.length === 0) return null;

  // Actions
  const handleDownloadSinglePNG = async () => {
    if (!currentTest) return;
    try {
      await exportNiimbotPNG(currentTest, company, rollSize);
    } catch (err) {
      alert('Erro ao exportar imagem PNG.');
    }
  };

  const handleDownloadSingleJCPS = async () => {
    if (!currentTest) return;
    try {
      await exportNiimbotJCPS(currentTest, company, rollSize);
    } catch (err) {
      alert('Erro ao exportar projeto .JCPS.');
    }
  };

  const handleDownloadBatchJCPS = async () => {
    setIsProcessing(true);
    try {
      await exportNiimbotBatchJCPS(tests, company, rollSize, (cur, tot, msg) => {
        setProgressMsg(msg);
      });
    } catch (err) {
      alert('Erro ao gerar projeto .JCPS em lote.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const handleDownloadAllZIP = async () => {
    setIsProcessing(true);
    try {
      await exportNiimbotBatchZIP(tests, company, rollSize, (cur, tot, msg) => {
        setProgressMsg(msg);
      });
    } catch (err) {
      alert('Erro ao gerar arquivo ZIP.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const handleDownloadPDF = async () => {
    setIsProcessing(true);
    try {
      await exportNiimbotPDF(tests, company, rollSize, (cur, tot, msg) => {
        setProgressMsg(msg);
      });
    } catch (err) {
      alert('Erro ao gerar documento PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const handleDownloadCSV = () => {
    try {
      exportNiimbotCSV(tests, company);
    } catch (err) {
      alert('Erro ao exportar planilha CSV para Niimbot.');
    }
  };

  const handleDirectPrint = async () => {
    try {
      await printNiimbotDirect(tests, company, rollSize);
    } catch (err) {
      alert('Erro ao enviar para impressão direta.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="bg-[#0A2540] text-white px-5 py-4 flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white leading-tight">
                  Etiquetas Compatíveis com Niimbot B1
                </h3>
                <span className="px-2 py-0.5 bg-orange-500 text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-xs">
                  203 DPI Térmica
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {tests.length === 1 
                  ? `Gerando etiqueta para o item ${currentTest.equipmentTag} (${currentTest.reportNumber})`
                  : `Emissão e exportação em lote para ${tests.length} itens selecionados`
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelpGuide(!showHelpGuide)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                showHelpGuide 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white/10 hover:bg-white/20 text-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Guia Niimbot</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">

          {/* Guide Banner (Collapsible) */}
          {showHelpGuide && (
            <div className="bg-blue-900 text-white rounded-2xl p-4 sm:p-5 shadow-md space-y-3 animate-in slide-in-from-top-3 duration-200">
              <div className="flex items-center justify-between border-b border-blue-800 pb-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-300" />
                  <span className="font-bold text-xs uppercase tracking-wider text-blue-200">
                    Como Imprimir no Software & Aplicativo NIIMBOT
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setHelpTab('jcps')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      helpTab === 'jcps' ? 'bg-white text-blue-900' : 'bg-blue-800/80 text-blue-100 hover:bg-blue-800'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 inline mr-1 text-amber-500" /> Projeto .JCPS
                  </button>
                  <button
                    onClick={() => setHelpTab('app')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      helpTab === 'app' ? 'bg-white text-blue-900' : 'bg-blue-800/80 text-blue-100 hover:bg-blue-800'
                    }`}
                  >
                    <Smartphone className="w-3 h-3 inline mr-1" /> App Celular
                  </button>
                  <button
                    onClick={() => setHelpTab('pc_csv')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      helpTab === 'pc_csv' ? 'bg-white text-blue-900' : 'bg-blue-800/80 text-blue-100 hover:bg-blue-800'
                    }`}
                  >
                    <Laptop className="w-3 h-3 inline mr-1" /> Software PC (Lote)
                  </button>
                  <button
                    onClick={() => setHelpTab('direct')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      helpTab === 'direct' ? 'bg-white text-blue-900' : 'bg-blue-800/80 text-blue-100 hover:bg-blue-800'
                    }`}
                  >
                    <Printer className="w-3 h-3 inline mr-1" /> Direto via Cabo/BT
                  </button>
                </div>
              </div>

              {helpTab === 'jcps' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-blue-950/60 p-3 rounded-xl border border-blue-800/60 space-y-1">
                    <span className="font-bold text-amber-300 block">1. Baixar Arquivo .JCPS</span>
                    <p className="text-blue-100 text-[11px]">
                      O formato <strong>.JCPS</strong> (Jingchen Print Schema) é o formato oficial de projeto do ecossistema Niimbot.
                    </p>
                  </div>
                  <div className="bg-blue-950/60 p-3 rounded-xl border border-blue-800/60 space-y-1">
                    <span className="font-bold text-amber-300 block">2. Abrir no Niimbot PC ou App</span>
                    <p className="text-blue-100 text-[11px]">
                      No software Niimbot PC ou no App Niimbot, clique em <strong>"Abrir Projeto / Modelo (.jcps)"</strong> para carregar o layout exato.
                    </p>
                  </div>
                  <div className="bg-blue-950/60 p-3 rounded-xl border border-blue-800/60 space-y-1">
                    <span className="font-bold text-amber-300 block">3. Dados e QR Code Vinculados</span>
                    <p className="text-blue-100 text-[11px]">
                      Todos os textos, fontes, bordas e QR Codes de validação criptográfica já vêm milimetricamente alinhados para 203 DPI.
                    </p>
                  </div>
                </div>
              )}

              {helpTab === 'app' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-blue-950/60 p-3 rounded-xl border border-blue-800/60 space-y-1">
                    <span className="font-bold text-orange-300 block">1. Baixar PNG / PDF</span>
                    <p className="text-blue-100 text-[11px]">
                      Clique no botão <strong>"Baixar PNG"</strong> ou <strong>"Baixar PDF 1:1"</strong> para salvar o arquivo de alta resolução no seu dispositivo.
                    </p>
                  </div>
                  <div className="bg-blue-950/60 p-3 rounded-xl border border-blue-800/60 space-y-1">
                    <span className="font-bold text-orange-300 block">2. Abrir no App NIIMBOT</span>
                    <p className="text-blue-100 text-[11px]">
                      No App NIIMBOT (Android/iOS), conecte sua B1 via Bluetooth e selecione <strong>"Importar Imagem"</strong> ou <strong>"Documento PDF"</strong>.
                    </p>
                  </div>
                  <div className="bg-blue-950/60 p-3 rounded-xl border border-blue-800/60 space-y-1">
                    <span className="font-bold text-orange-300 block">3. Impressão Perfeita</span>
                    <p className="text-blue-100 text-[11px]">
                      A imagem já vem configurada em 203 DPI e proporção exata para o rolo (50x30mm). Basta clicar em imprimir!
                    </p>
                  </div>
                </div>
              )}

              {helpTab === 'pc_csv' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-blue-950/60 p-3 rounded-xl border border-blue-800/60 space-y-1">
                    <span className="font-bold text-orange-300 block">1. Baixar Planilha CSV</span>
                    <p className="text-blue-100 text-[11px]">
                      Clique em <strong>"Planilha Niimbot CSV (Lote)"</strong> para exportar todos os ensaios formatados com cabeçalhos e links de QR Code.
                    </p>
                  </div>
                  <div className="bg-blue-950/60 p-3 rounded-xl border border-blue-800/60 space-y-1">
                    <span className="font-bold text-orange-300 block">2. Vincular no Niimbot PC</span>
                    <p className="text-blue-100 text-[11px]">
                      No software Niimbot para Windows/Mac, clique em <strong>"Excel / Data Source"</strong> e importe o arquivo CSV gerado.
                    </p>
                  </div>
                  <div className="bg-blue-950/60 p-3 rounded-xl border border-blue-800/60 space-y-1">
                    <span className="font-bold text-orange-300 block">3. Impressão Sequencial</span>
                    <p className="text-blue-100 text-[11px]">
                      O software Niimbot gerará 1 etiqueta para cada linha da planilha, imprimindo centenas de itens sequencialmente.
                    </p>
                  </div>
                </div>
              )}

              {helpTab === 'direct' && (
                <div className="p-3 bg-blue-950/60 rounded-xl border border-blue-800/60 text-xs text-blue-100 space-y-1">
                  <p>
                    Com o driver da <strong>Niimbot B1</strong> instalado no seu computador via USB ou pareado via Bluetooth, use o botão <strong>"Imprimir Direto (Térmica)"</strong>. A caixa de diálogo do navegador enviará o layout milimétrico ajustado sem margens.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Roll Size Selector */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                Selecione o Formato do Rolo Instalado na Niimbot B1:
              </span>
              <span className="text-slate-500 font-medium normal-case">
                Resolução Nativa: <strong>203 DPI (8 dots/mm)</strong>
              </span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(Object.keys(NIIMBOT_ROLL_CONFIGS) as NiimbotRollSize[]).map((sizeKey) => {
                const opt = NIIMBOT_ROLL_CONFIGS[sizeKey];
                const isSelected = rollSize === sizeKey;
                return (
                  <button
                    key={sizeKey}
                    type="button"
                    onClick={() => setRollSize(sizeKey)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold text-xs">{opt.widthMm} x {opt.heightMm} mm</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium line-clamp-1 block">
                        {opt.id === '50x30' ? '★ Padrão B1' : opt.recommendedFor.split(',')[0]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
              <span className="font-semibold text-slate-700">{config.name}:</span>
              <span>{config.description} • Recomendado para: {config.recommendedFor}</span>
            </div>
          </div>

          {/* Interactive Thermal Preview Section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            
            {/* Left: Live Visual Simulation */}
            <div className="md:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center space-y-4">
              
              <div className="w-full flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-orange-500" />
                  Simulação Térmica 1:1 ({config.widthMm} x {config.heightMm} mm)
                </span>
                
                {tests.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      title="Item anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-slate-800 px-1.5">
                      {currentIndex + 1} de {tests.length}
                    </span>
                    <button
                      onClick={() => setCurrentIndex(prev => Math.min(tests.length - 1, prev + 1))}
                      disabled={currentIndex === tests.length - 1}
                      className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      title="Próximo item"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Thermal Label Display Box */}
              <div className="p-4 sm:p-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner flex items-center justify-center w-full min-h-[220px]">
                {isLoadingPreview ? (
                  <div className="text-center space-y-2 py-8">
                    <Loader2 className="w-8 h-8 text-orange-400 animate-spin mx-auto" />
                    <p className="text-xs text-slate-300">Renderizando matriz térmica 203 DPI...</p>
                  </div>
                ) : previewDataUrl ? (
                  <div className="relative group max-w-full">
                    {/* Simulated Label Paper with subtle paper shadow */}
                    <div 
                      className="bg-white p-1 rounded-xs shadow-2xl border border-slate-300 transition-all duration-200 overflow-hidden"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '260px'
                      }}
                    >
                      <img 
                        src={previewDataUrl} 
                        alt="Etiqueta Niimbot B1" 
                        className="w-auto h-auto max-h-[240px] object-contain block mx-auto"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-2 flex items-center justify-center gap-2">
                      <span>Proporção: {config.widthMm}mm × {config.heightMm}mm</span>
                      <span>•</span>
                      <span>Contraste: 100% Monocromático</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Nenhum ensaio disponível para pré-visualização.</p>
                )}
              </div>

              {/* Item Info Summary */}
              {currentTest && (
                <div className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-left grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-medium">TAG:</span>
                    <span className="font-bold text-slate-900">{currentTest.equipmentTag}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Cliente:</span>
                    <span className="font-bold text-slate-900 truncate block">{currentTest.clientName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Resultado:</span>
                    <span className={`font-bold ${currentTest.result === 'APROVADO' ? 'text-emerald-700' : 'text-red-600'}`}>
                      {currentTest.result}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Validade:</span>
                    <span className="font-bold text-slate-900">{formatDateBR(currentTest.retestDueDate)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Export & Print Action Matrix */}
            <div className="md:col-span-5 space-y-3">
              
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  Opções de Exportação & Impressão
                </h4>

                {/* Button 0: Download Niimbot Project (.JCPS) */}
                <button
                  type="button"
                  onClick={handleDownloadSingleJCPS}
                  disabled={isProcessing}
                  className="w-full p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-300 rounded-xl transition-all flex items-center justify-between text-left shadow-xs cursor-pointer group active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 block">
                          Baixar Projeto Niimbot (.JCPS)
                        </span>
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-black rounded uppercase">
                          Oficial
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-600">
                        Formato Jingchen/Niimbot com layout milimétrico e dados
                      </span>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-amber-600 group-hover:scale-110 shrink-0 transition-transform" />
                </button>

                {/* Button 0.5: Download Batch Niimbot Project (.JCPS) if multiple tests */}
                {tests.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDownloadBatchJCPS}
                    disabled={isProcessing}
                    className="w-full p-3 bg-white hover:bg-amber-50/80 border border-slate-200 hover:border-amber-300 rounded-xl transition-all flex items-center justify-between text-left shadow-xs cursor-pointer group active:scale-98"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 group-hover:bg-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-900 block">
                          Baixar Projeto .JCPS em Lote ({tests.length} itens)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {tests.length} etiquetas sequenciais vinculadas no arquivo .jcps
                        </span>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-amber-600 shrink-0" />
                  </button>
                )}

                {/* Button 1: Download Image PNG (Direct Niimbot Import) */}
                <button
                  type="button"
                  onClick={handleDownloadSinglePNG}
                  disabled={isProcessing}
                  className="w-full p-3 bg-white hover:bg-orange-50/80 border border-slate-200 hover:border-orange-300 rounded-xl transition-all flex items-center justify-between text-left shadow-xs cursor-pointer group active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 group-hover:bg-orange-200 text-orange-700 flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">
                        Baixar Imagem PNG (203 DPI)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Item atual • Ideal para importar no App NIIMBOT
                      </span>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-orange-600 shrink-0" />
                </button>

                {/* Button 2: Download PDF (1:1 Exact mm format) */}
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isProcessing}
                  className="w-full p-3 bg-white hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 rounded-xl transition-all flex items-center justify-between text-left shadow-xs cursor-pointer group active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 group-hover:bg-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">
                        Baixar PDF 1:1 ({tests.length} {tests.length === 1 ? 'página' : 'páginas'})
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Páginas de {config.widthMm}x{config.heightMm}mm sem borda
                      </span>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                </button>

                {/* Button 3: Download ZIP (If multiple tests) */}
                {tests.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDownloadAllZIP}
                    disabled={isProcessing}
                    className="w-full p-3 bg-white hover:bg-purple-50/80 border border-slate-200 hover:border-purple-300 rounded-xl transition-all flex items-center justify-between text-left shadow-xs cursor-pointer group active:scale-98"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 group-hover:bg-purple-200 text-purple-700 flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-900 block">
                          Baixar Todas as Imagens (ZIP)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {tests.length} arquivos PNG separados + planilha
                        </span>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-purple-600 shrink-0" />
                  </button>
                )}

                {/* Button 4: CSV Data Source (Niimbot PC Excel Batch) */}
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  disabled={isProcessing}
                  className="w-full p-3 bg-white hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all flex items-center justify-between text-left shadow-xs cursor-pointer group active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">
                        Planilha Niimbot CSV (Lote)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Para módulo Excel/Data Source do software Niimbot
                      </span>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                </button>

                {/* Button 5: Direct Print */}
                <button
                  type="button"
                  onClick={handleDirectPrint}
                  disabled={isProcessing}
                  className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 active:scale-98 text-white rounded-xl font-bold text-xs shadow-md shadow-orange-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Direto no Driver Térmico</span>
                </button>
              </div>

              {/* Technical Specifications Badge */}
              <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  Rastreabilidade NR-10 & QR Code
                </div>
                <p>
                  As etiquetas incluem validação criptográfica de autenticidade, numeração de laudo e data de validade do reensaio.
                </p>
              </div>

            </div>
          </div>

        </div>

        {/* Progress Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-20">
            <div className="bg-white p-6 rounded-2xl max-w-sm w-full text-center space-y-3 shadow-2xl">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
              <h4 className="font-bold text-sm text-slate-900">Processando Etiquetas Niimbot</h4>
              <p className="text-xs text-slate-500">{progressMsg || 'Aguarde um instante...'}</p>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Compatível com NIIMBOT B1 • Resolução 203 DPI • Térmica Direta
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
