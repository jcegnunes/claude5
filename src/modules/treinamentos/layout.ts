/**
 * Layout do certificado de treinamento (logo, textos, assinaturas e cores).
 * Fica nos dados da empresa (CompanyLabInfo.trainingCertificateLayout), que já
 * sincronizam com a nuvem e entram no backup.
 */
import { DielectricStorageService } from '../../services/syncEngine';
import { formatCpf, formatDateBr, formatHours } from './rules';
import type { TrainingCertificate } from './types';
import type { CompanyLabInfo } from '../../types';

export type LogoSource = 'empresa' | 'personalizado' | 'nenhum';
export type LogoPosition = 'esquerda' | 'centro' | 'direita';
export type CompanyField = 'razaoSocial' | 'nomeFantasia' | 'cnpj' | 'crea' | 'endereco' | 'telefone' | 'email' | 'site' | 'instagram';

/** Dados da empresa que podem aparecer no cabeçalho (a ordem é a da tela). */
export const COMPANY_FIELDS: Array<{ id: CompanyField; label: string }> = [
  { id: 'razaoSocial', label: 'Razão social' },
  { id: 'nomeFantasia', label: 'Nome fantasia' },
  { id: 'cnpj', label: 'CNPJ' },
  { id: 'crea', label: 'Registro no CREA' },
  { id: 'endereco', label: 'Endereço' },
  { id: 'telefone', label: 'Telefone' },
  { id: 'email', label: 'E-mail' },
  { id: 'site', label: 'Site' },
  { id: 'instagram', label: 'Instagram' }
];

export type FrameStyle = 'nenhuma' | 'classica' | 'arredondada' | 'tracejada' | 'cantos' | 'faixa' | 'geometrica';

/** Modelos de moldura oferecidos na tela (a ordem é a da lista). */
export const FRAME_STYLES: Array<{ id: FrameStyle; label: string; hint: string }> = [
  { id: 'classica', label: 'Clássica', hint: 'Linhas retas acompanhando a borda' },
  { id: 'arredondada', label: 'Arredondada', hint: 'Cantos arredondados' },
  { id: 'tracejada', label: 'Tracejada', hint: 'Linha tracejada' },
  { id: 'cantos', label: 'Cantoneiras', hint: 'Cantos decorados em L' },
  { id: 'faixa', label: 'Faixa larga', hint: 'Borda cheia na cor 1' },
  { id: 'geometrica', label: 'Geométrica', hint: 'Triângulos nos cantos' },
  { id: 'nenhuma', label: 'Sem moldura', hint: 'Página limpa (bom com modelo importado)' }
];

export interface TrainingCertificateLayout {
  // ------------------------------------------- modelo importado (fundo)
  /** Fundo da frente (JPEG data URL, importado de PDF/JPG/PNG) */
  frontBackground: string;
  /** Fundo do verso */
  backBackground: string;
  /** Desloca o bloco de textos (título até a data), em mm */
  contentOffsetY: number;
  /** Desloca a linha das assinaturas, em mm */
  signatureOffsetY: number;
  // ------------------------------------------------------------- logo
  logoSource: LogoSource;
  /** Imagem própria do certificado (data URL), usada com logoSource "personalizado" */
  customLogo: string;
  logoPosition: LogoPosition;
  /** Largura máxima do logo (mm) */
  logoWidth: number;
  /** Logo na frente / no verso */
  logoOnFront: boolean;
  logoOnBack: boolean;
  /** Segundo logo, independente (ex.: parceiro, cliente, acreditação) */
  logo2Image: string;
  logo2Position: LogoPosition;
  logo2Width: number;
  logo2OnFront: boolean;
  logo2OnBack: boolean;
  /** Dados da empresa na frente / no verso */
  companyDataOnFront: boolean;
  companyDataOnBack: boolean;
  /** Quais dados da empresa aparecem */
  companyFields: CompanyField[];
  // ------------------------------------------------------- aparência
  primaryColor: string;
  accentColor: string;
  // ----------------------------------------------------------- moldura
  frameStyle: FrameStyle;
  /** 1 = uma linha; 2 = linha externa + interna */
  frameLines: number;
  /** Linha externa (ou única) */
  frameColor: string;
  frameWidth: number;
  /** Linha interna */
  frameColor2: string;
  frameWidth2: number;
  // ----------------------------------------------------------- textos
  title: string;
  subtitle: string;
  intro: string;
  bodyTemplate: string;
  showIdLine: boolean;
  showValidity: boolean;
  /** Texto livre abaixo do corpo (opcional) */
  closingText: string;
  // ------------------------------------------------------ assinaturas
  maxInstructors: number;
  showTechnicalResponsible: boolean;
  showParticipant: boolean;
  instructorLabel: string;
  technicalResponsibleLabel: string;
  participantLabel: string;
  // ------------------------------------------------------------ verso
  showBackPage: boolean;
  backTitle: string;
  showPerformance: boolean;
}

