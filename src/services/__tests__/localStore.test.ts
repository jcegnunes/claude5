import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  __resetLocalStoreForTests,
  initLocalStore,
  isManaged,
  storeGet,
  storeRemove,
  storeSet
} from '../localStore';

/** localStorage simples em memória (os testes rodam fora do navegador). */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

const KEYS = ['jvm_dielectric_tests', 'jvm_dielectric_clients'];
let factory: IDBFactory;

beforeEach(() => {
  factory = new IDBFactory();
  (globalThis as any).localStorage = new MemoryStorage();
  __resetLocalStoreForTests();
});

afterEach(() => __resetLocalStoreForTests());

describe('Armazenamento local (IndexedDB)', () => {
  it('sem IndexedDB, continua no localStorage', async () => {
    expect(await initLocalStore(KEYS, undefined)).toBe(false);
    expect(isManaged('jvm_dielectric_tests')).toBe(false);
  });

  it('migra os dados do localStorage e só então os remove de lá', async () => {
    localStorage.setItem('jvm_dielectric_tests', JSON.stringify([{ id: 't1', result: 'APROVADO' }]));
    localStorage.setItem('jvm_dielectric_current_user', '{"id":"u1"}');
    expect(await initLocalStore(KEYS, factory)).toBe(true);
    expect(isManaged('jvm_dielectric_tests')).toBe(true);
    expect(storeGet('jvm_dielectric_tests')).toEqual([{ id: 't1', result: 'APROVADO' }]);
    expect(localStorage.getItem('jvm_dielectric_tests')).toBeNull();
    // chaves não gerenciadas ficam onde estavam
    expect(localStorage.getItem('jvm_dielectric_current_user')).toBe('{"id":"u1"}');

    // reabrindo o app: os dados vêm do IndexedDB
    __resetLocalStoreForTests();
    await initLocalStore(KEYS, factory);
    expect(storeGet('jvm_dielectric_tests')).toEqual([{ id: 't1', result: 'APROVADO' }]);
  });

  it('gravações sobrevivem ao reabrir o app', async () => {
    await initLocalStore(KEYS, factory);
    await storeSet('jvm_dielectric_clients', [{ id: 'c1' }, { id: 'c2' }]);
    __resetLocalStoreForTests();
    await initLocalStore(KEYS, factory);
    expect(storeGet('jvm_dielectric_clients')).toEqual([{ id: 'c1' }, { id: 'c2' }]);
  });

  it('não perde itens que existiam só no localStorage (junta por id)', async () => {
    await initLocalStore(KEYS, factory);
    await storeSet('jvm_dielectric_tests', [{ id: 't1', v: 'indexeddb' }]);
    __resetLocalStoreForTests();
    localStorage.setItem('jvm_dielectric_tests', JSON.stringify([{ id: 't1', v: 'antigo' }, { id: 't2', v: 'novo' }]));
    await initLocalStore(KEYS, factory);
    expect(storeGet('jvm_dielectric_tests')).toEqual([{ id: 't1', v: 'indexeddb' }, { id: 't2', v: 'novo' }]);
  });

  it('quem lê recebe uma cópia: alterar sem gravar não muda os dados', async () => {
    await initLocalStore(KEYS, factory);
    await storeSet('jvm_dielectric_tests', [{ id: 't1', result: 'APROVADO' }]);
    const copy = storeGet<any[]>('jvm_dielectric_tests')!;
    copy[0].result = 'REPROVADO';
    expect(storeGet<any[]>('jvm_dielectric_tests')![0].result).toBe('APROVADO');
  });

  it('remove a chave', async () => {
    await initLocalStore(KEYS, factory);
    await storeSet('jvm_dielectric_clients', [{ id: 'c1' }]);
    await storeRemove('jvm_dielectric_clients');
    __resetLocalStoreForTests();
    await initLocalStore(KEYS, factory);
    expect(storeGet('jvm_dielectric_clients')).toBeUndefined();
  });

  it('guarda volumes que não cabiam no localStorage (~12 MB)', async () => {
    await initLocalStore(KEYS, factory);
    const photo = 'data:image/jpeg;base64,' + 'A'.repeat(400_000);
    const tests = Array.from({ length: 30 }, (_, i) => ({ id: 't' + i, photos: [{ url: photo }] }));
    await storeSet('jvm_dielectric_tests', tests);
    __resetLocalStoreForTests();
    await initLocalStore(KEYS, factory);
    expect(storeGet<any[]>('jvm_dielectric_tests')!.length).toBe(30);
  });
});
