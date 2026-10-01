import { getPhotoBlob, isLocalPhotoRef } from './photoStore';
import { inlineTestPhotos } from './photoExternalizer';
import { createClient, SupabaseClient, RealtimeChannel, Session } from '@supabase/supabase-js';
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
  /** Registros recusados por terem sido alterados em outro aparelho. */
  conflicts?: number;
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

/** Mensagem exibida quando o aparelho está sem sessão válida no Supabase Auth. */
export const SESSION_EXPIRED_MESSAGE = 'Sessão expirada: saia e entre novamente com usuário e senha para sincronizar os dados.';

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

/** Tabelas com detecção de conflito de edição entre aparelhos (coluna base_updated_at). */
const CONFLICT_TABLES = new Set<SyncTable>(['clients', 'equipment', 'service_orders', 'test_records', 'lab_instruments', 'consolidated_reports']);

function isEditConflict(error: string): boolean {
  return /JV409|Conflito de edição/i.test(error || '');
}

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
  private static refillPromise: Promise<void> | null = null;

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
      // Sessão do Supabase Auth guardada no aparelho: é ela que identifica o
      // usuário e a empresa nas regras de acesso (RLS) do banco.
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'jvm-supabase-auth'
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

  /** Sessão de login do Supabase guardada neste aparelho (null se não houver). */
  static async getSession(): Promise<Session | null> {
    try {
      const { data } = await this.getClient().auth.getSession();
      return data.session;
    } catch {
      return null;
    }
  }

  /** Encerra a sessão do Supabase neste aparelho (funciona também offline). */
  static async signOut(): Promise<void> {
    try {
      await this.getClient().auth.signOut({ scope: 'local' });
    } catch (err) {
      console.warn('Falha ao encerrar a sessão do Supabase:', err);
    }
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

    if (!(await this.getSession())) {
      result.remaining = DielectricStorageService.getSyncQueue().length;
      result.errors.push(SESSION_EXPIRED_MESSAGE);
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
          // Foto que não subiu para o Storage vai embutida: a referência local
          // só existe neste aparelho e nunca pode ir para o banco
          record = await inlineTestPhotos(record as TestRecord);
        }
        prepared.push({ item, row: this.buildRow(entityType, record, deviceId) });
      }
      DielectricStorageService.dropOrphanSyncItems(orphans);
      if (prepared.length === 0) continue;

      // 2. Garante que as empresas referenciadas existam (evita erro de FK)
      await this.ensureCompanies(client, prepared.map(p => p.row.company_id).filter(Boolean));

      // 3. Envia em lotes, isolando registros com problema
      const upserted = await this.upsertRows(client, table, prepared, entityType === 'audit');
      const ok = upserted.ok;
      let failed = upserted.failed;
      if (entityType === 'norm') {
        // Normas são referência comum: só admin/RT alteram. Recusa de permissão
        // não se resolve com nova tentativa — prevalece a versão do servidor.
        const denied = failed.filter(f => /row-level security|42501/i.test(f.error));
        DielectricStorageService.completeSyncItems(denied.map(f => f.item));
        failed = failed.filter(f => !denied.includes(f));
      }
      // Conflito de edição: guarda as duas versões para o usuário escolher
      const conflicts = failed.filter(f => isEditConflict(f.error));
      if (conflicts.length > 0) {
        await this.registerConflicts(client, table, entityType, conflicts.map(c => c.item));
        DielectricStorageService.completeSyncItems(conflicts.map(c => c.item));
        failed = failed.filter(f => !conflicts.includes(f));
        result.conflicts = (result.conflicts || 0) + conflicts.length;
        result.errors.push(`${conflicts.length} conflito(s) de edição: escolha a versão em Sincronização & Conflitos.`);
      }
      DielectricStorageService.completeSyncItems(ok.map(o => o.item));
      DielectricStorageService.failSyncItems(failed.map(f => ({ item: f.item, error: f.error })));
      if (CONFLICT_TABLES.has(table) && ok.length > 0) {
        await this.refreshServerVersions(client, table, entityType, ok.map(o => o.item.entityId));
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
    const row = this.mapRow(entityType, record, deviceId);
    if (CONFLICT_TABLES.has(ENTITY_TABLE[entityType])) {
      // Versão do servidor em que a edição se baseou (null = registro novo/antigo)
      row.base_updated_at = record._serverUpdatedAt || null;
    }
    return row;
  }

  /**
   * Após o envio, guarda a versão (updated_at) que ficou no servidor: a próxima
   * edição deste aparelho parte dela e não é confundida com conflito.
   */
  private static async refreshServerVersions(client: SupabaseClient, table: SyncTable, entityType: SyncEntityType, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await client.from(table).select('id,updated_at').in('id', ids.slice(i, i + 100));
      if (error || !data) return;
      DielectricStorageService.setServerVersions(entityType, data.map((r: any) => ({ id: r.id, updatedAt: r.updated_at })));
    }
  }

  /** Busca a versão do servidor e registra o conflito com a versão deste aparelho. */
  private static async registerConflicts(client: SupabaseClient, table: SyncTable, entityType: SyncEntityType, items: SyncQueueItem[]): Promise<void> {
    const ids = items.map(i => i.entityId);
    const { data, error } = await client.from(table).select('*').in('id', ids);
    if (error || !data) return;
    const toLocal: Partial<Record<SyncTable, (row: any) => any>> = {
      clients: rowToClient,
      equipment: rowToEquipment,
      service_orders: rowToServiceOrder,
      test_records: rowToTest,
      lab_instruments: rowToInstrument,
      consolidated_reports: rowToReport
    };
    const map = toLocal[table];
    if (!map) return;
    data.forEach((row: any) => {
      DielectricStorageService.registerConflict(entityType, map(row), { deviceId: row.device_id || '', updatedAt: row.updated_at });
    });
  }

  private static mapRow(entityType: SyncEntityType, record: any, deviceId: string): Record<string, any> {
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
      delete legacy.base_updated_at;
      const res = await client.from(table).upsert([legacy], { onConflict: 'id', ignoreDuplicates });
      if (!res.error) return null;
      error = res.error;
    }

    // Chave estrangeira: o vínculo (cliente/equipamento) ainda não existe na
    // nuvem. O ensaio é enviado sem o vínculo técnico — nome/tag continuam
    // gravados. A empresa (company_id) NUNCA é trocada.
    if (error && error.code === '23503') {
      // Cliente/equipamento que existe neste aparelho ainda não subiu (ex.: falhou
      // antes): o ensaio espera na fila e tenta de novo, sem perder o vínculo.
      const pendingParent =
        (row.client_id && DielectricStorageService.getLocalRecordForSync('client', row.client_id)) ||
        (row.equipment_id && DielectricStorageService.getLocalRecordForSync('equipment', row.equipment_id));
      if (pendingParent) {
        // garante que o cliente/equipamento esteja na fila (ex.: removido do servidor)
        const queued = new Set(DielectricStorageService.getSyncQueue().map(q => `${q.entityType}:${q.entityId}`));
        if (row.client_id && DielectricStorageService.getLocalRecordForSync('client', row.client_id) && !queued.has(`client:${row.client_id}`)) {
          DielectricStorageService.enqueueSync('client', 'update', row.client_id);
        }
        if (row.equipment_id && DielectricStorageService.getLocalRecordForSync('equipment', row.equipment_id) && !queued.has(`equipment:${row.equipment_id}`)) {
          DielectricStorageService.enqueueSync('equipment', 'update', row.equipment_id);
        }
        return 'Aguardando o envio do cliente/equipamento vinculado; nova tentativa automática.';
      }
      // Vínculo com registro que não existe mais em lugar nenhum: envia sem ele
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

  /** Cria (somente se ausentes) as empresas referenciadas pelos registros. */
  private static async ensureCompanies(client: SupabaseClient, companyIds: string[]): Promise<void> {
    const missing = Array.from(new Set(companyIds)).filter(id => id && !this.knownCompanyIds.has(id));
    if (missing.length === 0) return;
    const deviceId = getDeviceId();
    const rows = missing.map(id => {
      const local = DielectricStorageService.getCompanyById(id);
      const comp: Company = local || {
        id,
        name: 'Empresa',
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
    // Fotos em base64 ou guardadas no aparelho (referência local "jvm-foto:")
    const isPending = (u: unknown): u is string => typeof u === 'string' && (u.startsWith('data:') || isLocalPhotoRef(u));
    const targets: Array<{ key: string; dataUrl: string }> = [];
    (test.photos || []).forEach((ph, idx) => {
      if (isPending(ph?.url)) targets.push({ key: ph.id || `foto-${idx}`, dataUrl: ph.url });
      if (isPending(ph?.originalUrl)) targets.push({ key: `${ph.id || `foto-${idx}`}-original`, dataUrl: ph.originalUrl });
    });
    (test.visualInspection || []).forEach((v: any, idx: number) => {
      if (isPending(v?.photoUrl)) {
        targets.push({ key: `inspecao-${v.id || idx}`, dataUrl: v.photoUrl });
      }
    });
    if (targets.length === 0) return { record: test, count: 0 };

    const urlMap: Record<string, string> = {};
    const companyFolder = (test.companyId || 'sem-empresa').replace(/[^a-zA-Z0-9_-]/g, '_');
    const testFolder = String(test.id).replace(/[^a-zA-Z0-9_-]/g, '_');

    for (const t of targets) {
      if (urlMap[t.dataUrl]) continue;
      let parsed = isLocalPhotoRef(t.dataUrl) ? null : dataUrlToBlob(t.dataUrl);
      if (isLocalPhotoRef(t.dataUrl)) {
        const blob = await getPhotoBlob(t.dataUrl);
        if (blob) {
          const mime = blob.type || 'image/jpeg';
          parsed = { blob, mime, ext: (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') };
        }
      }
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

  /**
   * Abre no servidor a sessão da câmera remota (computador logado). Só com a
   * sessão aberta o celular consegue enviar fotos para "camera-remota/<sessão>/".
   */
  static async openCameraSession(sessionId: string): Promise<boolean> {
    if (!this.canSync() || !(await this.getSession())) return false;
    const { error } = await this.getClient().rpc('jvm_open_camera_session', { p_id: sessionId });
    if (error) console.info('[Câmera Remota] Sessão não registrada no servidor:', error.message);
    return !error;
  }

  /** Envia uma imagem avulsa (ex.: câmera remota) e retorna a URL pública, ou null. */
  static async uploadEvidenceImage(dataUrl: string, folder: string): Promise<string | null> {
    if (!dataUrl || !dataUrl.startsWith('data:') || this.storageUnavailable || !this.canSync()) return null;
    const parsed = dataUrlToBlob(dataUrl);
    if (!parsed) return null;
    try {
      const client = this.getClient();
      const path = `${folder.replace(/[^a-zA-Z0-9_\/-]/g, '_')}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${parsed.ext}`;
      // Sem upsert: a câmera remota (celular sem login) só tem permissão para inserir
      const { error } = await client.storage.from(EVIDENCE_BUCKET).upload(path, parsed.blob, { contentType: parsed.mime, upsert: false });
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

    if (!(await this.getSession())) {
      res.success = false;
      res.errors.push(SESSION_EXPIRED_MESSAGE);
      return res;
    }

    const client = this.getClient();
    // Isolamento: só baixa dados da empresa do usuário logado (normas são globais)
    const scope = DielectricStorageService.getSessionCompanyId();
    for (const table of PULL_TABLES) {
      if (table !== 'norms' && !scope) continue;
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
          if (table === 'companies') query = query.eq('id', scope);
          else if (table === 'norms') query = scope ? query.or(`company_id.is.null,company_id.eq.${scope}`) : query.is('company_id', null);
          else query = query.eq('company_id', scope);

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
    const scope = DielectricStorageService.getSessionCompanyId();
    if (table === 'norms') {
      rows = rows.filter((r: any) => !r.company_id || r.company_id === scope);
    } else {
      rows = rows.filter((r: any) => (table === 'companies' ? r.id : r.company_id) === scope);
    }
    if (rows.length === 0) return 0;
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

    if (table === 'norms') {
      // Versão da empresa prevalece sobre a oficial (mesma norma no mesmo lote
      // ou versão da empresa já guardada no aparelho)
      const companyIds = new Set(mapped.filter(m => m.companyId).map(m => m.id));
      mapped = mapped.filter(m => {
        if (m.companyId) return true;
        if (companyIds.has(m.id)) return false;
        const local = DielectricStorageService.getLocalRecordForSync('norm', m.id) as NormCriterion | null;
        return !(local && local.companyId === scope);
      });
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

    const bootstrap = !DielectricStorageService.isBootstrapDone() && !!DielectricStorageService.getSessionCompanyId();
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

    // Depois de enviar e baixar (números já usados conhecidos), repõe as faixas de numeração
    await this.refillNumberBlocks();
    return out;
  }

  /**
   * Reserva no servidor novas faixas de numeração (ensaio, laudo, certificado,
   * OS) para uso offline sem duplicidade entre aparelhos.
   */
  static async refillNumberBlocks(): Promise<void> {
    if (this.refillPromise) return this.refillPromise;
    this.refillPromise = (async () => {
      if (!this.canSync() || !DielectricStorageService.getSessionCompanyId()) return;
      if (!(await this.getSession())) return;
      const client = this.getClient();
      for (const req of DielectricStorageService.getNumberRefillRequests()) {
        const { data, error } = await client.rpc('jvm_reserve_numbers', {
          p_kind: req.kind,
          p_period: req.period,
          p_quantity: req.quantity,
          p_local_max: req.localMax
        });
        if (error) {
          // Sem permissão (perfil cliente) ou banco sem a função: usa a contingência
          console.info('[Numeração] Reserva indisponível:', error.message);
          return;
        }
        const range: any = typeof data === 'string' ? JSON.parse(data) : data;
        if (range && Number.isFinite(range.start) && Number.isFinite(range.end)) {
          DielectricStorageService.addNumberRange(req.kind, range.start, range.end);
        }
      }
    })().catch(err => console.warn('[Numeração] Falha ao reservar faixa:', err))
      .finally(() => { this.refillPromise = null; });
    return this.refillPromise;
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
    // Faixa de numeração acabando: reserva outra se houver internet
    window.addEventListener('jvm-number-refill', () => { this.refillNumberBlocks(); });
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
  // EMPRESA DO USUÁRIO (primeiro acesso em um aparelho)
  // ===========================================================================
  /**
   * Busca a empresa pelo ID direto no banco, grava no aparelho e a torna
   * ativa (inclusive os dados técnicos do laboratório). Retorna null se não existir.
   */
  static async fetchCompanyById(companyId: string): Promise<Company | null> {
    if (!companyId || !this.canSync()) return null;
    try {
      const client = this.getClient();
      const { data, error } = await client.from('companies').select('*').eq('id', companyId).maybeSingle();
      if (error || !data || data.deleted_at) return null;
      const company = rowToCompany(data);
      DielectricStorageService.saveFromRemote('companies', [company]);
      this.knownCompanyIds.add(company.id);
      const local = DielectricStorageService.getCompanyById(company.id);
      if (local) {
        DielectricStorageService.setActiveCompany(local);
        this.applyActiveCompanyFromRemote([data]);
      }
      return local || company;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // VALIDAÇÃO PÚBLICA (QR CODE)
  // ===========================================================================
  /**
   * Portal público: busca um laudo/certificado no Supabase pelo código de
   * validação (o código aleatório do QR Code). Funciona sem login, pela
   * função jvm_validar_certificado. Devolve também os dados do laboratório
   * emissor, usados no PDF baixado pelo cliente.
   */
  static async fetchPublicValidation(code: string): Promise<{ test: TestRecord; labInfo?: CompanyLabInfo } | null> {
    const clean = (code || '').trim().toUpperCase();
    if (!clean) return null;
    try {
      const client = this.getClient();
      const { data, error } = await client.rpc('jvm_validar_certificado', { p_code: clean });
      if (error || !data) return null;
      const payload: any = typeof data === 'string' ? JSON.parse(data) : data;
      if (!payload?.test) return null;
      const test = rowToTest(payload.test);
      const company = payload.company;
      const labInfo: CompanyLabInfo | undefined = company
        ? {
            ...DielectricStorageService.getCompanyInfo(),
            name: company.name || '',
            legalName: company.legal_name || company.name || '',
            cnpj: company.cnpj || '',
            ...(company.lab_info && typeof company.lab_info === 'object' ? company.lab_info : {})
          }
        : undefined;
      return { test, labInfo };
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // AUTENTICAÇÃO
  // ===========================================================================
  /**
   * Login pelo Supabase Auth (e-mail ou nome de usuário + senha).
   * A sessão fica guardada no aparelho e identifica o usuário nas regras de
   * acesso do banco: cada um só lê e grava os dados da própria empresa.
   */
  static async authenticateWithSupabase(
    login: string,
    password: string,
    companyId?: string
  ): Promise<{ success: boolean; user?: User; error?: string; networkError?: boolean }> {
    const isNetwork = (msg?: string) => /fetch|network|Failed to|timed? ?out|Load failed/i.test(msg || '');
    const isMissingFn = (err: any) =>
      err?.code === 'PGRST202' || err?.code === '42883' || /Could not find the function|does not exist/i.test(err?.message || '');
    try {
      const config = this.getConfig();
      if (!config.enabled) {
        return { success: false, networkError: true, error: 'Integração com Supabase está desativada nas configurações.' };
      }

      const client = this.getClient(config);
      const cleanLogin = login.trim().toLowerCase();

      // 1. Nome de usuário -> e-mail de login
      const { data: email, error: emailError } = await client.rpc('jvm_login_email', { p_login: cleanLogin });
      if (emailError) {
        if (isNetwork(emailError.message)) {
          return { success: false, networkError: true, error: 'Sem conexão com o banco de dados.' };
        }
        if (isMissingFn(emailError)) {
          return {
            success: false,
            error: 'O login desta versão ainda não foi ativado no banco. Execute o arquivo supabase/schema.sql no SQL Editor do Supabase.'
          };
        }
        return { success: false, error: `Erro no Supabase: ${emailError.message}` };
      }
      if (!email) {
        return { success: false, error: 'Usuário ou senha inválidos.' };
      }

      // 2. Senha conferida pelo Supabase Auth
      const { error: signInError } = await client.auth.signInWithPassword({ email: String(email), password });
      if (signInError) {
        if (isNetwork(signInError.message) || signInError.status === 0) {
          return { success: false, networkError: true, error: 'Sem conexão com o banco de dados.' };
        }
        if (signInError.code === 'user_banned' || /banned/i.test(signInError.message || '')) {
          return { success: false, error: 'Usuário inativo. Contate o administrador.' };
        }
        if (signInError.status === 429) {
          return { success: false, error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' };
        }
        return { success: false, error: 'Usuário ou senha inválidos.' };
      }

      // 3. Perfil do usuário no sistema
      const { data, error } = await client.rpc('jvm_me');
      const payload: any = typeof data === 'string' ? JSON.parse(data) : data;
      if (error || !payload || payload.ok !== true || !payload.user) {
        await this.signOut();
        return { success: false, error: payload?.error || error?.message || 'Não foi possível carregar o perfil do usuário.' };
      }

      const userObj = rowToUser(payload.user);
      delete (userObj as any).syncStatus;
      const homeCompanyId = payload.user.company_id || userObj.companyId || '';
      userObj.companyId = companyId || homeCompanyId;

      // Mantém o perfil no aparelho (sem senha) para a lista de usuários
      DielectricStorageService.saveFromRemote('users', [{ ...userObj, companyId: homeCompanyId }]);

      return { success: true, user: userObj };
    } catch (err: any) {
      return { success: false, networkError: true, error: err.message || 'Falha na conexão de login com o Supabase' };
    }
  }

  // ===========================================================================
  // CADASTRO DE USUÁRIOS (administrador da empresa)
  // ===========================================================================
  /** Mensagem amigável para erros das funções de administração de usuários. */
  private static adminErrorMessage(error: any): string {
    const msg = error?.message || '';
    if (/fetch|network|Failed to|Load failed/i.test(msg)) {
      return 'Sem conexão com a internet: cadastrar usuário com acesso ou definir senha exige internet.';
    }
    if (error?.code === 'PGRST202' || /Could not find the function/i.test(msg)) {
      return 'Função ainda não instalada no banco. Execute o arquivo supabase/schema.sql no SQL Editor do Supabase.';
    }
    return msg || 'Não foi possível concluir a operação.';
  }

  /**
   * Cadastra um usuário COM acesso ao sistema, vinculado à empresa do
   * administrador logado. A senha é gravada (criptografada) pelo servidor.
   */
  static async adminCreateUser(data: {
    name: string;
    email: string;
    username?: string;
    role: User['role'];
    password: string;
    cargo?: string;
    registration?: string;
    phone?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    if (!this.canSync()) return { success: false, error: this.adminErrorMessage({ message: 'network' }) };
    if (!(await this.getSession())) return { success: false, error: SESSION_EXPIRED_MESSAGE };
    const { data: res, error } = await this.getClient().rpc('jvm_admin_create_user', {
      p_name: data.name,
      p_email: data.email,
      p_username: data.username || null,
      p_role: data.role,
      p_password: data.password,
      p_cargo: data.cargo || null,
      p_registration: data.registration || null,
      p_phone: data.phone || null
    });
    if (error) return { success: false, error: this.adminErrorMessage(error) };
    const payload: any = typeof res === 'string' ? JSON.parse(res) : res;
    if (!payload?.user) return { success: false, error: 'Resposta inválida do servidor.' };
    const user = rowToUser(payload.user);
    DielectricStorageService.saveFromRemote('users', [user]);
    return { success: true, user };
  }

  /**
   * Define ou troca a senha de um usuário da empresa. Para um técnico
   * cadastrado sem acesso, informe o e-mail (e, se quiser, o nome de usuário).
   */
  static async adminSetPassword(userId: string, password: string, email?: string, username?: string): Promise<{ success: boolean; user?: User; error?: string }> {
    if (!this.canSync()) return { success: false, error: this.adminErrorMessage({ message: 'network' }) };
    if (!(await this.getSession())) return { success: false, error: SESSION_EXPIRED_MESSAGE };
    const { data: res, error } = await this.getClient().rpc('jvm_admin_set_password', {
      p_user_id: userId,
      p_password: password,
      p_email: email || null,
      p_username: username || null
    });
    if (error) return { success: false, error: this.adminErrorMessage(error) };
    const payload: any = typeof res === 'string' ? JSON.parse(res) : res;
    if (!payload?.user) return { success: false, error: 'Resposta inválida do servidor.' };
    const user = rowToUser(payload.user);
    DielectricStorageService.saveFromRemote('users', [user]);
    return { success: true, user };
  }
}
