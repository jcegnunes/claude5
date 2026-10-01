/**
 * Emissão em lote a partir de planilha Excel: leitura das linhas, validação
 * e agrupamento em turmas. Funções puras (testadas em __tests__).
 */
import { formatCpf, isParticipantApproved, isValidCpf, onlyDigits } from './rules';
import type { TrainingCertificate, TrainingCourse, TrainingInstructor } from './types';

/**
 * Colunas do modelo: Nome, CPF e Colaborador da Empresa. Curso, datas, local,
 * instrutor, presença e nota são escolhidos na tela. Colunas extras (Função,
 * Curso, Início, Término, Carga horária, Local, Presença, Nota, Instrutor)
 * continuam aceitas e valem para a linha. A ordem e acentos não importam.
 */
export const TEMPLATE_HEADERS = ['Nome', 'CPF', 'Colaborador da Empresa'];

export const OPTIONAL_HEADERS = ['Função', 'Curso', 'Início', 'Término', 'Carga horária', 'Local', 'Presença (%)', 'Nota', 'Instrutor'];

export const MAX_IMPORT_ROWS = 1000;

type Field = 'name' | 'cpf' | 'role' | 'company' | 'course' | 'start' | 'end' | 'hours' | 'location' | 'attendance' | 'grade' | 'instructor';

const ALIASES: Record<Field, string[]> = {
  name: ['nome', 'nome completo', 'participante', 'aluno', 'colaborador', 'funcionario'],
  cpf: ['cpf', 'documento'],
  role: ['funcao', 'cargo'],
  company: ['colaborador da empresa', 'empresa do colaborador', 'empresa', 'cliente', 'contratante'],
  course: ['curso', 'treinamento', 'sigla', 'codigo do curso'],
  start: ['inicio', 'data inicio', 'data de inicio', 'data', 'data do treinamento'],
  end: ['termino', 'fim', 'data termino', 'data de termino', 'data final', 'conclusao'],
  hours: ['carga horaria', 'ch', 'horas', 'carga horaria (h)'],
  location: ['local', 'cidade', 'local do treinamento'],
  attendance: ['presenca', 'presenca (%)', 'frequencia', 'frequencia (%)', '% presenca'],
  grade: ['nota', 'avaliacao', 'nota final'],
  instructor: ['instrutor', 'instrutores', 'instrutor(es)']
};

