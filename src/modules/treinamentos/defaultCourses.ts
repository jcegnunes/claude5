/**
 * Cursos cadastrados automaticamente na primeira abertura do módulo (por
 * empresa). Tudo pode ser editado: nome, norma, carga horária de cada tópico,
 * validade e regras de aprovação. A distribuição das horas por tópico é uma
 * sugestão: a norma define o conteúdo mínimo e a carga horária total.
 */
import type { TrainingCourse } from './types';

type CourseSeed = Omit<TrainingCourse, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'serverUpdatedAt'>;

export const DEFAULT_COURSES: Array<{ key: string } & CourseSeed> = [
  {
    key: 'nr10-basico',
    code: 'NR-10 BÁSICO',
    name: 'NR-10 – Segurança em Instalações e Serviços em Eletricidade (Curso Básico)',
    normReference: 'NR-10, item 10.8.8 – conteúdo mínimo do curso básico',
    workloadHours: 40,
    validityMonths: 24,
    modality: 'presencial',
    minAttendance: 100,
    minGrade: 7,
    active: true,
    notes: 'Reciclagem bienal e sempre que ocorrer troca de função, retorno de afastamento superior a três meses ou modificações significativas nas instalações (NR-10, item 10.8.8.2).',
    topics: [
      { title: 'Introdução à segurança com eletricidade', hours: 1 },
      { title: 'Riscos em instalações e serviços com eletricidade: choque elétrico (mecanismos e efeitos), arcos elétricos, queimaduras, quedas e campos eletromagnéticos', hours: 4 },
      { title: 'Técnicas de análise de risco', hours: 2 },
      { title: 'Medidas de controle do risco elétrico: desenergização, aterramento (funcional, de proteção e temporário), equipotencialização, seccionamento automático, dispositivos DR, extrabaixa tensão, barreiras e invólucros, bloqueios e impedimentos, obstáculos e anteparos, isolamento das partes vivas, isolação dupla ou reforçada, colocação fora de alcance e separação elétrica', hours: 6 },
      { title: 'Normas técnicas brasileiras – NBR 5410, NBR 14039 e outras', hours: 2 },
      { title: 'Regulamentações do MTE: NRs, NR-10, qualificação, habilitação, capacitação e autorização', hours: 2 },
      { title: 'Equipamentos de proteção coletiva', hours: 2 },
      { title: 'Equipamentos de proteção individual', hours: 2 },
      { title: 'Rotinas de trabalho e procedimentos: instalações desenergizadas, liberação para serviços, sinalização, inspeções de áreas, serviços, ferramental e equipamentos', hours: 3 },
      { title: 'Documentação de instalações elétricas', hours: 1 },
      { title: 'Riscos adicionais: altura, ambientes confinados, áreas classificadas, umidade e condições atmosféricas', hours: 2 },
      { title: 'Proteção e combate a incêndios: noções básicas, medidas preventivas, métodos de extinção e prática', hours: 4 },
      { title: 'Acidentes de origem elétrica: causas diretas e indiretas, discussão de casos', hours: 2 },
      { title: 'Primeiros socorros: lesões, priorização do atendimento, respiração artificial, massagem cardíaca, remoção e transporte de acidentados, práticas', hours: 6 },
      { title: 'Responsabilidades', hours: 1 }
    ]
  },
  {
    key: 'nr10-sep',
    code: 'NR-10 SEP',
    name: 'NR-10 – Curso Complementar: Segurança no Sistema Elétrico de Potência (SEP) e em suas Proximidades',
    normReference: 'NR-10, item 10.8.8 – conteúdo mínimo do curso complementar (SEP)',
    workloadHours: 40,
    validityMonths: 24,
    modality: 'presencial',
    minAttendance: 100,
    minGrade: 7,
    active: true,
    prerequisite: 'Conclusão do curso básico NR-10 (40 h) com aproveitamento satisfatório.',
    notes: 'Reciclagem bienal e nas situações previstas no item 10.8.8.2 da NR-10.',
    topics: [
      { title: 'Organização do Sistema Elétrico de Potência – SEP', hours: 2 },
      { title: 'Organização do trabalho: programação e planejamento dos serviços, trabalho em equipe, prontuário e cadastro das instalações, métodos de trabalho e comunicação', hours: 3 },
      { title: 'Aspectos comportamentais', hours: 2 },
      { title: 'Condições impeditivas para serviços', hours: 2 },
      { title: 'Riscos típicos no SEP e sua prevenção: proximidade e contato com partes energizadas, indução, descargas atmosféricas, estática, campos elétricos e magnéticos, comunicação e identificação, trabalhos em altura, máquinas e equipamentos especiais', hours: 3 },
      { title: 'Técnicas de análise de risco no SEP', hours: 3 },
      { title: 'Procedimentos de trabalho – análise e discussão', hours: 3 },
      { title: 'Técnicas de trabalho sob tensão: em linha viva, ao potencial, em áreas internas, a distância, trabalhos noturnos e ambientes subterrâneos', hours: 3 },
      { title: 'Equipamentos e ferramentas de trabalho: escolha, uso, conservação, verificação e ensaios', hours: 3 },
      { title: 'Sistemas de proteção coletiva', hours: 2 },
      { title: 'Equipamentos de proteção individual', hours: 2 },
      { title: 'Posturas e vestuários de trabalho', hours: 1 },
      { title: 'Segurança com veículos e transporte de pessoas, materiais e equipamentos', hours: 2 },
      { title: 'Sinalização e isolamento de áreas de trabalho', hours: 2 },
      { title: 'Liberação de instalação para serviço e para operação e uso', hours: 2 },
      { title: 'Treinamento em técnicas de remoção, atendimento e transporte de acidentados', hours: 2 },
      { title: 'Acidentes típicos: análise, discussão e medidas de proteção', hours: 2 },
      { title: 'Responsabilidades', hours: 1 }
    ]
  },
  {
    key: 'nr35',
    code: 'NR-35',
    name: 'NR-35 – Trabalho em Altura',
    normReference: 'NR-35, item 35.3 – capacitação e treinamento',
    workloadHours: 8,
    validityMonths: 24,
    modality: 'presencial',
    minAttendance: 100,
    minGrade: 7,
    active: true,
    notes: 'Treinamento teórico e prático. Treinamento periódico bienal e nas situações previstas na NR-35.',
    topics: [
      { title: 'Normas e regulamentos aplicáveis ao trabalho em altura', hours: 1 },
      { title: 'Análise de risco e condições impeditivas', hours: 1 },
      { title: 'Riscos potenciais inerentes ao trabalho em altura e medidas de prevenção e controle', hours: 1 },
      { title: 'Sistemas, equipamentos e procedimentos de proteção coletiva', hours: 1 },
      { title: 'Equipamentos de proteção individual para trabalho em altura: seleção, inspeção, conservação e limitação de uso', hours: 2 },
      { title: 'Acidentes típicos em trabalhos em altura', hours: 1 },
      { title: 'Condutas em situações de emergência, incluindo noções de técnicas de resgate e de primeiros socorros', hours: 1 }
    ]
  },
  {
    key: 'epi-epc-isolantes',
    code: 'EPI/EPC ISOLANTES',
    name: 'Uso, Inspeção e Cuidados com EPI e EPC Isolantes',
    normReference: 'NR-6 e NR-10 – treinamento sobre uso adequado, guarda e conservação',
    workloadHours: 4,
    validityMonths: 24,
    modality: 'presencial',
    minAttendance: 75,
    minGrade: 7,
    active: true,
    notes: 'Luvas, mangas, tapetes, mantas, ferramentas isoladas e demais equipamentos isolantes.',
    topics: [
      { title: 'Classes de tensão e seleção de EPI/EPC isolantes (luvas, mangas, tapetes, mantas e ferramentas isoladas)', hours: 1 },
      { title: 'Inspeção visual antes do uso e teste de inflação das luvas', hours: 1 },
      { title: 'Uso correto: luvas de cobertura, limites de uso e incompatibilidades', hours: 0.5 },
      { title: 'Guarda, transporte, limpeza e conservação', hours: 0.5 },
      { title: 'Ensaios dielétricos periódicos, rastreabilidade e descarte', hours: 0.5 },
      { title: 'Atividade prática de inspeção', hours: 0.5 }
    ]
  }
];
