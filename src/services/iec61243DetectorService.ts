/**
 * ABNT NBR IEC 61243-1 / IEC 61243-1:2020 (Vigente)
 * Trabalhos em Linha Viva — Detectores de Tensão — Parte 1: Tipo Capacitivo para uso em tensões superiores a 1 kV c.a.
 * (Live working - Voltage detectors - Part 1: Capacitive type to be used for voltages exceeding 1 kV a.c.)
 * 
 * Normas correlatas:
 * - IEC 60855-1: Tubos e bastões de material isolante preenchidos com espuma para trabalhos em tensão
 * - ABNT NBR 16603: Tubos e bastões isolantes para sistemas de potência
 * - NR-10: Segurança em Instalações e Serviços em Eletricidade (Item 10.7.8)
 */

export type DetectorVoltageRangeCategory = 
  | 'distribuicao_mt_1_36kv' 
  | 'subtransmissao_at_36_138kv' 
  | 'transmissao_eat_138_500kv'
  | 'especial_multi_escala';

export type DetectorClimaticCategory = 'N' | 'S' | 'W';

export interface IEC61243DetectorNormEntry {
  id: string;
  testItem: string;
  targetComponent: 'haste_isolante' | 'carcaca_detector' | 'limiar_sensibilidade' | 'autoteste_sinalizacao' | 'eletrodo_contato';
  componentLabel: string;
  voltageRangeCategory: DetectorVoltageRangeCategory;
  nominalRangeLabel: string;
  nominalVoltageMin_kV: number;
  nominalVoltageMax_kV: number;
  testVoltage_kV: number;
  voltageType: 'AC' | 'DC';
  testDurationSeconds: number;
  maxLeakageCurrent_mA: number;
  maxLeakageCurrent_uA: number;
  currentUnit: 'mA' | 'uA';
  thresholdMinPercent: number; // 15%
  thresholdMaxPercent: number; // 45%
  minSoundPressure_dBA: number; // 70 dBA a 2m
  retestIntervalMonths: number;
  standardProcedureCode: string;
  approvalCriteria: string;
  normClause: string;
  notes: string;
}

