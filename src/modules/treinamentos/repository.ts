/**
 * Dados do módulo Treinamentos no aparelho (IndexedDB), com fila própria de
 * envio ao Supabase. Funciona offline; a sincronização fica em sync.ts.
 *
 * Do restante da plataforma o módulo só LÊ: empresa ativa, usuário logado,
 * clientes e responsável técnico. Nada dos ensaios é alterado aqui.
 */
import { isManaged, storeGet, storeSet } from '../../services/localStore';
import { DielectricStorageService, getDeviceId } from '../../services/syncEngine';
import {
  addRange, currentPeriod, deviceTag, fallbackNumber, formatNumber, maxSequence,
  remaining, takeFromBlocks, type NumberBlockState
} from '../../services/numberBlocks';
import { DEFAULT_COURSES } from './defaultCourses';
import { TRAINING_KEYS, TRAINING_MANAGED_KEYS } from './storageKeys';
import {
  CERTIFICATE_PREFIX, CLASS_PREFIX, computeExpiryDate, generateTrainingValidationCode,
  isParticipantApproved, newId, todayIso
} from './rules';
import type {
  TrainingCertificate, TrainingClass, TrainingConflict, TrainingCourse, TrainingInstructor,
  TrainingParticipant, TrainingQueueItem, TrainingTable
} from './types';

export { TRAINING_KEYS, TRAINING_MANAGED_KEYS };

const TABLE_KEY: Record<TrainingTable, string> = {
  training_courses: TRAINING_KEYS.COURSES,
  training_instructors: TRAINING_KEYS.INSTRUCTORS,
  training_classes: TRAINING_KEYS.CLASSES,
  training_certificates: TRAINING_KEYS.CERTIFICATES
};

type AnyRecord = TrainingCourse | TrainingInstructor | TrainingClass | TrainingCertificate;

// ----------------------------------------------------------------- leitura base
function read<T>(key: string, fallback: T): T {
  if (isManaged(key)) {
    const v = storeGet<T>(key);
    return v === undefined || v === null ? fallback : v;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (isManaged(key)) {
    storeSet(key, value);
  } else {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem espaço */ }
  }
}

// ---------------------------------------------------------------- notificações
const listeners = new Set<() => void>();
let changeTimer: ReturnType<typeof setTimeout> | null = null;

