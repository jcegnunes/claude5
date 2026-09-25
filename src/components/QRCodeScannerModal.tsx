import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Camera, 
  X, 
  Search, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  Upload, 
  SwitchCamera, 
  RefreshCw,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { DielectricStorageService } from '../services/syncEngine';
import { Equipment, TestRecord } from '../types';
import { formatDateBR } from '../utils/dateUtils';

interface QRCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEquipment?: (equipment: Equipment) => void;
  onSelectValidationCode?: (code: string) => void;
}

export const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectEquipment,
  onSelectValidationCode
}) => {
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  const [scanResult, setScanResult] = useState<{
    type: 'equipment' | 'certificate' | 'unknown';
    equipment?: Equipment;
    test?: TestRecord;
    code: string;
  } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const qrReaderId = 'html5-qr-reader-container';

  useEffect(() => {
    if (isOpen) {
      setScanResult(null);
      setCameraError(null);
      setErrorDetails(null);
      setShowTroubleshooting(false);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      scannerRef.current = null;
    }
    setScanning(false);
    setIsInitializing(false);
  };

  const startCamera = async () => {
    await stopCamera();
    setIsInitializing(true);
    setCameraError(null);
    setErrorDetails(null);

    // Wait slightly to ensure container is fully mounted in DOM
    setTimeout(async () => {
      try {
        const container = document.getElementById(qrReaderId);
        if (!container) {
          throw new Error('Elemento do visor não encontrado no DOM');
        }

        const scanner = new Html5Qrcode(qrReaderId);
        scannerRef.current = scanner;

        // Try getting cameras first if possible
        let cameras: Array<{ id: string; label: string }> = [];
        try {
          cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            setAvailableCameras(cameras);
          }
        } catch (camListErr) {
          console.warn('getCameras error or not supported:', camListErr);
        }

        const qrConfig = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.max(180, Math.floor(minEdge * 0.75));
            return { width: boxSize, height: boxSize };
          },
          aspectRatio: 1.0
        };

        const onScanSuccess = (decodedText: string) => {
          handleDecodedText(decodedText);
        };

        const onScanFailure = () => {
          // Ignore intermittent decode failures per frame
        };

        let started = false;

        // Attempt 1: If cameras list exists, use back camera or index
        if (cameras.length > 0) {
          const backCam = cameras.find(c => 
            c.label.toLowerCase().includes('back') || 
            c.label.toLowerCase().includes('traseira') || 
            c.label.toLowerCase().includes('rear') || 
            c.label.toLowerCase().includes('environment')
          );
          const targetCamId = backCam ? backCam.id : cameras[selectedCameraIndex % cameras.length].id;
          
          try {
            await scanner.start(targetCamId, qrConfig, onScanSuccess, onScanFailure);
            started = true;
          } catch (camIdErr) {
            console.warn('Attempt with deviceId failed, fallback to facingMode:', camIdErr);
          }
        }

        // Attempt 2: FacingMode 'environment'
        if (!started) {
          try {
            await scanner.start({ facingMode: facingMode }, qrConfig, onScanSuccess, onScanFailure);
            started = true;
          } catch (facingErr) {
            console.warn('Attempt with facingMode failed:', facingErr);
          }
        }

        // Attempt 3: Any facingMode / exact / user fallback
        if (!started) {
          try {
            await scanner.start({ facingMode: 'user' }, qrConfig, onScanSuccess, onScanFailure);
            started = true;
          } catch (userFacingErr) {
            console.warn('Attempt with user facingMode failed:', userFacingErr);
          }
        }

        if (started) {
          setScanning(true);
          setIsInitializing(false);
        } else {
          throw new Error('Nenhuma câmera pôde ser iniciada com as configurações padrão.');
        }

      } catch (err: any) {
        console.warn('Camera start error:', err);
        setIsInitializing(false);
        setScanning(false);
        
        const errMsg = err?.message || String(err);
        setErrorDetails(errMsg);

        if (errMsg.includes('Permission') || errMsg.includes('NotAllowed') || errMsg.includes('denied')) {
          setCameraError('Permissão de acesso à câmera negada. Conceda permissão no navegador ou utilize a Câmera Nativa abaixo.');
        } else if (errMsg.includes('NotFound') || errMsg.includes('DevicesNotFoundError')) {
          setCameraError('Nenhuma câmera foi encontrada neste dispositivo. Utilize o envio de imagem da galeria.');
        } else if (errMsg.includes('in use') || errMsg.includes('NotReadableError')) {
          setCameraError('A câmera está ocupada por outro app. Feche outros aplicativos ou use a Câmera Nativa.');
        } else {
          setCameraError('Não foi possível abrir a câmera em tempo real. Utilize o botão "📷 Tirar Foto com Câmera do Celular" abaixo.');
        }
      }
    }, 250);
  };

  const handleToggleFacingMode = () => {
    if (availableCameras.length > 1) {
      const nextIndex = (selectedCameraIndex + 1) % availableCameras.length;
      setSelectedCameraIndex(nextIndex);
    }
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleDecodedText = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    
    // Check if it's a URL (e.g. /validar/VAL-JVM-2026-XXXXXX)
    if (clean.includes('/validar/')) {
      const parts = clean.split('/validar/');
      const code = parts[1]?.split('?')[0]?.split('/')[0] || clean;
      const test = DielectricStorageService.getTestById(code);
      setScanResult({
        type: 'certificate',
        test,
        code
      });
      stopCamera();
      return;
    }

    // Check if it's equipment by UUID, tag or qrCode field
    const allEq = DielectricStorageService.getEquipment();
    const foundEq = allEq.find(e => 
      e.qrCode === clean || 
      e.uuid === clean || 
      e.tag.toLowerCase() === clean.toLowerCase() ||
      e.serialNumber.toLowerCase() === clean.toLowerCase()
    );

    if (foundEq) {
      setScanResult({
        type: 'equipment',
        equipment: foundEq,
        code: clean
      });
      stopCamera();
      return;
    }

    // Check if it's a certificate code directly
    const foundTest = DielectricStorageService.getTestById(clean);
    if (foundTest) {
      setScanResult({
        type: 'certificate',
        test: foundTest,
        code: clean
      });
      stopCamera();
      return;
    }

    setScanResult({
      type: 'unknown',
      code: clean
    });
    stopCamera();
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDecodedText(manualCode);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingPhoto(true);
    setCameraError(null);

    try {
      const scanner = new Html5Qrcode('file-qr-temp');
      const decodedText = await scanner.scanFile(file, true);
      handleDecodedText(decodedText);
    } catch (err: any) {
      console.warn('QR file scan error:', err);
      setCameraError('Não foi possível identificar um QR Code válido na foto tirada. Aproxime mais a câmera da etiqueta.');
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        
        {/* Header */}
        <div className="bg-[#0A2540] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Leitor de QR Code & Rastreabilidade</h3>
              <p className="text-[11px] text-slate-300">Aponte a câmera para a etiqueta do EPI/EPC ou laudo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          
          {/* Scanner Viewport */}
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden min-h-[260px] flex items-center justify-center border-2 border-slate-800 shadow-inner">
            
            {/* Realtime QR Container */}
            <div id={qrReaderId} className="w-full h-full min-h-[260px]" />

            {/* Loading Camera State */}
            {isInitializing && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2 text-white p-4">
                <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                <p className="text-xs font-semibold">Iniciando câmera do celular...</p>
                <p className="text-[10px] text-slate-400">Solicitando acesso ao sensor de vídeo</p>
              </div>
            )}

            {/* Camera Floating Controls */}
            {scanning && (
              <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  className="px-2.5 py-1.5 rounded-full bg-black/70 hover:bg-black/90 text-white text-[11px] font-bold backdrop-blur-md border border-white/20 flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
                  title="Alternar entre câmera frontal e traseira"
                >
                  <SwitchCamera className="w-3.5 h-3.5 text-orange-400" />
                  <span className="hidden xs:inline">Trocar Câmera</span>
                </button>
              </div>
            )}

            {/* Error / Fallback Card */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-5 text-center text-slate-200 z-10 space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <AlertCircle className="w-6 h-6" />
                </div>
                
                <div className="max-w-xs space-y-1">
                  <p className="text-xs font-bold text-white">Câmera em Tempo Real Bloqueada</p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{cameraError}</p>
                </div>

                {/* Primary Fallback Action: Native Phone Camera */}
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full max-w-xs pt-1">
                  <button
                    type="button"
                    onClick={() => nativeCameraInputRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingPhoto ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    <span>Tirar Foto (Câmera do Celular)</span>
                  </button>

                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full sm:w-auto px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                    title="Tentar abrir novamente a câmera"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tentar Novamente</span>
                  </button>
                </div>

                {/* Troubleshooting trigger */}
                <button
                  type="button"
                  onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                  className="text-[11px] text-orange-400 hover:underline flex items-center gap-1 cursor-pointer pt-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Como liberar a câmera no Chrome/Safari?</span>
                </button>
              </div>
            )}
          </div>

          {/* Hidden inputs for Native Camera & Gallery Photo scan */}
          <input 
            ref={nativeCameraInputRef}
            type="file" 
            accept="image/*" 
            capture="environment"
            className="hidden" 
            onChange={handleFileUpload} 
          />

          <input 
            ref={galleryInputRef}
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileUpload} 
          />

          <div id="file-qr-temp" className="hidden" />

          {/* Direct Camera Actions Bar */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              disabled={isProcessingPhoto}
              className="px-3 py-2.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4 text-orange-600" />
              <span>📷 Câmera Nativa</span>
            </button>

            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={isProcessingPhoto}
              className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4 text-slate-600" />
              <span>🖼️ Foto da Galeria</span>
            </button>
          </div>

          {/* Troubleshooting Accordion */}
          {showTroubleshooting && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <span>Como permitir a câmera no seu celular:</span>
              </h5>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                <li><strong>No Google Chrome (Android):</strong> Toque no ícone de <strong>Cadeado 🔒</strong> ou <strong>Ajustes</strong> na barra de endereços &gt; <em>Permissões</em> &gt; Ative a <strong>Câmera</strong>.</li>
                <li><strong>No Safari (iPhone/iOS):</strong> Vá em <em>Ajustes do iPhone</em> &gt; <em>Safari</em> &gt; <em>Câmera</em> &gt; Selecione <strong>Permitir</strong>.</li>
                <li><strong>Se estiver em visualização incorporada:</strong> Toque no botão de abrir em nova aba do navegador para conceder acesso total aos sensores.</li>
              </ul>
            </div>
          )}

          {/* Scanned Result Banner */}
          {scanResult && (
            <div className={`p-4 rounded-2xl border ${
              scanResult.type === 'equipment' 
                ? 'bg-blue-50 border-blue-200' 
                : scanResult.type === 'certificate'
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {scanResult.type === 'equipment' ? 'Equipamento Localizado' : scanResult.type === 'certificate' ? 'Certificado Identificado' : 'Código Lido'}
                  </span>
                  {scanResult.type === 'equipment' && scanResult.equipment && (
                    <div className="mt-1">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-blue-600" />
                        Tag: {scanResult.equipment.tag}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {scanResult.equipment.type.toUpperCase().replace('_', ' ')} (Classe {scanResult.equipment.dielectricClass}) • {scanResult.equipment.clientName}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Próximo Vencimento: <span className="font-semibold text-slate-800">{scanResult.equipment.nextTestDueDate ? formatDateBR(scanResult.equipment.nextTestDueDate) : 'Não ensaiado'}</span>
                      </p>
                    </div>
                  )}

                  {scanResult.type === 'certificate' && scanResult.test && (
                    <div className="mt-1">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-600" />
                        Laudo: {scanResult.test.reportNumber}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Tag: {scanResult.test.equipmentTag} • Resultado: <span className="font-bold text-emerald-700">{scanResult.test.result}</span>
                      </p>
                    </div>
                  )}

                  {scanResult.type === 'unknown' && (
                    <div className="mt-1">
                      <p className="text-xs text-slate-700 font-mono break-all">{scanResult.code}</p>
                      <p className="text-xs text-amber-700 mt-1">Item não cadastrado na base local.</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {scanResult.type === 'equipment' && scanResult.equipment && onSelectEquipment && (
                    <button
                      onClick={() => {
                        onSelectEquipment(scanResult.equipment!);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-[#0A2540] hover:bg-blue-900 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      Abrir Ficha <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {scanResult.type === 'certificate' && onSelectValidationCode && (
                    <button
                      onClick={() => {
                        onSelectValidationCode(scanResult.code);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      Validar Online <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSearch} className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ou digite a Tag, Nº de Série ou Código de Validação:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ex: LUV-VALE-001 ou VAL-JVM-2026-A8B1C4"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Buscar
              </button>
            </div>
          </form>

          {/* Quick Demo Tags */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[11px] text-slate-500 self-center">Exemplos rápidos:</span>
            {['LUV-VALE-001', 'MNT-PETRO-101', 'BST-CPFL-045', 'VAL-JVM-2026-A8B1C4'].map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setManualCode(tag);
                  handleDecodedText(tag);
                }}
                className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono transition-colors cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

