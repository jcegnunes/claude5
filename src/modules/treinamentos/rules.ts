/** Regras do módulo Treinamentos (funções puras, testadas em __tests__). */
import type { TrainingCertificate, TrainingCourse, TrainingParticipant } from './types';

export const VALIDATION_PREFIX = 'VAL-TRE-';
export const CLASS_PREFIX = 'TUR-';
export const CERTIFICATE_PREFIX = 'TRE-';
/** Aviso de reciclagem: certificados que vencem nos próximos N dias */
export const EXPIRY_WARNING_DAYS = 60;

export function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

/** Valida o CPF pelos dígitos verificadores. */
export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length !== 11) return value || '';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** CPF mascarado como no validador público: ***.456.789-** */
export function maskCpf(value: string): string {
  const d = onlyDigits(value);
  if (d.length !== 11) return '';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** Aprovado: presença e nota mínimas do curso (ou decisão manual do instrutor). */
export function isParticipantApproved(p: TrainingParticipant, course: Pick<TrainingCourse, 'minAttendance' | 'minGrade'>): boolean {
  if (typeof p.approvedOverride === 'boolean') return p.approvedOverride;
  if ((Number(p.attendance) || 0) < (Number(course.minAttendance) || 0)) return false;
  if (course.minGrade !== undefined && course.minGrade !== null && Number.isFinite(Number(course.minGrade))) {
    if (p.grade === undefined || p.grade === null || !Number.isFinite(Number(p.grade))) return false;
    if (Number(p.grade) < Number(course.minGrade)) return false;
  }
  return true;
}

/** Soma ano/mês sem pular para o mês seguinte (31/01 + 1 mês = 28/02). */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Vencimento: conta a partir do término do treinamento. */
export function computeExpiryDate(endDate: string, validityMonths: number): string | undefined {
  if (!endDate || !validityMonths || validityMonths <= 0) return undefined;
  return addMonths(endDate, validityMonths) || undefined;
}

export type CertificateSituation = 'valido' | 'vencendo' | 'vencido' | 'cancelado';

export function todayIso(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function certificateSituation(
  cert: Pick<TrainingCertificate, 'status' | 'expiryDate'>,
  today: string = todayIso()
): CertificateSituation {
  if (cert.status === 'cancelado') return 'cancelado';
  if (!cert.expiryDate) return 'valido';
  const days = daysBetween(today, cert.expiryDate);
  if (days < 0) return 'vencido';
  if (days <= EXPIRY_WARNING_DAYS) return 'vencendo';
  return 'valido';
}

export const SITUATION_LABEL: Record<CertificateSituation, string> = {
  valido: 'Válido',
  vencendo: 'Vence em breve',
  vencido: 'Vencido',
  cancelado: 'Cancelado'
};

/** Código público do QR Code (imprevisível: 32^8 combinações). */
export function generateTrainingValidationCode(now: Date = new Date()): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const period = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0');
  const random = new Uint8Array(8);
  crypto.getRandomValues(random);
  let code = `${VALIDATION_PREFIX}${period}-`;
  random.forEach(b => { code += chars.charAt(b % chars.length); });
  return code;
}

export function isTrainingValidationCode(code: string): boolean {
  return (code || '').trim().toUpperCase().startsWith(VALIDATION_PREFIX);
}

export function totalTopicHours(topics: Array<{ hours: number }>): number {
  return Math.round(topics.reduce((sum, t) => sum + (Number(t.hours) || 0), 0) * 100) / 100;
}

export function newId(prefix: string): string {
  const random = new Uint8Array(6);
  crypto.getRandomValues(random);
  return `${prefix}-${Date.now().toString(36)}-${Array.from(random, b => b.toString(36).padStart(2, '0')).join('').slice(0, 8)}`;
}

export function formatDateBr(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function formatHours(h: number): string {
  const n = Number(h) || 0;
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')} h`;
}
