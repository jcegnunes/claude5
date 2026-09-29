/**
 * Marcações sobre fotos de ensaio (seta, círculo, retângulo e texto) e giro
 * da foto em passos de 90°. As marcações ficam como formas (coordenadas em
 * pixels da foto já girada) até a foto ser salva — assim é possível desfazer,
 * refazer e girar sem perder o que foi marcado.
 */

export type AnnotationTool = 'arrow' | 'circle' | 'rect' | 'text';

export interface Point { x: number; y: number }

export type Annotation =
  | { kind: 'arrow' | 'circle' | 'rect'; from: Point; to: Point; color: string; width: number }
  | { kind: 'text'; at: Point; text: string; color: string; size: number };

export interface EditorState {
  /** Quartos de volta no sentido horário aplicados à foto original (0 a 3). */
  quarterTurns: number;
  annotations: Annotation[];
}

/** Tamanho da foto depois do giro. */
export function rotatedSize(width: number, height: number, quarterTurns: number): { width: number; height: number } {
  return quarterTurns % 2 === 0 ? { width, height } : { width: height, height: width };
}

/** Posição de um ponto depois de girar a foto 90° (horário ou anti-horário). */
export function rotatePoint(p: Point, width: number, height: number, clockwise: boolean): Point {
  // width/height: tamanho ANTES do giro
  return clockwise ? { x: height - p.y, y: p.x } : { x: p.y, y: width - p.x };
}

/** Gira a foto 90° levando junto todas as marcações. */
export function rotateState(state: EditorState, width: number, height: number, clockwise: boolean): EditorState {
  const current = rotatedSize(width, height, state.quarterTurns);
  const move = (p: Point) => rotatePoint(p, current.width, current.height, clockwise);
  return {
    quarterTurns: (state.quarterTurns + (clockwise ? 1 : 3)) % 4,
    annotations: state.annotations.map(a =>
      a.kind === 'text' ? { ...a, at: move(a.at) } : { ...a, from: move(a.from), to: move(a.to) }
    )
  };
}

/** Espessura do traço proporcional à foto (fino, médio, grosso). */
export function strokeWidthFor(level: 1 | 2 | 3, width: number, height: number): number {
  const factor = level === 1 ? 0.004 : level === 2 ? 0.007 : 0.012;
  return Math.max(2, Math.round(Math.min(width, height) * factor));
}

/** Tamanho do texto proporcional à foto. */
export function textSizeFor(level: 1 | 2 | 3, width: number, height: number): number {
  const factor = level === 1 ? 0.03 : level === 2 ? 0.045 : 0.065;
  return Math.max(12, Math.round(Math.min(width, height) * factor));
}

/** Pontas da seta (dois segmentos a partir da ponta `to`). */
export function arrowHead(from: Point, to: Point, width: number): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const length = Math.max(12, width * 4.5);
  const spread = Math.PI / 7;
  return [
    { x: to.x - length * Math.cos(angle - spread), y: to.y - length * Math.sin(angle - spread) },
    { x: to.x - length * Math.cos(angle + spread), y: to.y - length * Math.sin(angle + spread) }
  ];
}

/** Marcação pequena demais (toque sem arrastar) é descartada. */
export function isMeaningful(a: Annotation): boolean {
  if (a.kind === 'text') return a.text.trim().length > 0;
  return Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y) >= 6;
}

/** Desenha a foto girada e as marcações no canvas (tamanho = foto girada). */
export function renderEdited(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  state: EditorState,
  preview?: Annotation | null
): void {
  const { width, height } = rotatedSize(imageWidth, imageHeight, state.quarterTurns);
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate((state.quarterTurns * Math.PI) / 2);
  ctx.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
  ctx.restore();
  [...state.annotations, ...(preview ? [preview] : [])].forEach(a => drawAnnotation(ctx, a));
}

export function drawAnnotation(ctx: CanvasRenderingContext2D, a: Annotation): void {
  ctx.save();
  if (a.kind === 'text') {
    ctx.font = `bold ${a.size}px Arial, Helvetica, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    // contorno escuro/claro para o texto ser legível sobre qualquer fundo
    ctx.lineWidth = Math.max(2, a.size / 7);
    ctx.strokeStyle = a.color === '#ffffff' || a.color === '#facc15' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
    a.text.split('\n').forEach((line, i) => {
      const y = a.at.y + i * a.size * 1.2;
      ctx.strokeText(line, a.at.x, y);
      ctx.fillStyle = a.color;
      ctx.fillText(line, a.at.x, y);
    });
    ctx.restore();
    return;
  }
  ctx.strokeStyle = a.color;
  ctx.lineWidth = a.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (a.kind === 'rect') {
    ctx.rect(Math.min(a.from.x, a.to.x), Math.min(a.from.y, a.to.y), Math.abs(a.to.x - a.from.x), Math.abs(a.to.y - a.from.y));
  } else if (a.kind === 'circle') {
    ctx.ellipse(
      (a.from.x + a.to.x) / 2,
      (a.from.y + a.to.y) / 2,
      Math.max(1, Math.abs(a.to.x - a.from.x) / 2),
      Math.max(1, Math.abs(a.to.y - a.from.y) / 2),
      0, 0, Math.PI * 2
    );
  } else {
    const [h1, h2] = arrowHead(a.from, a.to, a.width);
    ctx.moveTo(a.from.x, a.from.y);
    ctx.lineTo(a.to.x, a.to.y);
    ctx.moveTo(h1.x, h1.y);
    ctx.lineTo(a.to.x, a.to.y);
    ctx.lineTo(h2.x, h2.y);
  }
  ctx.stroke();
  ctx.restore();
}
