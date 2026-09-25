import { DielectricClass, EquipmentType, TestResult } from '../types';

/**
 * ABNT NBR 16295 - Trabalhos em Linha Viva — Luvas de Material Isolante
 * (Equivalente internacional: IEC 60903)
 * 
 * Tabela 4 – Ensaio de prova e ensaio de rigidez dielétrica
 */

export type GloveLength_mm = 280 | 360 | 410 | 460;
export type GloveTestMethod = 'ensaio_prova' | 'rigidez_dieletrica';

export interface NBR16295TableEntry {
  classe: DielectricClass;
  // Ensaios de CA
  tensaoMaximaUsoAC_kV: number;
  tensaoProvaAC_kV: number;
  limitesFugaAC_mA: {
    280: number | null; // null = N/a (Não aplicável)
    360: number | null;
    410: number | null;
    460: number | null; // >= 460 mm
  };
  tensaoRigidezAC_kV: number;

  // Ensaios de CC
  tensaoMaximaUsoDC_kV: number;
  tensaoProvaDC_kV: number;
  tensaoRigidezDC_kV: number;
}

export const TABELA_4_NBR_16295: NBR16295TableEntry[] = [
  {
    classe: '00',
    tensaoMaximaUsoAC_kV: 0.5,
    tensaoProvaAC_kV: 2.5,
    limitesFugaAC_mA: {
      280: 10,
      360: 12,
      410: null,
      460: null
    },
    tensaoRigidezAC_kV: 5,
    tensaoMaximaUsoDC_kV: 0.75,
    tensaoProvaDC_kV: 4,
    tensaoRigidezDC_kV: 8
  },
  {
    classe: '0',
    tensaoMaximaUsoAC_kV: 1.0,
    tensaoProvaAC_kV: 5.0,
    limitesFugaAC_mA: {
      280: 10,
      360: 12,
      410: 14,
      460: 16
    },
    tensaoRigidezAC_kV: 10,
    tensaoMaximaUsoDC_kV: 1.5,
    tensaoProvaDC_kV: 10,
    tensaoRigidezDC_kV: 20
  },
  {
    classe: '1',
    tensaoMaximaUsoAC_kV: 7.5,
    tensaoProvaAC_kV: 10.0,
    limitesFugaAC_mA: {
      280: null,
      360: 14,
      410: 16,
      460: 18
    },
    tensaoRigidezAC_kV: 20,
    tensaoMaximaUsoDC_kV: 11.25,
    tensaoProvaDC_kV: 20,
    tensaoRigidezDC_kV: 40
  },
  {
    classe: '2',
    tensaoMaximaUsoAC_kV: 17.0,
    tensaoProvaAC_kV: 20.0,
    limitesFugaAC_mA: {
      280: null,
      360: 16,
      410: 18,
      460: 20
    },
    tensaoRigidezAC_kV: 30,
    tensaoMaximaUsoDC_kV: 25.5,
    tensaoProvaDC_kV: 30,
    tensaoRigidezDC_kV: 60
  },
  {
    classe: '3',
    tensaoMaximaUsoAC_kV: 26.5,
    tensaoProvaAC_kV: 30.0,
    limitesFugaAC_mA: {
      280: null,
      360: 18,
      410: 20,
      460: 22
    },
    tensaoRigidezAC_kV: 40,
    tensaoMaximaUsoDC_kV: 39.75,
    tensaoProvaDC_kV: 40,
    tensaoRigidezDC_kV: 70
  },
  {
    classe: '4',
    tensaoMaximaUsoAC_kV: 36.0,
    tensaoProvaAC_kV: 40.0,
    limitesFugaAC_mA: {
      280: null,
      360: null,
      410: 22,
      460: 24
    },
    tensaoRigidezAC_kV: 50,
    tensaoMaximaUsoDC_kV: 54.0,
    tensaoProvaDC_kV: 60,
    tensaoRigidezDC_kV: 90
  }
];

export const NBR_16295_LENGTH_OPTIONS: Array<{ value: GloveLength_mm; label: string; description: string }> = [
  { value: 280, label: '280 mm', description: 'Comprimento curto (Compatível com Classes 00 e 0)' },
  { value: 360, label: '360 mm', description: 'Comprimento padrão (Compatível com Classes 00, 0, 1, 2, 3)' },
  { value: 410, label: '410 mm', description: 'Comprimento longo (Compatível com Classes 0, 1, 2, 3, 4)' },
  { value: 460, label: '≥ 460 mm', description: 'Comprimento extra longo (Compatível com Classes 0, 1, 2, 3, 4)' }
];

