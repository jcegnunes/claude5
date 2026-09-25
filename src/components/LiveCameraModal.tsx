import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  RefreshCw, 
  X, 
  Check, 
  Image as ImageIcon, 
  Zap, 
  ZapOff,
  AlertTriangle, 
  Sparkles, 
  MapPin, 
  SwitchCamera, 
  Upload, 
  HelpCircle, 
  Smartphone, 
  QrCode,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { TestPhoto } from '../types';
import { MobileCameraBridgeModal } from './MobileCameraBridgeModal';
import { compressImage, fileToDataUrl } from '../utils/imageCompressor';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapturePhoto: (photo: Omit<TestPhoto, 'id' | 'timestamp'>) => void;
  defaultCategory?: TestPhoto['category'];
  defaultCaption?: string;
  userName: string;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCapturePhoto,
  defaultCategory = 'durante',
  defaultCaption = '',
  userName
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'permission' | 'notfound' | 'inuse' | 'generic' | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<TestPhoto['category']>(defaultCategory);
  const [caption, setCaption] = useState<string>(defaultCaption);
  const [isShutterActive, setIsShutterActive] = useState<boolean>(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(false);
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | undefined>();
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isMobileBridgeOpen, setIsMobileBridgeOpen] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileGalleryInputRef = useRef<HTMLInputElement | null>(null);

  // Play shutter sound via Web Audio API
  const playShutterSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, audioCtx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.07);
    } catch {}
  };

  // Get GPS Coordinates on mount
  useEffect(() => {
    if (isOpen && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => {
          console.warn('Geolocation not available:', err);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [isOpen]);

  // List camera video input devices
  const updateDeviceList = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoInputs);
      }
    } catch (e) {
      console.warn('enumerateDevices error:', e);
    }
  };

  // Attach MediaStream to video element whenever stream changes or video is mounted
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('webkit-playsinline', 'true');
      videoRef.current.setAttribute('autoplay', 'true');
      videoRef.current.muted = true;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Auto-play prevented, handling onloadedmetadata:', err);
        });
      }
    }
  }, [stream]);

  // Check torch capability whenever active stream changes
  useEffect(() => {
    if (stream) {
      try {
        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = (videoTrack?.getCapabilities && videoTrack.getCapabilities()) as any;
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
          setIsTorchOn(false);
        }
      } catch {
        setHasTorch(false);
      }
    } else {
      setHasTorch(false);
      setIsTorchOn(false);
    }
  }, [stream]);

  // Toggle Torch (Lanterna do Celular)
  const handleToggleTorch = async () => {
    if (!stream) return;
    try {
      const videoTrack = stream.getVideoTracks()[0];
      const nextTorch = !isTorchOn;
      await (videoTrack as any).applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn('Error toggling torch:', err);
    }
  };

  // Start Camera Stream when modal is opened or device/facing mode changes
  useEffect(() => {
    if (isOpen) {
      setCapturedPreview(null);
      setCategory(defaultCategory);
      setCaption(defaultCaption);
      setCameraError(null);
      setErrorType(null);
      startCameraStream();
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen, facingMode, selectedDeviceId]);

  const stopCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping track:', e);
        }
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
    setErrorType(null);

    // Fallback attempts array in order of preference for mobile and desktop cameras
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

    // 1. Ideal HD with selected facing mode (environment = rear camera for inspection)
    constraintAttempts.push({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });

    // 2. Standard 720p with selected facing mode
    constraintAttempts.push({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    // 3. Simple facing mode ideal without resolution constraints (most compatible on Android/iOS)
    constraintAttempts.push({
      video: {
        facingMode: { ideal: facingMode }
      },
      audio: false
    });

    // 4. Exact facing mode string
    constraintAttempts.push({
      video: {
        facingMode: facingMode
      },
      audio: false
    });

    // 5. Generic video (any webcam/camera available)
    constraintAttempts.push({
      video: true,
      audio: false
    });

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsLoadingCamera(false);
      setErrorType('generic');
      setCameraError(
        'Seu navegador não possui suporte direto à API de câmera em tempo real (getUserMedia) ou está em modo incorporado restrito. Utilize a Câmera Nativa do Celular abaixo.'
      );
      return;
    }

    let activeStream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintAttempts) {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (activeStream) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn('Tentativa com restrições de câmera falhou, tentando próxima opção:', constraints, err);
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

        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Erro na reprodução inicial do vídeo:', playErr);
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch((e) => console.warn('Erro ao reproduzir após loadedmetadata:', e));
          };
        }
      }

      // Update device list once permission is granted
      updateDeviceList();
    } else {
      setIsLoadingCamera(false);
      const name = lastError?.name || '';
      const msg = lastError?.message || '';

      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setErrorType('permission');
        setCameraError(
          'Permissão de acesso à câmera negada. No Chrome/Safari, clique no ícone de configurações/cadeado na barra de navegação e permita a Câmera, ou utilize a Câmera Nativa abaixo.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setErrorType('notfound');
        setCameraError(
          'Nenhuma câmera foi detectada no dispositivo. Conecte uma câmera externa ou utilize a Câmera Nativa do Celular.'
        );
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setErrorType('inuse');
        setCameraError(
          'A câmera do dispositivo está sendo usada por outro aplicativo. Feche outros apps e tente novamente, ou utilize a Câmera Nativa.'
        );
      } else {
        setErrorType('generic');
        setCameraError(
          msg || 'Não foi possível inicializar a câmera do dispositivo. Verifique as permissões de segurança ou use a Câmera Nativa do Celular.'
        );
      }
    }
  };

  const handleToggleFacingMode = () => {
    if (availableDevices.length > 1) {
      const currentIndex = availableDevices.findIndex((d) => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % availableDevices.length;
      setSelectedDeviceId(availableDevices[nextIndex].deviceId);
    } else {
      setSelectedDeviceId('');
      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    }
  };

  const handleTakeSnapshot = async () => {
    if (!videoRef.current) return;

    playShutterSound();
    setIsShutterActive(true);
    setTimeout(() => setIsShutterActive(false), 250);

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    let width = video.videoWidth || 1280;
    let height = video.videoHeight || 960;

    if (width > 1280 || height > 960) {
      const ratio = Math.min(1280 / width, 960 / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
      setCapturedPreview(dataUrl);
    }
  };

  const handleConfirmCapturedPhoto = async () => {
    if (!capturedPreview) return;

    const compressed = await compressImage(capturedPreview, 1280, 960, 0.75);

    onCapturePhoto({
      category,
      url: compressed || capturedPreview,
      caption: caption.trim() || `Registro fotográfico - ${category}`,
      userName: userName || 'Responsável Técnico',
      gpsCoords
    });

    onClose();
  };

  const handleNativeCameraFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let compressedUrl = await compressImage(file, 1280, 960, 0.75);
      if (!compressedUrl) {
        compressedUrl = await fileToDataUrl(file);
      }
      if (compressedUrl) {
        onCapturePhoto({
          category,
          url: compressedUrl,
          caption: caption.trim() || `Registro fotográfico (${file.name || category})`,
          userName: userName || 'Responsável Técnico',
          gpsCoords
        });
        onClose();
      }
    } catch (err) {
      console.warn('[LiveCameraModal] Fallback read error:', err);
      try {
        const rawUrl = await fileToDataUrl(file);
        if (rawUrl) {
          onCapturePhoto({
            category,
            url: rawUrl,
            caption: caption.trim() || `Registro fotográfico (${file.name || category})`,
            userName: userName || 'Responsável Técnico',
            gpsCoords
          });
          onClose();
        }
      } catch (readErr) {
        console.error('[LiveCameraModal] Failed to read photo file:', readErr);
      }
    }
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div id="live-camera-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Câmera do Ensaio Dielétrico</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {facingMode === 'environment' ? 'Traseira / Principal' : 'Frontal'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Captura de evidências fotográficas para o laudo e certificado</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileBridgeOpen(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-orange-600/20 cursor-pointer"
              title="Conectar câmera do celular sem fio via QR Code"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Conectar Celular</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewfinder / Preview Area */}
        <div className="relative bg-black flex-1 min-h-[300px] sm:min-h-[360px] flex items-center justify-center overflow-hidden">
          {/* Always mounted video element for continuous WebRTC stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => {
              videoRef.current?.play().catch(() => {});
            }}
            className={`w-full h-full object-cover max-h-[50vh] sm:max-h-[55vh] ${
              capturedPreview || isLoadingCamera || cameraError ? 'hidden' : 'block'
            }`}
          />

          {capturedPreview && (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={capturedPreview}
                alt="Foto Capturada"
                className="max-h-[50vh] sm:max-h-[55vh] w-full object-contain"
              />
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] text-emerald-400 font-bold flex items-center gap-1.5 border border-emerald-500/30 shadow-lg">
                <Check className="w-3.5 h-3.5" /> Foto Capturada com Sucesso
              </div>
            </div>
          )}

          {!capturedPreview && isLoadingCamera && (
            <div className="p-8 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-300">Conectando e inicializando a câmera do dispositivo...</p>
              <p className="text-[11px] text-slate-500">Aguarde a confirmação de permissão do navegador</p>
            </div>
          )}

          {!capturedPreview && !isLoadingCamera && cameraError && (
            <div className="p-6 text-center max-w-md space-y-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
                errorType === 'permission'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-white">
                  {errorType === 'permission'
                    ? 'Permissão de Câmera Bloqueada'
                    : errorType === 'notfound'
                    ? 'Câmera Não Encontrada'
                    : 'Acesso à Câmera Indisponível'}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
              </div>

              <div className="pt-2 flex flex-col gap-2.5 justify-center">
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="px-4 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 active:scale-95 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>📷 Tirar Foto com Câmera do Celular (Nativa)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMobileBridgeOpen(true)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-orange-400" />
                  <span>Conectar Celular Remoto via QR Code</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileGalleryInputRef.current?.click()}
                    className="flex-1 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-blue-400" />
                    <span>Galeria</span>
                  </button>

                  <button
                    type="button"
                    onClick={startCameraStream}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tentar Novamente</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {!capturedPreview && !isLoadingCamera && !cameraError && (
            <>
              {/* Shutter White Flash Animation */}
              {isShutterActive && (
                <div className="absolute inset-0 bg-white/90 animate-fade-out pointer-events-none" />
              )}

              {/* Viewfinder Target Overlay */}
              <div className="absolute inset-6 border border-white/20 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-2 border-l-2 border-orange-400 rounded-tl" />
                  <div className="w-6 h-6 border-t-2 border-r-2 border-orange-400 rounded-tr" />
                </div>
                <div className="text-center">
                  <span className="text-[10px] bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-slate-300 font-medium">
                    Enquadre o EPI / Instrumento / Cuba de Ensaio
                  </span>
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-2 border-l-2 border-orange-400 rounded-bl" />
                  <div className="w-6 h-6 border-b-2 border-r-2 border-orange-400 rounded-br" />
                </div>
              </div>

              {/* Top Controls: Switch Camera & Torch */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    className={`p-2 rounded-full backdrop-blur-md border border-white/20 shadow-lg cursor-pointer transition-transform active:scale-90 ${
                      isTorchOn ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-black/70 hover:bg-black/90 text-white'
                    }`}
                    title="Ligar/Desligar Lanterna"
                  >
                    {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4 text-slate-300" />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  className="px-3 py-2 bg-black/70 hover:bg-black/90 text-white rounded-full backdrop-blur-md border border-white/20 shadow-lg cursor-pointer transition-transform active:scale-90 flex items-center gap-1.5 text-xs font-semibold"
                  title="Alternar Câmera (Frontal/Traseira/Lentes)"
                >
                  <SwitchCamera className="w-4 h-4 text-orange-400" />
                  <span className="hidden sm:inline">Trocar Câmera</span>
                </button>
              </div>

              {/* GPS indicator */}
              {gpsCoords && (
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-slate-300 flex items-center gap-1 border border-white/10">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span>GPS ({gpsCoords.latitude.toFixed(4)}, {gpsCoords.longitude.toFixed(4)})</span>
                </div>
              )}
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Hidden file inputs for direct native camera & file picker */}
          <input
            ref={nativeCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleNativeCameraFallback}
          />
          <input
            ref={fileGalleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleNativeCameraFallback}
          />
        </div>

        {/* Form Controls (Category & Caption) */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-slate-400 mb-1 block">Etapa / Categoria do Registro:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TestPhoto['category'])}
                className="w-full p-2.5 text-xs bg-slate-900 border border-slate-700 text-white rounded-xl font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="antes">🛡️ Antes do Ensaio (Inspeção Visual)</option>
                <option value="durante">⚡ Durante o Ensaio (Cuba / Tensão)</option>
                <option value="apos">✅ Após o Ensaio (Secagem / Aprovado)</option>
                <option value="identificacao">🏷️ Identificação / CA / Tag</option>
                <option value="defeito">⚠️ Defeito / Não Conformidade / Furo</option>
                <option value="medicao">📊 Painel de Medição / Miliamperímetro</option>
                <option value="equipamento_teste">🔬 Equipamento de Teste / Cuba</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 mb-1 block">Legenda da Foto (Opcional):</label>
              <input
                type="text"
                placeholder="Ex: Tensão de 10 kV aplicada na cuba..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1">
            {capturedPreview ? (
              <div className="flex items-center gap-2 w-full justify-end">
                <button
                  type="button"
                  onClick={() => setCapturedPreview(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-700 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Tirar Outra</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCapturedPhoto}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Anexar Foto ao Ensaio</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => nativeCameraInputRef.current?.click()}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5 cursor-pointer py-1.5 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
                    title="Usar Câmera Nativa do Celular (Abre app de câmera do aparelho)"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Câmera Nativa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileGalleryInputRef.current?.click()}
                    className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1.5 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-slate-900 transition-colors"
                    title="Carregar foto salva no dispositivo"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Galeria</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isLoadingCamera || !!cameraError}
                  onClick={handleTakeSnapshot}
                  className="px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-orange-600/30 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-white animate-pulse" />
                  <span>CAPTURAR FOTO</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Camera Bridge Modal */}
      <MobileCameraBridgeModal
        isOpen={isMobileBridgeOpen}
        onClose={() => setIsMobileBridgeOpen(false)}
        defaultCategory={category}
        defaultCaption={caption}
        userName={userName}
        onPhotoReceived={(photo) => {
          setCapturedPreview(photo.url);
          setCategory(photo.category);
          if (photo.caption) setCaption(photo.caption);
          if (photo.gpsCoords) setGpsCoords(photo.gpsCoords);
          setIsMobileBridgeOpen(false);
        }}
      />
    </div>
  );
};

