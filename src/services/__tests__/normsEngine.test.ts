import { describe, expect, it } from 'vitest';
import {
  findMatchingCriterion,
  getApprovedToolsCount,
  getReprovedToolsCount,
  isTestEligibleForCertificate
} from '../normsEngine';
import { IsolatedToolItem, NormCriterion } from '../../types';

const tool = (overrides: Partial<IsolatedToolItem>): IsolatedToolItem =>
  ({ id: Math.random().toString(36), name: 'Alicate', quantity: 1, ...overrides } as IsolatedToolItem);

describe('Certificado — elegibilidade', () => {
  it('ensaio aprovado pode gerar certificado', () => {
    expect(isTestEligibleForCertificate({ result: 'APROVADO' })).toBe(true);
  });

  it('ensaio reprovado não gera certificado', () => {
    expect(isTestEligibleForCertificate({ result: 'REPROVADO', equipmentType: 'luva_isolante' })).toBe(false);
  });

  it('lote de ferramentas reprovado gera certificado parcial se houver peça aprovada', () => {
    const test = {
      result: 'REPROVADO',
      equipmentType: 'ferramenta_isolada',
      isolatedTools: [tool({ result: 'REPROVADO' }), tool({ result: 'APROVADO' })]
    };
    expect(isTestEligibleForCertificate(test)).toBe(true);
  });

  it('lote de ferramentas sem nenhuma peça aprovada não gera certificado', () => {
    const test = {
      result: 'REPROVADO',
      equipmentType: 'ferramenta_isolada',
      isolatedTools: [tool({ result: 'REPROVADO' }), tool({ dielectricResult: 'nao_conforme' } as any)]
    };
    expect(isTestEligibleForCertificate(test)).toBe(false);
  });
});

describe('Ferramentas isoladas — contagem de peças', () => {
  it('soma quantidades e trata não conformidade visual/dielétrica como reprovação', () => {
    const test = {
      isolatedTools: [
        tool({ result: 'APROVADO', quantity: 3 }),
        tool({ result: 'APROVADO', quantity: 2, visualInspection: 'nao_conforme' } as any),
        tool({ result: 'REPROVADO', quantity: 1 })
      ]
    };
    expect(getApprovedToolsCount(test)).toBe(3);
    expect(getReprovedToolsCount(test)).toBe(3);
  });
});

describe('Seleção do critério normativo', () => {
  const criterion = (overrides: Partial<NormCriterion>): NormCriterion =>
    ({
      id: 'c',
      status: 'active',
      applicableEquipmentTypes: ['luva_isolante'],
      dielectricClass: '0',
      ...overrides
    } as NormCriterion);

  it('escolhe o critério ativo do tipo e da classe do equipamento', () => {
    const all = [
      criterion({ id: 'classe-1', dielectricClass: '1' }),
      criterion({ id: 'classe-0', dielectricClass: '0' })
    ];
    expect(findMatchingCriterion('luva_isolante' as any, '0', all)?.id).toBe('classe-0');
  });

  it('ignora critérios inativos', () => {
    const all = [criterion({ id: 'inativo', status: 'inactive' as any })];
    expect(findMatchingCriterion('luva_isolante' as any, '0', all)).toBeUndefined();
  });

  it('não usa critério de outro tipo de equipamento', () => {
    const all = [criterion({ id: 'manga', applicableEquipmentTypes: ['manga_isolante' as any] })];
    expect(findMatchingCriterion('luva_isolante' as any, '0', all)).toBeUndefined();
  });
});
