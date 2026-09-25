import { NormCriterion, EquipmentType, DielectricClass, ChecklistItem, TestResult, IsolatedToolItem } from '../types';
import { 
  getNBR16295MaxLeakageCurrent, 
  getNBR16295Voltages, 
  getClosestGloveLength,
  GloveTestMethod,
  TABELA_4_NBR_16295 
} from './nbr16295Service';
import {
  getASTMD1048Entry,
  getASTMD178Entry,
  BlanketType,
  BlanketStyle,
  MattingSurface
} from './astmBlanketMattingService';
import {
  getLadderNormEntry,
  getLadderChecklistItems,
  LadderType,
  LadderTestMethod,
  TABELA_NORMAS_ESCADAS_FIBRA
} from './ladderNormsService';

export interface NormEvaluationInput {
  equipmentType: EquipmentType;
  dielectricClass: string;
  appliedVoltage_kV: number;
  voltageType: 'AC' | 'DC';
  durationSeconds: number;
  measuredLeakageCurrent_mA: number;
  withstandWithoutPuncture: boolean;
  visualChecklist: ChecklistItem[];
  customNormCriterionId?: string;
  allCriteria: NormCriterion[];
  isolatedTools?: IsolatedToolItem[];
  gloveLength_mm?: number;
  gloveTestMethod?: GloveTestMethod;
  moistureConditioning?: boolean;
  blanketType?: BlanketType;
  blanketStyle?: BlanketStyle;
  blanketDimensions?: string;
  mattingSurface?: MattingSurface;
  mattingThickness_mm?: number;
  mattingDimensions?: string;
  testElectrodeType?: string;
  flashoverClearance_mm?: number;
  ladderType?: LadderType;
  ladderTestMethod?: LadderTestMethod;
  ladderSegmentLength_mm?: number;
  ladderTestedSegmentsCount?: number;
  ladderRungsInspectedCount?: number;
  ladderMoistureConditioned?: boolean;
}

export interface NormEvaluationResult {
  canEvaluate: boolean;
  errorMessage?: string;
  matchedCriterion?: NormCriterion;
  isVisualConforming: boolean;
  visualFailedItems: string[];
  isVoltageSufficient: boolean;
  isDurationSufficient: boolean;
  isWithstandPassed: boolean;
  isLeakageCurrentConforming: boolean;
  isGloveLengthApplicable?: boolean;
  appliedLimit: number;
  appliedUnit: string;
  result: TestResult;
  rationale: string;
  recommendedRetestMonths: number;
  normReferenceClause?: string;
  approvedOpinion?: string;
  reprovedOpinion?: string;
  toolsEvaluation?: {
    totalTools: number;
    approvedCount: number;
    reprovedCount: number;
    canEmitPartialCertificate?: boolean;
    reprovedItems: Array<{ name: string; reason: string; quantity: number }>;
    approvedItems?: Array<{ name: string; quantity: number }>;
    approvedOpinion?: string;
    reprovedOpinion?: string;
  };
}

export function findMatchingCriterion(
  equipmentType: EquipmentType,
  dielectricClass: string,
  allCriteria: NormCriterion[],
  criterionId?: string
): NormCriterion | undefined {
  if (criterionId) {
    const directMatch = allCriteria.find(c => c.id === criterionId && c.status === 'active');
    if (directMatch && directMatch.applicableEquipmentTypes.includes(equipmentType)) {
      return directMatch;
    }
  }

  // Find by equipment type and class
  return allCriteria.find(c => {
    if (c.status !== 'active') return false;
    const typeMatches = c.applicableEquipmentTypes.includes(equipmentType);
    
    // Normalize class comparison (e.g. '0', '00', '1', '2', '3', '4', 'B', '1000V', 'Geral')
    const normClass = (c.dielectricClass || '').trim().toLowerCase();
    const inputClass = (dielectricClass || '').trim().toLowerCase();
    let classMatches = 
      normClass === inputClass ||
      normClass === 'geral';

    // Capacete Classe B equivalence to Dielectric Class 2
    if (equipmentType === 'capacete_classe_b') {
      if (
        (inputClass === '2' || inputClass === 'b' || inputClass.includes('2') || inputClass.includes('b')) &&
        (normClass === '2' || normClass === 'b' || normClass.includes('2') || normClass.includes('b') || normClass === 'geral')
      ) {
        classMatches = true;
      }
    }

    // Ferramentas Manuais Isoladas (NBR 9699 / IEC 60900 - 1000V AC / 1500V DC)
    if (equipmentType === 'ferramenta_isolada') {
      if (
        normClass === '1000v' || normClass === '1000 v' || normClass === '1000' || 
        normClass === '0' || normClass === 'geral' || normClass.includes('1000') ||
        inputClass === '0' || inputClass === '00' || inputClass === '1000v' || inputClass === '1000' || inputClass === 'geral'
      ) {
        classMatches = true;
      }
      if (typeMatches) {
        classMatches = true;
      }
    }

    return typeMatches && classMatches;
  });
}

