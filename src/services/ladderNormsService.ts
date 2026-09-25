import { ChecklistItem, EquipmentType, TestResult } from '../types';

/**
 * ABNT NBR IEC 61478: Trabalhos em linha viva - Escadas de material isolante
 * (Equivalente internacional: IEC 61478: Live working - Ladders of insulating material)
 * 
 * ABNT NBR 16308: Escadas portáteis em material isolante de plástico reforçado com fibra de vidro (PRFV)
 * Requisitos e métodos de ensaio
 */

export type LadderType = 
  | 'extensivel' 
  | 'simples' 
  | 'tesoura' 
  | 'plataforma' 
  | 'linha_viva';

export type LadderTestMethod = 
  | 'segmento_300mm_100kv' 
  | 'montante_metro_90kv' 
  | 'entre_degraus_30kv' 
  | 'linha_viva_integral'
  | 'baixa_tensao_en50528_36kv'
  | 'baixa_tensao_en50528_degraus';

export interface LadderNormEntry {
  id: string;
  normCode: string;
  normName: string;
  edition: string;
  testMethod: LadderTestMethod;
  methodLabel: string;
  segmentLength_mm: number;
  testVoltageAC_kV: number;
  testDurationSeconds: number;
  maxLeakageCurrent_mA: number; // 0.10 mA = 100 uA
  maxLeakageCurrentWet_mA?: number; // 0.20 mA = 200 uA
  currentUnit: 'mA' | 'uA';
  withstandRequirement: string;
  retestMonths: number;
  applicableLadderTypes: LadderType[];
  description: string;
  normClauses: string;
}

export interface LadderTypeInfo {
  type: LadderType;
  label: string;
  description: string;
  commonRungs: string;
  typicalHeights: string;
  standardCapacityKg: number;
  icon: string;
}

export const LADDER_TYPES_INFO: Record<LadderType, LadderTypeInfo> = {
  extensivel: {
    type: 'extensivel',
    label: 'Escada Extensível de Fibra (PRFV)',
    description: 'Composta por lance fixo e lance móvel guiado por roldana e corda, travado por catracas de segurança.',
    commonRungs: '2x8 até 2x16 degraus (16 a 32 degraus)',
    typicalHeights: '4,20 m a 10,20 m',
    standardCapacityKg: 150,
    icon: '🪜'
  },
  simples: {
    type: 'simples',
    label: 'Escada Simples / Encosto de Fibra (PRFV)',
    description: 'Lance único para apoio e encosto direto em postes, fachadas ou estruturas elétricas.',
    commonRungs: '8 a 16 degraus',
    typicalHeights: '2,40 m a 5,40 m',
    standardCapacityKg: 120,
    icon: '🪜'
  },
  tesoura: {
    type: 'tesoura',
    label: 'Escada Tesoura / Duplo Acesso Isolada',
    description: 'Autossustentável em formato V invertido com tirantes de segurança e degraus em um ou ambos os lados.',
    commonRungs: '4 a 12 degraus',
    typicalHeights: '1,20 m a 3,60 m',
    standardCapacityKg: 150,
    icon: '🪜'
  },
  plataforma: {
    type: 'plataforma',
    label: 'Escada Plataforma / Pódio Isolada',
    description: 'Estrutura com guarda-corpo de proteção superior e plataforma antiderrapante para manutenção industrial.',
    commonRungs: '3 a 8 degraus com plataforma',
    typicalHeights: '1,50 m a 3,00 m',
    standardCapacityKg: 150,
    icon: '🪜'
  },
  linha_viva: {
    type: 'linha_viva',
    label: 'Escada Estrutural de Linha Viva (Alta Tensão)',
    description: 'Montantes tubulares em PRFV de alta pureza com ganchos superiores para subestações e linhas de transmissão.',
    commonRungs: 'Seções modulares acopláveis',
    typicalHeights: '3,00 m a 8,00 m',
    standardCapacityKg: 150,
    icon: '⚡'
  }
};

