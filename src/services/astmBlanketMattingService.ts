import { DielectricClass, EquipmentType } from '../types';

/**
 * ASTM D1048-14 (Standard Specification for Rubber Insulating Blankets)
 * Mantas e Lençóis Isolantes de Borracha para Trabalhos em Tensão
 * 
 * ASTM D178-22 (Standard Specification for Rubber Insulating Matting)
 * Tapetes Isolantes de Borracha para Áreas de Painéis e Subestações
 */

export type BlanketType = 'Type I' | 'Type II';
export type BlanketStyle = 'Style A' | 'Style B' | 'Style C' | 'Style D';
export type MattingSurface = 'Corrugada' | 'Xadrez' | 'Lisa';
export type BlanketMattingTestMethod = 'ensaio_prova_ac' | 'ensaio_prova_dc' | 'rigidez_dieletrica_ac' | 'rigidez_dieletrica_dc';

export interface ASTMD1048TableEntry {
  classe: DielectricClass;
  // Limites de Tensão Máxima de Uso
  tensaoMaximaUsoAC_kV: number; // rms
  tensaoMaximaUsoDC_kV: number; // avg

  // Ensaio de Prova (Proof Test) - 60s
  tensaoProvaAC_kV: number; // rms
  tensaoProvaDC_kV: number; // avg

  // Tensão de Rigidez Dielétrica / Ruptura (Breakdown Voltage)
  tensaoRigidezAC_kV: number; // rms
  tensaoRigidezDC_kV: number; // avg

  // Espessura nominal e tolerâncias conforme Tabela 2 (mm)
  espessuraMin_mm: number;
  espessuraMax_mm: number;

  // Distância mínima de folga para evitar arco superficial (Flashover Clearance)
  distanciaBordaEletrodo_mm: number;
  distanciaBordaEletrodo_pol: string;
}

export interface ASTMD178TableEntry {
  classe: DielectricClass;
  // Limites de Tensão Máxima de Uso
  tensaoMaximaUsoAC_kV: number; // rms
  tensaoMaximaUsoDC_kV: number; // avg

  // Ensaio de Prova (Proof Test) - 60s
  tensaoProvaAC_kV: number; // rms
  tensaoProvaDC_kV: number; // avg

  // Tensão de Rigidez Dielétrica Mínima (Breakdown Voltage)
  tensaoRigidezAC_kV: number; // rms
  tensaoRigidezDC_kV: number; // avg

  // Espessura mínima conforme Tabela 2 (mm)
  espessuraMinima_mm: number;
  espessuraMinima_pol: string;

  // Limite de corrente de fuga adotado (ASTM D178 não estipula valor de fuga, adotando-se 100 mA)
  limiteFugaAdotado_mA: number;
}

/**
 * Tabela 1 e Tabela 2 da ASTM D178-22 (Mantas Isolantes de Borracha)
 */
export const TABELA_ASTM_D1048: ASTMD1048TableEntry[] = [
  {
    classe: '0',
    tensaoMaximaUsoAC_kV: 1.0,
    tensaoMaximaUsoDC_kV: 1.5,
    tensaoProvaAC_kV: 5.0,
    tensaoProvaDC_kV: 20.0,
    tensaoRigidezAC_kV: 6.0,
    tensaoRigidezDC_kV: 35.0,
    espessuraMin_mm: 1.6,
    espessuraMax_mm: 2.5,
    distanciaBordaEletrodo_mm: 51,
    distanciaBordaEletrodo_pol: '2 pol (51 mm)'
  },
  {
    classe: '1',
    tensaoMaximaUsoAC_kV: 7.5,
    tensaoMaximaUsoDC_kV: 11.25,
    tensaoProvaAC_kV: 10.0,
    tensaoProvaDC_kV: 40.0,
    tensaoRigidezAC_kV: 20.0,
    tensaoRigidezDC_kV: 50.0,
    espessuraMin_mm: 2.8,
    espessuraMax_mm: 3.8,
    distanciaBordaEletrodo_mm: 76,
    distanciaBordaEletrodo_pol: '3 pol (76 mm)'
  },
  {
    classe: '2',
    tensaoMaximaUsoAC_kV: 17.0,
    tensaoMaximaUsoDC_kV: 25.5,
    tensaoProvaAC_kV: 20.0,
    tensaoProvaDC_kV: 50.0,
    tensaoRigidezAC_kV: 30.0,
    tensaoRigidezDC_kV: 60.0,
    espessuraMin_mm: 3.2,
    espessuraMax_mm: 4.3,
    distanciaBordaEletrodo_mm: 127,
    distanciaBordaEletrodo_pol: '5 pol (127 mm)'
  },
  {
    classe: '3',
    tensaoMaximaUsoAC_kV: 26.5,
    tensaoMaximaUsoDC_kV: 39.75,
    tensaoProvaAC_kV: 30.0,
    tensaoProvaDC_kV: 60.0,
    tensaoRigidezAC_kV: 40.0,
    tensaoRigidezDC_kV: 70.0,
    espessuraMin_mm: 3.8,
    espessuraMax_mm: 5.1,
    distanciaBordaEletrodo_mm: 178,
    distanciaBordaEletrodo_pol: '7 pol (178 mm)'
  },
  {
    classe: '4',
    tensaoMaximaUsoAC_kV: 36.0,
    tensaoMaximaUsoDC_kV: 54.0,
    tensaoProvaAC_kV: 40.0,
    tensaoProvaDC_kV: 70.0,
    tensaoRigidezAC_kV: 50.0,
    tensaoRigidezDC_kV: 90.0,
    espessuraMin_mm: 4.6,
    espessuraMax_mm: 6.4,
    distanciaBordaEletrodo_mm: 254,
    distanciaBordaEletrodo_pol: '10 pol (254 mm)'
  }
];

