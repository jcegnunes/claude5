import { describe, expect, it } from 'vitest';
import {
  evaluateGloveTestNBR16295,
  getNBR16295ClassEntry,
  getNBR16295MaxLeakageCurrent,
  GloveEvaluationInput
} from '../nbr16295Service';

/** Luva classe 0, 360 mm, ensaio de prova CA conforme a Tabela 4. */
function gloveInput(overrides: Partial<GloveEvaluationInput> = {}): GloveEvaluationInput {
  const entry = getNBR16295ClassEntry('0')!;
  return {
    classe: '0',
    length_mm: 360,
    voltageType: 'AC',
    testMethod: 'ensaio_prova',
    appliedVoltage_kV: entry.tensaoProvaAC_kV,
    durationSeconds: 60,
    measuredLeakageCurrent_mA: 5,
    withstandWithoutPuncture: true,
    visualInspectionPassed: true,
    ...overrides
  };
}

describe('NBR 16295 — avaliação de luvas isolantes', () => {
  it('aprova luva dentro de todos os critérios', () => {
    const out = evaluateGloveTestNBR16295(gloveInput());
    expect(out.result).toBe('APROVADO');
    expect(out.isVoltageSufficient).toBe(true);
    expect(out.isDurationSufficient).toBe(true);
    expect(out.isLeakageCurrentConforming).toBe(true);
    expect(out.isLengthApplicable).toBe(true);
  });

  // Regra técnica JVM confirmada pelo laboratório (28/09/2026): o par de luvas é ensaiado ao mesmo
  // tempo na cuba, então o limite é o DOBRO do valor unitário da Tabela 4.
  it('usa o dobro do limite unitário da Tabela 4 (2 luvas simultâneas)', () => {
    const entry = getNBR16295ClassEntry('0')!;
    const out = evaluateGloveTestNBR16295(gloveInput());
    expect(out.maxLeakageCurrent_mA).toBe(entry.limitesFugaAC_mA[360]! * 2);
  });

  it('condicionamento de umidade acrescenta 2 mA por luva (Nota c)', () => {
    const base = getNBR16295MaxLeakageCurrent('0', 360, false);
    const wet = getNBR16295MaxLeakageCurrent('0', 360, true);
    expect(wet.limit_mA - base.limit_mA).toBe(4);
  });

  it('aprova com corrente exatamente no limite e reprova acima dele', () => {
    const limit = getNBR16295ClassEntry('0')!.limitesFugaAC_mA[360]! * 2;
    expect(evaluateGloveTestNBR16295(gloveInput({ measuredLeakageCurrent_mA: limit })).result).toBe('APROVADO');
    const above = evaluateGloveTestNBR16295(gloveInput({ measuredLeakageCurrent_mA: limit + 0.01 }));
    expect(above.result).toBe('REPROVADO');
    expect(above.isLeakageCurrentConforming).toBe(false);
  });

  it('reprova quando há perfuração/disrupção', () => {
    const out = evaluateGloveTestNBR16295(gloveInput({ withstandWithoutPuncture: false }));
    expect(out.result).toBe('REPROVADO');
    expect(out.isWithstandPassed).toBe(false);
  });

  it('reprova quando a inspeção visual não é conforme', () => {
    const out = evaluateGloveTestNBR16295(gloveInput({ visualInspectionPassed: false }));
    expect(out.result).toBe('REPROVADO');
    expect(out.isVisualConforming).toBe(false);
  });

  it('aceita tensão aplicada até 2% abaixo da tensão de prova e reprova abaixo disso', () => {
    const target = getNBR16295ClassEntry('0')!.tensaoProvaAC_kV;
    expect(evaluateGloveTestNBR16295(gloveInput({ appliedVoltage_kV: target * 0.98 })).isVoltageSufficient).toBe(true);
    const low = evaluateGloveTestNBR16295(gloveInput({ appliedVoltage_kV: target * 0.97 }));
    expect(low.isVoltageSufficient).toBe(false);
    expect(low.result).toBe('REPROVADO');
  });

  it('exige 60 s de aplicação (tolerância de 1 s)', () => {
    expect(evaluateGloveTestNBR16295(gloveInput({ durationSeconds: 59 })).isDurationSufficient).toBe(true);
    const short = evaluateGloveTestNBR16295(gloveInput({ durationSeconds: 58 }));
    expect(short.isDurationSufficient).toBe(false);
    expect(short.result).toBe('REPROVADO');
  });

  it('não aprova comprimento sem limite definido para a classe (classe 00, 410 mm)', () => {
    expect(getNBR16295MaxLeakageCurrent('00', 410, false).isApplicable).toBe(false);
    const out = evaluateGloveTestNBR16295(gloveInput({
      classe: '00',
      length_mm: 410,
      appliedVoltage_kV: getNBR16295ClassEntry('00')!.tensaoProvaAC_kV
    }));
    expect(out.isLengthApplicable).toBe(false);
    expect(out.result).not.toBe('APROVADO');
  });

  it('todas as classes da Tabela 4 têm tensões de prova crescentes', () => {
    const classes = ['00', '0', '1', '2', '3', '4'];
    const proof = classes.map(c => getNBR16295ClassEntry(c)!.tensaoProvaAC_kV);
    for (let i = 1; i < proof.length; i++) {
      expect(proof[i]).toBeGreaterThan(proof[i - 1]);
    }
  });
});