export const LADDER_TEST_METHODS_INFO: Record<LadderTestMethod, { label: string; norm: string; voltage: string; distance: string; limit: string }> = {
  segmento_300mm_100kv: {
    label: 'Ensaio Dielétrico por Segmento (100 kV CA / 300 mm)',
    norm: 'ABNT NBR IEC 61478 (Item 6.3) / ABNT NBR 16308',
    voltage: '100 kV CA (60 Hz)',
    distance: '300 mm (30 cm) entre eletrodos',
    limit: '≤ 0,10 mA (100 µA) seco / ≤ 0,20 mA úmido'
  },
  montante_metro_90kv: {
    label: 'Ensaio Dielétrico por Metro Linear (90 kV CA / 1000 mm)',
    norm: 'ABNT NBR 16308 (Item 5.4.2)',
    voltage: '90 kV CA (60 Hz)',
    distance: '1.000 mm (1 metro linear de montante)',
    limit: '≤ 0,50 mA (500 µA)'
  },
  entre_degraus_30kv: {
    label: 'Ensaio Dielétrico Entre Degraus Adjacentes (30 kV CA / 300 mm)',
    norm: 'ABNT NBR 16308 (Item 5.4.3)',
    voltage: '30 kV CA (60 Hz)',
    distance: 'Distância entre centros de degraus consecutivos',
    limit: '≤ 0,30 mA (300 µA)'
  },
  linha_viva_integral: {
    label: 'Ensaio de Linha Viva Categoria 1 e 2 (Tensão de Serviço)',
    norm: 'ABNT NBR IEC 61478 (Item 6.4 / Categoria 1 e 2)',
    voltage: '100 kV CA por 300 mm (Rigidez) / Tensão Nominal',
    distance: 'Segmentos contínuos e ensaio de corpo inteiro',
    limit: '≤ 0,10 mA (100 µA)'
  },
  baixa_tensao_en50528_36kv: {
    label: 'Ensaio Dielétrico em Escadas de Baixa Tensão (36 kV CA / EN 50528:2024)',
    norm: 'EN 50528:2024 (Cláusula 5.7)',
    voltage: '36 kV CA (50/60 Hz)',
    distance: 'Montantes isolantes (300 mm a 1.000 mm)',
    limit: '≤ 0,50 mA (500 µA) seco / ≤ 1,00 mA úmido'
  },
  baixa_tensao_en50528_degraus: {
    label: 'Ensaio Entre Degraus Adjacentes em Baixa Tensão (36 kV CA / EN 50528:2024)',
    norm: 'EN 50528:2024 (Cláusula 5.7.3)',
    voltage: '36 kV CA (50/60 Hz)',
    distance: 'Distância entre degraus consecutivos',
    limit: '≤ 0,30 mA (300 µA)'
  }
};

/**
 * Tabela Normativa Consolidada de Critérios para Escadas de Fibra de Vidro (PRFV)
 * Conforme ABNT NBR IEC 61478, ABNT NBR 16308 e EN 50528:2024
 */
