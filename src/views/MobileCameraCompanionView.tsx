import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  RefreshCw, 
  Check, 
  Zap, 
  ZapOff, 
  SwitchCamera, 
  QrCode, 
  MapPin, 
  Sparkles, 
  AlertTriangle, 
  Layers, 
  CheckCircle2, 
  Maximize2, 
  ArrowLeft,
  Smartphone,
  Send,
  ScanLine
} from 'lucide-react';
import { mobileCameraService, MobileDeviceInfo } from '../services/mobileCameraService';
import { TestPhoto } from '../types';
import { Html5Qrcode } from 'html5-qrcode';
import { compressImage } from '../utils/imageCompressor';

interface MobileCameraCompanionViewProps {
  sessionId: string;
  onExit?: () => void;
}

export const MobileCameraCompanionView: React.FC<MobileCameraCompanionViewProps> = ({
  sessionId,
  onExit
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Mode: 'camera' or 'scanner'
  const [activeMode, setActiveMode] = useState<'camera' | 'scanner'>('camera');

  // Photo details
  const [category, setCategory] = useState<TestPhoto['category']>('durante');
  const [caption, setCaption] = useState<string>('');
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | undefined>();
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isShutterActive, setIsShutterActive] = useState<boolean>(false);
  const [lastDeliveredPhoto, setLastDeliveredPhoto] = useState<string | null>(null);
  const [deliveredPhotosCount, setDeliveredPhotosCount] = useState<number>(0);
  const [recentTransfers, setRecentTransfers] = useState<Array<{ id: string; url: string; time: string; category: string }>>([]);

  // QR Scanner State
  const [scannedCodeFeedback, setScannedCodeFeedback] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Play shutter sound via Web Audio API
  const playShutterSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch {}
  };

  // 1. Initialize GPS
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => console.warn('GPS notice:', err),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // 2. Join Session & Register Mobile Device
  useEffect(() => {
    const deviceInfo: MobileDeviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      model: /iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? 'Apple iOS Device'
        : /Android/i.test(navigator.userAgent)
        ? 'Android Smartphone'
        : 'Dispositivo Móvel',
      facingMode
    };

    mobileCameraService.joinSessionFromMobile(sessionId, deviceInfo);

    // Keep-alive ping
    const interval = setInterval(() => {
      mobileCameraService.pingMobileSession(sessionId);
    }, 15000);

    return () => clearInterval(interval);
  }, [sessionId, facingMode]);

  // 3. Listen to remote commands from PC
  useEffect(() => {
    const unsub = mobileCameraService.listenToSession(sessionId, (session) => {
      if (session.remoteCommand?.type === 'shutter') {
        handleCaptureAndSend();
      }
    });

    return () => unsub();
  }, [sessionId, category, caption, gpsCoords, stream]);

  // Attach stream to video element whenever stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('webkit-playsinline', 'true');
      videoRef.current.setAttribute('autoplay', 'true');
      videoRef.current.muted = true;
      videoRef.current.play().catch((err) => {
        console.warn('Auto-play in MobileCameraCompanion prevented, handling onloadedmetadata:', err);
      });
    }
  }, [stream]);

  // 4. Start Camera Stream
  useEffect(() => {
    if (activeMode === 'camera') {
      startCameraStream();
    } else {
      stopCameraStream();
      startQRScanner();
    }

    return () => {
      stopCameraStream();
      stopQRScanner();
    };
  }, [activeMode, facingMode, selectedDeviceId]);

  const stopCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCameraStream = async () => {
    stopCameraStream();
    setIsLoadingCamera(true);
    setCameraError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsLoadingCamera(false);
      setCameraError('Seu navegador não possui suporte à API de vídeo em tempo real (WebRTC). Por favor, use a Câmera Nativa do Celular abaixo.');
      return;
    }

    const constraintAttempts: MediaStreamConstraints[] = [];

    if (selectedDeviceId) {
      constraintAttempts.push({
        video: {
          deviceId: { ideal: selectedDeviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      constraintAttempts.push({
        video: { deviceId: selectedDeviceId },
        audio: false
      });
    }

    constraintAttempts.push({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });

    constraintAttempts.push({
      video: { facingMode: { ideal: facingMode } },
      audio: false
    });

    constraintAttempts.push({
      video: { facingMode },
      audio: false
    });

    constraintAttempts.push({
      video: true,
      audio: false
    });

    let activeStream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintAttempts) {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (activeStream) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (activeStream) {
      setStream(activeStream);
      setIsLoadingCamera(false);

      if (videoRef.current) {
        videoRef.current.srcObject = activeStream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }

      // Check for torch capability on track
      try {
        const videoTrack = activeStream.getVideoTracks()[0];
        const capabilities = (videoTrack.getCapabilities && videoTrack.getCapabilities()) as any;
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch {
        setHasTorch(false);
      }

      // List devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAvailableDevices(devices.filter(d => d.kind === 'videoinput'));
      } catch {}
    } else {
      setIsLoadingCamera(false);
      const name = lastError?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('Permissão da câmera foi negada. Permita o acesso à câmera nas configurações do navegador ou use o botão de Câmera Nativa abaixo.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('Nenhuma câmera foi encontrada no aparelho. Conecte uma câmera ou use o botão de Câmera Nativa.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCameraError('A câmera está sendo utilizada por outro aplicativo no celular. Feche outros apps ou use a Câmera Nativa.');
      } else {
        setCameraError(lastError?.message || 'Não foi possível inicializar o visor da câmera. Utilize a Câmera Nativa do Celular.');
      }
    }
  };

  const handleToggleTorch = async () => {
    if (!stream) return;
    try {
      const videoTrack = stream.getVideoTracks()[0];
      const newTorchState = !isTorchOn;
      await (videoTrack as any).applyConstraints({
        advanced: [{ torch: newTorchState }]
      });
      setIsTorchOn(newTorchState);
    } catch (e) {
      console.warn('Erro ao acionar lanterna do celular:', e);
    }
  };

  const handleToggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture photo and transmit to PC
  const handleCaptureAndSend = async () => {
    if (!videoRef.current || isSending) return;

    setIsShutterActive(true);
    playShutterSound();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
    setTimeout(() => setIsShutterActive(false), 200);

    setIsSending(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      let width = video.videoWidth || 1280;
      let height = video.videoHeight || 720;

      if (width > 1280 || height > 960) {
        const ratio = Math.min(1280 / width, 960 / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
        const compressedUrl = (await compressImage(dataUrl, 1280, 960, 0.75)) || dataUrl;

        await mobileCameraService.sendPhotoFromMobile(sessionId, {
          url: compressedUrl,
          category,
          caption: caption.trim() || `Registro via Celular (${category})`,
          gpsCoords
        });

        setLastDeliveredPhoto(compressedUrl);
        setDeliveredPhotosCount(c => c + 1);
        setRecentTransfers(prev => [
          {
            id: String(Date.now()),
            url: compressedUrl,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            category
          },
          ...prev.slice(0, 4)
        ]);
      }
    } catch (err) {
      console.error('Erro ao enviar foto para o sistema central:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Fallback Native Mobile Camera Input
  const handleNativeCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSending(true);
    try {
      const compressedUrl = await compressImage(file, 1280, 960, 0.75);
      if (compressedUrl) {
        await mobileCameraService.sendPhotoFromMobile(sessionId, {
          url: compressedUrl,
          category,
          caption: caption.trim() || `Foto Nativa (${file.name || 'Câmera Celular'})`,
          gpsCoords
        });
        setLastDeliveredPhoto(compressedUrl);
        setDeliveredPhotosCount(c => c + 1);
        setRecentTransfers(prev => [
          {
            id: String(Date.now()),
            url: compressedUrl,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            category
          },
          ...prev.slice(0, 4)
        ]);
      }
    } catch (err) {
      console.error('Erro ao processar foto nativa:', err);
    } finally {
      setIsSending(false);
    }
    e.target.value = '';
  };

  // QR Scanner Handlers
  const startQRScanner = () => {
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('mobile-companion-qr-reader');
        qrScannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            handleDecodedQR(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.warn('QR scanner mobile start error:', err);
      }
    }, 150);
  };

  const stopQRScanner = async () => {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
        qrScannerRef.current.clear();
      } catch {}
      qrScannerRef.current = null;
    }
  };

  const handleDecodedQR = async (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }
    playShutterSound();
    setScannedCodeFeedback(code);
    await mobileCameraService.sendScanFromMobile(sessionId, code);
    setTimeout(() => setScannedCodeFeedback(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* Top Header Bar */}
      <header className="px-4 py-3 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-xs font-black tracking-wide text-white uppercase">CÂMERA MÓVEL JVM</h1>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Terminal: <span className="text-orange-400 font-bold">{sessionId}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Photos sent counter */}
          <div className="px-2.5 py-1 bg-slate-800/90 rounded-full border border-slate-700 text-[11px] font-bold text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{deliveredPhotosCount} enviada{deliveredPhotosCount !== 1 ? 's' : ''}</span>
          </div>

          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              title="Desconectar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Mode Switcher Tabs (Camera vs Scanner) */}
      <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex gap-2 z-10">
        <button
          type="button"
          onClick={() => setActiveMode('camera')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeMode === 'camera'
              ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Modo Câmera / Fotos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMode('scanner')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeMode === 'scanner'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <ScanLine className="w-3.5 h-3.5" />
          <span>Leitor de QR / Tag</span>
        </button>
      </div>

      {/* Main Viewfinder Section */}
      <main className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {activeMode === 'camera' ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Always mounted video element for continuous WebRTC stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => {
                videoRef.current?.play().catch(() => {});
              }}
              className={`w-full h-full object-cover ${
                isLoadingCamera || cameraError ? 'hidden' : 'block'
              }`}
            />

            {isLoadingCamera && (
              <div className="text-center p-6 space-y-3">
                <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-300">Inicializando lente do smartphone...</p>
                <p className="text-[11px] text-slate-500">Permita o acesso à câmera para transmissão instantânea</p>
              </div>
            )}

            {!isLoadingCamera && cameraError && (
              <div className="text-center p-6 max-w-xs space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-xs font-bold text-white">Câmera Indisponível</h3>
                <p className="text-[11px] text-slate-400">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Camera className="w-4 h-4" />
                  <span>Usar Câmera Nativa do Celular</span>
                </button>
              </div>
            )}

            {!isLoadingCamera && !cameraError && (
              <>
                {/* Shutter White Flash Animation */}
                {isShutterActive && (
                  <div className="absolute inset-0 bg-white/95 z-30 pointer-events-none transition-opacity duration-150" />
                )}

                {/* Reticle / Viewfinder Frame */}
                <div className="absolute inset-4 border border-white/20 rounded-3xl pointer-events-none flex flex-col justify-between p-4 z-10">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-2 border-l-2 border-orange-400 rounded-tl" />
                    <div className="w-6 h-6 border-t-2 border-r-2 border-orange-400 rounded-tr" />
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-slate-300 font-semibold border border-white/10">
                      Enquadre o EPI / Instrumento de Ensaio
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-b-2 border-l-2 border-orange-400 rounded-bl" />
                    <div className="w-6 h-6 border-b-2 border-r-2 border-orange-400 rounded-br" />
                  </div>
                </div>

                {/* Floating Quick Action Controls (Torch & Camera Switch) */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={handleToggleTorch}
                      className={`p-3 rounded-full backdrop-blur-md border shadow-lg transition-all ${
                        isTorchOn
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/50'
                          : 'bg-black/60 text-white border-white/20'
                      }`}
                      title="Lanterna / Flash"
                    >
                      {isTorchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleToggleFacingMode}
                    className="p-3 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md border border-white/20 shadow-lg active:scale-90 transition-transform"
                    title="Trocar Câmera (Frontal/Traseira)"
                  >
                    <SwitchCamera className="w-5 h-5 text-orange-400" />
                  </button>
                </div>

                {/* GPS Tag Indicator */}
                {gpsCoords && (
                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-slate-300 flex items-center gap-1 border border-white/10 z-20">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    <span>GPS Conectado</span>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Scanner Mode Container */
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-950">
            <div id="mobile-companion-qr-reader" className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-slate-700" />
            
            {scannedCodeFeedback ? (
              <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-center animate-fade-in">
                <div className="text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Código Lido e Transmitido ao PC!</span>
                </div>
                <p className="text-[11px] font-mono text-white mt-0.5">{scannedCodeFeedback}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center mt-4">
                Aponte para o QR Code da plaqueta ou etiqueta do EPI para carregar no sistema central
              </p>
            )}
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleNativeCapture}
        />
      </main>

      {/* Bottom Controls Area */}
      {activeMode === 'camera' && (
        <footer className="bg-slate-950 border-t border-slate-800 p-4 space-y-3 z-20">
          {/* Category Selector Horizontal Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'antes', label: '🛡️ Antes' },
              { id: 'durante', label: '⚡ Durante' },
              { id: 'apos', label: '✅ Após' },
              { id: 'identificacao', label: '🏷️ Tag / CA' },
              { id: 'defeito', label: '⚠️ Defeito' },
              { id: 'medicao', label: '📊 Medição' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id as TestPhoto['category'])}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                  category === item.id
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Quick Caption Input */}
          <div>
            <input
              type="text"
              placeholder="Legenda rápida (ex: Ensaio de Tensão 10kV...)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Shutter Button Row */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              className="p-3 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl border border-slate-800 flex items-center justify-center text-xs font-semibold"
              title="Abrir Câmera Nativa do Aparelho"
            >
              <Camera className="w-5 h-5 text-orange-400" />
            </button>

            {/* Big Shutter Button */}
            <button
              type="button"
              disabled={isLoadingCamera || !!cameraError || isSending}
              onClick={handleCaptureAndSend}
              className="w-20 h-20 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 active:scale-95 disabled:opacity-50 flex items-center justify-center p-1.5 shadow-2xl shadow-orange-600/50 transition-all cursor-pointer"
            >
              <div className="w-full h-full rounded-full border-4 border-white flex items-center justify-center bg-orange-600">
                {isSending ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white shadow-md animate-pulse" />
                )}
              </div>
            </button>

            {/* Thumbnail of last sent photo */}
            {lastDeliveredPhoto ? (
              <div className="w-12 h-12 rounded-2xl border-2 border-emerald-400 overflow-hidden bg-slate-900 shadow-md relative">
                <img src={lastDeliveredPhoto} alt="Última foto enviada" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                </div>
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl border border-slate-800 bg-slate-900/50 flex items-center justify-center text-slate-600">
                <Layers className="w-5 h-5" />
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};
