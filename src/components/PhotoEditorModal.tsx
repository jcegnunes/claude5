import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, RotateCcw, RotateCw, ArrowUpRight, Circle, Square, Type, Undo2, Redo2, Eraser, Save, Loader2
} from 'lucide-react';
import { resolvePhotoUrl } from '../services/photoStore';
import {
  Annotation,
  AnnotationTool,
  EditorState,
  Point,
  isMeaningful,
  renderEdited,
  rotateState,
  rotatedSize,
  strokeWidthFor,
  textSizeFor
} from '../utils/photoAnnotations';

const COLORS = [
  { value: '#ef4444', name: 'Vermelho' },
  { value: '#facc15', name: 'Amarelo' },
  { value: '#22c55e', name: 'Verde' },
  { value: '#3b82f6', name: 'Azul' },
  { value: '#ffffff', name: 'Branco' },
  { value: '#111827', name: 'Preto' }
];

const TOOLS: Array<{ id: AnnotationTool; label: string; icon: React.ElementType }> = [
  { id: 'arrow', label: 'Seta', icon: ArrowUpRight },
  { id: 'circle', label: 'Círculo', icon: Circle },
  { id: 'rect', label: 'Retângulo', icon: Square },
  { id: 'text', label: 'Texto', icon: Type }
];

interface PhotoEditorModalProps {
  /** Foto a editar (data URL, endereço da nuvem ou referência local). */
  src: string;
  title?: string;
  onClose: () => void;
  /** Foto editada em JPEG (data URL). */
  onSave: (dataUrl: string) => void;
}

/**
 * Editor de fotos do laudo: girar 90° e marcar com seta, círculo, retângulo
 * e texto. Funciona com toque (celular/tablet) e mouse.
 */