export const TABELA_NORMAS_ESCADAS_FIBRA: LadderNormEntry[] = [
  // EN 50528:2024 - Escadas Isolantes para Baixa Tensão (≤ 1.000 V CA / ≤ 1.500 V CC)
  {
    id: 'norm-escada-en-50528-2024-bt-36kv',
    normCode: 'EN 50528:2024',
    normName: 'Escadas de Material Isolante para Baixa Tensão (até 1.000 V CA / 1.500 V CC) - Ensaio Dielétrico a 36 kV CA',
    edition: 'EN 50528:2024 (Vigente / Substitui EN 50528:2010)',
    testMethod: 'baixa_tensao_en50528_36kv',
    methodLabel: 'Rigidez Dielétrica em Montantes Isolantes para Baixa Tensão (36 kV CA / 60s)',
    segmentLength_mm: 300,
    testVoltageAC_kV: 36.0,
    testDurationSeconds: 60,
    maxLeakageCurrent_mA: 0.50, // 500 uA
    maxLeakageCurrentWet_mA: 1.00, // 1000 uA
    currentUnit: 'mA',
    withstandRequirement: 'Sem disrupção superficial (flashover), perfuração dielétrica nos montantes de PRFV nem centelhamento destrutivo.',
    retestMonths: 12,
    applicableLadderTypes: ['extensivel', 'simples', 'tesoura', 'plataforma'],
    description: 'Norma Técnica EN 50528:2024 específica para escadas portáteis com montantes totalmente confeccionados em material isolante (PRFV/fibra de vidro) para uso em ou próximo a instalações de Baixa Tensão (BT até 1.000 V CA e 1.500 V CC). A tensão de ensaio foi atualizada para 36 kV CA durante 60 segundos nos montantes isolantes.',
    normClauses: 'EN 50528:2024 Cláusula 5.7 / EN 131 / NR-10 Item 10.7.8'
  },
  {
    id: 'norm-escada-en-50528-2024-degraus-36kv',
    normCode: 'EN 50528:2024',
    normName: 'Escadas Isolantes para Baixa Tensão - Ensaio Entre Degraus Consecutivos (36 kV CA)',
    edition: 'EN 50528:2024 (Vigente)',
    testMethod: 'baixa_tensao_en50528_degraus',
    methodLabel: 'Ensaio Dielétrico Entre Degraus Adjacentes em Baixa Tensão (36 kV CA)',
    segmentLength_mm: 300,
    testVoltageAC_kV: 36.0,
    testDurationSeconds: 60,
    maxLeakageCurrent_mA: 0.30, // 300 uA
    currentUnit: 'mA',
    withstandRequirement: 'Isolação segura entre pontos de fixação mecânica/cravamento dos degraus sob 36 kV CA sem centelhamento.',
    retestMonths: 12,
    applicableLadderTypes: ['extensivel', 'simples', 'tesoura', 'plataforma'],
    description: 'Ensaio dielétrico entre degraus sucessivos para comprovar que os rebites e cravamentos mecânicos não criam caminhos condutivos perigosos para o operador em baixa tensão.',
    normClauses: 'EN 50528:2024 Cláusula 5.7.3 / NR-10'
  },
  {
    id: 'norm-escada-nbr-iec-61478-100kv',
    normCode: 'ABNT NBR IEC 61478 / ABNT NBR 16308',
    normName: 'Escadas de Material Isolante em Fibra de Vidro (PRFV) - Ensaio Dielétrico por Segmento (100 kV CA / 300 mm)',
    edition: 'ABNT NBR IEC 61478:2018 / ABNT NBR 16308:2014',
    testMethod: 'segmento_300mm_100kv',
    methodLabel: 'Rigidez Dielétrica por Segmento de 300 mm (100 kV CA)',
    segmentLength_mm: 300,
    testVoltageAC_kV: 100.0,
    testDurationSeconds: 60,
    maxLeakageCurrent_mA: 0.10, // 100 uA
    maxLeakageCurrentWet_mA: 0.20, // 200 uA
    currentUnit: 'mA',
    withstandRequirement: 'Suportabilidade sem disrupção (flashover), perfuração dielétrica nem aquecimento perceptível ao toque.',
    retestMonths: 12,
    applicableLadderTypes: ['extensivel', 'simples', 'tesoura', 'plataforma', 'linha_viva'],
    description: 'Ensaio normativo padrão de laboratório aplicado em todos os segmentos dos montantes (longerons) de fibra de vidro com eletrodos espaçados a 300 mm sob 100 kV CA 60Hz durante 60 segundos. Corrente de fuga não deve ultrapassar 100 µA (0,10 mA) a seco.',
    normClauses: 'ABNT NBR IEC 61478:2018 Seção 6 / ABNT NBR 16308:2014 Item 5.4.1 / NR-10 Item 10.7.8'
  },
  {
    id: 'norm-escada-nbr-16308-metro-90kv',
    normCode: 'ABNT NBR 16308',
    normName: 'Escadas Portáteis em Fibra de Vidro (PRFV) - Ensaio por Metro Linear (90 kV CA / 1000 mm)',
    edition: 'ABNT NBR 16308:2014',
    testMethod: 'montante_metro_90kv',
    methodLabel: 'Ensaio de Suportabilidade Dielétrica por Metro Linear (90 kV CA)',
    segmentLength_mm: 1000,
    testVoltageAC_kV: 90.0,
    testDurationSeconds: 60,
    maxLeakageCurrent_mA: 0.50, // 500 uA
    currentUnit: 'mA',
    withstandRequirement: 'Ausência de centelhamento, descargas disruptivas superficiais ou perfuração do perfil de PRFV.',
    retestMonths: 12,
    applicableLadderTypes: ['extensivel', 'simples', 'tesoura', 'plataforma'],
    description: 'Ensaio dielétrico contínuo de 90 kV CA por metro linear de montante isolante por 60 segundos. Corrente de fuga máxima permitida de 0,50 mA (500 µA).',
    normClauses: 'ABNT NBR 16308:2014 Item 5.4.2 / NR-10'
  },
  {
    id: 'norm-escada-nbr-16308-degraus-30kv',
    normCode: 'ABNT NBR 16308',
    normName: 'Escadas Portáteis em Fibra de Vidro (PRFV) - Ensaio Entre Degraus Adjacentes (30 kV CA)',
    edition: 'ABNT NBR 16308:2014',
    testMethod: 'entre_degraus_30kv',
    methodLabel: 'Ensaio Dielétrico Entre Degraus Consecutivos (30 kV CA)',
    segmentLength_mm: 300,
    testVoltageAC_kV: 30.0,
    testDurationSeconds: 60,
    maxLeakageCurrent_mA: 0.30, // 300 uA
    currentUnit: 'mA',
    withstandRequirement: 'Isolação segura entre pontos de fixação dos degraus nos montantes, sem centelhamento nos rebites/cravamentos.',
    retestMonths: 12,
    applicableLadderTypes: ['extensivel', 'simples', 'tesoura', 'plataforma'],
    description: 'Ensaio dielétrico aplicado entre os degraus de fixação mecânica com 30 kV CA por 60 segundos. Corrente de fuga máxima de 0,30 mA.',
    normClauses: 'ABNT NBR 16308:2014 Item 5.4.3 / NR-10'
  },
  {
    id: 'norm-escada-nbr-iec-61478-linha-viva',
    normCode: 'ABNT NBR IEC 61478',
    normName: 'Escadas de Linha Viva para Alta Tensão - Categoria 1 e Categoria 2 (Trabalhos em Tensão)',
    edition: 'ABNT NBR IEC 61478:2018',
    testMethod: 'linha_viva_integral',
    methodLabel: 'Ensaio de Rigidez Dielétrica para Trabalhos em Linha Viva (100 kV CA / 300 mm)',
    segmentLength_mm: 300,
    testVoltageAC_kV: 100.0,
    testDurationSeconds: 60,
    maxLeakageCurrent_mA: 0.10, // 100 uA
    maxLeakageCurrentWet_mA: 0.20,
    currentUnit: 'mA',
    withstandRequirement: 'Sem perfuração dielétrica, aquecimento ou fuga de corrente progressiva em linha viva.',
    retestMonths: 6, // 6 meses para trabalhos de alta severidade em linha viva
    applicableLadderTypes: ['linha_viva', 'extensivel'],
    description: 'Critério rigoroso para escadas utilizadas em contato direto ou potencial em linhas de transmissão e subestações. Periodicidade recomendada de 6 meses.',
    normClauses: 'ABNT NBR IEC 61478:2018 Seção 6.4 / NR-10 Item 10.7.8'
  }
];

