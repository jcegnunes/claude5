import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  __setPhotoStoreFactoryForTests,
  dataUrlToBlob,
  deletePhoto,
  getPhotoBlob,
  getPhotoDataUrl,
  getPhotoStoreStats,
  isLocalPhotoRef,
  listPhotoRefs,
  PHOTO_REF_PREFIX,
  savePhotoFromDataUrl
} from '../photoStore';
import { inlineTestPhotos, testPhotoUrls } from '../photoExternalizer';

/** "Foto" JPEG de teste: bytes aleatórios com cabeçalho JPEG. */
function fakeJpegDataUrl(size = 200_000): string {
  const bytes = new Uint8Array(size);
  bytes[0] = 0xff; bytes[1] = 0xd8;
  for (let i = 2; i < size; i++) bytes[i] = (i * 31 + 7) % 256;
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'data:image/jpeg;base64,' + btoa(bin);
}

beforeEach(() => __setPhotoStoreFactoryForTests(new IDBFactory()));

describe('Fotos guardadas à parte no aparelho', () => {
  it('grava a foto como arquivo binário e devolve a referência local', async () => {
    const dataUrl = fakeJpegDataUrl();
    const ref = await savePhotoFromDataUrl(dataUrl);
    expect(ref.startsWith(PHOTO_REF_PREFIX)).toBe(true);
    expect(isLocalPhotoRef(ref)).toBe(true);
    const blob = await getPhotoBlob(ref);
    expect(blob?.size).toBe(200_000);
    expect(blob?.type).toBe('image/jpeg');
  });

  it('binário ocupa ~25% menos que a foto em texto (base64)', async () => {
    const dataUrl = fakeJpegDataUrl();
    const ref = await savePhotoFromDataUrl(dataUrl);
    const blob = (await getPhotoBlob(ref))!;
    expect(blob.size / dataUrl.length).toBeLessThan(0.76);
  });

  it('a foto volta idêntica quando precisa sair do aparelho (PDF, backup, envio)', async () => {
    const dataUrl = fakeJpegDataUrl(50_000);
    const ref = await savePhotoFromDataUrl(dataUrl);
    expect(await getPhotoDataUrl(ref)).toBe(dataUrl);
  });

  it('lista, mede e apaga as fotos guardadas', async () => {
    const r1 = await savePhotoFromDataUrl(fakeJpegDataUrl(10_000));
    const r2 = await savePhotoFromDataUrl(fakeJpegDataUrl(20_000));
    expect((await listPhotoRefs()).sort()).toEqual([r1, r2].sort());
    expect(await getPhotoStoreStats()).toEqual({ count: 2, bytes: 30_000 });
    await deletePhoto(r1);
    expect(await getPhotoBlob(r1)).toBeNull();
    expect(await listPhotoRefs()).toEqual([r2]);
  });

  it('imagem inválida é recusada', async () => {
    expect(dataUrlToBlob('não é imagem')).toBeNull();
    await expect(savePhotoFromDataUrl('xyz')).rejects.toThrow();
  });

  it('ensaio com referências locais pode ser copiado com as fotos embutidas', async () => {
    const dataUrl = fakeJpegDataUrl(5_000);
    const ref = await savePhotoFromDataUrl(dataUrl);
    const test: any = {
      id: 't1',
      photos: [{ id: 'p1', url: ref }, { id: 'p2', url: 'https://exemplo.supabase.co/foto.jpg' }],
      visualInspection: [{ id: 'v1', photoUrl: ref }, { id: 'v2' }]
    };
    const inlined = await inlineTestPhotos(test);
    expect(inlined.photos[0].url).toBe(dataUrl);
    expect(inlined.photos[1].url).toBe('https://exemplo.supabase.co/foto.jpg');
    expect(inlined.visualInspection[0].photoUrl).toBe(dataUrl);
    // o ensaio original (guardado no aparelho) continua só com a referência
    expect(test.photos[0].url).toBe(ref);
    expect(testPhotoUrls(test)).toEqual([ref, 'https://exemplo.supabase.co/foto.jpg', ref]);
  });
});
