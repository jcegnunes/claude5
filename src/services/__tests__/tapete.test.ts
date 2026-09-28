import { describe, expect, it } from 'vitest';
import { evaluateDielectricTest, NormEvaluationInput } from '../normsEngine';
import { TAPETE_LEAKAGE_LIMIT_MA } from '../astmBlanketMattingService';
import { INITIAL_NORMS } from '../../data/seedData';
import { NormCriterion } from '../../types';

const tapeteNorm = INITIAL_NORMS.find(n => n.id === 'norm-tapete-astm-cl0')!;

function input(overrides: Partial<NormEvaluationInput> = {}): NormEvaluationInput {
  return {
    equipmentType: 'tapete_isolante',
    dielectricClass: '0',
    appliedVoltage_kV: tapeteNorm.testVoltage_kV,
    voltageType: 'AC',
    durationSeconds: 60,
    measuredLeakageCurrent_mA: 50,
    withstandWithoutPuncture: true,
    visualChecklist: [],
    allCriteria: INITIAL_NORMS,
    ...overrides
  };
}

describe('Tapetes isolantes (ASTM D178-22) — limite de fuga de 100 mA', () => {
  it('o limite adotado é 100 mA', () => {
    expect(TAPETE_LEAKAGE_LIMIT_MA).toBe(100);
    expect(evaluateDielectricTest(input()).appliedLimit).toBe(100);
  });

  it('todas as classes de tapete nas normas iniciais usam 100 mA', () => {
    const tapetes = INITIAL_NORMS.filter(n => n.applicableEquipmentTypes.includes('tapete_isolante'));
    expect(tapetes.length).toBeGreaterThan(0);
    tapetes.forEach(n => {
      expect(n.maxLeakageCurrent).toBe(100);
      expect(n.currentUnit).toBe('mA');
    });
  });

  it('aprova com 100 mA e reprova acima de 100 mA', () => {
    expect(evaluateDielectricTest(input({ measuredLeakageCurrent_mA: 100 })).isLeakageCurrentConforming).toBe(true);
    const above = evaluateDielectricTest(input({ measuredLeakageCurrent_mA: 100.1 }));
    expect(above.isLeakageCurrentConforming).toBe(false);
    expect(above.result).toBe('REPROVADO');
  });

  it('usa 100 mA mesmo se a norma cadastrada tiver outro valor', () => {
    const edited: NormCriterion = { ...tapeteNorm, maxLeakageCurrent: 10 };
    const out = evaluateDielectricTest(input({ measuredLeakageCurrent_mA: 50, allCriteria: [edited] }));
    expect(out.appliedLimit).toBe(100);
    expect(out.isLeakageCurrentConforming).toBe(true);
  });
});