/**
 * Retorna o checklist de inspeção visual e mecânica detalhado para Escadas de Fibra (PRFV)
 * Conforme exigências da ABNT NBR IEC 61478 e ABNT NBR 16308
 */
export function getLadderChecklistItems(ladderType: LadderType = 'extensivel'): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      id: 'chk-esc-1',
      item: 'Montantes (longerons) em PRFV lisos, sem trincas, delaminações, fibras expostas/desfiadas ou queimas por arco elétrico (ABNT NBR IEC 61478 item 6.2 / NBR 16308 item 5.2)',
      status: 'conforme'
    },
    {
      id: 'chk-esc-2',
      item: 'Degraus estriados antiderrapantes íntegros, sem trincas, amassamentos e firmemente cravados/rebitados sem folgas ou rotação nos montantes (NBR 16308 item 5.2.3)',
      status: 'conforme'
    },
    {
      id: 'chk-esc-3',
      item: 'Sapatas articuladas de borracha antiderrapante e ponteiras de apoio íntegras, sem desgaste excessivo, ressecamento, cortes ou folgas nos eixos de fixação',
      status: 'conforme'
    }
  ];

  if (ladderType === 'extensivel') {
    items.push(
      {
        id: 'chk-esc-4',
        item: 'Conjunto de catracas de travamento em alumínio/náilon reforçado e travas de segurança com molas atuando perfeitamente e com engate seguro (NBR 16308 item 5.2.5)',
        status: 'conforme'
      },
      {
        id: 'chk-esc-5',
        item: 'Corda de polipropileno/poliéster e roldana guia sem desfiamento, sem nós indevidos, ressecamento ou travamento mecânico',
        status: 'conforme'
      },
      {
        id: 'chk-esc-6',
        item: 'Guias de alumínio e limitadores de curso dos lances fixo e móvel sem folgas excessivas, empenamento ou travamento',
        status: 'conforme'
      }
    );
  } else if (ladderType === 'tesoura' || ladderType === 'plataforma') {
    items.push(
      {
        id: 'chk-esc-4-t',
        item: 'Tirantes articulados de travamento de abertura e limitadores de curso sem folgas, empenamentos ou corrosão',
        status: 'conforme'
      },
      {
        id: 'chk-esc-5-t',
        item: 'Plataforma/patamar superior antiderrapante e guarda-corpo íntegros e sem deformações estruturais',
        status: 'conforme'
      }
    );
  } else if (ladderType === 'linha_viva') {
    items.push(
      {
        id: 'chk-esc-4-lv',
        item: 'Ganchos superiores giratórios de sustentação e ferragens de ancoragem em liga leve sem trincas, folgas ou fissuras de fadiga (ABNT NBR IEC 61478)',
        status: 'conforme'
      },
      {
        id: 'chk-esc-5-lv',
        item: 'Pinos de engate rápido, correntes de segurança e cintas de amarração sem desgaste ou corrosão',
        status: 'conforme'
      }
    );
  }

  items.push(
    {
      id: 'chk-esc-7',
      item: 'Superfície tratada com verniz poliuretano protetor anti-UV íntegro, limpa e isenta de umidade, óleos, graxas ou partículas condutivas incrustadas',
      status: 'conforme'
    },
    {
      id: 'chk-esc-8',
      item: 'Identificação indelével com fabricante, modelo, número de série/patrimônio, capacidade de carga nominal (120/150 kg) e normas ABNT NBR IEC 61478 / ABNT NBR 16308 legíveis',
      status: 'conforme'
    }
  );

  return items;
}

