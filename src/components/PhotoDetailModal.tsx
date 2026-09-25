import React from 'react';
import { X, Trash2, Calendar, User, Tag, MapPin, Download } from 'lucide-react';
import { TestPhoto } from '../types';

interface PhotoDetailModalProps {
  photo: TestPhoto | null;
  onClose: () => void;
  onDelete?: (photoId: string) => void;
}

export const PhotoDetailModal: React.FC<PhotoDetailModalProps> = ({
  photo,
  onClose,
  onDelete
}) => {
  if (!photo) return null;

  const categoryLabels: Record<TestPhoto['category'], { label: string; color: string }> = {
    antes: { label: 'Antes do Ensaio (Inspeção Visual)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    durante: { label: 'Durante o Ensaio (Tensão Aplicada)', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
    apos: { label: 'Após o Ensaio (Aprovado / Secagem)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    identificacao: { label: 'Identificação / CA / Etiqueta', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    defeito: { label: 'Defeito / Não Conformidade', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
    medicao: { label: 'Painel de Medição / Miliamperímetro', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
    equipamento_teste: { label: 'Equipamento de Teste / Cuba', color: 'bg-slate-500/20 text-slate-300 border-slate-500/40' }
  };

  const catInfo = categoryLabels[photo.category] || { label: photo.category, color: 'bg-slate-700 text-slate-200' };

  return (
    <div id="photo-detail-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-6">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${catInfo.color}`}>
              {catInfo.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Download */}
            <a
              href={photo.url}
              download={`foto-ensaio-${photo.category}-${photo.id}.jpg`}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors"
              title="Baixar Foto"
            >
              <Download className="w-4 h-4" />
            </a>

            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Deseja realmente remover esta foto do ensaio?')) {
                    onDelete(photo.id);
                    onClose();
                  }
                }}
                className="p-2 text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950/80 border border-red-800/40 rounded-xl transition-colors cursor-pointer"
                title="Excluir Foto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="bg-black/90 flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden min-h-[260px] max-h-[60vh]">
          <img
            src={photo.url}
            alt={photo.caption}
            className="max-h-full max-w-full object-contain rounded-xl shadow-lg"
          />
        </div>

        {/* Footer Meta Details */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
          <p className="text-sm font-semibold text-white">
            {photo.caption || 'Sem legenda informada.'}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{new Date(photo.timestamp).toLocaleString('pt-BR')}</span>
            </div>

            {photo.userName && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>{photo.userName}</span>
              </div>
            )}

            {photo.gpsCoords && (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>GPS: {photo.gpsCoords.latitude.toFixed(4)}, {photo.gpsCoords.longitude.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
