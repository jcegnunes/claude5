/**
 * Certificados digitais A1 dos instrutores e do Responsável Técnico.
 * Arquivo e senha ficam criptografados no banco (supabase/modules/treinamentos.sql)
 * e só são buscados na hora de assinar (exige internet). Neste aparelho fica
 * apenas a lista (titular e validade) e, durante a sessão, o material em memória.
 */
import { SupabaseService } from '../../services/supabaseService';
import { currentCompanyId, currentUser, getInstructors } from './repository';
import { base64ToBytes, bytesToBase64, inspectP12, isCertExpired, type PdfSigner } from './digitalSignature';
import type { TrainingCertificate } from './types';

export type SigningOwnerType = 'instructor' | 'rt';

export interface SigningCertSummary {
  ownerType: SigningOwnerType;
  ownerId: string;
  holderName: string;
  holderDoc: string;
  issuer: string;
  serial: string;
  validFrom: string;
  validTo: string;
  updatedAt?: string;
  lastUsedAt?: string;
}

const LIST_KEY = 'jvm_training_signing_list';
const listeners = new Set<() => void>();
const material = new Map<string, { p12: Uint8Array; password: string; holderName: string; validTo: string } | null>();

const keyOf = (type: SigningOwnerType, id: string) => `${type}:${type === 'rt' ? 'rt' : id}`;

function readCache(): SigningCertSummary[] {
  try {
    const all = JSON.parse(localStorage.getItem(LIST_KEY) || '{}');
    return Array.isArray(all[currentCompanyId()]) ? all[currentCompanyId()] : [];
  } catch {
    return [];
  }
}

function writeCache(list: SigningCertSummary[]) {
  try {
    const all = JSON.parse(localStorage.getItem(LIST_KEY) || '{}');
    all[currentCompanyId()] = list;
    localStorage.setItem(LIST_KEY, JSON.stringify(all));
  } catch { /* só nesta sessão */ }
  listeners.forEach(l => l());
}