export function subscribeTraining(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

let onLocalChange: (() => void) | null = null;
/** sync.ts registra aqui o envio automático após cada gravação. */
export function setTrainingChangeHandler(handler: (() => void) | null): void {
  onLocalChange = handler;
}

export function notifyTrainingChanged(local = false): void {
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = setTimeout(() => listeners.forEach(l => { try { l(); } catch { /* tela fechada */ } }), 0);
  if (local && onLocalChange) onLocalChange();
}

// ------------------------------------------------------------- empresa/usuário
export function currentCompanyId(): string {
  return DielectricStorageService.getSessionCompanyId() || DielectricStorageService.getActiveCompany()?.id || '';
}

export function currentUser() {
  return DielectricStorageService.getCurrentUser();
}

export function canEditTraining(): boolean {
  const u = currentUser();
  return !!u && ['admin', 'responsavel_tecnico', 'tecnico', 'administrativo'].includes(u.role);
}

export function canDeleteTraining(): boolean {
  const u = currentUser();
  return !!u && (u.role === 'admin' || !!u.isMasterAdmin);
}

// ------------------------------------------------------------- listas genéricas
function allOf<T extends AnyRecord>(table: TrainingTable): T[] {
  return read<T[]>(TABLE_KEY[table], []);
}

function listOf<T extends AnyRecord>(table: TrainingTable): T[] {
  const company = currentCompanyId();
  return allOf<T>(table).filter(r => !company || r.companyId === company);
}

function putRecord<T extends AnyRecord>(table: TrainingTable, record: T, enqueue = true): T {
  const now = new Date().toISOString();
  const saved = { ...record, companyId: record.companyId || currentCompanyId(), updatedAt: now, createdAt: record.createdAt || now } as T;
  const list = allOf<T>(table);
  const idx = list.findIndex(r => r.id === saved.id);
  if (idx >= 0) list[idx] = saved; else list.push(saved);
  write(TABLE_KEY[table], list);
  if (enqueue) enqueueTraining(table, saved.id, 'upsert');
  notifyTrainingChanged(enqueue);
  return saved;
}

function removeRecord(table: TrainingTable, id: string, enqueue = true): void {
  write(TABLE_KEY[table], allOf(table).filter(r => r.id !== id));
  if (enqueue) enqueueTraining(table, id, 'delete');
  notifyTrainingChanged(enqueue);
}

export function getTrainingRecord(table: TrainingTable, id: string): AnyRecord | undefined {
  return allOf(table).find(r => r.id === id);
}

// --------------------------------------------------------------------- cursos
export const getCourses = () => listOf<TrainingCourse>('training_courses').sort((a, b) => a.name.localeCompare(b.name));
export const getCourse = (id: string) => getCourses().find(c => c.id === id);
export const saveCourse = (c: TrainingCourse) => putRecord('training_courses', c);
export const deleteCourse = (id: string) => removeRecord('training_courses', id);

/** Cadastra os cursos padrão na primeira abertura do módulo (por empresa). */
export function ensureDefaultCourses(): number {
  const company = currentCompanyId();
  if (!company || !canEditTraining()) return 0;
  const seeded = read<Record<string, boolean>>(TRAINING_KEYS.SEEDED, {});
  if (seeded[company]) return 0;
  const existing = getCourses();
  let created = 0;
  DEFAULT_COURSES.forEach(({ key, ...seed }) => {
    const id = `crs-${company}-${key}`;
    if (existing.some(c => c.id === id || c.code === seed.code)) return;
    putRecord<TrainingCourse>('training_courses', { ...seed, topics: seed.topics.map(t => ({ ...t })), id, companyId: company, createdAt: '', updatedAt: '' });
    created++;
  });
  write(TRAINING_KEYS.SEEDED, { ...seeded, [company]: true });
  return created;
}

/** Recoloca os cursos padrão que foram apagados (botão na tela de cursos). */
export function restoreDefaultCourses(): number {
  const company = currentCompanyId();
  const seeded = read<Record<string, boolean>>(TRAINING_KEYS.SEEDED, {});
  delete seeded[company];
  write(TRAINING_KEYS.SEEDED, seeded);
  return ensureDefaultCourses();
}

// ----------------------------------------------------------------- instrutores
export const getInstructors = () => listOf<TrainingInstructor>('training_instructors').sort((a, b) => a.name.localeCompare(b.name));
export const saveInstructor = (i: TrainingInstructor) => putRecord('training_instructors', i);
export const deleteInstructor = (id: string) => removeRecord('training_instructors', id);

// --------------------------------------------------------------------- turmas
export const getClasses = () => listOf<TrainingClass>('training_classes').sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
export const getClass = (id: string) => getClasses().find(c => c.id === id);
export const saveClass = (c: TrainingClass) => putRecord('training_classes', { ...c, classNumber: c.classNumber || nextTrainingNumber('class') });
export const deleteClass = (id: string) => removeRecord('training_classes', id);

// ---------------------------------------------------------------- certificados
export const getCertificates = () => listOf<TrainingCertificate>('training_certificates').sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '') || b.certificateNumber.localeCompare(a.certificateNumber));
export const getCertificate = (id: string) => getCertificates().find(c => c.id === id);
export const saveCertificate = (c: TrainingCertificate) => putRecord('training_certificates', c);
export const deleteCertificate = (id: string) => removeRecord('training_certificates', id);

export function cancelCertificate(id: string, reason: string): TrainingCertificate | null {
  const cert = getCertificate(id);
  if (!cert) return null;
  return saveCertificate({ ...cert, status: 'cancelado', cancelReason: reason.trim() || 'Cancelado pelo emissor' });
}

