import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  QrCode, 
  X, 
  Copy, 
  Check, 
  Camera, 
  RefreshCw, 
  Wifi, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  Sparkles, 
  Image as ImageIcon, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Globe, 
  Sliders,
  Play,
  Layers,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { mobileCameraService, MobileCameraSession } from '../services/mobileCameraService';
import { TestPhoto } from '../types';

interface MobileCameraBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoReceived?: (photo: Omit<TestPhoto, 'id' | 'timestamp'>) => void;
  onScanReceived?: (code: string) => void;
  defaultCategory?: TestPhoto['category'];
  defaultCaption?: string;
  userName?: string;
}

export const MobileCameraBridgeModal: React.FC<MobileCameraBridgeModalProps> = ({
  isOpen,
  onClose,
  onPhotoReceived,
  onScanReceived,
  defaultCategory = 'durante',
  defaultCaption = '',
  userName = 'Responsável Técnico'
}) => {
  const [activeTab, setActiveTab] = useState<'qr_bridge' | 'ip_cam' | 'usb_devices'>('qr_bridge');
  const [session, setSession] = useState<MobileCameraSession | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [receivedPhotos, setReceivedPhotos] = useState<Array<any>>([]);
  const [selectedPhotoForPreview, setSelectedPhotoForPreview] = useState<any | null>(null);

  // IP Camera Stream State
  const [ipCamUrl, setIpCamUrl] = useState<string>('http://192.168.1.100:8080/video');
  const [isIpCamStreaming, setIsIpCamStreaming] = useState<boolean>(false);
  const [ipCamError, setIpCamError] = useState<string | null>(null);

  // USB / Local Devices State
  const [localDevices, setLocalDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedLocalDeviceId, setSelectedLocalDeviceId] = useState<string>('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const ipCamImgRef = useRef<HTMLImageElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Initialize or resume session when modal opens
  useEffect(() => {
    if (isOpen) {
      initSession();
      listLocalDevices();
    } else {
      stopLocalStream();
      setIsIpCamStreaming(false);
    }
  }, [isOpen]);

  const initSession = async () => {
    setIsGenerating(true);
    try {
      const newSession = await mobileCameraService.createSession();
      setSession(newSession);
      const qrUrl = await mobileCameraService.generateQRCode(newSession.id);
      setQrCodeDataUrl(qrUrl);
    } catch (err) {
      console.error('Erro ao inicializar sessão da câmera:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Real-time listener for incoming photos and scans from phone
  useEffect(() => {
    if (!isOpen || !session?.id) return;

    const unsub = mobileCameraService.listenToSession(session.id, (updatedSession) => {
      setSession(updatedSession);

      // Handle new photo received
      if (updatedSession.lastPhoto && updatedSession.lastPhoto.url) {
        const photo = updatedSession.lastPhoto;
        setReceivedPhotos((prev) => {
          if (prev.some((p) => p.id === photo.id)) return prev;
          return [photo, ...prev];
        });

        // Trigger callback to wizard/caller if available
        if (onPhotoReceived) {
          onPhotoReceived({
            category: photo.category || defaultCategory,
            url: photo.url,
            caption: photo.caption || defaultCaption || `Registro Fotográfico via Celular`,
            userName: photo.userName || userName,
            gpsCoords: photo.gpsCoords
          });
        }
      }

      // Handle new scan received
      if (updatedSession.lastScan && updatedSession.lastScan.code) {
        if (onScanReceived) {
          onScanReceived(updatedSession.lastScan.code);
        }
      }
    });

    return () => unsub();
  }, [isOpen, session?.id]);

  // Copy Link to clipboard
  const handleCopyLink = () => {
    if (!session) return;
    const url = mobileCameraService.getPairingUrl(session.id);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Trigger remote shutter on the phone
  const handleTriggerRemoteShutter = async () => {
    if (!session) return;
    await mobileCameraService.triggerRemoteShutter(session.id);
  };

  // List local USB/Webcam devices
  const listLocalDevices = async () => {
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vids = devices.filter((d) => d.kind === 'videoinput');
        setLocalDevices(vids);
        if (vids.length > 0 && !selectedLocalDeviceId) {
          setSelectedLocalDeviceId(vids[0].deviceId);
        }
      }
    } catch {}
  };

  const startLocalStream = async (deviceId: string) => {
    stopLocalStream();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: deviceId } : true,
          audio: false
        });
      }

      setLocalStream(stream);
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.setAttribute('playsinline', 'true');
        localVideoRef.current.setAttribute('webkit-playsinline', 'true');
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(() => {});
      }
    } catch (e: any) {
      console.warn('Erro ao abrir câmera USB:', e);
    }
  };

  const stopLocalStream = () => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
  };

  // Capture snapshot from Local/USB camera
  const handleCaptureLocalSnapshot = () => {
    if (!localVideoRef.current) return;
    const video = localVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      if (onPhotoReceived) {
        onPhotoReceived({
          category: defaultCategory,
          url: dataUrl,
          caption: defaultCaption || `Registro fotográfico (Câmera USB / Externa)`,
          userName
        });
      }
      setReceivedPhotos((prev) => [
        {
          id: 'local_' + Date.now(),
          url: dataUrl,
          category: defaultCategory,
          caption: 'Câmera USB / Externa',
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
    }
  };

  // Capture snapshot from IP Cam / MJPEG Stream
  const handleCaptureIpCamSnapshot = () => {
    if (!ipCamImgRef.current) return;
    try {
      const img = ipCamImgRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1280;
      canvas.height = img.naturalHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        if (onPhotoReceived) {
          onPhotoReceived({
            category: defaultCategory,
            url: dataUrl,
            caption: defaultCaption || `Registro via Câmera IP (${ipCamUrl})`,
            userName
          });
        }
        setReceivedPhotos((prev) => [
          {
            id: 'ip_' + Date.now(),
            url: dataUrl,
            category: defaultCategory,
            caption: `Câmera IP: ${ipCamUrl}`,
            timestamp: new Date().toISOString()
          },
          ...prev
        ]);
      }
    } catch (err) {
      setIpCamError('Não foi possível capturar frame da Câmera IP devido a restrições CORS da rede.');
    }
  };

  if (!isOpen) return null;

  const isConnected = session?.status === 'connected';

  return (
    <div id="mobile-camera-bridge-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-600/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Conectar Câmera do Celular ao Sistema</span>
                <span className="text-[10px] bg-orange-500/20 text-orange-400 font-semibold px-2.5 py-0.5 rounded-full border border-orange-500/30">
                  Sem Fio / QR Code
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Use seu smartphone como câmera móvel sem fio, leitor QR de bancada ou webcam IP
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-950/40 border-b border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('qr_bridge')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'qr_bridge'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Celular Sem Fio (QR Code)</span>
            {isConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ip_cam')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'ip_cam'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Câmera IP / DroidCam / Wi-Fi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('usb_devices')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'usb_devices'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Câmeras USB / Dispositivos ({localDevices.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-900/60">
          {/* TAB 1: QR CODE WIRELESS BRIDGE */}
          {activeTab === 'qr_bridge' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Left Column: QR Code Display & Pairing Info */}
              <div className="flex flex-col items-center text-center space-y-4 bg-slate-950/80 p-6 rounded-3xl border border-slate-800">
                {isGenerating ? (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-orange-400 animate-spin" />
                  </div>
                ) : qrCodeDataUrl ? (
                  <div className="relative group">
                    <div className="p-3 bg-white rounded-2xl shadow-xl shadow-black/50 border border-slate-300">
                      <img
                        src={qrCodeDataUrl}
                        alt="QR Code de Pareamento da Câmera Móvel"
                        className="w-44 h-44 sm:w-48 sm:h-48 object-contain"
                      />
                    </div>
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900 text-slate-200 border border-slate-700 rounded-full text-[10px] font-mono font-bold shadow-lg">
                      Sessão: {session?.id}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      {isConnected ? 'Celular Conectado com Sucesso!' : 'Aguardando Leitura do QR Code'}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    {isConnected
                      ? `${session?.deviceInfo?.model || 'Smartphone'} pronto para capturar fotos e escanear tags.`
                      : 'Aponte a câmera do seu celular para o QR Code acima para abrir o terminal de captura.'}
                  </p>
                </div>

                {/* Direct Link Action */}
                <div className="w-full flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link Direto'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={initSession}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                    title="Gerar Nova Sessão"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right Column: Instructions & Remote Shutter / Photo Stream */}
              <div className="space-y-4">
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <h4 className="text-xs font-bold text-orange-400 flex items-center gap-1.5 uppercase">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Como Funciona:</span>
                  </h4>
                  <ul className="text-xs text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-orange-500/30">1</span>
                      <span>Abra a câmera do seu celular e aponte para o QR Code (não precisa instalar app).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-orange-500/30">2</span>
                      <span>Toque no botão de captura no celular para registrar cuba, luva, mangote, tag ou painel.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-orange-500/30">3</span>
                      <span>A foto e o GPS são transmitidos em tempo real para este computador!</span>
                    </li>
                  </ul>
                </div>

                {/* Remote Shutter Trigger (when connected) */}
                {isConnected && (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">Disparador Remoto</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono">Sinal Ativo</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleTriggerRemoteShutter}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 active:scale-98 transition-all cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>📸 Disparar Foto no Celular Conectado</span>
                    </button>
                  </div>
                )}

                {/* Received Photos Carousel / Counter */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
                      <span>Fotos Recebidas nesta Sessão ({receivedPhotos.length})</span>
                    </h5>
                  </div>

                  {receivedPhotos.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                      Nenhuma foto enviada ainda. Tire uma foto no celular para visualizar aqui.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {receivedPhotos.slice(0, 4).map((p, idx) => (
                        <div
                          key={p.id || idx}
                          onClick={() => setSelectedPhotoForPreview(p)}
                          className="relative aspect-video rounded-xl overflow-hidden border border-slate-700 group cursor-pointer hover:border-orange-400 transition-all bg-black"
                        >
                          <img src={p.url} alt="Foto recebida" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-4 h-4 text-white" />
                          </div>
                          <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[8px] text-white font-bold uppercase">
                            {p.category || 'Ensaio'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IP CAMERA / DROIDCAM / WI-FI STREAM */}
          {activeTab === 'ip_cam' && (
            <div className="space-y-5">
              <div className="bg-slate-950/80 p-5 rounded-3xl border border-slate-800 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                    URL do Stream de Câmera IP / DroidCam / IP Webcam
                  </h4>
                  <p className="text-xs text-slate-400">
                    Insira o endereço IP fornecido pelo aplicativo no celular conectado à mesma rede Wi-Fi.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ipCamUrl}
                    onChange={(e) => setIpCamUrl(e.target.value)}
                    placeholder="http://192.168.1.100:8080/video ou http://192.168.1.50:4747/video"
                    className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsIpCamStreaming(!isIpCamStreaming)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      isIpCamStreaming
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : 'bg-orange-600 hover:bg-orange-500 text-white'
                    }`}
                  >
                    {isIpCamStreaming ? <X className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isIpCamStreaming ? 'Desconectar' : 'Conectar Stream'}</span>
                  </button>
                </div>

                {/* Stream Preview Container */}
                {isIpCamStreaming && (
                  <div className="relative bg-black rounded-2xl overflow-hidden aspect-video border border-slate-700 flex items-center justify-center">
                    <img
                      ref={ipCamImgRef}
                      src={ipCamUrl}
                      alt="IP Camera Live Stream"
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                      onError={() => {
                        setIpCamError('Não foi possível carregar o stream da Câmera IP. Verifique se o celular está na mesma rede Wi-Fi.');
                      }}
                    />
                    <div className="absolute top-3 left-3 bg-red-600/90 text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span>AO VIVO (IP CAM)</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCaptureIpCamSnapshot}
                      className="absolute bottom-4 right-4 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-black/50 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Capturar Frame</span>
                    </button>
                  </div>
                )}

                {ipCamError && (
                  <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{ipCamError}</span>
                  </div>
                )}
              </div>

              {/* Apps Guide */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800 space-y-1.5">
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-orange-400" />
                    <span>DroidCam (Android / iOS)</span>
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Instale o DroidCam no celular. Abra o app e copie o endereço <code className="text-orange-300">http://IP:4747/video</code> para conectar.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800 space-y-1.5">
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span>IP Webcam (Android)</span>
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Instale o app IP Webcam na Play Store. Clique em &quot;Iniciar Servidor&quot; e utilize a porta <code className="text-blue-300">8080/video</code>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: USB / LOCAL DEVICES */}
          {activeTab === 'usb_devices' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 p-5 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Selecione a Câmera / Dispositivo USB
                    </h4>
                    <p className="text-xs text-slate-400">
                      Câmeras integradas, webcams USB ou celulares conectados via cabo USB
                    </p>
                  </div>

                  <select
                    value={selectedLocalDeviceId}
                    onChange={(e) => {
                      setSelectedLocalDeviceId(e.target.value);
                      startLocalStream(e.target.value);
                    }}
                    className="p-2.5 text-xs bg-slate-900 border border-slate-700 text-white rounded-xl font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    {localDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Câmera ${i + 1} (${d.deviceId.substring(0, 8)})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Local Video Stream */}
                <div className="relative bg-black rounded-2xl overflow-hidden aspect-video border border-slate-700 flex items-center justify-center">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />

                  <div className="absolute top-3 left-3 bg-emerald-600/90 text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>CÂMERA USB ATIVA</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCaptureLocalSnapshot}
                    className="absolute bottom-4 right-4 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-black/50 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capturar Foto</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {receivedPhotos.length > 0 && (
              <span className="text-emerald-400 font-bold">
                ✓ {receivedPhotos.length} foto(s) anexada(s) automaticamente ao registro do ensaio
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Concluir / Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
