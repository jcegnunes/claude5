import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Download, 
  CheckCircle2, 
  X, 
  WifiOff, 
  QrCode, 
  ShieldCheck, 
  Zap, 
  Share2, 
  Layers, 
  FileCheck,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
  Usb,
  Terminal,
  Copy,
  Check,
  Cpu,
  FileCode,
  ArrowDownToLine,
  HelpCircle,
  Package,
  FolderArchive,
  Play,
  Tablet,
  AlertTriangle,
  ShieldAlert,
  KeyRound
} from 'lucide-react';
import { USBInstallerService, USBDeviceStatus } from '../services/usbInstallerService';
import { generateQRCodeDataUrl } from '../services/pdfGenerator';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchAndroidMode: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({
  isOpen,
  onClose,
  onLaunchAndroidMode
}) => {
  const [activeTab, setActiveTab] = useState<'apk' | 'devices' | 'pwa' | 'usb' | 'features'>('apk');
  const [installPromptTriggered, setInstallPromptTriggered] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  
  // USB & APK State
  const [usbStatus, setUsbStatus] = useState<USBDeviceStatus | null>(null);
  const [isDetectingUsb, setIsDetectingUsb] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [isGeneratingApkZip, setIsGeneratingApkZip] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const defaultUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-yqilyfejsx2or3ikkcoi5q-596527859900.us-east1.run.app';
  const [customServerUrl, setCustomServerUrl] = useState<string>(defaultUrl);

  const currentAppUrl = customServerUrl.trim() || defaultUrl;

  useEffect(() => {
    if (isOpen) {
      generateQRCodeDataUrl(currentAppUrl).then(setQrCodeUrl);
    }
  }, [isOpen, currentAppUrl]);

  if (!isOpen) return null;

  const handleInstallClick = () => {
    // @ts-expect-error window deferredPrompt
    if (window.deferredPrompt) {
      // @ts-expect-error window deferredPrompt
      window.deferredPrompt.prompt();
    } else {
      setInstallPromptTriggered(true);
    }
  };

  const handleDetectUSBDevice = async () => {
    setIsDetectingUsb(true);
    setUsbStatus(null);
    try {
      const result = await USBInstallerService.requestAndroidUSBDevice();
      setUsbStatus(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setUsbStatus({ connected: false, errorMessage: errorMsg });
    } finally {
      setIsDetectingUsb(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(label);
    setTimeout(() => setCopiedCommand(null), 2500);
  };

  const handleGenerateAndDownloadApkProject = async () => {
    setIsGeneratingApkZip(true);
    try {
      await USBInstallerService.generateAndDownloadAndroidStudioZip(currentAppUrl);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (err) {
      console.error('Erro ao gerar pacote APK:', err);
    } finally {
      setIsGeneratingApkZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* Header with Android Badge */}
        <div className="bg-gradient-to-r from-[#0A2540] via-blue-900 to-slate-900 p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between relative overflow-hidden shrink-0">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-36 h-36 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-green-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center text-slate-950 font-black">
              <Package className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase tracking-wider border border-emerald-500/30">
                  Gerador APK Android V5.2.0
                </span>
                <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 font-bold text-[10px] uppercase tracking-wider border border-orange-500/30">
                  Xiaomi &amp; Samsung Tablet
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-bold text-[10px] uppercase tracking-wider border border-blue-500/30">
                  Android 15 / HyperOS / One UI
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5 tracking-tight">
                Aplicativo Android APK V5.2.0 &bull; Laboratório Dielétrico JVM
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/80 p-1.5 gap-1 text-xs overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('apk')}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'apk'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Gerar APK (.zip)</span>
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'devices'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tablet className="w-4 h-4" />
            <span>Xiaomi &amp; Tablet Samsung</span>
          </button>

          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'pwa'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QR Code / Direto</span>
          </button>

          <button
            onClick={() => setActiveTab('usb')}
            className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'usb'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Usb className="w-4 h-4" />
            <span>Cabo USB (ADB)</span>
          </button>

          <button
            onClick={() => setActiveTab('features')}
            className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'features'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Paridade Total</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm flex-1">
          {/* TAB 1: GERAR ARQUIVO APK */}
          {activeTab === 'apk' && (
            <div className="space-y-4">
              {/* Featured Download Banner */}
              <div className="bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-700/50 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                      <FolderArchive className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white flex items-center gap-2 flex-wrap">
                        <span>Pacote Android Studio &amp; Gradle 8.13</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/40">APK Nativo 1-Clique</span>
                        <span className="text-[10px] bg-teal-500/20 text-teal-300 font-bold px-2 py-0.5 rounded-full border border-teal-500/40">Offline + Nuvem</span>
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Baixe o projeto compilável com <code>build-apk-windows.bat</code>, <code>AndroidManifest.xml</code> responsivo para celulares Xiaomi e tablets Samsung, e suporte a câmera/QR Code.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Target URL Selector for Live Sync */}
                <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                      <span>URL da Plataforma Online para Sincronização:</span>
                    </label>
                    <span className="text-[10px] text-emerald-400 font-mono">WebView Nativo</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={customServerUrl}
                      onChange={(e) => setCustomServerUrl(e.target.value)}
                      placeholder="https://sua-plataforma-online.com"
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomServerUrl(typeof window !== 'undefined' ? window.location.origin : '')}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-300 transition-colors"
                        title="Usar link atual"
                      >
                        Padrão Atual
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleGenerateAndDownloadApkProject}
                    disabled={isGeneratingApkZip}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.99] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingApkZip ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Empacotando Projeto Android (.zip)...</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownToLine className="w-4 h-4" />
                        <span>Baixar Pacote Completo APK (.ZIP)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      USBInstallerService.downloadFile('build-apk-windows.bat', USBInstallerService.getBuildApkWindowsBat(), 'application/x-bat');
                    }}
                    className="py-3 px-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <FileCode className="w-4 h-4 text-orange-400" />
                    <span>Script Compilar (.bat)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      USBInstallerService.downloadFile('AndroidManifest.xml', USBInstallerService.getAndroidManifestXml(), 'text/xml;charset=utf-8');
                    }}
                    className="py-3 px-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    title="Baixar AndroidManifest.xml com suporte a Xiaomi e Tablets Samsung"
                  >
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <span>Manifest XML</span>
                  </button>
                </div>

                {downloadSuccess && (
                  <div className="p-3 bg-emerald-900/60 border border-emerald-500/60 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>Download concluído!</strong> O arquivo <code>jvm-dielectric-lab-android-apk-v5.2.0.zip</code> foi baixado com sucesso.</span>
                  </div>
                )}

                {/* Important notice about extracting ZIP to avoid 'File Not Found' in Android Studio */}
                <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs text-amber-200/90 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Atenção: Como abrir no Android Studio (Evitando erro &quot;Não Localizado&quot;)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    <strong>1º Extraia o arquivo .ZIP</strong> (Botão direito &gt; <em>&quot;Extrair Tudo...&quot;</em> no Windows). O Android Studio não abre arquivos <code>.zip</code> diretamente.<br />
                    <strong>2º No Android Studio:</strong> Clique em <strong>File &gt; Open...</strong> e selecione a <strong>pasta descompactada</strong> (onde estão os arquivos <code>build.gradle</code> e <code>settings.gradle</code>).
                  </p>
                </div>
              </div>

              {/* 2 Methods Guide to compile APK */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Method 1: Android Studio */}
                <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] flex items-center justify-center font-black">1</span>
                    <span>Compilação no Android Studio</span>
                  </div>
                  <ol className="space-y-1.5 text-slate-300 text-[11px] list-decimal list-inside leading-relaxed">
                    <li>Extraia o arquivo <code>.zip</code> baixado para uma pasta.</li>
                    <li>No Android Studio, clique em <strong>File &gt; Open...</strong> e escolha a <strong>pasta descompactada</strong>.</li>
                    <li>Aguarde o Gradle sincronizar e vá em: <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong>.</li>
                    <li>O APK será gerado em: <br/><code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded text-[10px]">app/build/outputs/apk/debug/app-debug.apk</code></li>
                  </ol>
                </div>

                {/* Method 2: Batch 1-click */}
                <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-orange-400 font-bold">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-300 text-[11px] flex items-center justify-center font-black">2</span>
                    <span>Compilação Rápida no Windows (1-Clique)</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Após extrair o ZIP, dê duplo clique em <code>build-apk-windows.bat</code>. Ele executa o Gradle 8.13 automaticamente e compila o instalador <code>app-debug.apk</code> pronto para transferir ao celular ou tablet.
                  </p>
                </div>
              </div>

              {/* Developer Recognition & Play Protect Card */}
              <div className="p-4 bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border border-blue-600/40 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Por que o Android exibe aviso de &quot;Desenvolvedor Desconhecido&quot; / Play Protect?</span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    Quando você gera o APK através de <code>Build APK(s)</code>, o Android Studio utiliza uma chave genérica de teste (<em>debug key</em>). Todo celular Android (Samsung, Xiaomi, Motorola) exibe um aviso padrão de segurança para qualquer app instalado fora da Google Play Store. <strong>Isso é 100% seguro e normal para apps privados/corporativos.</strong>
                  </p>
                  <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                    <strong className="text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Como instalar no celular:
                    </strong>
                    <p className="text-slate-300 text-[10.5px]">
                      Ao abrir o APK no celular, se o Play Protect disser <em>&quot;Bloqueado pelo Play Protect / Desenvolvedor não reconhecido&quot;</em>, clique em <strong>&quot;Mais detalhes&quot;</strong> e depois em <strong>&quot;Instalar assim mesmo&quot;</strong>.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Como assinar o APK oficialmente com seus dados de Criador (Release Assinada)</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    No Android Studio, você pode assinar o APK com seu próprio nome e empresa:
                  </p>
                  <ol className="text-[10.5px] text-slate-300 list-decimal list-inside space-y-1 pl-1">
                    <li>No menu superior do Android Studio, vá em: <strong>Build &gt; Generate Signed Bundle / APK...</strong></li>
                    <li>Selecione <strong>APK</strong> e clique em <strong>Next</strong>.</li>
                    <li>Em <em>Key store path</em>, clique em <strong>Create new...</strong> e preencha com seu nome (<em>João Carlos / JVM Engenharia</em>).</li>
                    <li>Escolha a variante <strong>release</strong>, marque <strong>V1 e V2 signatures</strong> e clique em <strong>Finish</strong>.</li>
                    <li>O arquivo gerado será o <code>app-release.apk</code> assinado com você como autor oficial.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: XIAOMI & SAMSUNG TABLET GUIDES */}
          {activeTab === 'devices' && (
            <div className="space-y-4 text-xs">
              {/* Xiaomi Phone Card */}
              <div className="p-4 bg-gradient-to-br from-slate-900 via-orange-950/30 to-slate-900 border border-orange-700/50 rounded-2xl space-y-3">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Smartphones Xiaomi / Redmi / POCO (MIUI &amp; HyperOS)</h3>
                    <span className="text-[10px] text-orange-300">Otimizações para Campo &amp; Agilidade</span>
                  </div>
                </div>

                <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Orientação Dinâmica:</strong> Funciona perfeitamente em modo retrato (vertical) com navegação rápida de polegar e auto-rotação.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Câmera &amp; Scanner de QR Code:</strong> Foco rápido para leitura das tags adesivas ou de plaquetas dos EPIs.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Instalação do APK:</strong> Se a MIUI ou HyperOS solicitar confirmação de segurança, selecione &quot;Permitir instalação de fontes desconhecidas&quot;.</span>
                  </div>
                </div>
              </div>

              {/* Samsung Tablet Card */}
              <div className="p-4 bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border border-blue-700/50 rounded-2xl space-y-3">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Tablet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Tablets Samsung (Galaxy Tab S / Galaxy Tab A / One UI)</h3>
                    <span className="text-[10px] text-blue-300">Visualização Completa de Laboratório &amp; Tela Grande</span>
                  </div>
                </div>

                <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Layout Horizontal (Paisagem):</strong> Em telas de 8&quot; a 14.6&quot;, exibe a interface idêntica ao Desktop com gráficos de corrente de fuga mA em tempo real.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Caneta S-Pen &amp; Assinatura Digital:</strong> Coleta de assinaturas do Responsável Técnico diretamente na tela com precisão milimétrica.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Modo Samsung DeX &amp; Split-Screen:</strong> Suporte a multijanela lado a lado para conferir especificações e emitir laudos simultaneamente.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Impressão Bluetooth Niimbot B1:</strong> Conexão Bluetooth direta com a impressora térmica para emitir etiquetas na bancada do tablet.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: QR CODE / PWA INSTANT */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-800/60 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                {qrCodeUrl ? (
                  <div className="p-2.5 bg-white rounded-2xl shadow-xl shrink-0">
                    <img src={qrCodeUrl} alt="QR Code Instalação Direta" className="w-36 h-36 object-contain" />
                    <span className="block text-[9px] text-slate-800 text-center font-bold mt-1">Escanear com a Câmera</span>
                  </div>
                ) : (
                  <div className="w-36 h-36 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 shrink-0">
                    <QrCode className="w-12 h-12 animate-pulse" />
                  </div>
                )}

                <div className="text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold rounded-md text-[10px] uppercase">
                      Instalação Instantânea
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-white">Aponte a Câmera do seu Xiaomi ou Tablet Samsung</h3>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Abra a câmera nativa do celular ou tablet e aponte para o QR Code ao lado para carregar e instalar o aplicativo diretamente no navegador (Chrome / Samsung Internet / Mi Browser) em 10 segundos.
                  </p>
                  <button
                    onClick={handleInstallClick}
                    className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Instalar Aplicativo Neste Dispositivo</span>
                  </button>
                </div>
              </div>

              {/* Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                  <span className="font-bold text-orange-400 block">1. Escanear QR Code</span>
                  <span className="text-slate-400">Acesse o sistema no Chrome ou Samsung Internet.</span>
                </div>
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                  <span className="font-bold text-orange-400 block">2. Menu ⋮ do Navegador</span>
                  <span className="text-slate-400">Toque em &quot;Instalar aplicativo&quot; ou &quot;Adicionar à tela inicial&quot;.</span>
                </div>
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                  <span className="font-bold text-orange-400 block">3. Pronto para Uso!</span>
                  <span className="text-slate-400">Ícone criado na tela com funcionamento 100% offline.</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VIA CABO USB (ADB) */}
          {activeTab === 'usb' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-orange-950/40 via-amber-950/20 to-slate-900 border border-orange-800/60 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-orange-400 font-bold">
                  <Terminal className="w-4 h-4" />
                  <span>Instalação Direta via Cabo USB &amp; Modo Desenvolvedor</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Conecte seu aparelho Xiaomi ou Samsung via cabo USB com a <strong>Depuração USB</strong> ativada para instalar o aplicativo sem passar por lojas.
                </p>
              </div>

              {/* USB Device Diagnostics */}
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    Diagnóstico de Conexão USB
                  </span>
                  <button
                    type="button"
                    onClick={handleDetectUSBDevice}
                    disabled={isDetectingUsb}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isDetectingUsb ? (
                      <>
                        <div className="w-3 h-3 border-2 border-slate-300 border-t-white rounded-full animate-spin" />
                        <span>Detectando...</span>
                      </>
                    ) : (
                      <>
                        <Usb className="w-3.5 h-3.5 text-orange-400" />
                        <span>Testar Dispositivo USB</span>
                      </>
                    )}
                  </button>
                </div>

                {usbStatus && (
                  <div className={`p-3 rounded-xl text-xs border ${
                    usbStatus.connected 
                      ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300' 
                      : usbStatus.isIframeRestricted
                        ? 'bg-blue-950/70 border-blue-600/50 text-blue-200'
                        : 'bg-amber-950/60 border-amber-600/50 text-amber-300'
                  }`}>
                    {usbStatus.connected ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-bold text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Dispositivo Android Conectado com Sucesso!</span>
                        </div>
                        <p className="text-[11px] text-emerald-200">
                          Modelo: {usbStatus.deviceName} | Fabricante: {usbStatus.manufacturerName}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                          <span className="leading-relaxed">{usbStatus.errorMessage || 'Nenhum dispositivo Android selecionado.'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: FEATURES & PARITY */}
          {activeTab === 'features' && (
            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl space-y-2.5">
                <span className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] block">
                  100% de Paridade Funcional no Aplicativo APK:
                </span>
                <ul className="space-y-2 text-slate-300 text-[11px]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Abertura Direta da Câmera do Celular:</strong> Abertura nativa da lente fotográfica para registros fotográficos de inspeção, conformidade visual, evidências e leitura instantânea de QR Code tags.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Assistente de Ensaios em 4 Passos:</strong> Ensaios de Luvas, Mangotes, Varetas, Lençóis e Ferramentas 1000V com cálculo normativo de corrente de fuga mA.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Laudos e Certificados com Matrícula do Técnico:</strong> Identificação completa do operador, empresa, lotação e assinatura na tela.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Impressão Térmica Niimbot B1:</strong> Geração direta de etiquetas de ensaio com fidelidade milimétrica (203 DPI) via Bluetooth ou CSV.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Inventário de EPIs &amp; Ordens de Serviço:</strong> Rastreabilidade total de lotes, datas de reensaio e status em tempo real.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Operação 100% Offline:</strong> Todos os registros e fotos são gravados instantaneamente no armazenamento do celular ou tablet.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => {
              onLaunchAndroidMode();
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-orange-400" />
            <span>Simulador Modo Android</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleGenerateAndDownloadApkProject}
              disabled={isGeneratingApkZip}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGeneratingApkZip ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Gerando Pacote ZIP...</span>
                </>
              ) : (
                <>
                  <FolderArchive className="w-4 h-4" />
                  <span>Baixar Pacote APK (.zip)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
