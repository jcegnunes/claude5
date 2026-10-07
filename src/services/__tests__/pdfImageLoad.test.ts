import { describe, expect, it } from 'vitest';
import { fetchImageForPdf } from '../pdfGenerator';

const url = 'https://abc.supabase.co/storage/v1/object/public/jvm-evidencias/emp/foto.jpg';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

describe('Fotos no PDF do laudo', () => {
  it('cache opaco do app instalado: busca de novo com outro endereço', async () => {
    const calls: string[] = [];
    const fetcher = (async (target: string) => {
      calls.push(target);
      // 1ª: o service worker devolve a resposta opaca guardada → o navegador rejeita
      if (calls.length === 1) throw new TypeError('Failed to fetch');
      return new Response(new Blob([jpeg], { type: 'image/jpeg' }), { status: 200 });
    }) as typeof fetch;
    const blob = await fetchImageForPdf(url, fetcher);
    expect(blob?.type).toBe('image/jpeg');
    expect(calls[0]).toBe(url);
    expect(calls[1]).toMatch(/foto\.jpg\?pdf=\d+$/);
  });

  it('foto enviada sem tipo é reconhecida pelos bytes; erro do servidor não vira imagem', async () => {
    const octet = (async () => new Response(new Blob([jpeg], { type: 'application/octet-stream' }), { status: 200 })) as typeof fetch;
    expect((await fetchImageForPdf(url, octet))?.type).toBe('image/jpeg');
    const notFound = (async () => new Response('não encontrado', { status: 404 })) as typeof fetch;
    expect(await fetchImageForPdf(url, notFound)).toBeNull();
  });
});
