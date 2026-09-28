import { describe, expect, it } from 'vitest';
import { cleanPayload, clientToRow, rowToClient } from '../supabaseMappers';
import { diffFields } from '../../components/ConflictsPanel';

describe('Conflito de edição — versão do servidor', () => {
  it('guarda o updated_at exato do servidor (com microssegundos) ao baixar', () => {
    const row = {
      id: 'cli-1',
      company_id: 'comp-1',
      razao_social: 'Cliente',
      cnpj: '1',
      updated_at: '2026-09-28T12:00:00.123456+00:00',
      payload: {}
    };
    const client = rowToClient(row) as any;
    expect(client._serverUpdatedAt).toBe('2026-09-28T12:00:00.123456+00:00');
  });

  it('a versão do servidor não vai para o payload enviado', () => {
    const payload = cleanPayload({ id: 'x', _serverUpdatedAt: '2026-01-01', syncStatus: 'pending', nome: 'a' });
    expect(payload).toEqual({ id: 'x', nome: 'a' });
    const row = clientToRow({ id: 'cli-1', razaoSocial: 'C', cnpj: '1', _serverUpdatedAt: 't' } as any, 'DEV-1');
    expect(row.payload._serverUpdatedAt).toBeUndefined();
  });
});

describe('Conflito de edição — comparação das versões', () => {
  it('lista só os campos diferentes, ignorando campos técnicos', () => {
    const local = { id: '1', tag: 'LUVA-01', status: 'ativo', updatedAt: 'a', syncStatus: 'pending', _serverUpdatedAt: 'x' };
    const remote = { id: '1', tag: 'LUVA-01', status: 'reprovado', updatedAt: 'b', syncStatus: 'synced', _serverUpdatedAt: 'y' };
    expect(diffFields(local, remote)).toEqual([{ field: 'status', local: 'ativo', remote: 'reprovado' }]);
  });

  it('resume imagens, listas e objetos', () => {
    const diff = diffFields(
      { signature: 'data:image/png;base64,AAAA', photos: [1, 2], meta: { a: 1 } },
      { signature: 'data:image/png;base64,BBBB', photos: [1], meta: { a: 2 } }
    );
    expect(diff).toEqual([
      { field: 'signature', local: '(imagem)', remote: '(imagem)' },
      { field: 'photos', local: '2 item(ns)', remote: '1 item(ns)' },
      { field: 'meta', local: '(dados detalhados)', remote: '(dados detalhados)' }
    ]);
  });
});