export function evaluateDielectricTest(input: NormEvaluationInput): NormEvaluationResult {
  const criterion = findMatchingCriterion(
    input.equipmentType,
    input.dielectricClass,
    input.allCriteria,
    input.customNormCriterionId
  );

  // Requirement: If no criterion configured, do NOT invent criteria
  if (!criterion) {
    return {
      canEvaluate: false,
      errorMessage: 'Critério técnico não configurado. Consulte a norma/procedimento aplicável.',
      isVisualConforming: false,
      visualFailedItems: [],
      isVoltageSufficient: false,
      isDurationSufficient: false,
      isWithstandPassed: false,
      isLeakageCurrentConforming: false,
      appliedLimit: 0,
      appliedUnit: 'mA',
      result: 'PENDENTE',
      rationale: 'Critério técnico não configurado. Consulte a norma/procedimento aplicável.',
      recommendedRetestMonths: 6
    };
  }

  // 1. Visual Inspection Check
  const visualFailedItems: string[] = [];
  input.visualChecklist.forEach(item => {
    if (item.status === 'nao_conforme') {
      visualFailedItems.push(item.item + (item.observation ? ` (${item.observation})` : ''));
    }
  });
  const isVisualConforming = visualFailedItems.length === 0;

  // Specific calculation for Insulating Gloves (Luvas Isolantes) per NBR 16295 Tabela 4
  let appliedLimit = criterion.maxLeakageCurrent;
  let isGloveLengthApplicable = true;
  let normReferenceClause = criterion.normCode;

  if (input.equipmentType === 'luva_isolante') {
    const gloveLength = input.gloveLength_mm || 360;
    const leakageLookup = getNBR16295MaxLeakageCurrent(
      input.dielectricClass,
      gloveLength,
      !!input.moistureConditioning
    );
    
    if (leakageLookup.isApplicable) {
      appliedLimit = leakageLookup.limit_mA;
      isGloveLengthApplicable = true;
    } else {
      appliedLimit = criterion.maxLeakageCurrent;
      isGloveLengthApplicable = false;
    }
    
    normReferenceClause = 'ABNT NBR 16295:2023 Tabela 4 (2 Luvas Simultâneas)';
  } else if (input.equipmentType === 'manta_isolante') {
    normReferenceClause = 'ASTM D1048-14 (Itens 18.1 a 18.3 / Tabelas 1 e 2)';
  } else if (input.equipmentType === 'tapete_isolante') {
    appliedLimit = 100.0;
    normReferenceClause = 'ASTM D178-22 (Itens 18.1 e 18.2 / Tabelas 1 e 2 - Limite de fuga adotado: 100 mA)';
  } else if (input.equipmentType === 'escada_isolada') {
    const ladderNorm = getLadderNormEntry(input.ladderTestMethod || 'segmento_300mm_100kv');
    normReferenceClause = ladderNorm.normClauses;
    if (input.ladderMoistureConditioned && ladderNorm.maxLeakageCurrentWet_mA) {
      appliedLimit = ladderNorm.maxLeakageCurrentWet_mA;
    } else {
      appliedLimit = ladderNorm.maxLeakageCurrent_mA;
    }
  } else if (input.equipmentType === 'ferramenta_isolada') {
    const totalToolsCount = (input.isolatedTools && input.isolatedTools.length > 0)
      ? input.isolatedTools.reduce((acc, t) => acc + (Number(t.quantity) || 1), 0)
      : 1;
    appliedLimit = Math.max(1, totalToolsCount) * 1.0;
    normReferenceClause = 'ABNT NBR 9699:2022 / IEC 60900 (Item 5.5 / 1,0 mA por ferramenta)';
  }

  // 2. Voltage Check (applied voltage must meet or exceed required voltage within 2% tolerance)
  const targetVoltage = criterion.testVoltage_kV;
  const isVoltageSufficient = input.appliedVoltage_kV >= (targetVoltage * 0.98);

  // 3. Duration Check (duration must meet or exceed configured duration)
  const isDurationSufficient = input.durationSeconds >= (criterion.testDurationSeconds - 1);

  // 4. Withstand without perforation/puncture
  const isWithstandPassed = input.withstandWithoutPuncture;

  // 5. Leakage Current Check
  const isLeakageCurrentConforming = isGloveLengthApplicable
    ? input.measuredLeakageCurrent_mA <= appliedLimit
    : false;

  // Evaluate overall result
  let result: TestResult = 'APROVADO';
  const rationaleParts: string[] = [];

  if (!isVisualConforming) {
    result = 'REPROVADO';
    rationaleParts.push(`Reprovado na inspeção visual: ${visualFailedItems.join('; ')}.`);
  }

  if (input.equipmentType === 'luva_isolante' && !isGloveLengthApplicable) {
    result = 'REPROVADO';
    rationaleParts.push(`Comprimento ${input.gloveLength_mm} mm não é aplicável para Luva Classe ${input.dielectricClass} conforme ABNT NBR 16295 Tabela 4.`);
  }

  if (!isWithstandPassed) {
    result = 'REPROVADO';
    rationaleParts.push('Ocorreu disrupção ou perfuração dielétrica (puncture/flashover) durante a aplicação de alta tensão.');
  }

  if (!isVoltageSufficient) {
    result = 'REPROVADO';
    rationaleParts.push(`Tensão aplicada (${input.appliedVoltage_kV} kV) inferior à tensão normativa exigida (${targetVoltage} kV).`);
  }

  if (!isDurationSufficient) {
    result = 'REPROVADO';
    rationaleParts.push(`Tempo de aplicação (${input.durationSeconds}s) inferior ao tempo normativo (${criterion.testDurationSeconds}s).`);
  }

  if (!isLeakageCurrentConforming && isGloveLengthApplicable) {
    result = 'REPROVADO';
    if (input.equipmentType === 'luva_isolante') {
      const len = input.gloveLength_mm || 360;
      const singleLimit = (appliedLimit / 2).toFixed(1);
      rationaleParts.push(`Corrente de fuga medida (${input.measuredLeakageCurrent_mA.toFixed(1)} mA) excedeu o limite máximo normativo de ${appliedLimit.toFixed(1)} mA da ABNT NBR 16295 Tabela 4 para ensaio simultâneo de 2 luvas (Classe ${input.dielectricClass}, ${len} mm: ${singleLimit} mA unitário × 2 luvas).`);
    } else if (input.equipmentType === 'manta_isolante') {
      rationaleParts.push(`Corrente de fuga medida (${input.measuredLeakageCurrent_mA} mA) excedeu o patamar aceitável de ${appliedLimit} mA conforme ASTM D1048-14.`);
    } else if (input.equipmentType === 'tapete_isolante') {
      rationaleParts.push(`Corrente de fuga medida (${input.measuredLeakageCurrent_mA} mA) excedeu o limite máximo de ${appliedLimit} mA (a norma ASTM D178-22 não estipula valor específico de corrente de fuga, adotando-se o limite de 100 mA).`);
    } else if (input.equipmentType === 'ferramenta_isolada') {
      const totalToolsCount = (input.isolatedTools && input.isolatedTools.length > 0)
        ? input.isolatedTools.reduce((acc, t) => acc + (Number(t.quantity) || 1), 0)
        : 1;
      rationaleParts.push(`Corrente de fuga medida (${input.measuredLeakageCurrent_mA.toFixed(2)} mA) excedeu o limite normativo máximo de ${appliedLimit.toFixed(1)} mA para o lote de ${totalToolsCount} ferramenta(s) ensaiada(s) (1,0 mA por ferramenta conforme ABNT NBR 9699 / IEC 60900).`);
    } else {
      rationaleParts.push(`Corrente de fuga medida (${input.measuredLeakageCurrent_mA} ${criterion.currentUnit}) excedeu o limite máximo permitido de ${appliedLimit} ${criterion.currentUnit} conforme ${criterion.normCode}.`);
    }
  }

  // 5.1 ASTM D178-22 Table 2 Thickness Validation for Tapetes Isolantes
  if (input.equipmentType === 'tapete_isolante' && input.mattingThickness_mm !== undefined && input.mattingThickness_mm > 0) {
    const astmTapete = getASTMD178Entry(input.dielectricClass);
    if (astmTapete && input.mattingThickness_mm < astmTapete.espessuraMinima_mm) {
      result = 'REPROVADO';
      rationaleParts.push(
        `Espessura medida do tapete (${input.mattingThickness_mm} mm) inferior ao requisito mínimo normativo de ${astmTapete.espessuraMinima_mm} mm (${astmTapete.espessuraMinima_pol}) estabelecido na ASTM D178-22 Tabela 2 para Tapete Classe ${input.dielectricClass}.`
      );
    }
  }

  // 6. Insulated Tools Individual Evaluation Check
  let toolsEvaluation: NormEvaluationResult['toolsEvaluation'] = undefined;
  let toolApprovedOpinion: string | undefined = undefined;
  let toolReprovedOpinion: string | undefined = undefined;

  if (input.equipmentType === 'ferramenta_isolada' && input.isolatedTools && input.isolatedTools.length > 0) {
    const totalTools = input.isolatedTools.reduce((acc, t) => acc + (Number(t.quantity) || 1), 0);
    const reprovedList: Array<{ name: string; reason: string; quantity: number }> = [];
    const approvedList: Array<{ name: string; quantity: number }> = [];
    let approvedTotal = 0;

    input.isolatedTools.forEach(tool => {
      const isToolApproved = (tool.result || 'APROVADO') === 'APROVADO' && 
                             tool.visualInspection !== 'nao_conforme' && 
                             tool.dielectricResult !== 'nao_conforme';
      const qty = Number(tool.quantity) || 1;
      if (isToolApproved) {
        approvedTotal += qty;
        approvedList.push({
          name: `${tool.toolName} ${tool.sizeOrSpec ? `(${tool.sizeOrSpec})` : ''} - Fabr: ${tool.manufacturer || 'N/A'}`,
          quantity: qty
        });
      } else {
        reprovedList.push({
          name: `${tool.toolName} ${tool.sizeOrSpec ? `(${tool.sizeOrSpec})` : ''} - Fabr: ${tool.manufacturer || 'N/A'}`,
          reason: tool.defectReason || 'Não atendeu aos critérios da NBR 9699 / IEC 60900',
          quantity: qty
        });
      }
    });

    const reprovedTotal = totalTools - approvedTotal;

    if (approvedTotal > 0) {
      if (reprovedTotal > 0) {
        const approvedDescriptions = approvedList.map(a => `${a.quantity}x ${a.name}`).join('; ');
        toolApprovedOpinion = `PARECER TÉCNICO 1 — FERRAMENTAS APROVADAS (LIBERAÇÃO OPERACIONAL)\nNorma Aplicável: ABNT NBR 9699:2022 / IEC 60900 / NR-10 Item 10.4\nAs ${approvedTotal} ferramenta(s) manuais isoladas listadas [${approvedDescriptions}] foram ensaiadas individualmente sob tensão de prova de 10.000 V CA por 180 segundos contínuos (3 minutos) após condicionamento, apresentando integridade plena da isolação, ausência de perfuração dielétrica e corrente de fuga controlada inferior ao limite normativo de ${(approvedTotal * 1.0).toFixed(1)} mA (1,0 mA por ferramenta ensaiada).\nCONCLUSÃO: CONSIDERADAS APTAS para utilização profissional em instalações elétricas energizadas até 1.000 V CA / 1.500 V CC. EMISSÃO AUTORIZADA DO CERTIFICADO DE CONFORMIDADE DIELÉTRICA.`;
      } else {
        toolApprovedOpinion = `Lote de ${approvedTotal} ferramenta(s) manuais isoladas ensaiadas individualmente sob tensão de prova de 10.000 V CA por 180 segundos contínuos (3 minutos) após condicionamento, conforme ABNT NBR 9699:2022 / IEC 60900 / NR-10 Item 10.4.\nTodas as peças apresentaram plena integridade da isolação, ausência de perfuração dielétrica e corrente de fuga total de ${input.measuredLeakageCurrent_mA.toFixed(1)} mA (estritamente abaixo do limite normativo de ${(approvedTotal * 1.0).toFixed(1)} mA, à razão de 1,0 mA por ferramenta).\nCONCLUSÃO: Lote considerado APTO para intervenções e serviços profissionais em instalações elétricas energizadas até 1.000 V CA / 1.500 V CC. EMISSÃO AUTORIZADA DO CERTIFICADO DE CONFORMIDADE DIELÉTRICA.`;
      }
    }

    if (reprovedTotal > 0) {
      const reprovedDescriptions = reprovedList.map(r => `${r.quantity}x ${r.name} (Motivo: ${r.reason})`).join('; ');
      toolReprovedOpinion = `PARECER TÉCNICO 2 — FERRAMENTAS REPROVADAS (SEGREGAÇÃO E DESCARTE COMPULSÓRIO)\nNorma Aplicável: ABNT NBR 9699:2022 / IEC 60900 / NR-10 Item 10.4.1\nAs ${reprovedTotal} ferramenta(s) manuais isoladas listadas [${reprovedDescriptions}] NÃO ATENDERAM aos critérios de aceitação durante a inspeção visual ou ensaio dielétrico a 10 kV CA, apresentando não-conformidades que comprometem a segurança do operador.\nCONCLUSÃO: CONSIDERADAS INAPTAS para intervenções elétricas. DETERMINA-SE A SEGREGAÇÃO IMEDIATA, APLICAÇÃO DE ETIQUETA VERMELHA DE CONDENAÇÃO E ENCAMINHAMENTO PARA DESCARTE / DESTRUIÇÃO MECÂNICA COMPULSÓRIA, SENDO PROIBIDA SUA UTILIZAÇÃO.`;
    }

    toolsEvaluation = {
      totalTools,
      approvedCount: approvedTotal,
      reprovedCount: reprovedTotal,
      canEmitPartialCertificate: approvedTotal > 0,
      reprovedItems: reprovedList,
      approvedItems: approvedList,
      approvedOpinion: toolApprovedOpinion,
      reprovedOpinion: toolReprovedOpinion
    };

    if (toolsEvaluation.reprovedCount > 0) {
      result = 'REPROVADO';
      if (approvedTotal > 0) {
        rationaleParts.push(
          `${toolApprovedOpinion}\n\n${toolReprovedOpinion}`
        );
      } else {
        rationaleParts.push(
          toolReprovedOpinion || `Avaliação individual de ferramentas manuais isoladas: Todas as ${totalTools} ferramentas foram REPROVADAS e devem ser segregadas e retiradas de uso imediatamente.`
        );
      }
    } else {
      rationaleParts.push(
        toolApprovedOpinion || `Avaliação individual das ferramentas manuais isoladas: Todas as ${totalTools} peças foram APROVADAS individualmente na inspeção visual e ensaio dielétrico (10 kV / NBR 9699 / IEC 60900), liberadas para uso com Certificado de Conformidade.`
      );
    }
  }

  if (result === 'APROVADO') {
    if (input.equipmentType === 'luva_isolante') {
      const len = input.gloveLength_mm || 360;
      const singleLimit = (appliedLimit / 2).toFixed(1);
      rationaleParts.push(
        `Equipamento plenamente CONFORME com a ABNT NBR 16295:2023 Tabela 4 (Ensaio de Prova item 8.4.2.1 / 8.4.3.1). ` +
        `Atendeu à inspeção visual com inflamento de ar (item 8.2), suportabilidade dielétrica a ${targetVoltage} kV ${input.voltageType} por ${input.durationSeconds} segundos sem perfuração, ` +
        `com corrente de fuga de ${input.measuredLeakageCurrent_mA.toFixed(1)} mA (abaixo do limite máximo normativo de ${appliedLimit.toFixed(1)} mA para o ensaio simultâneo de 2 luvas na cuba, referente ao limite unitário de ${singleLimit} mA × 2 da Tabela 4 para Classe ${input.dielectricClass}, comprimento ${len} mm).`
      );
    } else if (input.equipmentType === 'manta_isolante') {
      const astm = getASTMD1048Entry(input.dielectricClass);
      const styleDesc = input.blanketStyle ? ` (${input.blanketStyle})` : '';
      const typeDesc = input.blanketType ? ` [${input.blanketType}]` : '';
      const clearance = astm?.distanciaBordaEletrodo_mm ? ` com folga de borda de ${astm.distanciaBordaEletrodo_mm} mm (${astm.distanciaBordaEletrodo_pol})` : '';
      rationaleParts.push(
        `Manta Isolante plenamente CONFORME com a ASTM D1048-14 (Tabelas 1 e 2 / Item 18)${styleDesc}${typeDesc}. ` +
        `Aprovada na inspeção visual de integridade de superfície e suportabilidade dielétrica ao Ensaio de Prova com ${targetVoltage} kV ${input.voltageType} contínuos por ${input.durationSeconds} segundos entre eletrodos planos${clearance}, ` +
        `sem ocorrência de perfuração dielétrica ou descarga disruptiva (withstand without puncture/flashover), com corrente de fuga de ${input.measuredLeakageCurrent_mA.toFixed(1)} mA (limite: ${appliedLimit} mA).`
      );
    } else if (input.equipmentType === 'tapete_isolante') {
      const astm = getASTMD178Entry(input.dielectricClass);
      const surfaceDesc = input.mattingSurface ? ` (Superfície ${input.mattingSurface})` : '';
      const thickDesc = astm ? ` (espessura mínima exigida: ${astm.espessuraMinima_mm} mm / ${astm.espessuraMinima_pol})` : '';
      rationaleParts.push(
        `Tapete Isolante plenamente CONFORME com a ASTM D178-22 (Tabelas 1 e 2 / Item 18)${surfaceDesc}${thickDesc}. ` +
        `Aprovado na inspeção visual de integridade superficial e ensaio dielétrico de prova a ${targetVoltage} kV ${input.voltageType} por ${input.durationSeconds} segundos por segmento sem disrupção nem perfuração, ` +
        `com corrente de fuga estável em ${input.measuredLeakageCurrent_mA.toFixed(1)} mA (abaixo do limite de ${appliedLimit} mA; a norma ASTM D178-22 não estipula valor específico de corrente de fuga, adotando-se o limite de 100 mA).`
      );
    } else if (input.equipmentType === 'escada_isolada') {
      const ladderNorm = getLadderNormEntry(input.ladderTestMethod || 'segmento_300mm_100kv');
      const ladderTypeDesc = input.ladderType ? ` (Tipo: ${input.ladderType})` : '';
      const segDesc = input.ladderTestedSegmentsCount ? ` em ${input.ladderTestedSegmentsCount} segmento(s) testado(s)` : '';
      const condDesc = input.ladderMoistureConditioned ? ' sob condicionamento de umidade' : ' a seco';
      rationaleParts.push(
        `Escada Isolada em Fibra de Vidro (PRFV) plenamente CONFORME com as normas ${ladderNorm.normCode} (${ladderNorm.normClauses})${ladderTypeDesc}. ` +
        `Aprovada na inspeção visual e mecânica de integridade dos montantes, degraus, catracas e sapatas antiderrapantes. ` +
        `Atendeu ao ensaio dielétrico de ${targetVoltage} kV ${input.voltageType} por ${input.durationSeconds} segundos${segDesc}${condDesc} com suportabilidade plena sem disrupção ou perfuração, ` +
        `registrando corrente de fuga de ${input.measuredLeakageCurrent_mA.toFixed(2)} mA (${(input.measuredLeakageCurrent_mA * 1000).toFixed(0)} µA), estritamente abaixo do limite de ${appliedLimit.toFixed(2)} mA (${appliedLimit * 1000} µA).`
      );
    } else if (input.equipmentType === 'capacete_classe_b') {
      rationaleParts.push(
        `Capacete de Segurança Classe B (Classe Dielétrica 2 — Até 20.000 V) plenamente CONFORME com a ABNT NBR 8221 / ANSI Z89.1. ` +
        `Aprovado na inspeção visual do casco, carneira, jugular e suspensão, suportabilidade dielétrica a ${targetVoltage} kV ${input.voltageType} durante ${input.durationSeconds} segundos (3 minutos) após imersão em água por 24h sem perfuração ou descarga disruptiva, ` +
        `com corrente de fuga de ${input.measuredLeakageCurrent_mA.toFixed(1)} mA (estritamente abaixo do limite máximo de ${appliedLimit.toFixed(1)} mA para Classe 2 / Classe B).`
      );
    } else if (input.equipmentType === 'ferramenta_isolada') {
      // Parecer técnico completo e conclusivo já consolidado acima para ferramentas manuais isoladas
    } else {
      rationaleParts.push(
        `Equipamento plenamente CONFORME. Atendeu à inspeção visual, suportabilidade dielétrica a ${criterion.testVoltage_kV} kV ${criterion.voltageType} por ${criterion.testDurationSeconds} segundos, com corrente de fuga de ${input.measuredLeakageCurrent_mA} ${criterion.currentUnit} (abaixo do limite de ${appliedLimit} ${criterion.currentUnit} da norma ${criterion.normCode}).`
      );
    }
  }

  return {
    canEvaluate: true,
    matchedCriterion: criterion,
    isVisualConforming,
    visualFailedItems,
    isVoltageSufficient,
    isDurationSufficient,
    isWithstandPassed,
    isLeakageCurrentConforming,
    isGloveLengthApplicable,
    appliedLimit,
    appliedUnit: criterion.currentUnit,
    result,
    rationale: rationaleParts.join('\n\n'),
    recommendedRetestMonths: criterion.defaultRetestMonths,
    normReferenceClause,
    approvedOpinion: toolApprovedOpinion,
    reprovedOpinion: toolReprovedOpinion,
    toolsEvaluation
  };
}

