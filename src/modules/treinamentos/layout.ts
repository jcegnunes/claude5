/**
 * Layout do certificado de treinamento (logo, textos, assinaturas e cores).
 * Fica nos dados da empresa (CompanyLabInfo.trainingCertificateLayout), que já
 * sincronizam com a nuvem e entram no backup.
 */
import { DielectricStorageService } from '../../services/syncEngine';
import { formatCpf, formatDateBr, formatHours } from './rules';
import type { TrainingCertificate } from './types';

export type LogoSource = 'empresa' | 'personalizado' | 'nenhum';
export type LogoPosition = 'esquerda' | 'centro' | 'direita';

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
  showCompanyData: boolean;
  // ------------------------------------------------------- aparência
  primaryColor: string;
  accentColor: string;
  showFrame: boolean;
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
  showCompanyData: true,
  primaryColor: '#0a2540',
  accentColor: '#ea580c',
  showFrame: true,
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
    showCompanyData: bool(r.showCompanyData, d.showCompanyData),
    primaryColor: HEX.test(r.primaryColor) ? r.primaryColor : d.primaryColor,
    accentColor: HEX.test(r.accentColor) ? r.accentColor : d.accentColor,
    showFrame: bool(r.showFrame, d.showFrame),
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
