/**
 * Mapeamento entre o modelo de dados do app (camelCase) e as tabelas do Supabase.
 *
 * Cada linha é gravada com:
 *  - colunas "legíveis" (para consultas, relatórios SQL e validação pública)
 *  - payload JSONB com o registro completo, garantindo que NENHUM campo do
 *    ensaio/equipamento se perca na ida e volta (antes, campos específicos
 *    de escadas, detectores, mantas etc. eram descartados no pull).
 *  - deleted_at para propagar exclusões entre dispositivos.
 *
 * updated_at NÃO é enviado: é definido pelo servidor (gatilho) e usado como
 * cursor do pull incremental.
 */
import {
  Client,
  Company,
  CompanyLabInfo,
  ConsolidatedReport,
  Equipment,
  LabInstrument,
  NormCriterion,
  ServiceOrder,
  TestRecord,
  User,
  AuditLog
} from '../types';

export type SyncTable =
  | 'companies'
  | 'users'
  | 'clients'
  | 'equipment'
  | 'service_orders'
  | 'lab_instruments'
  | 'norms'
  | 'test_records'
  | 'consolidated_reports'
  | 'audit_logs';

/** Ordem de envio respeitando chaves estrangeiras (pais antes dos filhos). */
export const SYNC_TABLE_ORDER: SyncTable[] = [
  'companies',
  'users',
  'clients',
  'equipment',
  'service_orders',
  'lab_instruments',
  'norms',
  'test_records',
  'consolidated_reports',
  'audit_logs'
];

/** Colunas de usuários liberadas para o app (a senha não é legível). */
export const USERS_SELECT_COLUMNS =
  'id,company_id,company_name,name,email,username,role,cargo,registration_number,crea_or_cft,phone,active,is_master_admin,signature_url,custom_settings,payload,device_id,deleted_at,created_at,updated_at';

/** Tabelas baixadas do servidor (auditoria é somente envio). */
export const PULL_TABLES: SyncTable[] = SYNC_TABLE_ORDER.filter(t => t !== 'audit_logs');

/** Sanitiza datas para o tipo DATE do PostgreSQL (YYYY-MM-DD) ou null. */
export function sanitizeDate(d: any): string | null {
  if (!d || typeof d !== 'string') return null;
  const trimmed = d.trim();
  if (!trimmed) return null;
  if (trimmed.includes('T')) {
    const part = trimmed.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
}

/** Sanitiza timestamps (TIMESTAMPTZ) ou null. */
export function sanitizeTimestamp(d: any): string | null {
  if (!d || typeof d !== 'string') return null;
  const parsed = new Date(d.trim());
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Conversão segura para colunas NUMERIC/INTEGER. */
export function sanitizeNumber(val: any, fallback: number = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(',', '.'));
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

function sanitizeInt(val: any): number | null {
  const n = sanitizeNumber(val, NaN);
  return isNaN(n) ? null : Math.round(n);
}

/** Remove undefined recursivamente (JSONB não aceita) e campos puramente locais. */
export function cleanPayload<T extends Record<string, any>>(obj: T, omit: string[] = []): Record<string, any> {
  const skip = new Set(['syncStatus', ...omit]);
  const walk = (v: any): any => {
    if (v === undefined) return undefined;
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.filter(i => i !== undefined).map(walk);
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) {
      if (val !== undefined) out[k] = walk(val);
    }
    return out;
  };
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (skip.has(k) || v === undefined) continue;
    result[k] = walk(v);
  }
  return result;
}