export function getDefaultChecklistForEquipment(type: EquipmentType): ChecklistItem[] {
  const commonItems: ChecklistItem[] = [
    { id: 'chk-1', item: 'Furos, rasgos, cortes ou perfurações na superfície', status: 'conforme' },
    { id: 'chk-2', item: 'Rachaduras, trincas, ressecamento ou envelhecimento por ozônio', status: 'conforme' },
    { id: 'chk-3', item: 'Contaminação por graxa, óleo, solventes ou substâncias químicas', status: 'conforme' },
    { id: 'chk-4', item: 'Identificação do fabricante, classe de tensão e CA legíveis', status: 'conforme' },
    { id: 'chk-5', item: 'Deformações estruturais ou desgaste excessivo', status: 'conforme' }
  ];

  if (type === 'luva_isolante') {
    return [
      { id: 'chk-l1', item: 'Ensaio manual de retenção e inflamento de ar (ausência de microporos/furos - NBR 16295 item 8.2)', status: 'conforme' },
      { id: 'chk-l2', item: 'Superfície interna e externa isenta de cortes, perfurações, rasgos ou desgaste excessivo', status: 'conforme' },
      { id: 'chk-l3', item: 'Ausência de trincas, fissuras, endurecimento ou degradação por ozônio (envelhecimento)', status: 'conforme' },
      { id: 'chk-l4', item: 'Isento de impregnação de óleo, graxa, solventes ou compostos químicos condutivos', status: 'conforme' },
      { id: 'chk-l5', item: 'Marcação indelével do Fabricante, Classe de Tensão, Norma NBR 16295 e CA do MTE legíveis no punho', status: 'conforme' }
    ];
  }

  if (type === 'manta_isolante') {
    return [
      { id: 'chk-m1', item: 'Superfície 100% inspecionada contra furos, microperfurações, rasgos, cortes ou abrasão profunda (ASTM D1048)', status: 'conforme' },
      { id: 'chk-m2', item: 'Ausência de trincas, craqueamento por ozônio (corona checking), ressecamento ou perda de elasticidade', status: 'conforme' },
      { id: 'chk-m3', item: 'Isento de impregnação por óleo, graxa, solventes químicos ou partículas condutivas incrustadas', status: 'conforme' },
      { id: 'chk-m4', item: 'Ilhoses, ranhuras e reforços de borda íntegros, sem trincas, rasgos ou deformações (Styles B, C, D)', status: 'conforme' },
      { id: 'chk-m5', item: 'Identificação indelével de Fabricante, Classe de Tensão, Tipo (I/II), Norma ASTM D1048 e CA legíveis', status: 'conforme' }
    ];
  }

  if (type === 'tapete_isolante') {
    return [
      { id: 'chk-t1', item: 'Superfície integral contínua livre de bolhas, furos, rasgos, cortes, trincas ou perfurações (ASTM D178-22)', status: 'conforme' },
      { id: 'chk-t2', item: 'Padrão antiderrapante (ranhurado/xadrez) uniforme, sem delaminações, quebras ou desgaste excessivo', status: 'conforme' },
      { id: 'chk-t3', item: 'Espessura uniforme e conforme classe dielétrica (mínimo normativo ASTM D178-22 Tabela 2)', status: 'conforme' },
      { id: 'chk-t4', item: 'Ausência de impregnação de óleos minerais, solventes ou contaminações condutivas de piso', status: 'conforme' },
      { id: 'chk-t5', item: 'Gravação indelével de Fabricante, Classe de Tensão, Tipo e Norma ASTM D178-22 legíveis', status: 'conforme' }
    ];
  }

  if (type === 'escada_isolada') {
    return getLadderChecklistItems('extensivel');
  }

  if (type === 'bastao_manobra' || type === 'vara_manobra') {
    return [
      { id: 'chk-b1', item: 'Superfície de fibra de vidro lisa, polida e sem delaminações', status: 'conforme' },
      { id: 'chk-b2', item: 'Mecanismos de trava telescópica e encaixes funcionando perfeitamente', status: 'conforme' },
      { id: 'chk-b3', item: 'Cabeçote universal e parafusos de fixação sem trincas ou folgas', status: 'conforme' },
      { id: 'chk-b4', item: 'Ausência de umidade interna ou infiltração no bastão/vara', status: 'conforme' },
      { id: 'chk-b5', item: 'Identificação da tensão nominal e limites de empunhadura visíveis', status: 'conforme' }
    ];
  }

  if (type === 'capacete_classe_b') {
    return [
      { id: 'chk-c1', item: 'Casco sem trincas, furos, deformações térmicas ou impactos', status: 'conforme' },
      { id: 'chk-c2', item: 'Suspensão, carneira e jugular em perfeito estado de fixação', status: 'conforme' },
      { id: 'chk-c3', item: 'Ausência de furos não originais ou adesivos condutivos', status: 'conforme' },
      { id: 'chk-c4', item: 'Gravação indelével de Classe B e CA do MTE legíveis', status: 'conforme' },
      { id: 'chk-c5', item: 'Data de fabricação e validade do casco dentro dos limites', status: 'conforme' }
    ];
  }

  if (type === 'ferramenta_isolada') {
    return [
      { id: 'chk-f1', item: 'Camada de isolamento sem descascamento, bolhas ou cortes', status: 'conforme' },
      { id: 'chk-f2', item: 'Isolação dupla com aviso de desgaste por cor interna preservada', status: 'conforme' },
      { id: 'chk-f3', item: 'Gravação 1000V CA / 1500V CC e símbolo IEC 60900 legíveis', status: 'conforme' },
      { id: 'chk-f4', item: 'Articulações mecânicas sem folgas excessivas e sem corrosão', status: 'conforme' }
    ];
  }

  return commonItems;
}