export function subscribeSigningCerts(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function getCachedSigningCerts(): SigningCertSummary[] {
  return readCache();
}

export function findSigningCert(type: SigningOwnerType, id: string): SigningCertSummary | undefined {
  return readCache().find(c => keyOf(c.ownerType, c.ownerId) === keyOf(type, id));
}

/** Administrador ou Responsável Técnico cadastram/trocam/removem. */
export function canManageSigningCerts(): boolean {
  const u = currentUser();
  return !!u && (u.role === 'admin' || u.role === 'responsavel_tecnico' || !!u.isMasterAdmin);
}

const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

function rpcError(error: { message?: string } | null): Error {
  const msg = error?.message || 'Falha no servidor';
  if (/function .*jvm_training_.*signing|does not exist|schema cache/i.test(msg)) {
    return new Error('O banco ainda não tem o recurso de certificado digital: execute de novo supabase/modules/treinamentos.sql no Supabase.');
  }
  return new Error(msg);
}

/** Atualiza a lista a partir do servidor (sem internet: usa a última lista). */
export async function loadSigningCerts(): Promise<SigningCertSummary[]> {
  if (!online()) return readCache();
  try {
    const { data, error } = await SupabaseService.getClient().rpc('jvm_training_signing_certs');
    if (error) return readCache();
    const list = (typeof data === 'string' ? JSON.parse(data) : data) as SigningCertSummary[] || [];
    writeCache(list);
    return list;
  } catch {
    return readCache();
  }
}

/** Confere o arquivo com a senha e grava no servidor (criptografado). */
export async function saveSigningCert(type: SigningOwnerType, ownerId: string, file: File, password: string): Promise<SigningCertSummary> {
  if (!online()) throw new Error('Cadastrar certificado digital exige internet.');
  if (!/\.(pfx|p12)$/i.test(file.name)) throw new Error('Escolha o arquivo do certificado A1 (.pfx ou .p12).');
  if (file.size > 100_000) throw new Error('Arquivo grande demais para um certificado A1.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = inspectP12(bytes, password);
  if (isCertExpired(info)) throw new Error(`Este certificado venceu em ${new Date(info.validTo).toLocaleDateString('pt-BR')}.`);
  const { error } = await SupabaseService.getClient().rpc('jvm_training_save_signing_cert', {
    p_owner_type: type,
    p_owner_id: type === 'rt' ? 'rt' : ownerId,
    p_pfx_base64: bytesToBase64(bytes),
    p_password: password,
    p_holder_name: info.holderName,
    p_holder_doc: info.holderDoc,
    p_issuer: info.issuer,
    p_serial: info.serial,
    p_valid_from: info.validFrom,
    p_valid_to: info.validTo
  });
  if (error) throw rpcError(error);
  material.delete(keyOf(type, ownerId));
  await loadSigningCerts();
  return { ownerType: type, ownerId: type === 'rt' ? 'rt' : ownerId, ...info };
}

export async function deleteSigningCert(type: SigningOwnerType, ownerId: string): Promise<void> {
  if (!online()) throw new Error('Remover certificado digital exige internet.');
  const { error } = await SupabaseService.getClient().rpc('jvm_training_delete_signing_cert', { p_owner_type: type, p_owner_id: ownerId });
  if (error) throw rpcError(error);
  material.delete(keyOf(type, ownerId));
  await loadSigningCerts();
}

async function getMaterial(type: SigningOwnerType, ownerId: string) {
  const key = keyOf(type, ownerId);
  if (material.has(key)) return material.get(key)!;
  const { data, error } = await SupabaseService.getClient().rpc('jvm_training_signing_material', { p_owner_type: type, p_owner_id: ownerId });
  if (error) throw rpcError(error);
  const m: any = typeof data === 'string' ? JSON.parse(data) : data;
  const value = m && m.pfx ? { p12: base64ToBytes(m.pfx), password: m.password, holderName: m.holderName || '', validTo: m.validTo || '' } : null;
  material.set(key, value);
  return value;
}

export interface SignaturePlan {
  signers: PdfSigner[];
  /** Nomes impressos com "Assinado digitalmente" */
  names: string[];
  /** Avisos (certificado vencido, sem internet...) */
  warnings: string[];
}

/** Quem assina este certificado: Responsável Técnico e instrutores com certificado digital. */
export async function planSignatures(cert: TrainingCertificate): Promise<SignaturePlan> {
  const plan: SignaturePlan = { signers: [], names: [], warnings: [] };
  const wanted: Array<{ type: SigningOwnerType; id: string; label: string }> = [];
  if (cert.technicalResponsibleName && findSigningCert('rt', 'rt')) wanted.push({ type: 'rt', id: 'rt', label: cert.technicalResponsibleName });
  const instructors = getInstructors();
  cert.instructorIds.forEach((id, i) => {
    if (findSigningCert('instructor', id)) wanted.push({ type: 'instructor', id, label: cert.instructorNames[i] || instructors.find(x => x.id === id)?.name || 'Instrutor' });
  });
  if (!wanted.length) return plan;
  if (!online()) {
    plan.warnings.push('Sem internet: o PDF sai sem assinatura digital.');
    return plan;
  }
  for (const w of wanted) {
    const m = await getMaterial(w.type, w.id);
    if (!m) continue;
    if (m.validTo && new Date(m.validTo).getTime() < Date.now()) {
      plan.warnings.push(`Certificado digital de ${w.label} vencido: não assinado.`);
      continue;
    }
    plan.signers.push({
      p12: m.p12,
      password: m.password,
      name: m.holderName || w.label,
      reason: w.type === 'rt' ? 'Responsável Técnico – certificado de treinamento' : 'Instrutor – certificado de treinamento'
    });
    plan.names.push(w.label);
  }
  return plan;
}

/** Algum certificado digital cadastrado para a empresa? */
export function hasAnySigningCert(): boolean {
  return readCache().length > 0;
}
