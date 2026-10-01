/**
 * Sincronização do módulo Treinamentos com o Supabase (tabelas training_*).
 * Independente da sincronização dos ensaios: usa só o cliente e a sessão de
 * login da plataforma.
 */
import { SupabaseService } from '../../services/supabaseService';
import { getDeviceId } from '../../services/syncEngine';
import {
  addTrainingConflict, addTrainingNumberRange, applyRemoteTraining, clearServerVersion, currentCompanyId,
  enqueueTraining, getTrainingCursors, getTrainingQueue, getTrainingRecord, getTrainingRefillRequests,
  markTrainingSent, notifyTrainingChanged, recordLabel, removeTrainingConflict, setTrainingChangeHandler,
  setTrainingCursor, updateTrainingQueue
} from './repository';
import { isTrainingValidationCode } from './rules';
import type { PublicTrainingCertificate, TrainingTable } from './types';

const TABLES: TrainingTable[] = ['training_courses', 'training_instructors', 'training_classes', 'training_certificates'];
const PAGE = 500;

export interface TrainingSyncStatus {
  running: boolean;
  lastSyncAt?: string;
  lastError?: string;
}

let status: TrainingSyncStatus = { running: false };
const statusListeners = new Set<(s: TrainingSyncStatus) => void>();
let running: Promise<void> | null = null;

export function getTrainingSyncStatus(): TrainingSyncStatus {
  return status;
}

export function subscribeTrainingSync(listener: (s: TrainingSyncStatus) => void): () => void {
  statusListeners.add(listener);
  return () => { statusListeners.delete(listener); };
}

function setStatus(patch: Partial<TrainingSyncStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach(l => l(status));
}

const isConflict = (msg?: string) => /JV409|Conflito de edição/i.test(msg || '');
const dateOrNull = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** Colunas pesquisáveis de cada tabela; o registro completo vai em payload. */
export function toTrainingRow(table: TrainingTable, r: any): Record<string, unknown> {
  const { serverUpdatedAt, ...payload } = r;
  const base = {
    id: r.id,
    company_id: r.companyId,
    payload,
    device_id: getDeviceId(),
    deleted_at: null,
    base_updated_at: serverUpdatedAt || null
  };
  switch (table) {
    case 'training_courses':
      return { ...base, code: r.code, name: r.name, norm_reference: r.normReference, workload_hours: r.workloadHours, validity_months: r.validityMonths, active: r.active !== false };
    case 'training_instructors':
      return { ...base, name: r.name, qualification: r.qualification, registration: r.registration, active: r.active !== false };
    case 'training_classes':
      return { ...base, class_number: r.classNumber, course_id: r.courseId, course_name: r.courseName, client_id: r.clientId || null, client_name: r.clientName || null, start_date: dateOrNull(r.startDate), end_date: dateOrNull(r.endDate), location: r.location, status: r.status };
    case 'training_certificates':
      return { ...base, certificate_number: r.certificateNumber, validation_code: r.validationCode, class_id: r.classId || null, course_id: r.courseId, course_name: r.courseName, participant_name: r.participantName, participant_cpf: r.participantCpf, participant_company: r.participantCompany || null, issue_date: dateOrNull(r.issueDate), expiry_date: dateOrNull(r.expiryDate), status: r.status };
  }
}

async function canSync(): Promise<boolean> {
  if (!SupabaseService.getConfig().enabled) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (!currentCompanyId()) return false;
  return !!(await SupabaseService.getSession());
}

async function push(): Promise<string | undefined> {
  const client = SupabaseService.getClient();
  const company = currentCompanyId();
  let lastError: string | undefined;
  for (const item of getTrainingQueue()) {
    const record: any = getTrainingRecord(item.table, item.id);
    if (record && record.companyId !== company) continue; // de outra empresa (troca de login)
    let error: { message: string } | null = null;
    let updatedAt: string | undefined;
    if (item.action === 'delete') {
      ({ error } = await client.from(item.table)
        .update({ deleted_at: new Date().toISOString(), device_id: getDeviceId(), base_updated_at: null })
        .eq('id', item.id));
    } else if (record) {
      const res = await client.from(item.table).upsert(toTrainingRow(item.table, record), { onConflict: 'id' }).select('updated_at').maybeSingle();
      error = res.error;
      updatedAt = (res.data as any)?.updated_at;
    }
    if (error) {
      if (isConflict(error.message)) {
        addTrainingConflict({ table: item.table, id: item.id, label: recordLabel(item.table, item.id), detectedAt: new Date().toISOString() });
        updateTrainingQueue(q => q.filter(x => !(x.table === item.table && x.id === item.id)));
        continue;
      }
      lastError = error.message;
      updateTrainingQueue(q => q.map(x => x.table === item.table && x.id === item.id ? { ...x, attempts: x.attempts + 1, lastError: error!.message } : x));
      continue;
    }
    updateTrainingQueue(q => q.filter(x => !(x.table === item.table && x.id === item.id && x.action === item.action)));
    if (updatedAt) markTrainingSent(item.table, item.id, updatedAt);
  }
  return lastError;
}