/**
 * Retorna os dados da Tabela 4 da NBR 16295 para a classe informada.
 */
export function getNBR16295ClassEntry(classe: DielectricClass | string): NBR16295TableEntry | undefined {
  const normClass = classe.trim().toUpperCase();
  return TABELA_4_NBR_16295.find(e => e.classe.toUpperCase() === normClass);
}

/**
 * Retorna se o comprimento é aplicável para a classe de luva conforme Tabela 4 da NBR 16295.
 */
export function isGloveLengthValidForClass(classe: DielectricClass | string, length_mm: number): boolean {
  const entry = getNBR16295ClassEntry(classe);
  if (!entry) return false;

  const normalizedLength = getClosestGloveLength(length_mm);
  return entry.limitesFugaAC_mA[normalizedLength] !== null;
}

/**
 * Normaliza o comprimento numérico para os patamares da Tabela 4 (280, 360, 410, 460).
 */
export function getClosestGloveLength(length_mm: number): GloveLength_mm {
  if (length_mm <= 300) return 280;
  if (length_mm <= 380) return 360;
  if (length_mm <= 430) return 410;
  return 460;
}

/**
 * Obtém o comprimento padrão recomendado para uma classe se nenhum for informado.
 */
export function getDefaultGloveLengthForClass(classe: DielectricClass | string): GloveLength_mm {
  const normClass = classe.trim().toUpperCase();
  if (normClass === '4') return 410;
  return 360;
}

/**
 * Calcula a corrente máxima de fuga permitida (mArms) conforme Tabela 4 da NBR 16295.
 * REGRA TÉCNICA JVM: Para os critérios das luvas isolantes, considera-se o DOBRO da corrente de fuga
 * permitida pela Tabela 4 da ABNT NBR 16295, pois o ensaio é realizado em duas luvas simultâneas na cuba.
 * Inclui o acréscimo de +2 mA por luva (+4 mA para o par) caso haja condicionamento para absorção de umidade (Nota c da Tabela 4).
 */
export function getNBR16295MaxLeakageCurrent(
  classe: DielectricClass | string,
  length_mm: number = 360,
  moistureConditioning: boolean = false,
  simultaneousGloves: number = 2
): { 
  limit_mA: number; 
  singleGloveLimit_mA: number;
  simultaneousGloves: number;
  isApplicable: boolean; 
  note?: string 
} {
  const entry = getNBR16295ClassEntry(classe);
  if (!entry) {
    return { 
      limit_mA: 28.0, 
      singleGloveLimit_mA: 14.0, 
      simultaneousGloves: 2, 
      isApplicable: false, 
      note: 'Classe não localizada na Tabela 4 da NBR 16295.' 
    };
  }

  const normalizedLength = getClosestGloveLength(length_mm);
  const baseSingleLimit = entry.limitesFugaAC_mA[normalizedLength];

  if (baseSingleLimit === null) {
    return {
      limit_mA: 0,
      singleGloveLimit_mA: 0,
      simultaneousGloves,
      isApplicable: false,
      note: `Comprimento ${normalizedLength} mm não é aplicável (N/a) para Luvas Classe ${classe} conforme Tabela 4 da NBR 16295.`
    };
  }

  // Base individual por luva + acréscimo de umidade (Nota c da Tabela 4: +2 mA por luva)
  const singleLimitWithMoisture = moistureConditioning ? baseSingleLimit + 2.0 : baseSingleLimit;
  
  // Limite total para o ensaio simultâneo (2 luvas) = Dobro da Tabela 4
  const finalLimit = singleLimitWithMoisture * simultaneousGloves;

  const note = moistureConditioning
    ? `Limite normativo de ${finalLimit.toFixed(1)} mA para ensaio simultâneo de 2 luvas (${baseSingleLimit.toFixed(1)} mA base + 2,0 mA umidade = ${singleLimitWithMoisture.toFixed(1)} mA unitário × 2 luvas conforme NBR 16295 Tabela 4).`
    : `Limite normativo de ${finalLimit.toFixed(1)} mA para ensaio simultâneo de 2 luvas (${baseSingleLimit.toFixed(1)} mA unitário da Tabela 4 × 2 luvas conforme metodologia de cuba dupla).`;

  return {
    limit_mA: finalLimit,
    singleGloveLimit_mA: singleLimitWithMoisture,
    simultaneousGloves,
    isApplicable: true,
    note
  };
}