function parsePayload(row: any): Record<string, any> | null {
  if (!row || !row.payload) return null;
  if (typeof row.payload === 'object') return row.payload;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

function withSyncMeta<T>(obj: any, row: any): T {
  const out: any = { ...obj };
  if (row.deleted_at) {
    out.deletedAt = row.deleted_at;
  } else {
    delete out.deletedAt;
  }
  out.syncStatus = 'synced';
  return out as T;
}

// ---------------------------------------------------------------------------
// COMPANIES
// ---------------------------------------------------------------------------
export function companyToRow(comp: Company, deviceId: string, labInfo?: CompanyLabInfo | null): Record<string, any> {
  const row: Record<string, any> = {
    id: comp.id,
    name: comp.name || comp.legalName || 'Empresa',
    legal_name: comp.legalName || comp.tradeName || comp.name,
    cnpj: comp.cnpj || '',
    inscricao_estadual: comp.inscricaoEstadual || null,
    city: comp.city || null,
    state: comp.state || null,
    cep: comp.cep || null,
    phone: comp.phone || null,
    email: comp.email || null,
    logo_url: comp.logoUrl || null,
    technical_responsible: comp.technicalResponsible ? JSON.stringify(comp.technicalResponsible) : null,
    active: comp.active !== false,
    payload: cleanPayload(comp),
    device_id: deviceId,
    deleted_at: null
  };
  if (labInfo) {
    // Credenciais de conexão ficam apenas no aparelho
    row.lab_info = cleanPayload(labInfo, ['supabaseAnonKey', 'supabaseUrl', 'supabaseEnabled', 'supabaseAutoSync', 'lastSupabaseSyncTime']);
  }
  return row;
}

export function rowToCompany(row: any): Company {
  const p = parsePayload(row);
  if (p) {
    return withSyncMeta<Company>({ ...p, id: row.id, updatedAt: row.updated_at || p.updatedAt }, row);
  }
  let tech: any = undefined;
  if (row.technical_responsible) {
    if (typeof row.technical_responsible === 'object') tech = row.technical_responsible;
    else {
      try {
        tech = JSON.parse(row.technical_responsible);
      } catch {
        tech = { name: row.technical_responsible, title: 'Responsável Técnico', creaNumber: '', rnp: '' };
      }
    }
  }
  return withSyncMeta<Company>({
    id: row.id,
    name: row.name,
    legalName: row.legal_name || row.name,
    tradeName: row.name,
    cnpj: row.cnpj || '',
    inscricaoEstadual: row.inscricao_estadual || undefined,
    city: row.city || '',
    state: row.state || '',
    cep: row.cep || '',
    phone: row.phone || '',
    email: row.email || '',
    active: row.active ?? true,
    logoUrl: row.logo_url || undefined,
    technicalResponsible: tech,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  }, row);
}

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------
export function userToRow(u: User, deviceId: string): Record<string, any> {
  return {
    id: u.id,
    company_id: u.companyId || 'comp-jvm',
    company_name: u.companyName || null,
    name: u.name,
    email: (u.email || '').trim().toLowerCase(),
    role: u.role,
    cargo: u.cargo || null,
    registration_number: u.registrationNumber || null,
    crea_or_cft: u.creaOrCft || u.registrationNumber || null,
    phone: u.phone || null,
    // A senha NUNCA é enviada pelo app: é gravada criptografada pelo banco
    // (painel do Supabase ou função jvm_set_initial_password).
    username: u.username ? u.username.trim().toLowerCase() : null,
    active: u.active !== false,
    is_master_admin: !!u.isMasterAdmin,
    signature_url: u.signatureUrl || null,
    custom_settings: u.customSettings || null,
    payload: cleanPayload(u, ['password']),
    device_id: deviceId,
    deleted_at: (u as any).deletedAt || null
  };
}

export function rowToUser(row: any): User {
  const p = parsePayload(row) || {};
  return withSyncMeta<User>({
    ...p,
    id: row.id,
    companyId: row.company_id || p.companyId || 'comp-jvm',
    companyName: row.company_name || p.companyName || 'JVM Engenharia & Treinamentos',
    name: row.name,
    email: row.email,
    role: row.role,
    cargo: row.cargo || p.cargo || 'Especialista em Ensaios',
    registrationNumber: row.registration_number || p.registrationNumber || '',
    creaOrCft: row.crea_or_cft || row.registration_number || '',
    phone: row.phone || '',
    username: row.username || p.username || undefined,
    password: '', // senhas nunca ficam no aparelho
    active: row.active ?? true,
    isMasterAdmin: !!row.is_master_admin,
    signatureUrl: row.signature_url || p.signatureUrl || undefined,
    customSettings: row.custom_settings || p.customSettings || undefined
  }, row);
}

// ---------------------------------------------------------------------------
// CLIENTS
// ---------------------------------------------------------------------------
export function clientToRow(c: Client, deviceId: string): Record<string, any> {
  return {
    id: c.id,
    company_id: c.companyId || 'comp-jvm',
    razao_social: c.razaoSocial || c.nomeFantasia || 'Cliente',
    nome_fantasia: c.nomeFantasia || c.razaoSocial,
    cnpj: c.cnpj || '',
    inscricao_estadual: c.inscricaoEstadual || null,
    email: c.email || null,
    telefone: c.telefone || null,
    contato_responsavel: c.responsavel || null,
    endereco: c.endereco || null,
    cidade: c.cidade || null,
    estado: c.estado || null,
    cep: c.cep || null,
    data_cadastro: sanitizeTimestamp(c.createdAt) || new Date().toISOString(),
    status: 'ativo',
    observacoes: c.observacoes || null,
    payload: cleanPayload(c),
    device_id: deviceId,
    deleted_at: (c as any).deletedAt || null
  };
}

export function rowToClient(row: any): Client {
  const p = parsePayload(row);
  if (p) {
    return withSyncMeta<Client>({ ...p, id: row.id, companyId: row.company_id || p.companyId, updatedAt: row.updated_at || p.updatedAt }, row);
  }
  return withSyncMeta<Client>({
    id: row.id,
    companyId: row.company_id || undefined,
    razaoSocial: row.razao_social || '',
    nomeFantasia: row.nome_fantasia || '',
    cnpj: row.cnpj || '',
    inscricaoEstadual: row.inscricao_estadual || undefined,
    email: row.email || '',
    telefone: row.telefone || '',
    responsavel: row.contato_responsavel || 'Contato Principal',
    cargoResponsavel: 'Responsável',
    endereco: row.endereco || '',
    numero: '',
    bairro: '',
    cidade: row.cidade || '',
    estado: row.estado || '',
    cep: row.cep || '',
    observacoes: row.observacoes || undefined,
    createdAt: row.data_cadastro || row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  }, row);
}

// ---------------------------------------------------------------------------
// EQUIPMENT
// ---------------------------------------------------------------------------
export function equipmentToRow(eq: Equipment, deviceId: string): Record<string, any> {
  return {
    id: eq.id,
    company_id: eq.companyId || 'comp-jvm',
    uuid: eq.uuid || eq.id,
    client_id: eq.clientId || null,
    client_name: eq.clientName || null,
    service_order_id: eq.serviceOrderId || null,
    service_order_number: eq.serviceOrderNumber || null,
    type: eq.type || 'outro',
    tag: eq.tag || eq.id,
    serial_number: eq.serialNumber || null,
    ca_number: eq.caNumber || null,
    asset_number: eq.assetNumber || null,
    manufacturer: eq.manufacturer || null,
    model: eq.model || null,
    dielectric_class: String(eq.dielectricClass || '0'),
    size_or_length: eq.sizeOrLength || null,
    glove_length_mm: sanitizeInt(eq.gloveLength_mm),
    blanket_type: eq.blanketType || null,
    blanket_style: eq.blanketStyle || null,
    blanket_dimensions: eq.blanketDimensions || null,
    matting_surface: eq.mattingSurface || null,
    matting_thickness_mm: sanitizeNumber(eq.mattingThickness_mm, 0) || null,
    matting_dimensions: eq.mattingDimensions || null,
    ladder_type: eq.ladderType || null,
    ladder_rungs_count: sanitizeInt(eq.ladderRungsCount),
    ladder_length_extended_m: sanitizeNumber(eq.ladderLengthExtended_m, 0) || null,
    ladder_load_capacity_kg: sanitizeInt(eq.ladderLoadCapacity_kg),
    isolated_tools: eq.isolatedTools || null,
    status: eq.status || 'em_uso',
    collaborator_name: eq.collaboratorName || null,
    collaborator_registration: eq.collaboratorRegistration || null,
    collaborator_sector: eq.collaboratorSector || null,
    last_test_date: sanitizeDate(eq.lastTestDate),
    next_test_due_date: sanitizeDate(eq.nextTestDueDate),
    retest_interval_months: sanitizeInt(eq.retestIntervalMonths) || 6,
    qr_code: eq.qrCode || eq.tag,
    payload: cleanPayload(eq),
    device_id: deviceId,
    deleted_at: eq.deletedAt || null
  };
}

export function rowToEquipment(row: any): Equipment {
  const p = parsePayload(row);
  if (p) {
    return withSyncMeta<Equipment>({ ...p, id: row.id, companyId: row.company_id || p.companyId, updatedAt: row.updated_at || p.updatedAt }, row);
  }
  return withSyncMeta<Equipment>({
    id: row.id,
    companyId: row.company_id || undefined,
    uuid: row.uuid || row.id,
    clientId: row.client_id,
    clientName: row.client_name || undefined,
    serviceOrderId: row.service_order_id || undefined,
    serviceOrderNumber: row.service_order_number || undefined,
    type: row.type,
    tag: row.tag,
    serialNumber: row.serial_number || '',
    caNumber: row.ca_number || undefined,
    assetNumber: row.asset_number || undefined,
    manufacturer: row.manufacturer || '',
    model: row.model || '',
    dielectricClass: row.dielectric_class || '0',
    sizeOrLength: row.size_or_length || undefined,
    gloveLength_mm: row.glove_length_mm || undefined,
    blanketType: row.blanket_type || undefined,
    blanketStyle: row.blanket_style || undefined,
    blanketDimensions: row.blanket_dimensions || undefined,
    mattingSurface: row.matting_surface || undefined,
    mattingThickness_mm: row.matting_thickness_mm ? Number(row.matting_thickness_mm) : undefined,
    mattingDimensions: row.matting_dimensions || undefined,
    ladderType: row.ladder_type || undefined,
    ladderRungsCount: row.ladder_rungs_count || undefined,
    ladderLengthExtended_m: row.ladder_length_extended_m ? Number(row.ladder_length_extended_m) : undefined,
    ladderLoadCapacity_kg: row.ladder_load_capacity_kg || undefined,
    isolatedTools: row.isolated_tools || undefined,
    status: row.status || 'em_uso',
    collaboratorName: row.collaborator_name || undefined,
    collaboratorRegistration: row.collaborator_registration || undefined,
    collaboratorSector: row.collaborator_sector || undefined,
    lastTestDate: row.last_test_date || undefined,
    nextTestDueDate: row.next_test_due_date || undefined,
    retestIntervalMonths: row.retest_interval_months || 6,
    qrCode: row.qr_code || row.tag,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  }, row);
}

// ---------------------------------------------------------------------------
// SERVICE ORDERS
// ---------------------------------------------------------------------------
export function serviceOrderToRow(os: ServiceOrder, deviceId: string): Record<string, any> {
  return {
    id: os.id,
    company_id: os.companyId || 'comp-jvm',
    os_number: os.osNumber || `OS-${os.id}`,
    client_id: os.clientId || null,
    client_name: (os.clientName && os.clientName.trim()) || 'Cliente Geral',
    status: os.status || 'aberta',
    priority: (os as any).priority || 'normal',
    opened_at: sanitizeTimestamp(os.openDate) || sanitizeTimestamp(os.createdAt) || new Date().toISOString(),
    scheduled_for: sanitizeDate(os.scheduledDate),
    completed_at: os.status === 'concluida' ? (sanitizeTimestamp(os.updatedAt) || new Date().toISOString()) : null,
    technician_id: os.technicianId || null,
    technician_name: os.technicianName || 'Técnico Responsável',
    technician_cft_crea: (os as any).technicianCftCrea || null,
    art_number: os.artNumber || null,
    service_location: (os as any).serviceLocation || null,
    scope_description: os.notes || null,
    equipment_ids: os.equipmentIds || [],
    total_items: os.equipmentIds?.length || 0,
    technical_notes: os.notes || null,
    payload: cleanPayload(os),
    device_id: deviceId,
    deleted_at: os.deletedAt || null
  };
}

export function rowToServiceOrder(row: any): ServiceOrder {
  const p = parsePayload(row);
  if (p) {
    return withSyncMeta<ServiceOrder>({ ...p, id: row.id, companyId: row.company_id || p.companyId, updatedAt: row.updated_at || p.updatedAt }, row);
  }
  const rawOpened: string = row.opened_at || row.created_at || new Date().toISOString();
  return withSyncMeta<ServiceOrder>({
    id: row.id,
    companyId: row.company_id || undefined,
    osNumber: row.os_number,
    clientId: row.client_id,
    clientName: row.client_name || 'Cliente',
    openDate: rawOpened.includes('T') ? rawOpened.split('T')[0] : rawOpened,
    scheduledDate: row.scheduled_for || undefined,
    status: row.status || 'aberta',
    responsibleId: row.technician_id || 'usr-master-admin-001',
    responsibleName: row.technician_name || 'Responsável Técnico',
    technicianId: row.technician_id || 'usr-tech',
    technicianName: row.technician_name || 'Técnico Responsável',
    equipmentIds: Array.isArray(row.equipment_ids) ? row.equipment_ids : [],
    notes: row.scope_description || row.technical_notes || undefined,
    artNumber: row.art_number || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  }, row);
}

// ---------------------------------------------------------------------------
// TEST RECORDS (ENSAIOS)
// ---------------------------------------------------------------------------
/** Campos pesados guardados apenas em colunas próprias (evita duplicar no payload). */
const TEST_HEAVY_FIELDS = ['photos', 'technicianSignature', 'techResponsibleSignature', 'clientSignature', 'qrCodeDataUrl'];

export function testToRow(t: TestRecord, deviceId: string): Record<string, any> {
  return {
    id: t.id,
    company_id: t.companyId || 'comp-jvm',
    uuid: t.uuid || `uuid-${t.id}`,
    test_number: t.testNumber || t.id,
    report_number: t.reportNumber || t.testNumber || t.id,
    certificate_number: t.certificateNumber || null,
    validation_code: t.validationCode || ('VAL-' + String(t.id).replace(/[^a-zA-Z0-9]/g, '').slice(-10).toUpperCase()),
    document_hash: t.documentHash || ('HASH-' + String(t.id).slice(-8).toUpperCase()),
    client_id: t.clientId || null,
    client_name: t.clientName || 'Cliente Geral',
    equipment_id: t.equipmentId || null,
    equipment_tag: t.equipmentTag || 'S/TAG',
    equipment_type: t.equipmentType || 'outro',
    equipment_class: t.equipmentClass || t.appliedClass || '0',
    equipment_serial: t.equipmentSerial || null,
    equipment_ca: t.equipmentCa || null,
    collaborator_name: t.collaboratorName || null,
    collaborator_registration: t.collaboratorRegistration || null,
    collaborator_sector: t.collaboratorSector || null,
    service_order_id: t.serviceOrderId || null,
    service_order_number: t.serviceOrderNumber || null,
    art_number: t.artNumber || null,
    technician_id: t.technicianId || null,
    technician_name: t.technicianName || 'Técnico Responsável',
    technician_cft_or_crea: t.technicianCftOrCrea || null,
    tech_responsible_id: t.techResponsibleId || null,
    tech_responsible_name: t.techResponsibleName || 'Responsável Técnico',
    tech_responsible_crea: t.techResponsibleCrea || null,
    test_date: sanitizeDate(t.testDate) || new Date().toISOString().split('T')[0],
    test_time: t.testTime || null,
    location: t.location || null,
    norm_code: t.normCode || 'N/A',
    procedure_code: t.procedureCode || null,
    applied_class: t.appliedClass || t.equipmentClass || '0',
    applied_voltage_kv: sanitizeNumber(t.appliedVoltage_kV, 0),
    voltage_type: t.voltageType || 'AC',
    application_duration_seconds: Math.round(sanitizeNumber(t.applicationDurationSeconds, 60)),
    measured_leakage_current_ma: sanitizeNumber(t.measuredLeakageCurrent_mA, 0),
    leakage_current_limit_ma: sanitizeNumber(t.leakageCurrentLimit_mA, 0),
    current_unit: t.currentUnit || 'mA',
    withstand_without_puncture: t.withstandWithoutPuncture !== false,
    glove_length_mm: sanitizeInt(t.gloveLength_mm),
    matting_surface: t.mattingSurface || null,
    matting_thickness_mm: sanitizeNumber(t.mattingThickness_mm, 0) || null,
    isolated_tools: t.isolatedTools || null,
    tools_evaluation: t.toolsEvaluation || null,
    environmental: t.environmental || null,
    visual_inspection: t.visualInspection || [],
    visual_inspection_passed: t.visualInspectionPassed !== false,
    instruments_used: t.instrumentsUsed || [],
    result: t.result || 'PENDENTE',
    result_rationale: t.resultRationale || null,
    approved_opinion: t.approvedOpinion || null,
    reproved_opinion: t.reprovedOpinion || null,
    technical_notes: t.technicalNotes || null,
    retest_due_date: sanitizeDate(t.retestDueDate),
    technician_signature: t.technicianSignature || null,
    tech_responsible_signature: t.techResponsibleSignature || null,
    client_signature: t.clientSignature || null,
    photos: t.photos || [],
    payload: cleanPayload(t, TEST_HEAVY_FIELDS),
    device_id: deviceId,
    deleted_at: t.deletedAt || null
  };
}

export function rowToTest(row: any): TestRecord {
  const p = parsePayload(row);
  const heavy = {
    photos: Array.isArray(row.photos) ? row.photos : [],
    technicianSignature: row.technician_signature || undefined,
    techResponsibleSignature: row.tech_responsible_signature || undefined,
    clientSignature: row.client_signature || undefined
  };
  if (p) {
    return withSyncMeta<TestRecord>({
      ...p,
      ...heavy,
      id: row.id,
      companyId: row.company_id || p.companyId,
      updatedAt: row.updated_at || p.updatedAt
    }, row);
  }
  return withSyncMeta<TestRecord>({
    id: row.id,
    companyId: row.company_id || undefined,
    uuid: row.uuid || row.id,
    testNumber: row.test_number,
    reportNumber: row.report_number,
    certificateNumber: row.certificate_number || undefined,
    validationCode: row.validation_code,
    documentHash: row.document_hash,
    clientId: row.client_id,
    clientName: row.client_name,
    equipmentId: row.equipment_id,
    equipmentTag: row.equipment_tag,
    equipmentType: row.equipment_type,
    equipmentClass: row.equipment_class,
    equipmentSerial: row.equipment_serial,
    equipmentCa: row.equipment_ca || undefined,
    collaboratorName: row.collaborator_name || undefined,
    collaboratorRegistration: row.collaborator_registration || undefined,
    collaboratorSector: row.collaborator_sector || undefined,
    serviceOrderId: row.service_order_id,
    serviceOrderNumber: row.service_order_number,
    artNumber: row.art_number || undefined,
    technicianId: row.technician_id,
    technicianName: row.technician_name,
    technicianCftOrCrea: row.technician_cft_or_crea || undefined,
    techResponsibleId: row.tech_responsible_id,
    techResponsibleName: row.tech_responsible_name,
    techResponsibleCrea: row.tech_responsible_crea,
    testDate: row.test_date,
    testTime: row.test_time,
    location: row.location,
    normCode: row.norm_code,
    procedureCode: row.procedure_code || undefined,
    appliedClass: row.applied_class,
    appliedVoltage_kV: Number(row.applied_voltage_kv),
    voltageType: row.voltage_type,
    applicationDurationSeconds: row.application_duration_seconds,
    measuredLeakageCurrent_mA: Number(row.measured_leakage_current_ma),
    leakageCurrentLimit_mA: Number(row.leakage_current_limit_ma),
    currentUnit: row.current_unit,
    withstandWithoutPuncture: row.withstand_without_puncture,
    gloveLength_mm: row.glove_length_mm || undefined,
    mattingSurface: row.matting_surface || undefined,
    mattingThickness_mm: row.matting_thickness_mm ? Number(row.matting_thickness_mm) : undefined,
    isolatedTools: row.isolated_tools || undefined,
    toolsEvaluation: row.tools_evaluation || undefined,
    environmental: row.environmental || {
      temperatureC: 24,
      relativeHumidityPercent: 55,
      measurementDateTime: row.created_at || new Date().toISOString()
    },
    visualInspection: row.visual_inspection || [],
    visualInspectionPassed: row.visual_inspection_passed,
    instrumentsUsed: row.instruments_used || [],
    result: row.result,
    resultRationale: row.result_rationale,
    approvedOpinion: row.approved_opinion || undefined,
    reprovedOpinion: row.reproved_opinion || undefined,
    technicalNotes: row.technical_notes || undefined,
    retestDueDate: row.retest_due_date,
    ...heavy,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    syncVersion: 1,
    deviceId: row.device_id || 'supabase-cloud'
  }, row);
}

// ---------------------------------------------------------------------------
// LAB INSTRUMENTS
// ---------------------------------------------------------------------------
export function instrumentToRow(inst: LabInstrument, deviceId: string): Record<string, any> {
  return {
    id: inst.id,
    company_id: inst.companyId || 'comp-jvm',
    name: `${inst.type || 'Instrumento'} - ${inst.model || ''}`.trim(),
    type: inst.type || 'Instrumento',
    manufacturer: inst.manufacturer || null,
    model: inst.model || null,
    serial_number: inst.serialNumber || null,
    tag: inst.assetNumber || inst.serialNumber || null,
    calibration_cert_number: inst.calibrationCertNumber || '',
    calibration_date: sanitizeDate(inst.calibrationDate),
    calibration_expiry_date: sanitizeDate(inst.calibrationExpiryDate),
    calibration_lab: inst.calibratingLab || null,
    resolution: inst.measurementRange || null,
    accuracy: null,
    operational_status: inst.active ? 'operacional' : 'inativo',
    payload: cleanPayload(inst),
    device_id: deviceId,
    deleted_at: inst.deletedAt || null
  };
}

export function rowToInstrument(row: any): LabInstrument {
  const p = parsePayload(row);
  if (p) {
    return withSyncMeta<LabInstrument>({ ...p, id: row.id, companyId: row.company_id || p.companyId, updatedAt: row.updated_at || p.updatedAt }, row);
  }
  return withSyncMeta<LabInstrument>({
    id: row.id,
    companyId: row.company_id || undefined,
    type: row.type || 'Hipot CA/CC',
    manufacturer: row.manufacturer || '',
    model: row.model || '',
    serialNumber: row.serial_number || '',
    assetNumber: row.tag || row.serial_number || undefined,
    measurementRange: row.resolution || '',
    calibrationCertNumber: row.calibration_cert_number || '',
    calibrationDate: row.calibration_date || '',
    calibrationExpiryDate: row.calibration_expiry_date || '',
    calibratingLab: row.calibration_lab || '',
    active: row.operational_status === 'operacional' || row.operational_status === 'ativo',
    updatedAt: row.updated_at || undefined
  }, row);
}

// ---------------------------------------------------------------------------
// NORMS / REPORTS / AUDIT (armazenados integralmente no payload)
// ---------------------------------------------------------------------------
export function normToRow(n: NormCriterion, deviceId: string): Record<string, any> {
  return {
    id: n.id,
    norm_code: n.normCode || null,
    norm_name: (n as any).normName || null,
    dielectric_class: n.dielectricClass || null,
    payload: cleanPayload(n),
    device_id: deviceId,
    deleted_at: n.deletedAt || null
  };
}

export function rowToNorm(row: any): NormCriterion {
  const p = parsePayload(row) || {};
  return withSyncMeta<NormCriterion>({
    ...p,
    id: row.id,
    normCode: p.normCode || row.norm_code || 'Norma',
    normName: p.normName || row.norm_name || p.normCode || row.norm_code || 'Norma',
    dielectricClass: p.dielectricClass || row.dielectric_class || '0'
  }, row);
}

export function reportToRow(r: ConsolidatedReport, deviceId: string): Record<string, any> {
  return {
    id: r.id,
    company_id: r.companyId || 'comp-jvm',
    report_code: r.reportCode || null,
    client_id: r.clientId || null,
    client_name: r.clientName || null,
    emission_date: sanitizeDate(r.emissionDate),
    payload: cleanPayload(r),
    device_id: deviceId,
    deleted_at: (r as any).deletedAt || null
  };
}

export function rowToReport(row: any): ConsolidatedReport {
  const p = parsePayload(row) || {};
  return withSyncMeta<ConsolidatedReport>({ ...p, id: row.id, companyId: row.company_id || p.companyId }, row);
}

export function auditToRow(l: AuditLog, deviceId: string): Record<string, any> {
  return {
    id: l.id,
    company_id: l.companyId || null,
    action: l.action,
    user_name: l.userName,
    entity_type: l.entityType,
    entity_id: l.entityId,
    description: l.description,
    date_time: sanitizeTimestamp(l.dateTime),
    payload: cleanPayload(l),
    device_id: deviceId,
    deleted_at: null
  };
}
