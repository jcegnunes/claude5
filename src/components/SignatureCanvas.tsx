import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Check, PenTool, Upload, Image as ImageIcon, Sparkles, CheckCircle2 } from 'lucide-react';
import { cleanSignatureImage } from '../utils/signatureCleaner';

interface SignatureCanvasProps {
  title: string;
  signerName: string;
  signerRole: string;
  documentNumber?: string;
  onSave: (dataUrl: string) => void;
  onSaveAsDefault?: (dataUrl: string) => void;
  initialSignature?: string;
  sourceBadge?: string;
  isDefault?: boolean;
}

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  title,
  signerName,
  signerRole,
  documentNumber,
  onSave,
  onSaveAsDefault,
  initialSignature,
  sourceBadge,
  isDefault
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(Boolean(initialSignature));
  const [isSaved, setIsSaved] = useState(Boolean(initialSignature));
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);

  const drawImageOnCanvas = (dataUrl: string, notify = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Calculate aspect ratio fit centered
      const scale = Math.min((rect.width - 20) / img.width, (rect.height - 20) / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (rect.width - w) / 2;
      const y = (rect.height - h) / 2;

      ctx.drawImage(img, x, y, w, h);
      setHasDrawn(true);
      setIsSaved(true);
      if (notify) {
        onSave(dataUrl);
        if (onSaveAsDefault) {
          onSaveAsDefault(dataUrl);
          setShowSavedFeedback(true);
          setTimeout(() => setShowSavedFeedback(false), 3500);
        }
      }
    };
    img.src = dataUrl;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions with retina sharpness
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0A2540';

    if (initialSignature) {
      drawImageOnCanvas(initialSignature, false);
      setHasDrawn(true);
      setIsSaved(true);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
      setIsSaved(false);
    }
  }, [initialSignature, signerName]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
    setIsSaved(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setIsSaved(false);
    onSave('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setIsSaved(true);
    onSave(dataUrl);
    if (onSaveAsDefault) {
      onSaveAsDefault(dataUrl);
      setShowSavedFeedback(true);
      setTimeout(() => setShowSavedFeedback(false), 3500);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        const cleaned = await cleanSignatureImage(dataUrl);
        drawImageOnCanvas(cleaned, true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <PenTool className="w-4 h-4 text-blue-600" />
            {title}
          </h4>
          <p className="text-xs text-slate-500">
            {signerName} {documentNumber ? `(${documentNumber})` : ''} - <span className="font-medium text-slate-700">{signerRole}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {sourceBadge && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              {sourceBadge}
            </span>
          )}
          {isDefault && hasDrawn && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
              <Sparkles className="w-3 h-3 text-amber-600" /> Padrão Cadastrado
            </span>
          )}
          {isSaved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              <Check className="w-3 h-3" /> Assinado
            </span>
          )}
        </div>
      </div>

      <div 
        className={`relative w-full h-32 bg-white rounded-lg border-2 ${
          isDraggingFile 
            ? 'border-blue-500 bg-blue-50/50' 
            : 'border-dashed border-slate-300'
        } touch-none overflow-hidden transition-colors`}
        onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={handleDrop}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 text-xs gap-1">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <PenTool className="w-3.5 h-3.5" />
              <span>Assine com o dedo ou mouse</span>
              <span>ou</span>
              <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-blue-600 font-semibold">carregue o arquivo de imagem</span>
            </div>
            <span className="text-[10px] text-slate-400">Ao carregar a imagem, ela será salva como padrão para todos os laudos deste profissional</span>
          </div>
        )}
      </div>

      {showSavedFeedback && (
        <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-1.5 text-xs text-emerald-800 font-medium animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Assinatura definida como padrão oficial para todos os futuros laudos de {signerName}!</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer"
            title="Importar imagem de assinatura e definir como padrão (PNG/JPG/SVG)"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Carregar Imagem Padrão</span>
          </button>

          <button
            type="button"
            onClick={clearCanvas}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Limpar assinatura"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Limpar
          </button>
        </div>

        <button
          type="button"
          onClick={saveSignature}
          disabled={!hasDrawn}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            isSaved
              ? 'bg-emerald-600 text-white'
              : hasDrawn
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
          {isSaved ? 'Assinatura Registrada' : 'Confirmar & Salvar Padrão'}
        </button>
      </div>
    </div>
  );
};