/**
 * Tabela 1 e Tabela 2 da ASTM D178-22 (Tapetes Isolantes de Borracha)
 * Nota: A norma ASTM D178-22 não estipula valor para a corrente de fuga;
 * adota-se o valor de 100 mA para o limite máximo de corrente de fuga.
 */
export const TABELA_ASTM_D178: ASTMD178TableEntry[] = [
  {
    classe: '0',
    tensaoMaximaUsoAC_kV: 1.0,
    tensaoMaximaUsoDC_kV: 1.5,
    tensaoProvaAC_kV: 5.0,
    tensaoProvaDC_kV: 20.0,
    tensaoRigidezAC_kV: 6.0,
    tensaoRigidezDC_kV: 35.0,
    espessuraMinima_mm: 3.2,
    espessuraMinima_pol: '1/8 pol (3,2 mm)',
    limiteFugaAdotado_mA: 100.0
  },
  {
    classe: '1',
    tensaoMaximaUsoAC_kV: 7.5,
    tensaoMaximaUsoDC_kV: 11.25,
    tensaoProvaAC_kV: 10.0,
    tensaoProvaDC_kV: 40.0,
    tensaoRigidezAC_kV: 20.0,
    tensaoRigidezDC_kV: 50.0,
    espessuraMinima_mm: 4.8,
    espessuraMinima_pol: '3/16 pol (4,8 mm)',
    limiteFugaAdotado_mA: 100.0
  },
  {
    classe: '2',
    tensaoMaximaUsoAC_kV: 17.0,
    tensaoMaximaUsoDC_kV: 25.5,
    tensaoProvaAC_kV: 20.0,
    tensaoProvaDC_kV: 50.0,
    tensaoRigidezAC_kV: 30.0,
    tensaoRigidezDC_kV: 60.0,
    espessuraMinima_mm: 6.4,
    espessuraMinima_pol: '1/4 pol (6,4 mm)',
    limiteFugaAdotado_mA: 100.0
  },
  {
    classe: '3',
    tensaoMaximaUsoAC_kV: 26.5,
    tensaoMaximaUsoDC_kV: 39.75,
    tensaoProvaAC_kV: 30.0,
    tensaoProvaDC_kV: 60.0,
    tensaoRigidezAC_kV: 40.0,
    tensaoRigidezDC_kV: 70.0,
    espessuraMinima_mm: 9.5,
    espessuraMinima_pol: '3/8 pol (9,5 mm)',
    limiteFugaAdotado_mA: 100.0
  },
  {
    classe: '4',
    tensaoMaximaUsoAC_kV: 36.0,
    tensaoMaximaUsoDC_kV: 54.0,
    tensaoProvaAC_kV: 40.0,
    tensaoProvaDC_kV: 70.0,
    tensaoRigidezAC_kV: 50.0,
    tensaoRigidezDC_kV: 90.0,
    espessuraMinima_mm: 12.7,
    espessuraMinima_pol: '1/2 pol (12,7 mm)',
    limiteFugaAdotado_mA: 100.0
  }
];

export const BLANKET_STYLES_INFO = [
  { value: 'Style A', label: 'Style A — Lisa / Plana', desc: 'Manta contínua sem ranhuras nem furos, para cobrir barramentos e painéis' },
  { value: 'Style B', label: 'Style B — Ranhurada (Slotted)', desc: 'Manta com ranhura central para encaixe em cruzetas e isoladores de pino' },
  { value: 'Style C', label: 'Style C — Com Ilhoses (Eyeletted)', desc: 'Manta com ilhoses reforçados nas bordas para fixação com botões ou prendedores' },
  { value: 'Style D', label: 'Style D — Ranhurada com Ilhoses', desc: 'Manta combinada com abertura central ranhurada e ilhoses laterais' }
];

export const BLANKET_TYPES_INFO = [
  { value: 'Type I', label: 'Type I — Elastômero Natural', desc: 'Borracha natural de alta flexibilidade (Não resistente a ozônio)' },
  { value: 'Type II', label: 'Type II — Elastômero Sintético (EPDM)', desc: 'Resistente a ozônio, raios UV, corona e intempéries' }
];