async function pull(): Promise<void> {
  const client = SupabaseService.getClient();
  const company = currentCompanyId();
  for (const table of TABLES) {
    const scope = `${company}|${table}`;
    let cursor = getTrainingCursors()[scope] || '1970-01-01T00:00:00Z';
    for (;;) {
      const { data, error } = await client.from(table)
        .select('id, payload, deleted_at, updated_at')
        .eq('company_id', company)
        .gt('updated_at', cursor)
        .order('updated_at', { ascending: true })
        .limit(PAGE);
      if (error) throw new Error(error.message);
      const rows = (data || []) as any[];
      applyRemoteTraining(table, rows);
      if (rows.length) {
        cursor = rows[rows.length - 1].updated_at;
        setTrainingCursor(scope, cursor);
      }
      if (rows.length < PAGE) break;
    }
  }
}

async function refillNumbers(): Promise<void> {
  const client = SupabaseService.getClient();
  for (const req of getTrainingRefillRequests()) {
    const { data, error } = await client.rpc('jvm_training_reserve_numbers', {
      p_kind: req.kind, p_period: req.period, p_quantity: req.quantity, p_local_max: req.localMax
    });
    if (error) return; // perfil sem permissão ou módulo ainda não instalado no banco
    const range: any = typeof data === 'string' ? JSON.parse(data) : data;
    if (range && Number.isFinite(range.start) && Number.isFinite(range.end)) addTrainingNumberRange(req.kind, range.start, range.end);
  }
}

/** Envia o que está pendente, baixa as novidades e reserva numeração. */
export function syncTraining(): Promise<void> {
  if (running) return running;
  running = (async () => {
    if (!(await canSync())) return;
    setStatus({ running: true });
    try {
      const pushError = await push();
      await pull();
      await refillNumbers();
      setStatus({ lastSyncAt: new Date().toISOString(), lastError: pushError });
    } catch (err: any) {
      const msg = String(err?.message || err);
      setStatus({ lastError: /relation .*training_|does not exist|schema cache/i.test(msg)
        ? 'O banco ainda não tem o módulo Treinamentos: execute supabase/modules/treinamentos.sql no Supabase.'
        : msg });
    } finally {
      setStatus({ running: false });
      notifyTrainingChanged(false);
    }
  })().finally(() => { running = null; });
  return running;
}

let sendTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let users = 0;
const onOnline = () => { void syncTraining(); };

/** Liga a sincronização automática enquanto a tela do módulo está aberta. */
export function startTrainingSync(): () => void {
  users++;
  if (users === 1) {
    setTrainingChangeHandler(() => {
      if (sendTimer) clearTimeout(sendTimer);
      sendTimer = setTimeout(() => { void syncTraining(); }, 1500);
    });
    intervalTimer = setInterval(() => { void syncTraining(); }, 90_000);
    window.addEventListener('online', onOnline);
  }
  void syncTraining();
  return () => {
    users = Math.max(0, users - 1);
    if (users === 0) {
      setTrainingChangeHandler(null);
      if (intervalTimer) clearInterval(intervalTimer);
      window.removeEventListener('online', onOnline);
    }
  };
}

/** Conflito: manter a versão deste aparelho (sobrescreve a do servidor). */
export async function resolveConflictKeepMine(table: TrainingTable, id: string): Promise<void> {
  clearServerVersion(table, id);
  enqueueTraining(table, id, 'upsert');
  removeTrainingConflict(table, id);
  await syncTraining();
}

/** Conflito: usar a versão do servidor (descarta a edição deste aparelho). */
export async function resolveConflictUseServer(table: TrainingTable, id: string): Promise<void> {
  const { data, error } = await SupabaseService.getClient().from(table)
    .select('id, payload, deleted_at, updated_at').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  removeTrainingConflict(table, id);
  if (data) applyRemoteTraining(table, [data as any]);
}

/** Validador público (sem login): consulta pelo código do QR Code. */
export async function fetchPublicTrainingCertificate(code: string): Promise<PublicTrainingCertificate | null> {
  const clean = (code || '').trim().toUpperCase();
  if (!isTrainingValidationCode(clean)) return null;
  try {
    const { data, error } = await SupabaseService.getClient().rpc('jvm_validar_treinamento', { p_code: clean });
    if (error || !data) return null;
    const payload: any = typeof data === 'string' ? JSON.parse(data) : data;
    if (!payload?.certificate) return null;
    return {
      ...payload.certificate,
      companyName: payload.company?.name || '',
      companyLegalName: payload.company?.legal_name || '',
      companyCnpj: payload.company?.cnpj || ''
    };
  } catch {
    return null;
  }
}