export const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({ src, title = 'Editar foto', onClose, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Área disponível para a foto (a foto é exibida inteira, sem rolagem)
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<EditorState>({ quarterTurns: 0, annotations: [] });
  const [undoStack, setUndoStack] = useState<EditorState[]>([]);
  const [redoStack, setRedoStack] = useState<EditorState[]>([]);
  const [tool, setTool] = useState<AnnotationTool>('arrow');
  const [color, setColor] = useState(COLORS[0].value);
  const [level, setLevel] = useState<1 | 2 | 3>(2);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [textInput, setTextInput] = useState<{ at: Point; screen: { left: number; top: number }; value: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Carrega a foto (referência local, data URL ou nuvem)
  useEffect(() => {
    let cancelled = false;
    resolvePhotoUrl(src).then(url => {
      if (cancelled) return;
      if (!url) return setLoadError('Foto não encontrada neste aparelho.');
      const img = new Image();
      if (/^https?:/i.test(url)) img.crossOrigin = 'anonymous';
      img.onload = () => !cancelled && setImage(img);
      img.onerror = () => !cancelled && setLoadError('Não foi possível abrir a foto. Verifique a conexão e tente novamente.');
      img.src = url;
    });
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setArea({ width: el.clientWidth - 24, height: el.clientHeight - 24 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const imgW = image?.naturalWidth || 0;
  const imgH = image?.naturalHeight || 0;
  const size = rotatedSize(imgW, imgH, state.quarterTurns);
  const scale = size.width && area.width > 0 && area.height > 0
    ? Math.min(area.width / size.width, area.height / size.height, 1)
    : 0;
  const display = { width: Math.floor(size.width * scale), height: Math.floor(size.height * scale) };

  // Redesenha a cada alteração
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    if (canvas.width !== size.width) canvas.width = size.width;
    if (canvas.height !== size.height) canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (ctx) renderEdited(ctx, image, imgW, imgH, state, draft);
  }, [image, state, draft, size.width, size.height, imgW, imgH]);

  const commit = useCallback((next: EditorState) => {
    setUndoStack(u => [...u, state]);
    setRedoStack([]);
    setState(next);
  }, [state]);

  const undo = () => {
    if (!undoStack.length) return;
    setRedoStack(r => [...r, state]);
    setState(undoStack[undoStack.length - 1]);
    setUndoStack(u => u.slice(0, -1));
  };
  const redo = () => {
    if (!redoStack.length) return;
    setUndoStack(u => [...u, state]);
    setState(redoStack[redoStack.length - 1]);
    setRedoStack(r => r.slice(0, -1));
  };

  const rotate = (clockwise: boolean) => {
    if (!image) return;
    setTextInput(null);
    commit(rotateState(state, imgW, imgH, clockwise));
  };

  /** Posição do toque/clique em pixels da foto. */
  const toImagePoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * size.width,
      y: ((e.clientY - rect.top) / rect.height) * size.height
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!image) return;
    const p = toImagePoint(e);
    if (tool === 'text') {
      const container = e.currentTarget.parentElement!.getBoundingClientRect();
      setTextInput({ at: p, screen: { left: e.clientX - container.left, top: e.clientY - container.top }, value: '' });
      return;
    }
    // mantém o traço mesmo se o dedo/mouse sair da foto (nem todo navegador permite)
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    setDraft({ kind: tool, from: p, to: p, color, width: strokeWidthFor(level, size.width, size.height) });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draft || draft.kind === 'text') return;
    const to = toImagePoint(e);
    setDraft({ ...draft, to });
  };

  const onPointerUp = () => {
    if (!draft) return;
    if (isMeaningful(draft)) commit({ ...state, annotations: [...state.annotations, draft] });
    setDraft(null);
  };

  const confirmText = () => {
    if (!textInput) return;
    const annotation: Annotation = {
      kind: 'text',
      at: textInput.at,
      text: textInput.value,
      color,
      size: textSizeFor(level, size.width, size.height)
    };
    if (isMeaningful(annotation)) commit({ ...state, annotations: [...state.annotations, annotation] });
    setTextInput(null);
  };

  const clearAll = () => {
    if (!state.annotations.length) return;
    if (window.confirm('Remover todas as marcações desta foto?')) commit({ ...state, annotations: [] });
  };

  const hasChanges = state.quarterTurns !== 0 || state.annotations.length > 0;

  const save = () => {
    if (!image || !canvasRef.current) return;
    setSaving(true);
    try {
      const out = document.createElement('canvas');
      out.width = size.width;
      out.height = size.height;
      const ctx = out.getContext('2d')!;
      renderEdited(ctx, image, imgW, imgH, state, null);
      onSave(out.toDataURL('image/jpeg', 0.85));
    } catch {
      setLoadError('Não foi possível salvar: a foto veio de outro endereço e o navegador bloqueou a edição. Baixe a foto e adicione-a novamente.');
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (hasChanges && !window.confirm('Descartar as alterações desta foto?')) return;
    onClose();
  };

  const btn = 'inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40';
  const idle = 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700';
  const active = 'bg-blue-600 border-blue-500 text-white';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[96vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button type="button" onClick={close} className="p-1.5 text-slate-400 hover:text-white" aria-label="Fechar editor">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ferramentas */}
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-800 bg-slate-950/60">
          <button type="button" className={`${btn} ${idle}`} onClick={() => rotate(false)} disabled={!image} title="Girar 90° para a esquerda">
            <RotateCcw className="w-4 h-4" /><span className="hidden sm:inline">Girar</span>
          </button>
          <button type="button" className={`${btn} ${idle}`} onClick={() => rotate(true)} disabled={!image} title="Girar 90° para a direita">
            <RotateCw className="w-4 h-4" /><span className="hidden sm:inline">Girar</span>
          </button>
          <span className="w-px h-6 bg-slate-700 mx-1" aria-hidden="true" />
          {TOOLS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`${btn} ${tool === t.id ? active : idle}`}
              onClick={() => { setTool(t.id); setTextInput(null); }}
              aria-pressed={tool === t.id}
              title={t.label}
            >
              <t.icon className="w-4 h-4" /><span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
          <span className="w-px h-6 bg-slate-700 mx-1" aria-hidden="true" />
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Cor da marcação">
            {COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={color === c.value}
                aria-label={c.name}
                title={c.name}
                onClick={() => setColor(c.value)}
                className={`w-6 h-6 rounded-full border-2 ${color === c.value ? 'border-white ring-2 ring-blue-500' : 'border-slate-600'}`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <label className="flex items-center gap-1 text-xs text-slate-300 ml-1">
            <span className="hidden sm:inline">Espessura</span>
            <select
              value={level}
              onChange={e => setLevel(Number(e.target.value) as 1 | 2 | 3)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white"
              aria-label="Espessura e tamanho do texto"
            >
              <option value={1}>Fina</option>
              <option value={2}>Média</option>
              <option value={3}>Grossa</option>
            </select>
          </label>
          <span className="w-px h-6 bg-slate-700 mx-1" aria-hidden="true" />
          <button type="button" className={`${btn} ${idle}`} onClick={undo} disabled={!undoStack.length} title="Desfazer">
            <Undo2 className="w-4 h-4" />
          </button>
          <button type="button" className={`${btn} ${idle}`} onClick={redo} disabled={!redoStack.length} title="Refazer">
            <Redo2 className="w-4 h-4" />
          </button>
          <button type="button" className={`${btn} ${idle}`} onClick={clearAll} disabled={!state.annotations.length} title="Remover todas as marcações">
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Foto */}
        <div ref={areaRef} className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-3 bg-black">
          {loadError ? (
            <p className="text-sm text-red-300 text-center max-w-md" role="alert">{loadError}</p>
          ) : !image ? (
            <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando foto…</p>
          ) : (
            <div className="relative" style={display.width ? { width: display.width, height: display.height } : undefined}>
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDraft(null)}
                className="block w-full h-full cursor-crosshair select-none"
                style={{ touchAction: 'none' }}
                aria-label="Foto em edição: toque e arraste para marcar"
              />
              {textInput && (
                <div
                  className="absolute z-10 flex gap-1 bg-slate-900/95 border border-slate-600 rounded-lg p-1.5 shadow-xl"
                  style={{ left: Math.max(0, textInput.screen.left - 10), top: Math.max(0, textInput.screen.top - 10) }}
                >
                  <input
                    autoFocus
                    value={textInput.value}
                    onChange={e => setTextInput({ ...textInput, value: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); confirmText(); }
                      if (e.key === 'Escape') setTextInput(null);
                    }}
                    placeholder="Digite o texto"
                    className="w-44 px-2 py-1 rounded bg-white text-slate-900 text-sm"
                    aria-label="Texto da marcação"
                  />
                  <button type="button" onClick={confirmText} className="px-2 rounded bg-blue-600 text-white text-xs font-bold">OK</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-800">
          <p className="text-[11px] text-slate-400">
            {tool === 'text' ? 'Toque na foto onde o texto deve aparecer.' : 'Toque e arraste sobre a foto para marcar.'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={close} className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-600 text-slate-200 hover:bg-slate-800">
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!image || !hasChanges || saving}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar foto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