export function reactivateCertificate(id: string): TrainingCertificate | null {
  const cert = getCertificate(id);
  if (!cert) return null;
  return saveCertificate({ ...cert, status: 'valido', cancelReason: undefined });
}

function technicalResponsible() {
  const info = DielectricStorageService.getCompanyInfo();
  const rt = info?.technicalResponsible;
  return {
    technicalResponsibleName: rt?.name || '',
    technicalResponsibleTitle: rt?.title || '',
    technicalResponsibleRegistration: [rt?.creaNumber, rt?.rnp ? `RNP ${rt.rnp}` : ''].filter(Boolean).join(' · '),
    technicalResponsibleSignature: rt?.signatureUrl || ''
  };
}

function instructorSnapshot(ids: string[]) {
  const all = getInstructors();
  const chosen = ids.map(id => all.find(i => i.id === id)).filter(Boolean) as TrainingInstructor[];
  return {
    instructorIds: chosen.map(i => i.id),
    instructorNames: chosen.map(i => i.name),
    instructors: chosen.map(i => ({ name: i.name, qualification: i.qualification, registration: i.registration, signatureUrl: i.signatureUrl }))
  };
}

function buildCertificate(course: TrainingCourse, data: {
  participant: Pick<TrainingParticipant, 'name' | 'cpf' | 'role' | 'company' | 'attendance' | 'grade'>;
  startDate: string; endDate: string; location: string; workloadHours: number;
  modality: TrainingCourse['modality']; instructorIds: string[]; classId?: string; classNumber?: string; issueDate?: string;
}): TrainingCertificate {
  const issueDate = data.issueDate || todayIso();
  return {
    id: newId('trc'),
    companyId: currentCompanyId(),
    createdAt: '',
    updatedAt: '',
    certificateNumber: nextTrainingNumber('certificate'),
    validationCode: generateTrainingValidationCode(),
    classId: data.classId,
    classNumber: data.classNumber,
    courseId: course.id,
    courseName: course.name,
    normReference: course.normReference,
    workloadHours: data.workloadHours || course.workloadHours,
    modality: data.modality || course.modality,
    topics: course.topics.map(t => ({ ...t })),
    prerequisite: course.prerequisite,
    courseNotes: course.notes,
    participantName: data.participant.name.trim(),
    participantCpf: data.participant.cpf,
    participantRole: data.participant.role,
    participantCompany: data.participant.company,
    attendance: data.participant.attendance,
    grade: data.participant.grade,
    startDate: data.startDate,
    endDate: data.endDate,
    location: data.location,
    issueDate,
    expiryDate: computeExpiryDate(data.endDate, course.validityMonths),
    ...instructorSnapshot(data.instructorIds),
    ...technicalResponsible(),
    status: 'valido'
  };
}

/** Emite os certificados dos aprovados da turma que ainda não têm certificado. */
export function issueCertificatesForClass(classId: string): TrainingCertificate[] {
  const turma = getClass(classId);
  if (!turma) throw new Error('Turma não encontrada.');
  const course = getCourse(turma.courseId);
  if (!course) throw new Error('O curso desta turma não existe mais. Escolha outro curso na turma.');
  const created: TrainingCertificate[] = [];
  const participants = turma.participants.map(p => {
    if (p.certificateId && getCertificate(p.certificateId)) return p;
    if (!isParticipantApproved(p, course)) return p;
    const cert = saveCertificate(buildCertificate(course, {
      participant: p, startDate: turma.startDate, endDate: turma.endDate, location: turma.location,
      workloadHours: turma.workloadHours, modality: turma.modality, instructorIds: turma.instructorIds,
      classId: turma.id, classNumber: turma.classNumber
    }));
    created.push(cert);
    return { ...p, certificateId: cert.id };
  });
  if (created.length) {
    saveClass({ ...turma, participants, status: turma.status === 'cancelada' ? turma.status : 'concluida' });
  }
  return created;
}