export interface EquipmentNormPreset {
  normCode: string;
  normName: string;
  testVoltage_kV: number;
  voltageType: 'AC' | 'DC';
  testDurationSeconds: number;
  maxLeakageCurrent: number;
  currentUnit: 'mA' | 'uA';
  retestIntervalMonths: number;
  standardProcedureCode: string;
  description: string;
}

export function getNormPresetForEquipment(
  type: EquipmentType,
  dielectricClass: DielectricClass = '2'
): EquipmentNormPreset {
  switch (type) {
    case 'luva_isolante': {
      const entry = TABELA_4_NBR_16295.find(x => x.classe === dielectricClass) || TABELA_4_NBR_16295[3]; // default Class 2
      const singleLimit = entry.limitesFugaAC_mA[360] || entry.limitesFugaAC_mA[410] || 16;
      const doubleLimit = singleLimit * 2; // Dobro da Tabela 4 devido ao ensaio simultâneo de 2 luvas
      return {
        normCode: 'NBR 16295 Tabela 4',
        normName: `Luvas de Material Isolante - Classe ${dielectricClass} (2 Luvas Simultâneas)`,
        testVoltage_kV: entry.tensaoProvaAC_kV,
        voltageType: 'AC',
        testDurationSeconds: 60,
        maxLeakageCurrent: doubleLimit,
        currentUnit: 'mA',
        retestIntervalMonths: 6,
        standardProcedureCode: 'PR-JVM-LAB-01 Rev.08',
        description: `Ensaio dielétrico de prova em cuba com água conforme NBR 16295 Tabela 4 (Classe ${dielectricClass}). Limite máximo de ${doubleLimit.toFixed(1)} mA para o ensaio simultâneo de 2 luvas (${singleLimit} mA unitário da Tabela 4 × 2).`
      };
    }
    case 'manga_isolante': {
      const mangaLimits: Record<string, { kv: number; ma: number }> = {
        '0': { kv: 5, ma: 10 },
        '1': { kv: 10, ma: 14 },
        '2': { kv: 20, ma: 18 },
        '3': { kv: 30, ma: 20 },
        '4': { kv: 40, ma: 22 },
        '00': { kv: 5, ma: 10 }
      };
      const data = mangaLimits[dielectricClass] || { kv: 20, ma: 18 };
      return {
        normCode: 'ABNT NBR 10624 / ASTM D1051',
        normName: `Mangas Isolantes de Borracha - Classe ${dielectricClass}`,
        testVoltage_kV: data.kv,
        voltageType: 'AC',
        testDurationSeconds: 60,
        maxLeakageCurrent: data.ma,
        currentUnit: 'mA',
        retestIntervalMonths: 6,
        standardProcedureCode: 'PR-JVM-LAB-02 Rev.05',
        description: `Ensaio dielétrico de mangas isolantes de borracha conforme NBR 10624 e ASTM D1051 (Classe ${dielectricClass}).`
      };
    }
    case 'manta_isolante': {
      const entry = getASTMD1048Entry(dielectricClass);
      return {
        normCode: 'ASTM D1048',
        normName: `Mantas de Cobertura Isolantes (ASTM D1048) - Classe ${dielectricClass}`,
        testVoltage_kV: entry ? entry.tensaoProvaAC_kV : 20,
        voltageType: 'AC',
        testDurationSeconds: 60,
        maxLeakageCurrent: 15.0,
        currentUnit: 'mA',
        retestIntervalMonths: 12,
        standardProcedureCode: 'PR-JVM-LAB-03 Rev.04',
        description: `Ensaio dielétrico entre eletrodos planos conforme ASTM D1048 (Classe ${dielectricClass}).`
      };
    }
    case 'tapete_isolante': {
      const entry = getASTMD178Entry(dielectricClass);
      return {
        normCode: 'ASTM D178-22',
        normName: `Tapetes Isolantes de Borracha (ASTM D178-22) - Classe ${dielectricClass}`,
        testVoltage_kV: entry ? entry.tensaoProvaAC_kV : 20,
        voltageType: 'AC',
        testDurationSeconds: 60,
        maxLeakageCurrent: 100.0,
        currentUnit: 'mA',
        retestIntervalMonths: 12,
        standardProcedureCode: 'PR-JVM-LAB-04 Rev.04',
        description: `Ensaio dielétrico por segmento conforme ASTM D178-22 (Classe ${dielectricClass}). A norma ASTM D178-22 não estipula valor específico de corrente de fuga, adotando-se o patamar limite de 100 mA.`
      };
    }
    case 'bastao_manobra': {
      return {
        normCode: 'ABNT NBR 16613 / ASTM F711',
        normName: 'Bastões de Manobra e Salvamento em PRFV (100kV/30cm)',
        testVoltage_kV: 100.0,
        voltageType: 'AC',
        testDurationSeconds: 60,
        maxLeakageCurrent: 0.1,
        currentUnit: 'mA',
        retestIntervalMonths: 12,
        standardProcedureCode: 'PR-JVM-LAB-05 Rev.06',
        description: 'Ensaio de rigidez dielétrica por segmento de 300 mm com 100 kV CA por 1 minuto conforme ABNT NBR 16613 e ASTM F711.'
      };
    }
    case 'vara_manobra': {
      return {
        normCode: 'ABNT NBR 16613 / ASTM F711',
        normName: 'Varas de Manobra Telescópicas / Seccionáveis (100kV/30cm)',
        testVoltage_kV: 100.0,
        voltageType: 'AC',
        testDurationSeconds: 60,
        maxLeakageCurrent: 0.1,
        currentUnit: 'mA',
        retestIntervalMonths: 12,
        standardProcedureCode: 'PR-JVM-LAB-05 Rev.06',
        description: 'Ensaio de rigidez dielétrica de vara de manobra a 100 kV CA / 300 mm conforme ABNT NBR 16613.'
      };
    }
    case 'ferramenta_isolada': {
      return {
        normCode: 'ABNT NBR 9699 / IEC 60900',
        normName: 'Ferramentas Manuais Isoladas (1000V CA / 1500V CC)',
        testVoltage_kV: 10.0,
        voltageType: 'AC',
        testDurationSeconds: 180,
        maxLeakageCurrent: 1.0,
        currentUnit: 'mA',
        retestIntervalMonths: 12,
        standardProcedureCode: 'PR-JVM-LAB-06 Rev.04',
        description: 'Ensaio dielétrico a 10 kV CA por 3 minutos (180s) após acondicionamento em banho-maria conforme ABNT NBR 9699 / IEC 60900. Limite de fuga máximo: 1,0 mA por ferramenta ensaiada (Qtd × 1,0 mA).'
      };
    }
    case 'capacete_classe_b': {
      return {
        normCode: 'ABNT NBR 8221 / ANSI Z89.1',
        normName: 'Capacete de Segurança Classe B (Classe 2 — Até 20.000V)',
        testVoltage_kV: 20.0,
        voltageType: 'AC',
        testDurationSeconds: 180,
        maxLeakageCurrent: 9.0,
        currentUnit: 'mA',
        retestIntervalMonths: 12,
        standardProcedureCode: 'PR-JVM-LAB-07 Rev.04',
        description: 'Ensaio de rigidez dielétrica a 20 kV CA durante 3 minutos (180s) após imersão em água por 24h conforme ABNT NBR 8221 / ANSI Z89.1 (Classe Dielétrica 2).'
      };
    }
    case 'bota_dielétrica': {
      return {
        normCode: 'ABNT NBR 16603 / ASTM F2413',
        normName: 'Calçados / Botas Dielétricas de Segurança (Até 14.000V)',
        testVoltage_kV: 14.0,
        voltageType: 'AC',
        testDurationSeconds: 60,
        maxLeakageCurrent: 3.5,
        currentUnit: 'mA',
        retestIntervalMonths: 12,
        standardProcedureCode: 'PR-JVM-LAB-08 Rev.03',
        description: 'Ensaio com esferas metálicas e cuba a 14 kV CA por 1 minuto conforme ABNT NBR 16603 e ASTM F2413.'
      };
    }
    case 'escada_isolada': {
      if (dielectricClass === '00' || dielectricClass === '0' || dielectricClass?.toLowerCase().includes('bt') || dielectricClass?.toLowerCase().includes('baixa')) {
        return {
          normCode: 'EN 50528:2024',
          normName: 'Escadas de Material Isolante para Baixa Tensão (até 1.000 V CA / 1.500 V CC)',
          testVoltage_kV: 36.0,
          voltageType: 'AC',
          testDurationSeconds: 60,
          maxLeakageCurrent: 0.5,
          currentUnit: 'mA',
          retestIntervalMonths: 12,
          standardProcedureCode: 'PR-JVM-LAB-09-BT Rev.01',
          description: 'Ensaio dielétrico em montantes de PRFV a 36 kV CA por 60s conforme EN 50528:2024 (Baixa Tensão) e NR-10.'
        };
      }
      return {
        normCode: 'ABNT NBR IEC 61478 / ABNT NBR 16308',
        normName: 'Escadas Isoladas de Fibra de Vidro (PRFV) - 100kV/30cm',
        testVoltage_kV: 100.0,
        voltageType: 'AC',
        testDurationSeconds: 60,
        maxLeakageCurrent: 0.1,
        currentUnit: 'mA',
        retestIntervalMonths: 12,
        standardProcedureCode: 'PR-JVM-LAB-09 Rev.02',
        description: 'Ensaio dielétrico por segmento de 300 mm com 100 kV CA por 60s conforme ABNT NBR IEC 61478 e ABNT NBR 16308.'
      };
    }
    case 'detector_tensao': {
      // Diferenciação por classe ou padrão de elemento isolante vs carcaça
      if (dielectricClass === '3' || dielectricClass === '4') {
        return {
          normCode: 'ABNT NBR IEC 61243-1',
          normName: 'Detector de Tensão Tipo Capacitivo - Alta Tensão (36 a 138/230 kV)',
          testVoltage_kV: 100.0,
          voltageType: 'AC',
          testDurationSeconds: 60,
          maxLeakageCurrent: 1.0,
          currentUnit: 'mA',
          retestIntervalMonths: 12,
          standardProcedureCode: 'PR-JVM-LAB-10 Rev.03',
          description: 'Ensaio dielétrico de isolação da carcaça e blindagem do detector para alta tensão (100 kV CA por 60s) conforme IEC 61243-1 Cláusula 6.2.'
        };
      }
      return {
        normCode: 'ABNT NBR IEC 61243-1 / IEC 60855-1',
        normName: 'Detectores de Tensão / Prova de Ausência de Tensão (IEC 61243-1)',
        testVoltage_kV: 100.0,
        voltageType: 'AC',
        testDurationSeconds: 60,
        maxLeakageCurrent: 0.1, // 100 uA = 0.1 mA
        currentUnit: 'mA',
        retestIntervalMonths: 12,
        standardProcedureCode: 'PR-JVM-LAB-10 Rev.03',
        description: 'Ensaio de rigidez dielétrica e corrente de fuga do elemento isolante (100 kV CA / 300 mm, máx 100 µA) e teste de funcionamento do detector conforme ABNT NBR IEC 61243-1.'
      };
    }
    case 'ponteira_prova': {
      return {
        normCode: 'IEC 61010-031',
        normName: 'Ponteiras de Prova e Cabos de Ensaio',
        testVoltage_kV: 5.0,
        voltageType: 'AC',
        testDurationSeconds: 60,
        maxLeakageCurrent: 1.0,
        currentUnit: 'mA',
        retestIntervalMonths: 12,
        standardProcedureCode: 'PR-JVM-LAB-11 Rev.01',
        description: 'Ensaio de rigidez dielétrica de cabos e ponteiras conforme IEC 61010-031.'
      };
    }
    case 'outro':
    default: {
      return {
        normCode: 'NR-10 / Especificação Técnica',
        normName: 'Dispositivo Dielétrico Especial',
        testVoltage_kV: 10.0,
        voltageType: 'AC',
        testDurationSeconds: 60,
        maxLeakageCurrent: 5.0,
        currentUnit: 'mA',
        retestIntervalMonths: 12,
        standardProcedureCode: 'PR-JVM-LAB-99 Rev.01',
        description: 'Ensaio dielétrico sob diretrizes de segurança da NR-10 e catálogo do fabricante.'
      };
    }
  }
}