/**
 * Retorna as tensões normativas de ensaio (Prova e Rigidez) para a luva em CA ou CC.
 */
export function getNBR16295Voltages(
  classe: DielectricClass | string,
  voltageType: 'AC' | 'DC' = 'AC'
): {
  tensaoUso_kV: number;
  tensaoProva_kV: number;
  tensaoRigidez_kV: number;
  unidade: string;
} {
  const entry = getNBR16295ClassEntry(classe);
  if (!entry) {
    return { tensaoUso_kV: 1.0, tensaoProva_kV: 5.0, tensaoRigidez_kV: 10.0, unidade: voltageType === 'AC' ? 'kVrms' : 'kV' };
  }

  if (voltageType === 'DC') {
    return {
      tensaoUso_kV: entry.tensaoMaximaUsoDC_kV,
      tensaoProva_kV: entry.tensaoProvaDC_kV,
      tensaoRigidez_kV: entry.tensaoRigidezDC_kV,
      unidade: 'kV'
    };
  }

  return {
    tensaoUso_kV: entry.tensaoMaximaUsoAC_kV,
    tensaoProva_kV: entry.tensaoProvaAC_kV,
    tensaoRigidez_kV: entry.tensaoRigidezAC_kV,
    unidade: 'kVrms'
  };
}

/**
 * Estrutura de avaliação do ensaio de luva isolante pela NBR 16295 Tabela 4
 */
export interface GloveEvaluationInput {
  classe: DielectricClass | string;
  length_mm: number;
  voltageType: 'AC' | 'DC';
  testMethod: GloveTestMethod; // 'ensaio_prova' | 'rigidez_dieletrica'
  appliedVoltage_kV: number;
  durationSeconds: number;
  measuredLeakageCurrent_mA: number;
  withstandWithoutPuncture: boolean;
  moistureConditioning?: boolean;
  visualInspectionPassed: boolean;
  visualFailedDetails?: string[];
}

export interface GloveEvaluationOutput {
  result: TestResult;
  isVisualConforming: boolean;
  isVoltageSufficient: boolean;
  isDurationSufficient: boolean;
  isWithstandPassed: boolean;
  isLeakageCurrentConforming: boolean;
  isLengthApplicable: boolean;
  requiredProofVoltage_kV: number;
  requiredBreakdownVoltage_kV: number;
  maxLeakageCurrent_mA: number;
  rationale: string;
  normativeSummary: string;
  criteriaClauses: {
    itemProofTest: string; // 8.4.2.1 / 8.4.3.1
    itemBreakdownTest: string; // 8.4.2.2 / 8.4.3.2
    tableReference: string; // Tabela 4 NBR 16295
  };
}

/**
 * Avalia o ensaio de luva isolante com base estrita na NBR 16295 Tabela 4 e itens 8.4.2 / 8.4.3
 */