export const DEFAULT_BODY_TEMPLATE =
  'concluiu com aproveitamento o treinamento "{curso}", em conformidade com {norma}, realizado {periodo}, na modalidade {modalidade}{local}, com carga horária total de {carga_horaria}.';

export const DEFAULT_LAYOUT: TrainingCertificateLayout = {
  frontBackground: '',
  backBackground: '',
  contentOffsetY: 0,
  signatureOffsetY: 0,
  logoSource: 'empresa',
  customLogo: '',
  logoPosition: 'esquerda',
  logoWidth: 34,
  logoOnFront: true,
  logoOnBack: true,
  logo2Image: '',
  logo2Position: 'direita',
  logo2Width: 34,
  logo2OnFront: true,
  logo2OnBack: false,
  companyDataOnFront: true,
  companyDataOnBack: true,
  companyFields: ['razaoSocial', 'cnpj', 'telefone', 'email', 'site'],
  primaryColor: '#0a2540',
  accentColor: '#ea580c',
  frameStyle: 'classica',
  frameLines: 2,
  frameColor: '#0a2540',
  frameWidth: 1.6,
  frameColor2: '#ea580c',
  frameWidth2: 0.5,
  title: 'CERTIFICADO',
  subtitle: 'DE CONCLUSÃO DE TREINAMENTO',
  intro: 'Certificamos que',
  bodyTemplate: DEFAULT_BODY_TEMPLATE,
  showIdLine: true,
  showValidity: true,
  closingText: '',
  maxInstructors: 2,
  showTechnicalResponsible: true,
  showParticipant: true,
  instructorLabel: 'Instrutor',
  technicalResponsibleLabel: 'Responsável Técnico',
  participantLabel: 'Participante',
  showBackPage: true,
  backTitle: 'CONTEÚDO PROGRAMÁTICO',
  showPerformance: true
};

/** Campos que podem ser usados no texto do certificado. */
export const TEMPLATE_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'curso', label: 'nome do curso' },
  { key: 'norma', label: 'norma / referência' },
  { key: 'periodo', label: '"em 05/10/2026" ou "no período de … a …"' },
  { key: 'modalidade', label: 'presencial, a distância (EAD)…' },
  { key: 'local', label: '", em <local>" (vazio sem local)' },
  { key: 'carga_horaria', label: '"40 horas"' },
  { key: 'nome', label: 'nome do participante' },
  { key: 'cpf', label: 'CPF do participante' },
  { key: 'empresa', label: 'empresa do participante' },
  { key: 'data_inicio', label: 'data de início' },
  { key: 'data_fim', label: 'data de término' },
  { key: 'validade', label: 'data de vencimento' },
  { key: 'turma', label: 'número da turma' }
];

const MODALITY: Record<string, string> = { presencial: 'presencial', ead: 'a distância (EAD)', semipresencial: 'semipresencial' };

const HEX = /^#[0-9a-f]{6}$/i;

