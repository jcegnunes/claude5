/**
 * Importação do modelo de certificado (PDF, JPEG ou PNG) para usar como fundo
 * da página. PDF: as páginas são convertidas em imagem (1ª = frente, 2ª = verso).
 * A imagem é reduzida para A4 a ~150 dpi em JPEG, para caber nos dados da empresa.
 */

/** A4 deitado a ~150 dpi */
const MAX_LONG_SIDE = 1754;
const MAX_BYTES = 900_000;

export interface ImportedTemplate {
  front: string;
  back?: string;
  /** Algum fundo veio em pé (o certificado é A4 deitado: a imagem é esticada) */
  portrait: boolean;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Imagem inválida ou formato não suportado.'));
    img.src = src;
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(file);
  });
}

/** Desenha em fundo branco e gera JPEG; reduz até caber no limite. */
function canvasToJpeg(source: CanvasImageSource, width: number, height: number): string {
  let out = '';
  for (const [side, quality] of [[MAX_LONG_SIDE, 0.85], [1400, 0.8], [1100, 0.75]] as const) {
    const scale = Math.min(1, side / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    out = canvas.toDataURL('image/jpeg', quality);
    if (out.length <= MAX_BYTES) break;
  }
  return out;
}

async function imageFileToJpeg(file: File): Promise<{ data: string; portrait: boolean }> {
  const img = await loadImage(await readAsDataUrl(file));
  return { data: canvasToJpeg(img, img.naturalWidth, img.naturalHeight), portrait: img.naturalHeight > img.naturalWidth };
}

async function pdfFileToJpegs(file: File): Promise<Array<{ data: string; portrait: boolean }>> {
  // build "legacy": funciona também em navegadores/WebViews mais antigos
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  try {
    const pages: Array<{ data: string; portrait: boolean }> = [];
    for (let n = 1; n <= Math.min(2, pdf.numPages); n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: MAX_LONG_SIDE / Math.max(base.width, base.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      pages.push({ data: canvasToJpeg(canvas, canvas.width, canvas.height), portrait: canvas.height > canvas.width });
    }
    return pages;
  } finally {
    pdf.destroy();
  }
}

export function isTemplateFile(file: File): boolean {
  return /\.(pdf|png|jpe?g)$/i.test(file.name) || ['application/pdf', 'image/png', 'image/jpeg'].includes(file.type);
}

/** PDF: 1ª página = frente, 2ª = verso (se houver). Imagem: uma página. */
export async function importTemplateFile(file: File): Promise<ImportedTemplate> {
  if (!isTemplateFile(file)) throw new Error('Use um arquivo PDF, JPG ou PNG.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Arquivo muito grande (máximo 25 MB).');
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  const pages = isPdf ? await pdfFileToJpegs(file) : [await imageFileToJpeg(file)];
  if (!pages.length || !pages[0].data) throw new Error('O arquivo não tem páginas.');
  return { front: pages[0].data, back: pages[1]?.data, portrait: pages.some(p => p.portrait) };
}

/** Uma imagem só, para trocar o fundo da frente ou do verso. PDF: usa a 1ª página. */
export async function importSinglePage(file: File): Promise<{ data: string; portrait: boolean }> {
  const t = await importTemplateFile(file);
  return { data: t.front, portrait: t.portrait };
}