export function evaluateGloveTestNBR16295(input: GloveEvaluationInput): GloveEvaluationOutput {
  const normClass = (input.classe || '2') as DielectricClass;
  const normalizedLength = getClosestGloveLength(input.length_mm || 360);
  const voltages = getNBR16295Voltages(normClass, input.voltageType);
  const leakageCalc = getNBR16295MaxLeakageCurrent(normClass, normalizedLength, !!input.moistureConditioning);

  const isLengthApplicable = leakageCalc.isApplicable;
  const isVisualConforming = input.visualInspectionPassed;
  const isWithstandPassed = input.withstandWithoutPuncture;

  // Tolerância de 2% para tensão aplicada
  const targetVoltage = input.testMethod === 'rigidez_dieletrica' ? voltages.tensaoRigidez_kV : voltages.tensaoProva_kV;
  const isVoltageSufficient = input.appliedVoltage_kV >= (targetVoltage * 0.98);
  const requiredDuration = input.voltageType === 'AC' ? 60 : 60; // 60 segundos
  const isDurationSufficient = input.durationSeconds >= (requiredDuration - 1);

  // Corrente de fuga para ensaio de prova CA
  const isLeakageCurrentConforming = isLengthApplicable 
    ? (input.measuredLeakageCurrent_mA <= leakageCalc.limit_mA) 
    : false;

  let result: TestResult = 'APROVADO';
  const rationaleParts: string[] = [];

  if (!isVisualConforming) {
    result = 'REPROVADO';
    const failedList = input.visualFailedDetails && input.visualFailedDetails.length > 0 
      ? input.visualFailedDetails.join(', ') 
      : 'Defeito na inspeção visual';
    rationaleParts.push(`Reprovado na inspeção visual prévia e inflamento de ar (NBR 16295 item 8.2): ${failedList}.`);
  }

  if (!isLengthApplicable) {
    result = 'REPROVADO';
    rationaleParts.push(`O comprimento de ${normalizedLength} mm não é aplicável para a Classe ${normClass} conforme NBR 16295 Tabela 4.`);
  }

  if (!isWithstandPassed) {
    result = 'REPROVADO';
    rationaleParts.push('Ocorreu disrupção ou perfuração dielétrica (puncture/flashover) durante o ensaio.');
  }

  if (!isVoltageSufficient) {
    result = 'REPROVADO';
    rationaleParts.push(`Tensão aplicada (${input.appliedVoltage_kV.toFixed(1)} kV) inferior à exigência normativa (${targetVoltage.toFixed(1)} kV).`);
  }

  if (!isDurationSufficient) {
    result = 'REPROVADO';
    rationaleParts.push(`Tempo de ensaio (${input.durationSeconds} s) inferior ao tempo normativo (${requiredDuration} s).`);
  }

  if (!isLeakageCurrentConforming && isLengthApplicable) {
    result = 'REPROVADO';
    rationaleParts.push(
      `Corrente de fuga medida (${input.measuredLeakageCurrent_mA.toFixed(1)} mA) excedeu o limite máximo normativo de ${leakageCalc.limit_mA.toFixed(1)} mA da NBR 16295 Tabela 4 para ensaio simultâneo de 2 luvas (Classe ${normClass} / ${normalizedLength} mm: ${leakageCalc.singleGloveLimit_mA.toFixed(1)} mA unitário × 2 luvas).`
    );
  }

  if (result === 'APROVADO') {
    rationaleParts.push(
      `Luva Isolante Classe ${normClass} (${normalizedLength} mm) APROVADA conforme ABNT NBR 16295 Tabela 4 e itens 8.4.2.1 / 8.4.3.1. ` +
      `A tensão de prova de ${voltages.tensaoProva_kV.toFixed(1)} ${voltages.unidade} foi mantida durante ${input.durationSeconds} segundos sem perfuração dielétrica, ` +
      `com corrente de fuga medida de ${input.measuredLeakageCurrent_mA.toFixed(1)} mA (abaixo do limite máximo normativo de ${leakageCalc.limit_mA.toFixed(1)} mA para ensaio em 2 luvas simultâneas, referente a ${leakageCalc.singleGloveLimit_mA.toFixed(1)} mA individual × 2 da Tabela 4).`
    );
  }

  const normativeSummary = `ABNT NBR 16295 / IEC 60903 Tabela 4 — Luva Classe ${normClass} (${normalizedLength} mm): Tensão Máx Uso = ${voltages.tensaoUso_kV} ${voltages.unidade} | Tensão Prova = ${voltages.tensaoProva_kV} ${voltages.unidade} | Limite Fuga Máx (2 Luvas Simultâneas) = ${leakageCalc.limit_mA.toFixed(1)} mA (${leakageCalc.singleGloveLimit_mA.toFixed(1)} mA × 2) | Tensão Rigidez = ${voltages.tensaoRigidez_kV} ${voltages.unidade}.`;

  return {
    result,
    isVisualConforming,
    isVoltageSufficient,
    isDurationSufficient,
    isWithstandPassed,
    isLeakageCurrentConforming,
    isLengthApplicable,
    requiredProofVoltage_kV: voltages.tensaoProva_kV,
    requiredBreakdownVoltage_kV: voltages.tensaoRigidez_kV,
    maxLeakageCurrent_mA: leakageCalc.limit_mA,
    rationale: rationaleParts.join(' '),
    normativeSummary,
    criteriaClauses: {
      itemProofTest: input.voltageType === 'AC' ? 'NBR 16295 Item 8.4.2.1' : 'NBR 16295 Item 8.4.3.1',
      itemBreakdownTest: input.voltageType === 'AC' ? 'NBR 16295 Item 8.4.2.2' : 'NBR 16295 Item 8.4.3.2',
      tableReference: 'ABNT NBR 16295 Tabela 4'
    }
  };
}