export const BLANKET_SIZES_INFO = [
  { value: '560x560 mm', label: '560 x 560 mm (22" x 22")', desc: 'Tamanho padrão compacto' },
  { value: '910x910 mm', label: '910 x 910 mm (36" x 36")', desc: 'Tamanho médio padrão de distribuição' },
  { value: '910x1160 mm', label: '910 x 1160 mm (36" x 45.5")', desc: 'Tamanho estendido retangular' },
  { value: '1160x1160 mm', label: '1160 x 1160 mm (45.5" x 45.5")', desc: 'Tamanho extra-grande para subestações' },
  { value: 'Rolo / Lençol sob medida', label: 'Lençol / Rolo Contínuo', desc: 'Comprimento especial fracionado' }
];

export const MATTING_SURFACES_INFO = [
  { value: 'Corrugada', label: 'Corrugada / Ranhurada', desc: 'Ranhuras longitudinais para drenagem e aderência de calçados' },
  { value: 'Xadrez', label: 'Relevo Xadrez / Diamond', desc: 'Padrão antiderrapante em alto relevo' },
  { value: 'Lisa', label: 'Superfície Lisa', desc: 'Fácil limpeza e higienização para áreas internas limpas' }
];

export const MATTING_TYPES_INFO = [
  { value: 'Type I', label: 'Type I — Borracha Padrão', desc: 'Composto isolante de uso geral' },
  { value: 'Type II', label: 'Type II — Resistente a Ozônio, Óleo e Fogo', desc: 'Propriedades antichama, resistentes a derivados de petróleo e ozônio' }
];

/**
 * Retorna os dados normativos da ASTM D1048 para a classe informada
 */
export function getASTMD1048Entry(dielectricClass: string): ASTMD1048TableEntry | undefined {
  const normalizedClass = dielectricClass.replace(/^cl(asse)?\s*/i, '').trim();
  return TABELA_ASTM_D1048.find(e => e.classe === normalizedClass);
}

/**
 * Retorna os dados normativos da ASTM D178 para a classe informada
 */
export function getASTMD178Entry(dielectricClass: string): ASTMD178TableEntry | undefined {
  const normalizedClass = dielectricClass.replace(/^cl(asse)?\s*/i, '').trim();
  return TABELA_ASTM_D178.find(e => e.classe === normalizedClass);
}

/**
 * Helper para obter parâmetros de tensão padrão conforme tipo de equipamento e classe
 */
export function getBlanketOrMattingVoltages(
  type: EquipmentType,
  dielectricClass: string
): {
  tensaoUsoAC_kV: number;
  tensaoProvaAC_kV: number;
  tensaoRigidezAC_kV: number;
  tensaoUsoDC_kV: number;
  tensaoProvaDC_kV: number;
  tensaoRigidezDC_kV: number;
  espessuraDesc: string;
  folgaBorda_mm?: number;
  normCode: string;
  limiteFugaAdotado_mA?: number;
} | undefined {
  if (type === 'manta_isolante') {
    const entry = getASTMD1048Entry(dielectricClass);
    if (!entry) return undefined;
    return {
      tensaoUsoAC_kV: entry.tensaoMaximaUsoAC_kV,
      tensaoProvaAC_kV: entry.tensaoProvaAC_kV,
      tensaoRigidezAC_kV: entry.tensaoRigidezAC_kV,
      tensaoUsoDC_kV: entry.tensaoMaximaUsoDC_kV,
      tensaoProvaDC_kV: entry.tensaoProvaDC_kV,
      tensaoRigidezDC_kV: entry.tensaoRigidezDC_kV,
      espessuraDesc: `${entry.espessuraMin_mm} a ${entry.espessuraMax_mm} mm`,
      folgaBorda_mm: entry.distanciaBordaEletrodo_mm,
      normCode: 'ASTM D1048-14'
    };
  }

  if (type === 'tapete_isolante') {
    const entry = getASTMD178Entry(dielectricClass);
    if (!entry) return undefined;
    return {
      tensaoUsoAC_kV: entry.tensaoMaximaUsoAC_kV,
      tensaoProvaAC_kV: entry.tensaoProvaAC_kV,
      tensaoRigidezAC_kV: entry.tensaoRigidezAC_kV,
      tensaoUsoDC_kV: entry.tensaoMaximaUsoDC_kV,
      tensaoProvaDC_kV: entry.tensaoProvaDC_kV,
      tensaoRigidezDC_kV: entry.tensaoRigidezDC_kV,
      espessuraDesc: `Mínimo de ${entry.espessuraMinima_mm} mm (${entry.espessuraMinima_pol})`,
      normCode: 'ASTM D178-22',
      limiteFugaAdotado_mA: entry.limiteFugaAdotado_mA
    };
  }

  return undefined;
}