/** Emissão individual (sem turma). */
export function issueIndividualCertificate(data: {
  courseId: string; participant: Pick<TrainingParticipant, 'name' | 'cpf' | 'role' | 'company'> & { attendance?: number; grade?: number };
  startDate: string; endDate: string; location: string; instructorIds: string[]; workloadHours?: number;
}): TrainingCertificate {
  const course = getCourse(data.courseId);
  if (!course) throw new Error('Escolha o curso.');
  return saveCertificate(buildCertificate(course, {
    participant: { attendance: 100, ...data.participant }, startDate: data.startDate, endDate: data.endDate,
    location: data.location, workloadHours: data.workloadHours || course.workloadHours, modality: course.modality,
    instructorIds: data.instructorIds
  }));
}

// ------------------------------------------------------------------- numeração
type NumberKind = 'class' | 'certificate';
const PREFIX: Record<NumberKind, string> = { class: CLASS_PREFIX, certificate: CERTIFICATE_PREFIX };
export const TRAINING_BLOCK_SIZE: Record<NumberKind, number> = { class: 10, certificate: 40 };
const REFILL_AT: Record<NumberKind, number> = { class: 4, certificate: 15 };

function usedNumbers(kind: NumberKind): string[] {
  return kind === 'class'
    ? allOf<TrainingClass>('training_classes').map(c => c.classNumber)
    : allOf<TrainingCertificate>('training_certificates').map(c => c.certificateNumber);
}

export function nextTrainingNumber(kind: NumberKind): string {
  const company = currentCompanyId();
  const period = currentPeriod();
  const key = `${company}|${kind}`;
  const state = read<NumberBlockState>(TRAINING_KEYS.NUMBER_BLOCKS, {});
  const localMax = maxSequence(usedNumbers(kind), period);
  let taken = takeFromBlocks(state, key);
  // descarta números da faixa que já foram usados (ex.: vindos de outro aparelho)
  while (taken.value !== null && taken.value <= localMax) taken = takeFromBlocks(taken.state, key);
  write(TRAINING_KEYS.NUMBER_BLOCKS, taken.state);
  if (taken.value !== null) return formatNumber(PREFIX[kind], period, taken.value);
  return fallbackNumber(PREFIX[kind], period, localMax + 1, deviceTag(getDeviceId()));
}

export function getTrainingRefillRequests(): Array<{ kind: NumberKind; quantity: number; localMax: number; period: string }> {
  const company = currentCompanyId();
  const state = read<NumberBlockState>(TRAINING_KEYS.NUMBER_BLOCKS, {});
  const period = currentPeriod();
  return (['class', 'certificate'] as NumberKind[])
    .filter(kind => remaining(state, `${company}|${kind}`) < REFILL_AT[kind])
    .map(kind => ({ kind, quantity: TRAINING_BLOCK_SIZE[kind], localMax: maxSequence(usedNumbers(kind), period), period }));
}

export function addTrainingNumberRange(kind: NumberKind, start: number, end: number): void {
  const key = `${currentCompanyId()}|${kind}`;
  write(TRAINING_KEYS.NUMBER_BLOCKS, addRange(read<NumberBlockState>(TRAINING_KEYS.NUMBER_BLOCKS, {}), key, start, end));
}

// ------------------------------------------------------------- fila de envio
export function getTrainingQueue(): TrainingQueueItem[] {
  return read<TrainingQueueItem[]>(TRAINING_KEYS.QUEUE, []);
}

export function enqueueTraining(table: TrainingTable, id: string, action: TrainingQueueItem['action']): void {
  const queue = getTrainingQueue().filter(q => !(q.table === table && q.id === id));
  queue.push({ table, id, action, attempts: 0 });
  write(TRAINING_KEYS.QUEUE, queue);
}

export function updateTrainingQueue(mutator: (queue: TrainingQueueItem[]) => TrainingQueueItem[]): void {
  write(TRAINING_KEYS.QUEUE, mutator(getTrainingQueue()));
}

export function hasPending(table: TrainingTable, id: string): boolean {
  return getTrainingQueue().some(q => q.table === table && q.id === id);
}

