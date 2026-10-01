import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { hardenPdfText } from '../safePdf';

describe('PDF — campos vazios não interrompem a geração', () => {
  it('sem a proteção, texto vazio derruba a geração (defeito encontrado)', () => {
    const doc = new jsPDF();
    expect(() => doc.text(undefined as any, 10, 10)).toThrow(/Invalid arguments/);
  });

  it('com a proteção, campo vazio vira texto em branco e número vira texto', () => {
    const doc = hardenPdfText(new jsPDF());
    expect(() => doc.text(undefined as any, 10, 10)).not.toThrow();
    expect(() => doc.text(null as any, 10, 20)).not.toThrow();
    expect(() => doc.text(5 as any, 10, 30)).not.toThrow();
    expect(() => doc.text(['linha', undefined as any], 10, 40)).not.toThrow();
  });

  it('coordenada inválida vira zero em vez de erro', () => {
    const doc = hardenPdfText(new jsPDF());
    expect(() => doc.text('texto', NaN, undefined as any)).not.toThrow();
  });

  it('aplicar duas vezes não duplica a proteção', () => {
    const doc = new jsPDF();
    const once = hardenPdfText(doc).text;
    expect(hardenPdfText(doc).text).toBe(once);
  });
});