function text(v: unknown, fallback: string, max = 2000): string {
  return typeof v === 'string' ? v.slice(0, max) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Completa e corrige um layout salvo (campos faltando ou inválidos voltam ao padrão). */
export function normalizeLayout(raw?: Partial<TrainingCertificateLayout> | Record<string, any> | null): TrainingCertificateLayout {
  const r: Record<string, any> = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_LAYOUT;
  const width = Number(r.logoWidth);
  const maxIns = Number(r.maxInstructors);
  const image = (v: unknown) => (typeof v === 'string' && /^data:image\/(jpeg|png);base64,/.test(v) ? v : '');
  const offset = (v: unknown, min: number, max: number) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : 0);
  return {
    frontBackground: image(r.frontBackground),
    backBackground: image(r.backBackground),
    contentOffsetY: offset(r.contentOffsetY, -40, 40),
    signatureOffsetY: offset(r.signatureOffsetY, -40, 15),
    logoSource: ['empresa', 'personalizado', 'nenhum'].includes(r.logoSource) ? r.logoSource : d.logoSource,
    customLogo: typeof r.customLogo === 'string' && r.customLogo.startsWith('data:image/') ? r.customLogo : '',
    logoPosition: ['esquerda', 'centro', 'direita'].includes(r.logoPosition) ? r.logoPosition : d.logoPosition,
    logoWidth: Number.isFinite(width) ? Math.min(70, Math.max(15, width)) : d.logoWidth,
    logoOnFront: bool(r.logoOnFront, d.logoOnFront),
    logoOnBack: bool(r.logoOnBack, d.logoOnBack),
    logo2Image: typeof r.logo2Image === 'string' && r.logo2Image.startsWith('data:image/') ? r.logo2Image : '',
    logo2Position: ['esquerda', 'centro', 'direita'].includes(r.logo2Position) ? r.logo2Position : d.logo2Position,
    logo2Width: Number.isFinite(Number(r.logo2Width)) && r.logo2Width !== null && r.logo2Width !== '' ? Math.min(70, Math.max(15, Number(r.logo2Width))) : d.logo2Width,
    logo2OnFront: bool(r.logo2OnFront, d.logo2OnFront),
    logo2OnBack: bool(r.logo2OnBack, d.logo2OnBack),
    // layout antigo: showCompanyData valia para frente e verso
    companyDataOnFront: bool(r.companyDataOnFront, bool(r.showCompanyData, d.companyDataOnFront)),
    companyDataOnBack: bool(r.companyDataOnBack, bool(r.showCompanyData, d.companyDataOnBack)),
    companyFields: Array.isArray(r.companyFields)
      ? COMPANY_FIELDS.map(f => f.id).filter(id => (r.companyFields as unknown[]).includes(id))
      : [...d.companyFields],
    primaryColor: HEX.test(r.primaryColor) ? r.primaryColor : d.primaryColor,
    accentColor: HEX.test(r.accentColor) ? r.accentColor : d.accentColor,
    // layout antigo: showFrame=false equivale a "sem moldura"
    frameStyle: FRAME_STYLES.some(f => f.id === r.frameStyle) ? r.frameStyle : r.showFrame === false ? 'nenhuma' : d.frameStyle,
    frameLines: Number(r.frameLines) === 1 ? 1 : 2,
    frameColor: HEX.test(r.frameColor) ? r.frameColor : HEX.test(r.primaryColor) ? r.primaryColor : d.frameColor,
    frameWidth: Number.isFinite(Number(r.frameWidth)) && r.frameWidth !== null && r.frameWidth !== '' ? Math.min(6, Math.max(0.2, Number(r.frameWidth))) : d.frameWidth,
    frameColor2: HEX.test(r.frameColor2) ? r.frameColor2 : HEX.test(r.accentColor) ? r.accentColor : d.frameColor2,
    frameWidth2: Number.isFinite(Number(r.frameWidth2)) && r.frameWidth2 !== null && r.frameWidth2 !== '' ? Math.min(4, Math.max(0.2, Number(r.frameWidth2))) : d.frameWidth2,
    title: text(r.title, d.title, 40),
    subtitle: text(r.subtitle, d.subtitle, 80),
    intro: text(r.intro, d.intro, 120),
    bodyTemplate: typeof r.bodyTemplate === 'string' && r.bodyTemplate.trim() ? r.bodyTemplate.slice(0, 1200) : d.bodyTemplate,
    showIdLine: bool(r.showIdLine, d.showIdLine),
    showValidity: bool(r.showValidity, d.showValidity),
    closingText: text(r.closingText, d.closingText, 400),
    maxInstructors: Number.isFinite(maxIns) ? Math.min(2, Math.max(0, Math.round(maxIns))) : d.maxInstructors,
    showTechnicalResponsible: bool(r.showTechnicalResponsible, d.showTechnicalResponsible),
    showParticipant: bool(r.showParticipant, d.showParticipant),
    instructorLabel: text(r.instructorLabel, d.instructorLabel, 60),
    technicalResponsibleLabel: text(r.technicalResponsibleLabel, d.technicalResponsibleLabel, 60),
    participantLabel: text(r.participantLabel, d.participantLabel, 60),
    showBackPage: bool(r.showBackPage, d.showBackPage),
    backTitle: text(r.backTitle, d.backTitle, 80),
    showPerformance: bool(r.showPerformance, d.showPerformance)
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = HEX.test(hex) ? hex : '#000000';
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

type TemplateCert = Pick<TrainingCertificate,
  'courseName' | 'normReference' | 'startDate' | 'endDate' | 'modality' | 'location' | 'workloadHours'
  | 'participantName' | 'participantCpf' | 'participantCompany' | 'expiryDate' | 'classNumber'>;

export function certificatePeriod(cert: Pick<TrainingCertificate, 'startDate' | 'endDate'>): string {
  if (!cert.endDate || cert.startDate === cert.endDate) return `em ${formatDateBr(cert.startDate)}`;
  return `no período de ${formatDateBr(cert.startDate)} a ${formatDateBr(cert.endDate)}`;
}

/** Troca os campos {curso}, {periodo}… pelos dados do certificado; campos desconhecidos ficam como estão. */
export function fillTemplate(template: string, cert: TemplateCert): string {
  const values: Record<string, string> = {
    curso: cert.courseName || '',
    norma: cert.normReference || 'a legislação aplicável',
    periodo: certificatePeriod(cert),
    modalidade: MODALITY[cert.modality] || cert.modality || '',
    local: cert.location ? `, em ${cert.location}` : '',
    carga_horaria: formatHours(cert.workloadHours).replace(' h', ' horas'),
    nome: cert.participantName || '',
    cpf: cert.participantCpf ? formatCpf(cert.participantCpf) : '',
    empresa: cert.participantCompany || '',
    data_inicio: formatDateBr(cert.startDate),
    data_fim: formatDateBr(cert.endDate || cert.startDate),
    validade: cert.expiryDate ? formatDateBr(cert.expiryDate) : 'sem vencimento',
    turma: cert.classNumber || ''
  };
  return template.replace(/\{([a-z_]+)\}/gi, (all, key: string) => {
    const k = key.toLowerCase();
    return Object.prototype.hasOwnProperty.call(values, k) ? values[k] : all;
  });
}

// ------------------------------------------------------------------ gravação
export function getTrainingLayout(): TrainingCertificateLayout {
  return normalizeLayout(DielectricStorageService.getCompanyInfo()?.trainingCertificateLayout);
}

export function saveTrainingLayout(layout: TrainingCertificateLayout): void {
  const info = DielectricStorageService.getCompanyInfo();
  DielectricStorageService.saveCompanyInfo({ ...info, trainingCertificateLayout: normalizeLayout(layout) as unknown as Record<string, unknown> });
}

function formatCnpjText(v: string): string {
  const d = (v || '').replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : v;
}

/**
 * Linhas do cabeçalho com os dados escolhidos: o nome em destaque (title),
 * a identificação (CNPJ, CREA…) e os contatos (endereço, telefone…).
 */
export function companyHeaderLines(company: Partial<CompanyLabInfo>, fields: CompanyField[]): { title: string; identity: string[]; contact: string[] } {
  const on = (f: CompanyField) => fields.includes(f);
  const legal = (company.legalName || '').trim();
  const trade = (company.name || '').trim();
  let title = '';
  const identity: string[] = [];
  if (on('razaoSocial') && (legal || trade)) title = legal || trade;
  if (on('nomeFantasia') && trade && trade !== title) {
    if (title) identity.push(trade); else title = trade;
  }
  identity.push([
    on('cnpj') && company.cnpj ? `CNPJ ${formatCnpjText(company.cnpj)}` : '',
    on('crea') && company.creaCompanyRegister ? `CREA ${company.creaCompanyRegister.replace(/^CREA[\s:-]*/i, '')}` : ''
  ].filter(Boolean).join(' · '));
  const street = [company.address, company.number].filter(Boolean).join(', ');
  const place = [company.neighborhood, [company.city, company.state].filter(Boolean).join('/'), company.cep ? `CEP ${company.cep}` : '']
    .filter(Boolean).join(' – ');
  const contact = [
    on('endereco') ? [street, place].filter(Boolean).join(' – ') : '',
    [on('telefone') ? company.phone : '', on('email') ? company.email : ''].filter(Boolean).join(' · '),
    [on('site') ? company.website : '', on('instagram') ? company.instagram : ''].filter(Boolean).join(' · ')
  ];
  return { title, identity: identity.filter(Boolean), contact: contact.filter(Boolean) as string[] };
}