export const IEC_61243_1_TABLE: IEC61243DetectorNormEntry[] = [
  {
    id: 'iec-61243-1-haste-300mm-100kv',
    testItem: 'Rigidez Dielétrica e Isolação do Elemento / Haste Isolante de Prolongamento',
    targetComponent: 'haste_isolante',
    componentLabel: 'Elemento Isolante / Haste de Prolongamento (PRFV / Resina Epóxi)',
    voltageRangeCategory: 'distribuicao_mt_1_36kv',
    nominalRangeLabel: '1 kV a 765 kV CA (Universal)',
    nominalVoltageMin_kV: 1.0,
    nominalVoltageMax_kV: 765.0,
    testVoltage_kV: 100.0,
    voltageType: 'AC',
    testDurationSeconds: 60,
    maxLeakageCurrent_mA: 0.10, // 100 uA
    maxLeakageCurrent_uA: 100,
    currentUnit: 'mA',
    thresholdMinPercent: 0,
    thresholdMaxPercent: 0,
    minSoundPressure_dBA: 0,
    retestIntervalMonths: 12,
    standardProcedureCode: 'PR-JVM-LAB-10 Rev.03',
    approvalCriteria: 'Sem disrupção, perfuração ou centelhamento superficial (flashover) ao longo dos 300 mm. Corrente de fuga ≤ 100 µA a seco (≤ 200 µA úmido).',
    normClause: 'IEC 61243-1 Cláusula 6.4 & IEC 60855-1',
    notes: 'Ensaio dielétrico aplicado a cada segmento de 300 mm do elemento isolante com 100 kV CA (60 Hz) por 60 segundos com medição precisa de microamperímetro.'
  },
  {
    id: 'iec-61243-1-carcaca-mt-40kv',
    testItem: 'Rigidez Dielétrica da Carcaça e Cabeçote do Detector (Média Tensão)',
    targetComponent: 'carcaca_detector',
    componentLabel: 'Carcaça Plástica e Ponta de Contato do Detector (Média Tensão)',
    voltageRangeCategory: 'distribuicao_mt_1_36kv',
    nominalRangeLabel: '1 kV a 36 kV CA (Média Tensão)',
    nominalVoltageMin_kV: 1.0,
    nominalVoltageMax_kV: 36.0,
    testVoltage_kV: 40.0,
    voltageType: 'AC',
    testDurationSeconds: 60,
    maxLeakageCurrent_mA: 0.50, // 500 uA
    maxLeakageCurrent_uA: 500,
    currentUnit: 'mA',
    thresholdMinPercent: 15,
    thresholdMaxPercent: 45,
    minSoundPressure_dBA: 70,
    retestIntervalMonths: 12,
    standardProcedureCode: 'PR-JVM-LAB-10 Rev.03',
    approvalCriteria: 'Sem disrupção dielétrica da carcaça plástica externa. Corrente de fuga máx 0,50 mA a 40 kV CA por 60s.',
    normClause: 'IEC 61243-1 Cláusula 6.2.2',
    notes: 'Ensaio de isolamento da carcaça do detector com eletrodos condutivos envolventes simulando contato com partes aterradas ou vizinhas.'
  },
  {
    id: 'iec-61243-1-carcaca-at-100kv',
    testItem: 'Rigidez Dielétrica da Carcaça e Cabeçote do Detector (Alta Tensão)',
    targetComponent: 'carcaca_detector',
    componentLabel: 'Carcaça e Blindagem do Cabeçote (Alta Tensão / Subestações)',
    voltageRangeCategory: 'subtransmissao_at_36_138kv',
    nominalRangeLabel: '36 kV a 138 kV / 230 kV CA (Alta Tensão)',
    nominalVoltageMin_kV: 36.0,
    nominalVoltageMax_kV: 138.0,
    testVoltage_kV: 100.0,
    voltageType: 'AC',
    testDurationSeconds: 60,
    maxLeakageCurrent_mA: 1.00, // 1000 uA
    maxLeakageCurrent_uA: 1000,
    currentUnit: 'mA',
    thresholdMinPercent: 15,
    thresholdMaxPercent: 45,
    minSoundPressure_dBA: 70,
    retestIntervalMonths: 12,
    standardProcedureCode: 'PR-JVM-LAB-10 Rev.03',
    approvalCriteria: 'Sem perfuração ou centelhamento na blindagem ou carcaça externa com 100 kV CA por 60s. Corrente de fuga ≤ 1,00 mA.',
    normClause: 'IEC 61243-1 Cláusula 6.2.3',
    notes: 'Ensaio dielétrico para detectores capacitivos de alta tensão utilizados em subestações de 69 kV, 138 kV e 230 kV.'
  },
  {
    id: 'iec-61243-1-limiar-sensibilidade-15-45',
    testItem: 'Ensaio de Tensão Limiar de Resposta (Sensibilidade de Detecção)',
    targetComponent: 'limiar_sensibilidade',
    componentLabel: 'Circuito Eletrônico de Detecção de Campo Elétrico Capacitivo',
    voltageRangeCategory: 'distribuicao_mt_1_36kv',
    nominalRangeLabel: '15% a 45% da Tensão Nominal Mínima (Un_mín)',
    nominalVoltageMin_kV: 1.0,
    nominalVoltageMax_kV: 36.0,
    testVoltage_kV: 6.2, // Exemplo referencial
    voltageType: 'AC',
    testDurationSeconds: 30,
    maxLeakageCurrent_mA: 0.50,
    maxLeakageCurrent_uA: 500,
    currentUnit: 'mA',
    thresholdMinPercent: 15,
    thresholdMaxPercent: 45,
    minSoundPressure_dBA: 70,
    retestIntervalMonths: 12,
    standardProcedureCode: 'PR-JVM-LAB-10 Rev.03',
    approvalCriteria: 'Ativação inequívoca e imediata (< 1s) dos sinais acústico e óptico entre 15% e 45% de Un_mín. Não ativação abaixo de 10% de Un_mín.',
    normClause: 'IEC 61243-1 Cláusula 4.3 & 6.1',
    notes: 'Garante que o detector não gere falso negativo em tensão nominal nem falso positivo em tensões induzidas de baixa magnitude.'
  },
  {
    id: 'iec-61243-1-autoteste-sinais',
    testItem: 'Verificação do Dispositivo de Autoteste Integrado e Sinalização Acústica / Óptica',
    targetComponent: 'autoteste_sinalizacao',
    componentLabel: 'Botão de Teste Interno, Buzzer Piezolétrico e LED de Alta Potência',
    voltageRangeCategory: 'distribuicao_mt_1_36kv',
    nominalRangeLabel: 'Todas as Classes / Faixas de Tensão',
    nominalVoltageMin_kV: 1.0,
    nominalVoltageMax_kV: 765.0,
    testVoltage_kV: 0.0,
    voltageType: 'AC',
    testDurationSeconds: 15,
    maxLeakageCurrent_mA: 0.0,
    maxLeakageCurrent_uA: 0,
    currentUnit: 'mA',
    thresholdMinPercent: 0,
    thresholdMaxPercent: 0,
    minSoundPressure_dBA: 70,
    retestIntervalMonths: 12,
    standardProcedureCode: 'PR-JVM-LAB-10 Rev.03',
    approvalCriteria: 'Pressão acústica ≥ 70 dB(A) a 2 metros de distância e sinal luminoso visível sob iluminação solar ambiente de 8.000 lux.',
    normClause: 'IEC 61243-1 Cláusula 4.4 & 4.5',
    notes: 'Verificação funcional com oscilador interno acionado pelo botão de autoteste antes e após os ensaios de alta tensão.'
  }
];

