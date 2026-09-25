import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import {
  Client,
  Equipment,
  ServiceOrder,
  TestRecord,
  User,
  NormCriterion,
  LabInstrument,
  CompanyLabInfo,
  Company,
  ConsolidatedReport,
  AuditLog
} from '../types';
import {
  DielectricStorageService,
  SyncQueueItem,
  SyncEntityType,
  TABLE_ENTITY,
  getDeviceId,
  scheduleCloudSync
} from './syncEngine';
import {
  SyncTable,
  PULL_TABLES,
  sanitizeDate as mapperSanitizeDate,
  sanitizeNumber as mapperSanitizeNumber,
  companyToRow,
  rowToCompany,
  userToRow,
  rowToUser,
  clientToRow,
  rowToClient,
  equipmentToRow,
  rowToEquipment,
  serviceOrderToRow,
  rowToServiceOrder,
  testToRow,
  rowToTest,
  instrumentToRow,
  rowToInstrument,
  normToRow,
  rowToNorm,
  reportToRow,
  rowToReport,
  auditToRow,
  USERS_SELECT_COLUMNS
} from './supabaseMappers';
import schemaSql from '../../supabase/schema.sql?raw';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled?: boolean;
  autoSync?: boolean;
}

export interface SupabaseConnectionResult {
  success: boolean;
  latencyMs: number;
  message: string;
  url: string;
  tablesFound?: string[];
  missingTables?: string[];
  needsMigration?: boolean;
  isReady: boolean;
}

export interface SupabaseSyncStats {
  companiesUploaded: number;
  usersUploaded: number;
  clientsUploaded: number;
  equipmentUploaded: number;
  testsUploaded: number;
  ordersUploaded: number;
  instrumentsUploaded: number;
  errors: string[];
  syncedAt: string;
}

export interface SupabasePullResult {
  success: boolean;
  pulledTests: number;
  pulledClients: number;
  pulledEquipment: number;
  pulledUsers: number;
  pulledCompanies: number;
  pulledServiceOrders: number;
  pulledInstruments: number;
  pulledNorms: number;
  pulledReports: number;
  totalPulled: number;
  errors: string[];
}

export interface SupabaseFlushResult {
  pushed: number;
  failed: number;
  remaining: number;
  details: { tests: number; equipment: number; serviceOrders: number; clients: number; photos: number };
  perEntity: Partial<Record<SyncEntityType, number>>;
  errors: string[];
}

export interface SupabaseSyncNowResult {
  pushed: number;
  pulled: number;
  details: SupabaseFlushResult['details'];
  pull?: SupabasePullResult;
  errors: string[];
}

export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  url: 'https://cdtbzbshylrcprvmjpgc.supabase.co',
  anonKey: 'sb_publishable_j3sUJcAb-zBEQI_S09u2Cg_X1-WJ-8M',
  enabled: true,
  autoSync: true
};

/** Bucket público de fotos/evidências (criado pelo supabase/schema.sql). */
export const EVIDENCE_BUCKET = 'jvm-evidencias';

export const sanitizeDate = mapperSanitizeDate;
export const sanitizeNumber = mapperSanitizeNumber;

/**
 * Normaliza a URL do Supabase, removendo o sufixo /rest/v1/ ou barras finais caso o usuário
 * tenha colado a URL direta do endpoint REST.
 */
export function normalizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return DEFAULT_SUPABASE_CONFIG.url;
  let cleaned = rawUrl.trim().replace(/\/+$/, '');
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  return cleaned;
}

/** Ordem de envio respeitando as chaves estrangeiras. */
const PUSH_ORDER: SyncEntityType[] = [
  'company',
  'company_info',
  'user',
  'client',
  'equipment',
  'service_order',
  'instrument',
  'norm',
  'test',
  'report',
  'audit'
];

const ENTITY_TABLE: Record<SyncEntityType, SyncTable> = {
  company: 'companies',
  company_info: 'companies',
  user: 'users',
  client: 'clients',
  equipment: 'equipment',
  service_order: 'service_orders',
  instrument: 'lab_instruments',
  norm: 'norms',
  test: 'test_records',
  report: 'consolidated_reports',
  audit: 'audit_logs'
};

/** Tamanho dos lotes de envio (ensaios carregam assinaturas/fotos). */
const CHUNK_SIZE: Partial<Record<SyncTable, number>> = { test_records: 10 };
const DEFAULT_CHUNK = 100;
/** Tamanho das páginas de download (o Supabase limita 1000 linhas por consulta). */
const PAGE_SIZE: Partial<Record<SyncTable, number>> = { test_records: 200 };
const DEFAULT_PAGE = 1000;
/** Sobreposição do cursor para não perder transações concluídas fora de ordem. */
const CURSOR_OVERLAP_MS = 2 * 60 * 1000;

function isMissingTableError(err: any): boolean {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205' || /does not exist|Could not find the table/i.test(err.message || '');
}

function isMissingColumnError(err: any): boolean {
  if (!err) return false;
  return err.code === '42703' || err.code === 'PGRST204' || /column .* does not exist|Could not find the '.*' column/i.test(err.message || '');
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string; ext: string } | null {
  try {
    const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
    if (!match) return null;
    const mime = match[1] || 'image/jpeg';
    const isBase64 = !!match[2];
    const payload = match[3];
    let bytes: Uint8Array;
    if (isBase64) {
      const bin = atob(payload);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(payload));
    }
    const ext = (mime.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '');
    return { blob: new Blob([bytes], { type: mime }), mime, ext };
  } catch {
    return null;
  }
}

