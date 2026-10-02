import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { __resetLocalStoreForTests, initLocalStore, storeGet, storeSet } from '../../../services/localStore';
import { TRAINING_KEYS, TRAINING_MANAGED_KEYS } from '../storageKeys';
import { exportModuleBackups, restoreModuleBackups } from '../../backup';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

beforeEach(async () => {
  (globalThis as any).localStorage = new MemoryStorage();
  __resetLocalStoreForTests();
  await initLocalStore(TRAINING_MANAGED_KEYS, new IDBFactory());
});
afterEach(() => __resetLocalStoreForTests());

describe('Backup completo — módulo Treinamentos', () => {
  it('exporta cursos, instrutores, turmas e certificados (sem a versão do servidor)', async () => {
    await storeSet(TRAINING_KEYS.COURSES, [{ id: 'crs-1', name: 'NR-10', serverUpdatedAt: '2026-10-01T00:00:00Z' }]);
    await storeSet(TRAINING_KEYS.CERTIFICATES, [{ id: 'trc-1', participantName: 'Maria' }]);
    const b: any = exportModuleBackups().treinamentos;
    expect(b.version).toBe(1);
    expect(b.tables.training_courses).toEqual([{ id: 'crs-1', name: 'NR-10' }]);
    expect(b.tables.training_certificates[0].participantName).toBe('Maria');
    expect(b.tables.training_classes).toEqual([]);
  });

  it('restaura juntando por id e coloca tudo na fila de envio', async () => {
    await storeSet(TRAINING_KEYS.COURSES, [{ id: 'crs-1', name: 'Antigo' }, { id: 'crs-2', name: 'Fica' }]);
    const res = restoreModuleBackups({
      treinamentos: { version: 1, tables: { training_courses: [{ id: 'crs-1', name: 'Do backup' }], training_certificates: [{ id: 'trc-9', participantName: 'Ana' }] } }
    });
    expect(res.treinamentos).toBe(2);
    const courses = storeGet<any[]>(TRAINING_KEYS.COURSES)!;
    expect(courses.find(c => c.id === 'crs-1').name).toBe('Do backup');
    expect(courses.find(c => c.id === 'crs-2').name).toBe('Fica');
    expect(storeGet<any[]>(TRAINING_KEYS.QUEUE)!.map(q => `${q.table}:${q.id}`).sort())
      .toEqual(['training_certificates:trc-9', 'training_courses:crs-1']);
  });

  it('backup antigo, sem a seção de módulos, é aceito', () => {
    expect(restoreModuleBackups(undefined)).toEqual({});
    expect(restoreModuleBackups({ treinamentos: 'lixo' }).treinamentos).toBe(0);
  });
});