export const IEC_61243_CLIMATIC_CATEGORIES = [
  {
    code: 'N' as DetectorClimaticCategory,
    name: 'Categoria N (Normal)',
    temperatureRange: '-25 °C a +55 °C',
    humidity: 'Até 96% UR sem condensação extrema',
    description: 'Uso em ambientes internos e externos sob clima temperado e tropical padrão.'
  },
  {
    code: 'S' as DetectorClimaticCategory,
    name: 'Categoria S (Severa)',
    temperatureRange: '-40 °C a +55 °C',
    humidity: 'Resistência a choque térmico severo e congelamento',
    description: 'Para operação em instalações sob temperaturas extremas de frio ou montanha.'
  },
  {
    code: 'W' as DetectorClimaticCategory,
    name: 'Categoria W (Resistente à Chuva / Umidade)',
    temperatureRange: '-25 °C a +55 °C',
    humidity: 'Resistente a condensação líquida, respingos e chuva forte',
    description: 'Detector com vedação IPX4/IPX5 para operações sob intempéries e chuva.'
  }
];

export const IEC_61243_TEST_STEPS = [
  {
    step: 1,
    title: 'Inspeção Visual & Autoteste Prévio (Item 8.1 / 4.4)',
    desc: 'Verificar integridade da carcaça plástica, ausência de fissuras, limpeza do eletrodo de contato, estado da rosca universal de acoplamento e acionar botão de autoteste (sinal óptico LED e alarme sonoro contínuo).'
  },
  {
    step: 2,
    title: 'Ensaio Dielétrico do Elemento Isolante / Haste (100 kV / 300 mm)',
    desc: 'Posicionar os eletrodos de ensaio anulares espaçados em 300 mm ao longo do tubo/haste isolante. Aplicar 100 kV CA 60Hz por 60 segundos. Corrente de fuga máxima permitida de 100 µA (0,10 mA).'
  },
  {
    step: 3,
    title: 'Ensaio de Rigidez Dielétrica da Carcaça do Detector (40 kV a 100 kV CA)',
    desc: 'Envolver o corpo do detector com manta metálica condutiva aterrada e aplicar tensão de prova proporcional à faixa (40 kV CA para MT, 100 kV CA para AT) por 60 segundos.'
  },
  {
    step: 4,
    title: 'Ensaio de Sensibilidade e Tensão Limiar de Resposta (15% a 45% Un)',
    desc: 'Elevar gradualmente a tensão a partir de 0 kV até a detecção clara. O acionamento obrigatório dos alarmes deve ocorrer na faixa de 15% a 45% da tensão nominal mínima da escala.'
  },
  {
    step: 5,
    title: 'Autoteste Posterior & Medição de Pressão Sonora (≥ 70 dB(A))',
    desc: 'Confirmar a integridade funcional do circuito após os ensaios dielétricos com medidor de nível de pressão sonora a 2 metros e verificação do LED sob luz direta.'
  }
];

/**
 * Calcula a faixa permitida de tensão limiar de resposta conforme IEC 61243-1
 */
export function calculateIEC61243ThresholdRange(nominalVoltageMin_kV: number): {
  minThreshold_kV: number;
  maxThreshold_kV: number;
  nonActuationMax_kV: number;
} {
  return {
    minThreshold_kV: parseFloat((nominalVoltageMin_kV * 0.15).toFixed(2)),
    maxThreshold_kV: parseFloat((nominalVoltageMin_kV * 0.45).toFixed(2)),
    nonActuationMax_kV: parseFloat((nominalVoltageMin_kV * 0.10).toFixed(2))
  };
}