function emptyDetails() {
  return { tests: 0, equipment: 0, serviceOrders: 0, clients: 0, photos: 0 };
}

export class SupabaseService {
  private static cachedClient: SupabaseClient | null = null;
  private static cachedUrl: string = '';
  private static cachedKey: string = '';

  private static flushPromise: Promise<SupabaseFlushResult> | null = null;
  private static pullPromise: Promise<SupabasePullResult> | null = null;
  private static syncPromise: Promise<SupabaseSyncNowResult> | null = null;
  private static knownCompanyIds = new Set<string>();
  private static storageUnavailable = false;
  private static autoSyncStarted = false;
  private static realtimeChannel: RealtimeChannel | null = null;
  private static pullTimer: ReturnType<typeof setTimeout> | null = null;
  private static lastAutoSyncAt = 0;
  private static usersLegacySelect = false;

  // ===========================================================================
  // CONFIGURAÇÃO E CLIENTE
  // ===========================================================================
  static getConfig(): SupabaseConfig {
    try {
      const company = DielectricStorageService.getCompanyInfo();
      const metaEnv = (import.meta as any).env || {};
      const rawUrl = company.supabaseUrl || (metaEnv.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_CONFIG.url;
      const anonKey = company.supabaseAnonKey || (metaEnv.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_SUPABASE_CONFIG.anonKey;
      const enabled = company.supabaseEnabled !== undefined ? company.supabaseEnabled : true;
      const autoSync = company.supabaseAutoSync !== undefined ? company.supabaseAutoSync : true;

      return {
        url: normalizeSupabaseUrl(rawUrl),
        anonKey: anonKey.trim(),
        enabled,
        autoSync
      };
    } catch {
      return DEFAULT_SUPABASE_CONFIG;
    }
  }

  static getClient(customConfig?: Partial<SupabaseConfig>): SupabaseClient {
    const activeConfig = { ...this.getConfig(), ...customConfig };
    const normalizedUrl = normalizeSupabaseUrl(activeConfig.url);
    const key = activeConfig.anonKey;

    if (this.cachedClient && this.cachedUrl === normalizedUrl && this.cachedKey === key) {
      return this.cachedClient;
    }

    // Credenciais mudaram: encerra a assinatura Realtime do cliente antigo
    if (this.realtimeChannel && this.cachedClient) {
      try { this.cachedClient.removeChannel(this.realtimeChannel); } catch {}
      this.realtimeChannel = null;
    }

    this.cachedClient = createClient(normalizedUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      db: {
        schema: 'public'
      }
    });
    this.cachedUrl = normalizedUrl;
    this.cachedKey = key;
    this.knownCompanyIds.clear();
    this.storageUnavailable = false;

    if (this.autoSyncStarted) {
      setTimeout(() => this.startRealtime(), 0);
    }

    return this.cachedClient;
  }

  private static canSync(): boolean {
    const config = this.getConfig();
    if (!config.enabled) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    return true;
  }

  /**
   * Testa a conectividade com o projeto Supabase medindo latência e verificando
   * se as tabelas e colunas da sincronização v6.1 existem.
   */
  static async testConnection(customConfig?: Partial<SupabaseConfig>): Promise<SupabaseConnectionResult> {
    const config = { ...this.getConfig(), ...customConfig };
    const normalizedUrl = normalizeSupabaseUrl(config.url);
    const startTime = performance.now();

    try {
      const pingUrl = `${normalizedUrl}/rest/v1/companies?select=id&limit=1`;
      const response = await fetch(pingUrl, {
        method: 'GET',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`
        }
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (!response.ok && ![200, 401, 404].includes(response.status)) {
        return {
          success: false,
          latencyMs,
          url: normalizedUrl,
          message: `Falha na resposta do servidor Supabase (HTTP ${response.status}: ${response.statusText})`,
          isReady: false
        };
      }

      const client = this.getClient(config);
      const tablesToCheck: SyncTable[] = [...PULL_TABLES, 'audit_logs'];
      const tablesFound: string[] = [];
      const missingTables: string[] = [];
      let needsMigration = false;

      await Promise.all(tablesToCheck.map(async tableName => {
        try {
          const { error } = await client.from(tableName).select('id,payload,deleted_at').limit(1);
          if (!error) {
            tablesFound.push(tableName);
          } else if (isMissingTableError(error)) {
            missingTables.push(tableName);
          } else if (isMissingColumnError(error)) {
            tablesFound.push(tableName);
            needsMigration = true;
          } else {
            tablesFound.push(tableName);
          }
        } catch {
          missingTables.push(tableName);
        }
      }));

      const isReady = missingTables.length === 0 && !needsMigration;
      let message = `Conexão bem-sucedida com o Supabase (${latencyMs}ms).`;
      if (isReady) {
        message += ` Todas as tabelas estão prontas (${tablesFound.length}/${tablesToCheck.length}).`;
      } else {
        message += ' Execute o Script SQL atualizado no SQL Editor do Supabase para habilitar a sincronização completa' +
          (missingTables.length ? ` (${missingTables.length} tabela(s) ausente(s)).` : ' (novas colunas de sincronização).');
      }

      return {
        success: true,
        latencyMs,
        url: normalizedUrl,
        tablesFound,
        missingTables,
        needsMigration,
        isReady,
        message
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        latencyMs,
        url: normalizedUrl,
        message: `Não foi possível conectar ao Supabase: ${err.message || 'Erro de rede ou CORS'}`,
        isReady: false
      };
    }
  }

  // ===========================================================================
  // ENVIO (PUSH) DA FILA
  // ===========================================================================
  /**
   * Envia a fila local ao Supabase em lotes, na ordem pai -> filho.
   * Itens com falha permanecem na fila com nova tentativa progressiva.
   * Chamadas simultâneas reaproveitam o envio em andamento.
   */
  static async flushQueue(opts: { force?: boolean } = {}): Promise<SupabaseFlushResult> {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.doFlush(!!opts.force).finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  private static async doFlush(force: boolean): Promise<SupabaseFlushResult> {
    const result: SupabaseFlushResult = {
      pushed: 0,
      failed: 0,
      remaining: 0,
      details: emptyDetails(),
      perEntity: {},
      errors: []
    };

    if (!this.canSync()) {
      result.remaining = DielectricStorageService.getSyncQueue().length;
      if (!this.getConfig().enabled) result.errors.push('Integração com o Supabase desativada nas configurações.');
      return result;
    }

    const due = DielectricStorageService.getDueSyncQueue(force);
    if (due.length === 0) {
      result.remaining = DielectricStorageService.getSyncQueue().length;
      return result;
    }

    const client = this.getClient();
    const deviceId = getDeviceId();
    const groups = new Map<SyncEntityType, SyncQueueItem[]>();
    due.forEach(item => {
      if (!groups.has(item.entityType)) groups.set(item.entityType, []);
      groups.get(item.entityType)!.push(item);
    });

    for (const entityType of PUSH_ORDER) {
      const items = groups.get(entityType);
      if (!items || items.length === 0) continue;
      const table = ENTITY_TABLE[entityType];

      // 1. Monta as linhas a partir do cache local (versão mais recente)
      const prepared: Array<{ item: SyncQueueItem; row: Record<string, any> }> = [];
      const orphans: SyncQueueItem[] = [];
      for (const item of items) {
        let record = entityType === 'audit'
          ? DielectricStorageService.getAuditLogs('ALL').find(l => l.id === item.entityId)
          : DielectricStorageService.getLocalRecordForSync(entityType, item.entityId);
        if (!record) {
          orphans.push(item);
          continue;
        }
        if (entityType === 'test') {
          const uploaded = await this.uploadTestMedia(client, record as TestRecord);
          record = uploaded.record;
          result.details.photos += uploaded.count;
        }
        prepared.push({ item, row: this.buildRow(entityType, record, deviceId) });
      }
      DielectricStorageService.dropOrphanSyncItems(orphans);
      if (prepared.length === 0) continue;

      // 2. Garante que as empresas referenciadas existam (evita erro de FK)
      await this.ensureCompanies(client, prepared.map(p => p.row.company_id).filter(Boolean));

      // 3. Envia em lotes, isolando registros com problema
      const { ok, failed } = await this.upsertRows(client, table, prepared, entityType === 'audit');
      DielectricStorageService.completeSyncItems(ok.map(o => o.item));
      DielectricStorageService.failSyncItems(failed.map(f => ({ item: f.item, error: f.error })));

      if (entityType === 'user' && ok.length > 0) {
        await this.sendInitialPasswords(client, ok.map(o => o.item.entityId));
      }

      result.pushed += ok.length;
      result.failed += failed.length;
      result.perEntity[entityType] = (result.perEntity[entityType] || 0) + ok.length;
      if (entityType === 'test') result.details.tests += ok.length;
      if (entityType === 'equipment') result.details.equipment += ok.length;
      if (entityType === 'service_order') result.details.serviceOrders += ok.length;
      if (entityType === 'client') result.details.clients += ok.length;
      failed.slice(0, 5).forEach(f => result.errors.push(`${table}/${f.item.entityId}: ${f.error}`));
    }

    if (result.pushed > 0) {
      const info = DielectricStorageService.getCompanyInfo();
      DielectricStorageService.setCompanyInfoSilently({ ...info, lastSupabaseSyncTime: new Date().toISOString() });
      window.dispatchEvent(new Event('jvm-data-changed'));
    }

    result.remaining = DielectricStorageService.getSyncQueue().length;
    // Registros gravados durante o envio: agenda uma nova rodada
    if (DielectricStorageService.getDueSyncQueue(false).length > 0 && result.failed === 0) {
      scheduleCloudSync(1000);
    }
    return result;
  }

  private static buildRow(entityType: SyncEntityType, record: any, deviceId: string): Record<string, any> {
    switch (entityType) {
      case 'company':
        return companyToRow(record as Company, deviceId);
      case 'company_info': {
        const active = DielectricStorageService.getActiveCompany();
        const labInfo = active.id === record.id ? DielectricStorageService.getCompanyInfo() : null;
        return companyToRow(record as Company, deviceId, labInfo);
      }
      case 'user':
        return userToRow(record as User, deviceId);
      case 'client':
        return clientToRow(record as Client, deviceId);
      case 'equipment':
        return equipmentToRow(record as Equipment, deviceId);
      case 'service_order':
        return serviceOrderToRow(record as ServiceOrder, deviceId);
      case 'instrument':
        return instrumentToRow(record as LabInstrument, deviceId);
      case 'norm':
        return normToRow(record as NormCriterion, deviceId);
      case 'test':
        return testToRow(record as TestRecord, deviceId);
      case 'report':
        return reportToRow(record as ConsolidatedReport, deviceId);
      case 'audit':
        return auditToRow(record as AuditLog, deviceId);
    }
  }

  /**
   * UPSERT em lote com isolamento de falhas. Linhas com colunas diferentes
   * são enviadas em lotes separados (o PostgREST preencheria as colunas
   * ausentes com NULL, apagando dados como lab_info da empresa).
   */
  private static async upsertRows(
    client: SupabaseClient,
    table: SyncTable,
    prepared: Array<{ item: SyncQueueItem; row: Record<string, any> }>,
    ignoreDuplicates: boolean
  ): Promise<{ ok: Array<{ item: SyncQueueItem }>; failed: Array<{ item: SyncQueueItem; error: string }> }> {
    const ok: Array<{ item: SyncQueueItem }> = [];
    const failed: Array<{ item: SyncQueueItem; error: string }> = [];

    const bySignature = new Map<string, typeof prepared>();
    prepared.forEach(p => {
      const sig = Object.keys(p.row).sort().join(',');
      if (!bySignature.has(sig)) bySignature.set(sig, []);
      bySignature.get(sig)!.push(p);
    });

    const chunkSize = CHUNK_SIZE[table] || DEFAULT_CHUNK;
    for (const group of bySignature.values()) {
      for (let i = 0; i < group.length; i += chunkSize) {
        const chunk = group.slice(i, i + chunkSize);
        const { error } = await client
          .from(table)
          .upsert(chunk.map(c => c.row), { onConflict: 'id', ignoreDuplicates });
        if (!error) {
          chunk.forEach(c => ok.push({ item: c.item }));
          continue;
        }
        if (chunk.length === 1) {
          const single = await this.upsertSingleWithRecovery(client, table, chunk[0].row, ignoreDuplicates, error);
          if (single === null) ok.push({ item: chunk[0].item });
          else failed.push({ item: chunk[0].item, error: single });
          continue;
        }
        // Lote falhou: envia um a um para isolar o registro com problema
        for (const c of chunk) {
          const single = await this.upsertSingleWithRecovery(client, table, c.row, ignoreDuplicates);
          if (single === null) ok.push({ item: c.item });
          else failed.push({ item: c.item, error: single });
        }
      }
    }
    return { ok, failed };
  }

  /** Retorna null em caso de sucesso ou a mensagem de erro. */
  private static async upsertSingleWithRecovery(
    client: SupabaseClient,
    table: SyncTable,
    row: Record<string, any>,
    ignoreDuplicates: boolean,
    knownError?: any
  ): Promise<string | null> {
    let error = knownError;
    if (!error) {
      const res = await client.from(table).upsert([row], { onConflict: 'id', ignoreDuplicates });
      error = res.error;
      if (!error) return null;
    }

    // Banco ainda sem as colunas novas: envia sem payload/deleted_at/lab_info
    if (isMissingColumnError(error)) {
      const legacy = { ...row };
      delete legacy.payload;
      delete legacy.device_id;
      delete legacy.deleted_at;
      delete legacy.lab_info;
      delete legacy.username;
      const res = await client.from(table).upsert([legacy], { onConflict: 'id', ignoreDuplicates });
      if (!res.error) return null;
      error = res.error;
    }

    // Chave estrangeira: o vínculo (cliente/equipamento) ainda não existe na
    // nuvem. O ensaio é enviado sem o vínculo técnico — nome/tag continuam
    // gravados. A empresa (company_id) NUNCA é trocada.
    if (error && error.code === '23503') {
      const relaxed = { ...row };
      ['client_id', 'equipment_id'].forEach(k => {
        if (relaxed[k] !== undefined) relaxed[k] = null;
      });
      const res = await client.from(table).upsert([relaxed], { onConflict: 'id', ignoreDuplicates });
      if (!res.error) return null;
      error = res.error;
    }

    return `${error?.code ? `[${error.code}] ` : ''}${error?.message || 'Erro desconhecido'}`;
  }

  /**
   * Envia a senha inicial de usuários recém-criados pelo app. O banco só
   * aceita se o usuário ainda não tiver senha (ver jvm_set_initial_password).
   */
  private static async sendInitialPasswords(client: SupabaseClient, userIds: string[]): Promise<void> {
    const pending = DielectricStorageService.getPendingInitialPasswords();
    for (const id of userIds) {
      const pwd = pending[id];
      if (!pwd) continue;
      const { error } = await client.rpc('jvm_set_initial_password', { p_user_id: id, p_password: pwd });
      // Sucesso, recusa definitiva ou banco sem a função: a senha sai do aparelho
      if (!error || !/fetch|network/i.test(error.message || '')) {
        DielectricStorageService.clearPendingInitialPassword(id);
      }
    }
  }

  /** Cria (somente se ausentes) as empresas referenciadas pelos registros. */
  private static async ensureCompanies(client: SupabaseClient, companyIds: string[]): Promise<void> {
    const missing = Array.from(new Set(companyIds)).filter(id => id && !this.knownCompanyIds.has(id));
    if (missing.length === 0) return;
    const deviceId = getDeviceId();
    const rows = missing.map(id => {
      const local = DielectricStorageService.getCompanyById(id);
      const comp: Company = local || {
        id,
        name: id === 'comp-jvm' ? 'JVM Engenharia & Treinamentos' : id,
        legalName: id,
        cnpj: '',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const row = companyToRow(comp, deviceId);
      delete row.payload; // não sobrescreve nada: apenas cria se não existir
      return row;
    });
    const { error } = await client.from('companies').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (!error) missing.forEach(id => this.knownCompanyIds.add(id));
  }

  // ===========================================================================
  // FOTOS / EVIDÊNCIAS -> SUPABASE STORAGE
  // ===========================================================================
  /**
   * Envia as fotos base64 do ensaio para o Storage e troca pelas URLs públicas.
   * Reduz drasticamente o tamanho das linhas e libera o armazenamento do aparelho.
   * Se o bucket não existir, as fotos seguem em base64 (comportamento anterior).
   */
  private static async uploadTestMedia(client: SupabaseClient, test: TestRecord): Promise<{ record: TestRecord; count: number }> {
    if (this.storageUnavailable) return { record: test, count: 0 };
    const targets: Array<{ key: string; dataUrl: string }> = [];
    (test.photos || []).forEach((ph, idx) => {
      if (ph?.url && ph.url.startsWith('data:')) targets.push({ key: ph.id || `foto-${idx}`, dataUrl: ph.url });
    });
    (test.visualInspection || []).forEach((v: any, idx: number) => {
      if (v?.photoUrl && typeof v.photoUrl === 'string' && v.photoUrl.startsWith('data:')) {
        targets.push({ key: `inspecao-${v.id || idx}`, dataUrl: v.photoUrl });
      }
    });
    if (targets.length === 0) return { record: test, count: 0 };

    const urlMap: Record<string, string> = {};
    const companyFolder = (test.companyId || 'comp-jvm').replace(/[^a-zA-Z0-9_-]/g, '_');
    const testFolder = String(test.id).replace(/[^a-zA-Z0-9_-]/g, '_');

    for (const t of targets) {
      if (urlMap[t.dataUrl]) continue;
      const parsed = dataUrlToBlob(t.dataUrl);
      if (!parsed) continue;
      const path = `${companyFolder}/${testFolder}/${t.key.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.${parsed.ext}`;
      const { error } = await client.storage.from(EVIDENCE_BUCKET).upload(path, parsed.blob, {
        contentType: parsed.mime,
        upsert: true,
        cacheControl: '31536000'
      });
      if (error) {
        if (/bucket not found|not found|row-level security|unauthorized/i.test(error.message || '')) {
          this.storageUnavailable = true;
          console.info('[Supabase Storage] Bucket de evidências indisponível — fotos seguem embutidas no registro. Execute o Script SQL atualizado.');
          break;
        }
        console.warn('[Supabase Storage] Falha ao enviar foto:', error.message);
        continue;
      }
      urlMap[t.dataUrl] = client.storage.from(EVIDENCE_BUCKET).getPublicUrl(path).data.publicUrl;
    }

    const count = Object.keys(urlMap).length;
    if (count === 0) return { record: test, count: 0 };
    DielectricStorageService.replaceTestMediaUrls(test.id, urlMap);
    const updated = DielectricStorageService.getLocalRecordForSync('test', test.id) as TestRecord | null;
    return { record: updated || test, count };
  }

  /** Envia uma imagem avulsa (ex.: câmera remota) e retorna a URL pública, ou null. */
  static async uploadEvidenceImage(dataUrl: string, folder: string): Promise<string | null> {
    if (!dataUrl || !dataUrl.startsWith('data:') || this.storageUnavailable || !this.canSync()) return null;
    const parsed = dataUrlToBlob(dataUrl);
    if (!parsed) return null;
    try {
      const client = this.getClient();
      const path = `${folder.replace(/[^a-zA-Z0-9_\/-]/g, '_')}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${parsed.ext}`;
      const { error } = await client.storage.from(EVIDENCE_BUCKET).upload(path, parsed.blob, { contentType: parsed.mime, upsert: true });
      if (error) return null;
      return client.storage.from(EVIDENCE_BUCKET).getPublicUrl(path).data.publicUrl;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // DOWNLOAD (PULL) INCREMENTAL E PAGINADO
  // ===========================================================================
  static async pullChanges(opts: { full?: boolean; keepNewerLocal?: boolean } = {}): Promise<SupabasePullResult> {
    if (this.pullPromise) return this.pullPromise;
    this.pullPromise = this.doPull(opts).finally(() => {
      this.pullPromise = null;
    });
    return this.pullPromise;
  }

  private static async doPull(opts: { full?: boolean; keepNewerLocal?: boolean }): Promise<SupabasePullResult> {
    const res: SupabasePullResult = {
      success: true,
      pulledTests: 0,
      pulledClients: 0,
      pulledEquipment: 0,
      pulledUsers: 0,
      pulledCompanies: 0,
      pulledServiceOrders: 0,
      pulledInstruments: 0,
      pulledNorms: 0,
      pulledReports: 0,
      totalPulled: 0,
      errors: []
    };
    if (!this.canSync()) {
      res.success = false;
      res.errors.push('Sem conexão ou integração Supabase desativada.');
      return res;
    }

    const client = this.getClient();
    for (const table of PULL_TABLES) {
      try {
        const cursor = opts.full ? null : DielectricStorageService.getPullCursor(table);
        const since = cursor ? new Date(new Date(cursor).getTime() - CURSOR_OVERLAP_MS).toISOString() : null;
        const pageSize = PAGE_SIZE[table] || DEFAULT_PAGE;
        let from = 0;
        let maxCursor = cursor;
        let applied = 0;

        while (true) {
          let query = client
            .from(table)
            .select(table === 'users' && !this.usersLegacySelect ? USERS_SELECT_COLUMNS : '*')
            .order('updated_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, from + pageSize - 1);
          if (since) query = query.gte('updated_at', since);

          const { data, error } = await query;
          if (error) {
            // Banco ainda sem a coluna "username" (script SQL não executado)
            if (table === 'users' && !this.usersLegacySelect && isMissingColumnError(error)) {
              this.usersLegacySelect = true;
              continue;
            }
            if (!isMissingTableError(error)) res.errors.push(`${table}: ${error.message}`);
            break;
          }
          const rows = data || [];
          if (rows.length === 0) break;

          applied += this.applyRemoteRows(table, rows, !!opts.keepNewerLocal);
          rows.forEach((r: any) => {
            if (r.updated_at && (!maxCursor || r.updated_at > maxCursor)) maxCursor = r.updated_at;
          });

          if (rows.length < pageSize) break;
          from += pageSize;
        }

        if (maxCursor) DielectricStorageService.setPullCursor(table, maxCursor);
        switch (table) {
          case 'companies': res.pulledCompanies = applied; break;
          case 'users': res.pulledUsers = applied; break;
          case 'clients': res.pulledClients = applied; break;
          case 'equipment': res.pulledEquipment = applied; break;
          case 'service_orders': res.pulledServiceOrders = applied; break;
          case 'lab_instruments': res.pulledInstruments = applied; break;
          case 'norms': res.pulledNorms = applied; break;
          case 'test_records': res.pulledTests = applied; break;
          case 'consolidated_reports': res.pulledReports = applied; break;
        }
        res.totalPulled += applied;
      } catch (err: any) {
        res.errors.push(`${table}: ${err?.message || err}`);
      }
    }

    res.success = res.errors.length === 0;
    if (res.totalPulled > 0) {
      window.dispatchEvent(new Event('jvm-data-changed'));
    }
    return res;
  }

  /** Converte e aplica as linhas recebidas no cache local. Retorna quantos registros mudaram. */
  private static applyRemoteRows(table: SyncTable, rows: any[], keepNewerLocal: boolean): number {
    const entityType = TABLE_ENTITY[table];
    let mapped: any[] = [];
    switch (table) {
      case 'companies': mapped = rows.map(rowToCompany); break;
      case 'users': mapped = rows.map(rowToUser); break;
      case 'clients': mapped = rows.map(rowToClient); break;
      case 'equipment': mapped = rows.map(rowToEquipment); break;
      case 'service_orders': mapped = rows.map(rowToServiceOrder); break;
      case 'lab_instruments': mapped = rows.map(rowToInstrument); break;
      case 'norms': mapped = rows.map(rowToNorm); break;
      case 'test_records': mapped = rows.map(rowToTest); break;
      case 'consolidated_reports': mapped = rows.map(rowToReport); break;
      default: return 0;
    }

    if (keepNewerLocal) {
      // Migração: não sobrescreve edições locais mais recentes que a nuvem
      mapped = mapped.filter(m => {
        const local = DielectricStorageService.getLocalRecordForSync(entityType, m.id);
        if (!local || !local.updatedAt || !m.updatedAt) return true;
        return new Date(local.updatedAt).getTime() <= new Date(m.updatedAt).getTime();
      });
    }

    const changed = DielectricStorageService.saveFromRemote(entityType, mapped);

    if (table === 'companies') {
      rows.forEach((r: any) => this.knownCompanyIds.add(r.id));
      this.applyActiveCompanyFromRemote(rows);
    }
    if (table === 'users') {
      this.refreshSessionUser(mapped as User[]);
    }
    return changed;
  }

  private static applyActiveCompanyFromRemote(rows: any[]): void {
    const active = DielectricStorageService.getActiveCompany();
    const row = rows.find((r: any) => r.id === active.id);
    if (!row || row.deleted_at) return;
    const pending = DielectricStorageService.getSyncQueue().some(q =>
      (q.entityType === 'company' || q.entityType === 'company_info') && q.entityId === active.id
    );
    if (pending) return;

    const remoteCompany = DielectricStorageService.getCompanyById(active.id);
    if (remoteCompany) {
      DielectricStorageService.setActiveCompany(remoteCompany);
    }
    if (row.lab_info && typeof row.lab_info === 'object') {
      const current = DielectricStorageService.getCompanyInfo();
      const merged: CompanyLabInfo = {
        ...current,
        ...row.lab_info,
        // conexão deste aparelho nunca é substituída pela nuvem
        supabaseUrl: current.supabaseUrl,
        supabaseAnonKey: current.supabaseAnonKey,
        supabaseEnabled: current.supabaseEnabled,
        supabaseAutoSync: current.supabaseAutoSync,
        lastSupabaseSyncTime: current.lastSupabaseSyncTime
      };
      DielectricStorageService.setCompanyInfoSilently(merged);
    }
  }

  private static refreshSessionUser(users: User[]): void {
    try {
      const rawStored = localStorage.getItem('jvm_dielectric_current_user');
      if (!rawStored) return;
      const currentSess: User = JSON.parse(rawStored);
      const match = users.find(u =>
        u.id === currentSess.id || (!!currentSess.email && !!u.email && currentSess.email.toLowerCase() === u.email.toLowerCase())
      );
      if (!match || (match as any).deletedAt) return;
      const mergedUser: User = { ...currentSess, ...match, companyId: currentSess.companyId, companyName: currentSess.companyName };
      delete (mergedUser as any).syncStatus;
      if (JSON.stringify(mergedUser) === rawStored) return;
      localStorage.setItem('jvm_dielectric_current_user', JSON.stringify(mergedUser));
      window.dispatchEvent(new CustomEvent('jvm-auth-changed', { detail: { user: mergedUser } }));
    } catch (e) {
      console.warn('Erro ao atualizar usuário em sessão ativa:', e);
    }
  }

  // ===========================================================================
  // SINCRONIZAÇÃO COMPLETA E AUTOMÁTICA
  // ===========================================================================
  /**
   * Envia a fila e baixa as alterações. Na primeira execução após a
   * atualização (v6.1) faz a migração: baixa tudo, preserva edições locais
   * mais recentes e reenvia a base completa com payload.
   */
  static async syncNow(): Promise<SupabaseSyncNowResult> {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.doSyncNow().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  private static async doSyncNow(): Promise<SupabaseSyncNowResult> {
    const out: SupabaseSyncNowResult = { pushed: 0, pulled: 0, details: emptyDetails(), errors: [] };
    if (!this.canSync()) {
      out.errors.push(this.getConfig().enabled ? 'Dispositivo offline.' : 'Integração com o Supabase desativada.');
      return out;
    }

    const bootstrap = !DielectricStorageService.isBootstrapDone();
    if (bootstrap) {
      const pull = await this.pullChanges({ full: true, keepNewerLocal: true });
      out.pull = pull;
      out.pulled += pull.totalPulled;
      out.errors.push(...pull.errors);
      if (pull.errors.length === 0) {
        DielectricStorageService.enqueueAllForBootstrap();
      }
    }

    const flush = await this.flushQueue({ force: true });
    out.pushed += flush.pushed;
    out.details = flush.details;
    out.errors.push(...flush.errors);

    if (bootstrap) {
      if (out.errors.length === 0) DielectricStorageService.setBootstrapDone();
    } else {
      const pull = await this.pullChanges();
      out.pull = pull;
      out.pulled += pull.totalPulled;
      out.errors.push(...pull.errors);
    }
    return out;
  }

  /**
   * Inicia a sincronização automática: na abertura do app, ao voltar a
   * conexão, ao retornar para a aba, a cada 2 minutos e em tempo real
   * (Supabase Realtime) quando outro dispositivo altera dados.
   */
  static startAutoSync(): void {
    if (this.autoSyncStarted || typeof window === 'undefined') return;
    this.autoSyncStarted = true;

    const run = (reason: string) => {
      const cfg = this.getConfig();
      if (!cfg.enabled || !cfg.autoSync || !navigator.onLine) return;
      if (Date.now() - this.lastAutoSyncAt < 20000 && reason !== 'online') return;
      this.lastAutoSyncAt = Date.now();
      this.syncNow().catch(err => console.warn(`[Supabase Auto-Sync] (${reason})`, err));
    };

    window.addEventListener('online', () => run('online'));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') run('visibility');
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') run('interval');
    }, 2 * 60 * 1000);

    this.startRealtime();
    run('startup');
  }

  /** Assina alterações das tabelas: cada evento dispara um pull incremental. */
  static startRealtime(): void {
    if (typeof window === 'undefined') return;
    const cfg = this.getConfig();
    if (!cfg.enabled) return;
    try {
      const client = this.getClient();
      if (this.realtimeChannel) {
        try { client.removeChannel(this.realtimeChannel); } catch {}
      }
      const myDevice = getDeviceId();
      let channel = client.channel('jvm-dielectric-sync');
      PULL_TABLES.forEach(table => {
        channel = channel.on('postgres_changes' as any, { event: '*', schema: 'public', table }, (payload: any) => {
          // ignora o eco das próprias gravações deste aparelho
          if (payload?.new?.device_id && payload.new.device_id === myDevice) return;
          this.schedulePull();
        });
      });
      channel.subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.info('[Supabase Realtime] Indisponível — sincronização periódica continua ativa.');
        }
      });
      this.realtimeChannel = channel;
    } catch (err) {
      console.info('[Supabase Realtime] Não iniciado:', err);
    }
  }

  private static schedulePull(delayMs: number = 1500): void {
    if (this.pullTimer) clearTimeout(this.pullTimer);
    this.pullTimer = setTimeout(() => {
      this.pullTimer = null;
      this.pullChanges().catch(() => {});
    }, delayMs);
  }

  // ===========================================================================
  // API DE COMPATIBILIDADE (usada pelas telas existentes)
  // ===========================================================================
  /** Envia TODOS os registros locais (reenvio completo manual). */
  static async syncAllToSupabase(): Promise<SupabaseSyncStats> {
    DielectricStorageService.enqueueAllForBootstrap();
    const flush = await this.flushQueue({ force: true });
    const pe = flush.perEntity;
    return {
      companiesUploaded: (pe.company || 0) + (pe.company_info || 0),
      usersUploaded: pe.user || 0,
      clientsUploaded: pe.client || 0,
      equipmentUploaded: pe.equipment || 0,
      testsUploaded: pe.test || 0,
      ordersUploaded: pe.service_order || 0,
      instrumentsUploaded: pe.instrument || 0,
      errors: flush.errors,
      syncedAt: new Date().toISOString()
    };
  }

  /** Baixa as alterações do Supabase (incremental). */
  static async pullFromSupabase(opts: { full?: boolean } = {}): Promise<SupabasePullResult> {
    return this.pullChanges(opts);
  }

  static async pushRecord(table: SyncTable, record: any): Promise<boolean> {
    const entityType = TABLE_ENTITY[table];
    if (!entityType || !record?.id) return false;
    DielectricStorageService.enqueueSync(entityType, 'update', record.id);
    const res = await this.flushQueue({ force: true });
    return !DielectricStorageService.getSyncQueue().some(q => q.entityType === entityType && q.entityId === record.id) && res.errors.length === 0;
  }

  static async deleteRecord(table: SyncTable, id: string): Promise<boolean> {
    const entityType = TABLE_ENTITY[table];
    if (!entityType || !id) return false;
    DielectricStorageService.enqueueSync(entityType, 'delete', id);
    const res = await this.flushQueue({ force: true });
    return res.errors.length === 0;
  }

  static async autoPushToSupabase(table: SyncTable, record: any): Promise<boolean> {
    return this.pushRecord(table, record);
  }

  // ===========================================================================
  // VALIDAÇÃO PÚBLICA (QR CODE)
  // ===========================================================================
  /**
   * Busca um laudo/certificado diretamente no Supabase pelo código de
   * validação, número do certificado, do laudo ou do ensaio. Usado pelo
   * portal público quando o registro não está no aparelho de quem consulta.
   */
  static async fetchTestByCode(code: string): Promise<TestRecord | null> {
    const clean = (code || '').trim().replace(/["\\,()]/g, '');
    if (!clean) return null;
    try {
      const client = this.getClient();
      const orFilter = ['validation_code', 'certificate_number', 'report_number', 'test_number']
        .map(col => `${col}.eq."${clean}"`)
        .join(',');
      let { data, error } = await client.from('test_records').select('*').or(orFilter).is('deleted_at', null).limit(1);
      if (error && isMissingColumnError(error)) {
        ({ data, error } = await client.from('test_records').select('*').or(orFilter).limit(1));
      }
      if (error || !data || data.length === 0) return null;
      return rowToTest(data[0]);
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // AUTENTICAÇÃO
  // ===========================================================================
  /**
   * Autentica credenciais na tabela public.users do Supabase.
   * (Removidas as senhas universais que davam acesso a QUALQUER conta.)
   */
  static async authenticateWithSupabase(
    login: string,
    password: string,
    companyId?: string
  ): Promise<{ success: boolean; user?: User; error?: string; networkError?: boolean }> {
    try {
      const config = this.getConfig();
      if (!config.enabled) {
        return { success: false, networkError: true, error: 'Integração com Supabase está desativada nas configurações.' };
      }

      const client = this.getClient(config);
      const cleanLogin = login.trim().toLowerCase();

      // Conferência da senha no servidor (senha criptografada, nunca exposta)
      const { data, error } = await client.rpc('jvm_login', { p_login: cleanLogin, p_password: password });

      if (error) {
        if (/fetch|network|Failed to/i.test(error.message || '')) {
          return { success: false, networkError: true, error: 'Sem conexão com o banco de dados.' };
        }
        const missingFn = error.code === 'PGRST202' || error.code === '42883' || /Could not find the function|does not exist/i.test(error.message || '');
        if (missingFn) {
          return {
            success: false,
            error: 'O login pelo banco de dados ainda não foi ativado. Execute o arquivo supabase/schema.sql no SQL Editor do Supabase.'
          };
        }
        return { success: false, error: `Erro no Supabase: ${error.message}` };
      }

      const payload: any = typeof data === 'string' ? JSON.parse(data) : data;
      if (!payload || payload.ok !== true || !payload.user) {
        return { success: false, error: payload?.error || 'Usuário ou senha inválidos.' };
      }

      const userObj = rowToUser(payload.user);
      delete (userObj as any).syncStatus;
      const homeCompanyId = payload.user.company_id || userObj.companyId || 'comp-jvm';
      userObj.companyId = companyId || homeCompanyId;

      // Mantém o perfil no aparelho (sem senha) para a lista de usuários
      DielectricStorageService.saveFromRemote('users', [{ ...userObj, companyId: homeCompanyId }]);

      return { success: true, user: userObj };
    } catch (err: any) {
      return { success: false, networkError: true, error: err.message || 'Falha na conexão de login com o Supabase' };
    }
  }

  // ===========================================================================
  // SCRIPT SQL
  // ===========================================================================
  /** Script SQL oficial (idempotente) — mesma fonte de supabase/schema.sql. */
  static generateSupabaseSchema(): string {
    return schemaSql;
  }
}
