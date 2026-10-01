import type { jsPDF } from 'jspdf';

/**
 * Protege a escrita de texto no PDF: um campo vazio (ex.: ensaio antigo sem
 * hora ou número de série) vira texto em branco e uma coordenada inválida vira
 * zero, em vez de interromper a geração do documento inteiro com
 * "Invalid arguments passed to jsPDF.text".
 */
export function hardenPdfText<T extends jsPDF>(doc: T): T {
  const d = doc as any;
  if (d.__jvmSafeText) return doc;
  const original = d.text.bind(doc);
  const clean = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'string' ? v : String(v));
  const coord = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
  d.text = (text: unknown, x: unknown, y: unknown, ...rest: unknown[]) =>
    original(Array.isArray(text) ? text.map(clean) : clean(text), coord(x), coord(y), ...rest);
  d.__jvmSafeText = true;
  return doc;
}