export function normalizeText(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function fieldOf(header: string): Field | null {
  const h = normalizeText(header).replace(/\*$/, '').trim();
  for (const [field, names] of Object.entries(ALIASES) as Array<[Field, string[]]>) {
    if (names.includes(h)) return field;
  }
  return null;
}

/** Data da célula (Date, número serial do Excel ou texto dd/mm/aaaa) -> AAAA-MM-DD. */
export function parseDateCell(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const iso = (y: number, m: number, d: number) => {
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt.toISOString().slice(0, 10);
  };
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    // o leitor do Excel cria a data à meia-noite local
    return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v < 1 || v > 2958465) return null;
    const dt = new Date(Math.round((v - 25569) * 86400000));
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

/** Número da célula: aceita "8,5", "100%", 9. */
export function parseNumberCell(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const n = Number(String(v).replace('%', '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export function findCourse(text: string, courses: TrainingCourse[]): TrainingCourse | undefined {
  const t = normalizeText(text);
  if (!t) return undefined;
  return courses.find(c => normalizeText(c.code) === t)
    || courses.find(c => normalizeText(c.name) === t)
    || courses.find(c => c.id === text)
    || (t.length >= 4 ? courses.find(c => normalizeText(c.name).includes(t)) : undefined);
}

export function findInstructors(text: string, instructors: TrainingInstructor[]): { ids: string[]; unknown: string[] } {
  const names = String(text || '').split(/[;,/]| e /).map(n => n.trim()).filter(Boolean);
  const ids: string[] = [];
  const unknown: string[] = [];
  names.forEach(n => {
    const t = normalizeText(n);
    const found = instructors.find(i => normalizeText(i.name) === t) || instructors.find(i => normalizeText(i.name).startsWith(t));
    if (found) { if (!ids.includes(found.id)) ids.push(found.id); } else unknown.push(n);
  });
  return { ids, unknown };
}

export interface ImportDefaults {
  courseId?: string;
  /** Presença (%) de quem não tem a coluna Presença (padrão 100) */
  attendance?: number;
  /** Nota de quem não tem a coluna Nota (cursos com avaliação) */
  grade?: number;
  startDate?: string;
  endDate?: string;
  location?: string;
  instructorIds: string[];
}

export interface ImportRow {
  /** Linha na planilha (cabeçalho = 1) */
  line: number;
  name: string;
  cpf: string;
  role: string;
  company: string;
  course?: TrainingCourse;
  startDate: string;
  endDate: string;
  workloadHours?: number;
  location: string;
  attendance: number;
  grade?: number;
  instructorIds: string[];
  errors: string[];
  warnings: string[];
  approved: boolean;
}

export type ImportStatus = 'ok' | 'reprovado' | 'erro';
export const rowStatus = (r: ImportRow): ImportStatus => (r.errors.length ? 'erro' : r.approved ? 'ok' : 'reprovado');

/** Converte as linhas lidas da planilha (objetos por cabeçalho) e valida. */
export function buildImportRows(
  raw: Array<Record<string, unknown>>,
  ctx: { courses: TrainingCourse[]; instructors: TrainingInstructor[]; defaults: ImportDefaults; existing: TrainingCertificate[] }
): ImportRow[] {
  const seen = new Set<string>();
  const rows: ImportRow[] = [];
  raw.slice(0, MAX_IMPORT_ROWS).forEach((obj, idx) => {
    const v: Partial<Record<Field, unknown>> = {};
    Object.entries(obj).forEach(([header, value]) => {
      const f = fieldOf(header);
      if (f && (v[f] === undefined || v[f] === '')) v[f] = value;
    });
    const name = String(v.name ?? '').replace(/\s+/g, ' ').trim();
    // linha totalmente vazia: ignorada
    if (!name && Object.values(v).every(x => x === undefined || String(x).trim() === '')) return;

    const errors: string[] = [];
    const warnings: string[] = [];
    const cpfRaw = String(v.cpf ?? '').trim();
    const cpfDigits = onlyDigits(cpfRaw).padStart(cpfRaw && onlyDigits(cpfRaw).length >= 9 ? 11 : 0, '0');
    const cpf = cpfDigits ? formatCpf(cpfDigits) : '';

    const courseText = String(v.course ?? '').trim();
    const course = courseText ? findCourse(courseText, ctx.courses) : ctx.courses.find(c => c.id === ctx.defaults.courseId);
    const startDate = (v.start !== undefined && v.start !== '' ? parseDateCell(v.start) : ctx.defaults.startDate) || '';
    const endRaw = v.end !== undefined && v.end !== '' ? parseDateCell(v.end) : null;
    const endDate = endRaw || (v.start !== undefined && v.start !== '' ? startDate : (ctx.defaults.endDate || startDate));
    const attendance = parseNumberCell(v.attendance) ?? ctx.defaults.attendance ?? 100;
    const grade = parseNumberCell(v.grade) ?? ctx.defaults.grade;
    const workloadHours = parseNumberCell(v.hours);
    const location = String(v.location ?? '').trim() || ctx.defaults.location || '';
    const instructorText = String(v.instructor ?? '').trim();
    const ins = instructorText ? findInstructors(instructorText, ctx.instructors) : { ids: ctx.defaults.instructorIds, unknown: [] };

    if (!name) errors.push('Nome em branco');
    if (cpfRaw && !isValidCpf(cpf)) errors.push('CPF inválido');
    if (!course) errors.push(courseText ? `Curso "${courseText}" não cadastrado` : 'Curso não informado');
    if (!startDate) errors.push(v.start ? 'Data de início inválida' : 'Data de início não informada');
    if (v.end !== undefined && v.end !== '' && !endRaw) errors.push('Data de término inválida');
    if (startDate && endDate && endDate < startDate) errors.push('Término antes do início');
    if (attendance < 0 || attendance > 100) errors.push('Presença deve ficar entre 0 e 100');
    if (grade !== undefined && (grade < 0 || grade > 10)) errors.push('Nota deve ficar entre 0 e 10');
    if (workloadHours !== undefined && workloadHours <= 0) errors.push('Carga horária inválida');
    if (ins.unknown.length) errors.push(`Instrutor não cadastrado: ${ins.unknown.join(', ')}`);
    if (!ins.ids.length && !ins.unknown.length) warnings.push('Sem instrutor');
    if (!cpf) warnings.push('Sem CPF');

    // mesma pessoa: pelo CPF; sem CPF, pelo nome
    if (course && startDate && (cpf || name)) {
      const who = cpf ? `cpf:${onlyDigits(cpf)}` : `nome:${normalizeText(name)}`;
      const what = cpf ? 'CPF' : 'nome';
      const key = `${course.id}|${who}|${endDate}`;
      if (seen.has(key)) errors.push(`Repetido na planilha (mesmo ${what}, curso e data)`);
      seen.add(key);
      const samePerson = (c: TrainingCertificate) => cpf
        ? onlyDigits(c.participantCpf) === onlyDigits(cpf)
        : !onlyDigits(c.participantCpf) && normalizeText(c.participantName) === normalizeText(name);
      if (ctx.existing.some(c => c.status === 'valido' && c.courseId === course.id && c.endDate === endDate && samePerson(c))) {
        errors.push(`Certificado já emitido (mesmo ${what}, curso e data)`);
      }
    }

    const approved = !!course && isParticipantApproved({ id: '', name, cpf, attendance, grade }, course);
    rows.push({
      line: idx + 2, name, cpf, role: String(v.role ?? '').trim(), company: String(v.company ?? '').trim(),
      course, startDate, endDate, workloadHours, location, attendance, grade, instructorIds: ins.ids,
      errors, warnings, approved
    });
  });
  return rows;
}

export interface ImportGroup {
  key: string;
  course: TrainingCourse;
  startDate: string;
  endDate: string;
  location: string;
  workloadHours: number;
  instructorIds: string[];
  rows: ImportRow[];
}

/** Uma turma por curso + período + local (+ instrutores). Linhas com erro ficam de fora. */
export function groupImportRows(rows: ImportRow[]): ImportGroup[] {
  const map = new Map<string, ImportGroup>();
  rows.filter(r => !r.errors.length && r.course).forEach(r => {
    const ins = [...r.instructorIds].sort();
    const key = [r.course!.id, r.startDate, r.endDate, normalizeText(r.location), ins.join(',')].join('|');
    if (!map.has(key)) {
      map.set(key, {
        key, course: r.course!, startDate: r.startDate, endDate: r.endDate, location: r.location,
        workloadHours: r.workloadHours || r.course!.workloadHours, instructorIds: ins, rows: []
      });
    }
    map.get(key)!.rows.push(r);
  });
  return Array.from(map.values());
}

export interface ParticipantImport {
  line: number;
  name: string;
  cpf: string;
  role: string;
  company: string;
  attendance: number;
  grade?: number;
  error?: string;
}

/** Linhas da planilha -> alunos de uma turma. */
export function parseParticipantRows(raw: Array<Record<string, unknown>>, defaultCompany = ''): ParticipantImport[] {
  const out: ParticipantImport[] = [];
  raw.slice(0, MAX_IMPORT_ROWS).forEach((obj, idx) => {
    const v: Partial<Record<Field, unknown>> = {};
    Object.entries(obj).forEach(([header, value]) => {
      const f = fieldOf(header);
      if (f && (v[f] === undefined || v[f] === '')) v[f] = value;
    });
    const name = String(v.name ?? '').replace(/\s+/g, ' ').trim();
    if (!name && Object.values(v).every(x => x === undefined || String(x).trim() === '')) return;
    const cpfRaw = String(v.cpf ?? '').trim();
    const digits = onlyDigits(cpfRaw);
    const cpf = digits ? formatCpf(digits.length >= 9 ? digits.padStart(11, '0') : digits) : '';
    const attendance = parseNumberCell(v.attendance) ?? 100;
    const grade = parseNumberCell(v.grade);
    let error: string | undefined;
    if (!name) error = 'Nome em branco';
    else if (cpfRaw && !isValidCpf(cpf)) error = 'CPF inválido';
    else if (attendance < 0 || attendance > 100) error = 'Presença deve ficar entre 0 e 100';
    else if (grade !== undefined && (grade < 0 || grade > 10)) error = 'Nota deve ficar entre 0 e 10';
    out.push({
      line: idx + 2, name, cpf, role: String(v.role ?? '').trim(),
      company: String(v.company ?? '').trim() || defaultCompany, attendance, grade, error
    });
  });
  return out;
}
