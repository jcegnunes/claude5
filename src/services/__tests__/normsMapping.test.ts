import { describe, expect, it } from 'vitest';
import { normToRow, rowToNorm } from '../supabaseMappers';
import { NormCriterion } from '../../types';

const norm = (overrides: Partial<NormCriterion> = {}): NormCriterion =>
  ({
    id: 'norm-luva-0',
    normCode: 'NBR 16295',
    normName: 'Luvas Classe 0',
    dielectricClass: '0',
    applicableEquipmentTypes: ['luva_isolante'],
    status: 'active',
    ...overrides
  } as NormCriterion);

describe('Normas por empresa — mapeamento com o banco', () => {
  it('norma oficial usa o próprio id e company_id nulo', () => {
    const row = normToRow(norm(), 'DEV-1');
    expect(row.id).toBe('norm-luva-0');
    expect(row.norm_id).toBe('norm-luva-0');
    expect(row.company_id).toBeNull();
  });

  it('versão da empresa ganha linha própria sem mudar o id da norma no app', () => {
    const row = normToRow(norm({ companyId: 'comp-1' }), 'DEV-1');
    expect(row.id).toBe('comp-1::norm-luva-0');
    expect(row.norm_id).toBe('norm-luva-0');
    expect(row.company_id).toBe('comp-1');

    const back = rowToNorm(row);
    expect(back.id).toBe('norm-luva-0');
    expect(back.companyId).toBe('comp-1');
  });

  it('linha oficial antiga (sem norm_id) continua com o mesmo id', () => {
    const back = rowToNorm({ id: 'norm-antiga', payload: { normCode: 'X' } });
    expect(back.id).toBe('norm-antiga');
    expect(back.companyId).toBeUndefined();
  });
});