/**
 * Busca uma entrada de critério normativo de escada por tipo ou método
 */
export function getLadderNormEntry(
  testMethod: LadderTestMethod = 'segmento_300mm_100kv'
): LadderNormEntry {
  return (
    TABELA_NORMAS_ESCADAS_FIBRA.find(n => n.testMethod === testMethod) ||
    TABELA_NORMAS_ESCADAS_FIBRA[0]
  );
}

/**
 * Avalia o ensaio dielétrico de escadas em fibra de vidro conforme normas ABNT NBR IEC 61478 e ABNT NBR 16308
 */
export function evaluateLadderDielectricTest(params: {
  appliedVoltage_kV: number;
  durationSeconds: number;
  measuredLeakageCurrent_mA: number;
  withstandWithoutPuncture: boolean;
  testMethod?: LadderTestMethod;
  ladderType?: LadderType;
  testedSegmentsCount?: number;
  moistureConditioned?: boolean;
  visualChecklist: ChecklistItem[];
}): {
  result: TestResult;
  rationale: string;
  isVisualConforming: boolean;
  visualFailedItems: string[];
  isVoltageSufficient: boolean;
  isDurationSufficient: boolean;
  isLeakageConforming: boolean;
  appliedLimit_mA: number;
  normReference: string;
  recommendedRetestMonths: number;
} {
  const method = params.testMethod || 'segmento_300mm_100kv';
  const normEntry = getLadderNormEntry(method);

  // 1. Checklist Visual e Mecânico
  const visualFailedItems: string[] = [];
  params.visualChecklist.forEach(item => {
    if (item.status === 'nao_conforme') {
      visualFailedItems.push(item.item + (item.observation ? ` (${item.observation})` : ''));
    }
  });
  const isVisualConforming = visualFailedItems.length === 0;

  // 2. Limite de Corrente de Fuga
  const appliedLimit_mA = params.moistureConditioned && normEntry.maxLeakageCurrentWet_mA
    ? normEntry.maxLeakageCurrentWet_mA
    : normEntry.maxLeakageCurrent_mA;

  // 3. Verificações Técnicas
  const isVoltageSufficient = params.appliedVoltage_kV >= (normEntry.testVoltageAC_kV * 0.98);
  const isDurationSufficient = params.durationSeconds >= (normEntry.testDurationSeconds - 1);
  const isLeakageConforming = params.measuredLeakageCurrent_mA <= appliedLimit_mA;
  const isWithstandPassed = params.withstandWithoutPuncture;

  let result: TestResult = 'APROVADO';
  const rationaleParts: string[] = [];

  if (!isVisualConforming) {
    result = 'REPROVADO';
    rationaleParts.push(`Reprovado na inspeção visual/mecânica da escada de fibra: ${visualFailedItems.join('; ')}.`);
  }

  if (!isWithstandPassed) {
    result = 'REPROVADO';
    rationaleParts.push('Ocorreu descarga disruptiva superficial (flashover) ou perfuração dielétrica na fibra de vidro (PRFV) durante a aplicação de alta tensão.');
  }

  if (!isVoltageSufficient) {
    result = 'REPROVADO';
    rationaleParts.push(`Tensão de ensaio aplicada (${params.appliedVoltage_kV} kV) inferior à exigência normativa (${normEntry.testVoltageAC_kV} kV).`);
  }

  if (!isDurationSufficient) {
    result = 'REPROVADO';
    rationaleParts.push(`Tempo de aplicação (${params.durationSeconds}s) inferior ao tempo normativo (${normEntry.testDurationSeconds}s).`);
  }

  if (!isLeakageConforming) {
    result = 'REPROVADO';
    rationaleParts.push(
      `Corrente de fuga medida (${params.measuredLeakageCurrent_mA.toFixed(2)} mA) excedeu o limite máximo normativo de ${appliedLimit_mA.toFixed(2)} mA (${appliedLimit_mA * 1000} µA) estabelecido na ${normEntry.normCode}.`
    );
  }

  const segmentsText = params.testedSegmentsCount ? ` em ${params.testedSegmentsCount} segmentos testados` : '';
  const conditionText = params.moistureConditioned ? ' sob condicionamento de umidade' : ' a seco';

  if (result === 'APROVADO') {
    rationaleParts.push(
      `Escada de Fibra de Vidro (PRFV) plenamente CONFORME com as normas ${normEntry.normCode} (${normEntry.normClauses}). ` +
      `Aprovada na inspeção visual e mecânica de integridade dos montantes, degraus, catracas e sapatas. ` +
      `Atendeu à suportabilidade dielétrica a ${normEntry.testVoltageAC_kV} kV CA por ${normEntry.testDurationSeconds} segundos${segmentsText}${conditionText} sem disrupção superficial nem perfuração, ` +
      `com corrente de fuga de ${params.measuredLeakageCurrent_mA.toFixed(2)} mA (${(params.measuredLeakageCurrent_mA * 1000).toFixed(0)} µA), abaixo do limite máximo de ${appliedLimit_mA.toFixed(2)} mA (${appliedLimit_mA * 1000} µA).`
    );
  }

  return {
    result,
    rationale: rationaleParts.join(' '),
    isVisualConforming,
    visualFailedItems,
    isVoltageSufficient,
    isDurationSufficient,
    isLeakageConforming,
    appliedLimit_mA,
    normReference: normEntry.normCode,
    recommendedRetestMonths: normEntry.retestMonths
  };
}