/**
 * Verifica se um ensaio é elegível para emissão de Certificado de Conformidade.
 * Para ferramentas manuais isoladas, se houver ao menos uma ferramenta aprovada no lote,
 * o ensaio permite a emissão do certificado exclusivo para as ferramentas aprovadas.
 */
export function isTestEligibleForCertificate(test: {
  result: string;
  equipmentType?: string;
  isolatedTools?: IsolatedToolItem[];
}): boolean {
  if (!test) return false;
  if (test.result === 'APROVADO') return true;
  if (test.equipmentType === 'ferramenta_isolada' && test.isolatedTools && test.isolatedTools.length > 0) {
    return test.isolatedTools.some(
      tool => (tool.result || 'APROVADO') === 'APROVADO' &&
              tool.visualInspection !== 'nao_conforme' &&
              tool.dielectricResult !== 'nao_conforme'
    );
  }
  return false;
}

/**
 * Retorna a lista de ferramentas manuais isoladas aprovadas de um ensaio
 */
export function getApprovedToolsFromTest(test: { isolatedTools?: IsolatedToolItem[] }): IsolatedToolItem[] {
  if (!test.isolatedTools || test.isolatedTools.length === 0) return [];
  return test.isolatedTools.filter(
    tool => (tool.result || 'APROVADO') === 'APROVADO' &&
            tool.visualInspection !== 'nao_conforme' &&
            tool.dielectricResult !== 'nao_conforme'
  );
}

/**
 * Retorna a lista de ferramentas manuais isoladas reprovadas de um ensaio
 */
export function getReprovedToolsFromTest(test: { isolatedTools?: IsolatedToolItem[] }): IsolatedToolItem[] {
  if (!test.isolatedTools || test.isolatedTools.length === 0) return [];
  return test.isolatedTools.filter(
    tool => tool.result === 'REPROVADO' ||
            tool.visualInspection === 'nao_conforme' ||
            tool.dielectricResult === 'nao_conforme'
  );
}

/**
 * Retorna a quantidade total de peças aprovadas
 */
export function getApprovedToolsCount(test: { isolatedTools?: IsolatedToolItem[] }): number {
  const approved = getApprovedToolsFromTest(test);
  return approved.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
}

/**
 * Retorna a quantidade total de peças reprovadas
 */
export function getReprovedToolsCount(test: { isolatedTools?: IsolatedToolItem[] }): number {
  const reproved = getReprovedToolsFromTest(test);
  return reproved.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
}