export function pendingTrainingCount(): number {
  const company = currentCompanyId();
  return getTrainingQueue().filter(q => {
    const rec = getTrainingRecord(q.table, q.id);
    return !rec || rec.companyId === company;
  }).length;
}

// ------------------------------------------------- dados recebidos do servidor
/** Grava o que veio do servidor sem reenviar (e sem sobrescrever edições pendentes). */
export function applyRemoteTraining(table: TrainingTable, rows: Array<{ id: string; payload: any; deleted_at: string | null; updated_at: string }>): number {
  if (!rows.length) return 0;
  const list = allOf<AnyRecord>(table);
  const byId = new Map(list.map(r => [r.id, r]));
  let changed = 0;
  const conflicts = read<TrainingConflict[]>(TRAINING_KEYS.CONFLICTS, []);
  rows.forEach(row => {
    // edição pendente ou conflito aguardando decisão: mantém a versão do aparelho
    if (hasPending(table, row.id) || conflicts.some(c => c.table === table && c.id === row.id)) return;
    if (row.deleted_at) {
      if (byId.delete(row.id)) changed++;
      return;
    }
    if (!row.payload || typeof row.payload !== 'object') return;
    const current = byId.get(row.id);
    if (current?.serverUpdatedAt === row.updated_at) return;
    byId.set(row.id, { ...row.payload, id: row.id, serverUpdatedAt: row.updated_at });
    changed++;
  });
  if (changed) {
    write(TABLE_KEY[table], Array.from(byId.values()));
    notifyTrainingChanged(false);
  }
  return changed;
}

export function markTrainingSent(table: TrainingTable, id: string, serverUpdatedAt: string): void {
  const list = allOf<AnyRecord>(table);
  const idx = list.findIndex(r => r.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], serverUpdatedAt };
  write(TABLE_KEY[table], list);
}

export function clearServerVersion(table: TrainingTable, id: string): void {
  const list = allOf<AnyRecord>(table);
  const idx = list.findIndex(r => r.id === id);
  if (idx < 0) return;
  const { serverUpdatedAt: _drop, ...rest } = list[idx];
  list[idx] = rest as AnyRecord;
  write(TABLE_KEY[table], list);
}

export function getTrainingCursors(): Record<string, string> {
  return read<Record<string, string>>(TRAINING_KEYS.CURSORS, {});
}

export function setTrainingCursor(scope: string, value: string): void {
  write(TRAINING_KEYS.CURSORS, { ...getTrainingCursors(), [scope]: value });
}

// ------------------------------------------------------------------ conflitos
export function getTrainingConflicts(): TrainingConflict[] {
  const company = currentCompanyId();
  return read<TrainingConflict[]>(TRAINING_KEYS.CONFLICTS, []).filter(c => {
    const rec = getTrainingRecord(c.table, c.id);
    return !rec || rec.companyId === company;
  });
}

export function addTrainingConflict(conflict: TrainingConflict): void {
  const list = read<TrainingConflict[]>(TRAINING_KEYS.CONFLICTS, []).filter(c => !(c.table === conflict.table && c.id === conflict.id));
  write(TRAINING_KEYS.CONFLICTS, [...list, conflict]);
  notifyTrainingChanged(false);
}

export function removeTrainingConflict(table: TrainingTable, id: string): void {
  write(TRAINING_KEYS.CONFLICTS, read<TrainingConflict[]>(TRAINING_KEYS.CONFLICTS, []).filter(c => !(c.table === table && c.id === id)));
  notifyTrainingChanged(false);
}

export function recordLabel(table: TrainingTable, id: string): string {
  const r: any = getTrainingRecord(table, id);
  if (!r) return id;
  if (table === 'training_courses') return `Curso ${r.name}`;
  if (table === 'training_instructors') return `Instrutor ${r.name}`;
  if (table === 'training_classes') return `Turma ${r.classNumber} – ${r.courseName}`;
  return `Certificado ${r.certificateNumber} – ${r.participantName}`;
}
