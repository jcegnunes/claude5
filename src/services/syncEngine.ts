import { 
  Client, 
  Equipment, 
  ServiceOrder, 
  LabInstrument, 
  NormCriterion, 
  TestRecord, 
  User, 
  AuditLog, 
  SyncConflict,
  Company,
  CompanyLabInfo,
  ConsolidatedReport
} from '../types';
import { 
  INITIAL_CLIENTS, 
  INITIAL_EQUIPMENT, 
  INITIAL_SERVICE_ORDERS, 
  INITIAL_INSTRUMENTS, 
  INITIAL_NORMS, 
  INITIAL_TEST_RECORDS, 
  INITIAL_USERS, 
  INITIAL_AUDIT_LOGS,
  INITIAL_COMPANIES,
  JVM_COMPANY_INFO
} from '../data/seedData';
import { DEFAULT_VALIDATION_BASE_URL, normalizeValidationBaseUrl } from '../config/validationPortalConfig';

const STORAGE_KEYS = {
  COMPANIES: 'jvm_dielectric_companies',
  ACTIVE_COMPANY: 'jvm_dielectric_active_company',
  CLIENTS: 'jvm_dielectric_clients',
  EQUIPMENT: 'jvm_dielectric_equipment',
  SERVICE_ORDERS: 'jvm_dielectric_os',
  INSTRUMENTS: 'jvm_dielectric_instruments',
  NORMS: 'jvm_dielectric_norms',
  TESTS: 'jvm_dielectric_tests',
  USERS: 'jvm_dielectric_users',
  AUDIT: 'jvm_dielectric_audit',
  CONFLICTS: 'jvm_dielectric_conflicts',
  COMPANY: 'jvm_dielectric_company',
  CURRENT_USER: 'jvm_dielectric_current_user',
  DEVICE_ID: 'jvm_dielectric_device_id',
  SYNC_QUEUE: 'jvm_dielectric_sync_queue',
  LAST_SYNC: 'jvm_dielectric_last_sync',
  REPORTS: 'jvm_dielectric_consolidated_reports',
  PULL_CURSORS: 'jvm_dielectric_pull_cursors',
  BOOTSTRAP_V61: 'jvm_dielectric_supabase_bootstrap_v61',
  IDB_MIGRATED_V61: 'jvm_dielectric_idb_migrated_v61'
};

export const LEGACY_IDB_NAME = 'jvm_dielectric_lab_offline_db';

export type SyncEntityType =
  | 'client'
  | 'equipment'
  | 'service_order'
  | 'test'
  | 'norm'
  | 'user'
  | 'company'
  | 'company_info'
  | 'instrument'
  | 'report'
  | 'audit';

/**
 * Item da fila de envio ao Supabase (outbox).
 * Guarda apenas a REFERÊNCIA do registro: no envio o dado é lido do cache
 * local, sempre na versão mais recente (antes a fila duplicava o registro
 * inteiro, fotos inclusive, e esgotava o armazenamento do navegador).
 */
export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  action: 'create' | 'update' | 'delete';
  entityId: string;
  data?: any;
  timestamp: string;
  deviceId: string;
  retryCount: number;
  lastError?: string;
  nextAttemptAt?: string;
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'DEV-SERVER';
  let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!id) {
    id = 'DEV-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    try {
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
    } catch {}
  }
  return id;
}

/** Tipo de entidade -> chave do cache local */
export const ENTITY_STORAGE_KEY: Record<SyncEntityType, string> = {
  client: STORAGE_KEYS.CLIENTS,
  equipment: STORAGE_KEYS.EQUIPMENT,
  service_order: STORAGE_KEYS.SERVICE_ORDERS,
  test: STORAGE_KEYS.TESTS,
  norm: STORAGE_KEYS.NORMS,
  user: STORAGE_KEYS.USERS,
  company: STORAGE_KEYS.COMPANIES,
  company_info: STORAGE_KEYS.COMPANIES,
  instrument: STORAGE_KEYS.INSTRUMENTS,
  report: STORAGE_KEYS.REPORTS,
  audit: STORAGE_KEYS.AUDIT
};

/** Tabela Supabase -> tipo de entidade local */
export const TABLE_ENTITY: Record<string, SyncEntityType> = {
  companies: 'company',
  users: 'user',
  clients: 'client',
  equipment: 'equipment',
  service_orders: 'service_order',
  lab_instruments: 'instrument',
  norms: 'norm',
  test_records: 'test',
  consolidated_reports: 'report',
  audit_logs: 'audit'
};

/**
 * Agenda o envio da fila ao Supabase (debounce). Chamado a cada gravação
 * local: o ensaio sai do aparelho segundos depois de salvo, e várias
 * gravações seguidas viram um único lote.
 */
let cloudFlushTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleCloudSync(delayMs: number = 1500): void {
  if (typeof window === 'undefined') return;
  if (cloudFlushTimer) clearTimeout(cloudFlushTimer);
  cloudFlushTimer = setTimeout(() => {
    cloudFlushTimer = null;
    import('./supabaseService')
      .then(({ SupabaseService }) => SupabaseService.flushQueue())
      .catch(err => console.warn('[Supabase Sync] Falha ao agendar envio:', err));
  }, delayMs);
}

// Storage helpers with quota protection
function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (err) {
    console.warn(`Error reading ${key} from storage:`, err);
    return fallback;
  }
}

function setLocal<T>(key: string, data: T): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (err: any) {
    console.warn(`localStorage quota warning on ${key}:`, err);
    // If quota exceeded, clean up old audit logs or temporary keys
    if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
      try {
        const audit = getLocal<AuditLog[]>(STORAGE_KEYS.AUDIT, []);
        if (audit.length > 50) {
          localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(audit.slice(0, 50)));
        }
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (retryErr) {
        console.error('Fatal storage quota limit reached in localStorage:', retryErr);
        // Tenta liberar espaço enviando as fotos pendentes para o Supabase Storage
        scheduleCloudSync(0);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jvm-storage-quota', { detail: { key } }));
        }
      }
    }
    return false;
  }
}

export class DielectricStorageService {
  private static isInitialized = false;

  // Initialization
  static init() {
    if (typeof window === 'undefined') return;
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (!localStorage.getItem(STORAGE_KEYS.NORMS)) {
      setLocal(STORAGE_KEYS.NORMS, INITIAL_NORMS);
    } else {
      // Auto-migrate or update existing norms, ensuring all seed norms (ASTM D178-22, ASTM D1048, NBR 16295 Tabela 4) are present
      try {
        const existingNorms = getLocal<NormCriterion[]>(STORAGE_KEYS.NORMS, []);
        let updated = false;
        const existingIds = new Set(existingNorms.map(n => n.id));
        const migratedNorms = existingNorms.map(n => {
          if (n.applicableEquipmentTypes?.includes('luva_isolante')) {
            const seedMatch = INITIAL_NORMS.find(sn => sn.id === n.id || (sn.applicableEquipmentTypes.includes('luva_isolante') && sn.dielectricClass === n.dielectricClass));
            if (seedMatch && (n.normCode !== 'NBR 16295 Tabela 4' || !n.gloveLengthLimits || (n.gloveLengthLimits[360] && n.gloveLengthLimits[360]! < 20) || n.maxLeakageCurrent < 20)) {
              updated = true;
              return { 
                ...n, 
                ...seedMatch, 
                normCode: 'NBR 16295 Tabela 4', 
                maxLeakageCurrent: seedMatch.maxLeakageCurrent,
                gloveLengthLimits: seedMatch.gloveLengthLimits,
                notes: seedMatch.notes,
                history: n.history || seedMatch.history 
              };
            }
          }
          if (n.applicableEquipmentTypes?.includes('tapete_isolante')) {
            const seedMatch = INITIAL_NORMS.find(sn => sn.id === n.id || (sn.applicableEquipmentTypes.includes('tapete_isolante') && sn.dielectricClass === n.dielectricClass));
            if (seedMatch && (n.maxLeakageCurrent !== 100 || n.notes !== seedMatch.notes)) {
              updated = true;
              return {
                ...n,
                ...seedMatch,
                maxLeakageCurrent: 100.0,
                notes: seedMatch.notes,
                history: n.history || seedMatch.history
              };
            }
          }
          return n;
        });

        // Ensure all seed norms exist (especially ASTM D178-22 and ASTM D1048)
        INITIAL_NORMS.forEach(seedNorm => {
          if (!existingIds.has(seedNorm.id)) {
            migratedNorms.push(seedNorm);
            existingIds.add(seedNorm.id);
            updated = true;
          }
        });

        if (updated) {
          setLocal(STORAGE_KEYS.NORMS, migratedNorms);
        }
      } catch (mErr) {
        console.warn('Norms migration notice:', mErr);
      }

      // Also migrate any saved tests for luva_isolante to NBR 16295 Tabela 4
      try {
        const existingTests = getLocal<TestRecord[]>(STORAGE_KEYS.TESTS, []);
        let testsUpdated = false;
        const migratedTests = existingTests.map(t => {
          if ((t.equipmentType === 'luva_isolante' || t.gloveLength_mm) && (t.normCode === 'ABNT NBR 16259' || t.normCode === 'NBR 16295 / IEC 60903')) {
            testsUpdated = true;
            return { ...t, normCode: 'NBR 16295 Tabela 4' };
          }
          return t;
        });
        if (testsUpdated) {
          setLocal(STORAGE_KEYS.TESTS, migratedTests);
        }
      } catch (tErr) {
        console.warn('Tests migration notice:', tErr);
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.COMPANIES)) {
      setLocal(STORAGE_KEYS.COMPANIES, INITIAL_COMPANIES);
    } else {
      // Ensure seed companies are always present
      const existing = getLocal<Company[]>(STORAGE_KEYS.COMPANIES, []);
      const existingIds = new Set(existing.map(c => c.id));
      let compUpdated = false;
      INITIAL_COMPANIES.forEach(seedComp => {
        if (!existingIds.has(seedComp.id)) {
          existing.push(seedComp);
          existingIds.add(seedComp.id);
          compUpdated = true;
        }
      });
      if (compUpdated) {
        setLocal(STORAGE_KEYS.COMPANIES, existing);
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY)) {
      setLocal(STORAGE_KEYS.ACTIVE_COMPANY, INITIAL_COMPANIES[0]);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CLIENTS)) {
      setLocal(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.EQUIPMENT)) {
      setLocal(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SERVICE_ORDERS)) {
      setLocal(STORAGE_KEYS.SERVICE_ORDERS, INITIAL_SERVICE_ORDERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.INSTRUMENTS)) {
      setLocal(STORAGE_KEYS.INSTRUMENTS, INITIAL_INSTRUMENTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TESTS)) {
      setLocal(STORAGE_KEYS.TESTS, INITIAL_TEST_RECORDS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      setLocal(STORAGE_KEYS.USERS, INITIAL_USERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT)) {
      setLocal(STORAGE_KEYS.AUDIT, INITIAL_AUDIT_LOGS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.COMPANY)) {
      setLocal(STORAGE_KEYS.COMPANY, JVM_COMPANY_INFO);
    }
    // CNPJ oficial da JVM Engenharia (substitui os CNPJs de demonstração)
    try {
      const DEMO_CNPJS = ['34.892.115/0001-80', '38.456.789/0001-12'];
      const JVM_CNPJ = '29.894.500/0001-04';
      const comps = getLocal<Company[]>(STORAGE_KEYS.COMPANIES, []);
      const jvm = comps.find(c => c.id === 'comp-jvm');
      if (jvm && (!jvm.cnpj || DEMO_CNPJS.includes(jvm.cnpj))) {
        jvm.cnpj = JVM_CNPJ;
        jvm.updatedAt = new Date().toISOString();
        setLocal(STORAGE_KEYS.COMPANIES, comps);
      }
      const info = getLocal<CompanyLabInfo | null>(STORAGE_KEYS.COMPANY, null);
      if (info && (!info.cnpj || DEMO_CNPJS.includes(info.cnpj))) {
        setLocal(STORAGE_KEYS.COMPANY, { ...info, cnpj: JVM_CNPJ });
      }
      const active = getLocal<Company | null>(STORAGE_KEYS.ACTIVE_COMPANY, null);
      if (active && active.id === 'comp-jvm' && (!active.cnpj || DEMO_CNPJS.includes(active.cnpj))) {
        setLocal(STORAGE_KEYS.ACTIVE_COMPANY, { ...active, cnpj: JVM_CNPJ });
      }
    } catch {}

    // Sem login automático: a sessão só existe após autenticação no banco.
    // Senhas nunca ficam guardadas no aparelho (remove as de versões antigas).
    try {
      const storedUsers = getLocal<User[]>(STORAGE_KEYS.USERS, []);
      if (storedUsers.some(u => u && u.password)) {
        setLocal(STORAGE_KEYS.USERS, storedUsers.map(u => {
          const { password: _pw, ...rest } = u as User;
          return rest as User;
        }));
      }
    } catch {}

    // Auto-migrate all entities to ensure companyId is populated
    try {
      const allClients = getLocal<Client[]>(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
      let clientsUpdated = false;
      allClients.forEach(c => {
        if (!c.companyId) {
          c.companyId = 'comp-jvm';
          clientsUpdated = true;
        }
      });
      if (clientsUpdated) setLocal(STORAGE_KEYS.CLIENTS, allClients);

      const allEq = getLocal<Equipment[]>(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
      let eqUpdated = false;
      allEq.forEach(e => {
        if (!e.companyId) {
          e.companyId = 'comp-jvm';
          eqUpdated = true;
        }
      });
      if (eqUpdated) setLocal(STORAGE_KEYS.EQUIPMENT, allEq);

      const allOrders = getLocal<ServiceOrder[]>(STORAGE_KEYS.SERVICE_ORDERS, INITIAL_SERVICE_ORDERS);
      let ordersUpdated = false;
      allOrders.forEach(o => {
        if (!o.companyId) {
          o.companyId = 'comp-jvm';
          ordersUpdated = true;
        }
      });
      if (ordersUpdated) setLocal(STORAGE_KEYS.SERVICE_ORDERS, allOrders);

      const allInst = getLocal<LabInstrument[]>(STORAGE_KEYS.INSTRUMENTS, INITIAL_INSTRUMENTS);
      let instUpdated = false;
      allInst.forEach(i => {
        if (!i.companyId) {
          i.companyId = 'comp-jvm';
          instUpdated = true;
        }
      });
      if (instUpdated) setLocal(STORAGE_KEYS.INSTRUMENTS, allInst);

      const allTests = getLocal<TestRecord[]>(STORAGE_KEYS.TESTS, INITIAL_TEST_RECORDS);
      let testsCompUpdated = false;
      allTests.forEach(t => {
        if (!t.companyId) {
          t.companyId = 'comp-jvm';
          t.companyName = t.companyName || 'JVM Engenharia & Treinamentos';
          testsCompUpdated = true;
        }
      });
      if (testsCompUpdated) setLocal(STORAGE_KEYS.TESTS, allTests);

      const allUsers = getLocal<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
      let usersUpdated = false;
      const userIds = new Set(allUsers.map(u => u.id));
      INITIAL_USERS.forEach(su => {
        if (!userIds.has(su.id)) {
          allUsers.push(su);
          userIds.add(su.id);
          usersUpdated = true;
        }
      });
      allUsers.forEach(u => {
        if (!u.companyId) {
          u.companyId = 'comp-jvm';
          u.companyName = u.companyName || 'JVM Engenharia & Treinamentos';
          usersUpdated = true;
        }
      });
      if (usersUpdated) setLocal(STORAGE_KEYS.USERS, allUsers);
    } catch (migrErr) {
      console.warn('Company scoping migration notice:', migrErr);
    }

    // Migração única: dados que só existiam no antigo IndexedDB voltam para o
    // cache e entram na fila do Supabase. Depois o IndexedDB é apagado.
    this.migrateLegacyIndexedDb();
  }

  /**
   * Migração única do antigo banco IndexedDB (removido na v6.1).
   * Registros que existiam apenas lá são trazidos para o cache local e
   * enfileirados para o Supabase, então o banco antigo é excluído.
   */
  private static migrateLegacyIndexedDb(): void {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    if (localStorage.getItem(STORAGE_KEYS.IDB_MIGRATED_V61)) return;

    const storeMap: Array<{ store: string; key: string; entity: SyncEntityType }> = [
      { store: 'companies', key: STORAGE_KEYS.COMPANIES, entity: 'company' },
      { store: 'clients', key: STORAGE_KEYS.CLIENTS, entity: 'client' },
      { store: 'equipment', key: STORAGE_KEYS.EQUIPMENT, entity: 'equipment' },
      { store: 'serviceOrders', key: STORAGE_KEYS.SERVICE_ORDERS, entity: 'service_order' },
      { store: 'instruments', key: STORAGE_KEYS.INSTRUMENTS, entity: 'instrument' },
      { store: 'norms', key: STORAGE_KEYS.NORMS, entity: 'norm' },
      { store: 'tests', key: STORAGE_KEYS.TESTS, entity: 'test' },
      { store: 'users', key: STORAGE_KEYS.USERS, entity: 'user' },
      { store: 'reports', key: STORAGE_KEYS.REPORTS, entity: 'report' }
    ];

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(LEGACY_IDB_NAME);
    } catch {
      return;
    }

    request.onupgradeneeded = () => {
      // Banco não existia: nada a migrar. Aborta para não criar um banco vazio.
      try { request.transaction?.abort(); } catch {}
    };
    request.onerror = () => {
      try { localStorage.setItem(STORAGE_KEYS.IDB_MIGRATED_V61, new Date().toISOString()); } catch {}
      try { indexedDB.deleteDatabase(LEGACY_IDB_NAME); } catch {}
    };
    request.onsuccess = async () => {
      const idb = request.result;
      const readStore = (name: string) => new Promise<any[]>((resolve) => {
        if (!idb.objectStoreNames.contains(name)) return resolve([]);
        try {
          const req = idb.transaction(name, 'readonly').objectStore(name).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });

      let allWritten = true;
      const toEnqueue: Array<{ entityType: SyncEntityType; entityId: string }> = [];
      for (const { store, key, entity } of storeMap) {
        const idbItems = await readStore(store);
        if (!idbItems.length) continue;
        const local = getLocal<any[]>(key, []);
        const ids = new Set(local.map(i => i && i.id));
        let added = false;
        idbItems.forEach(item => {
          if (item && item.id && !ids.has(item.id)) {
            local.push({ ...item, syncStatus: 'pending' });
            ids.add(item.id);
            toEnqueue.push({ entityType: entity, entityId: item.id });
            added = true;
          }
        });
        if (added && !setLocal(key, local)) allWritten = false;
      }
      idb.close();

      if (toEnqueue.length > 0) {
        this.enqueueMany(toEnqueue.map(i => ({ ...i, action: 'update' as const })));
        console.info(`[Migração v6.1] ${toEnqueue.length} registro(s) recuperado(s) do IndexedDB e enviados para a fila do Supabase.`);
        window.dispatchEvent(new Event('jvm-data-changed'));
      }
      if (allWritten) {
        try { localStorage.setItem(STORAGE_KEYS.IDB_MIGRATED_V61, new Date().toISOString()); } catch {}
        try { indexedDB.deleteDatabase(LEGACY_IDB_NAME); } catch {}
      }
    };
  }

  // Multi-Company Management
  static getCompanies(): Company[] {
    const comps = getLocal<Company[]>(STORAGE_KEYS.COMPANIES, INITIAL_COMPANIES);
    if (!comps || comps.length === 0) {
      setLocal(STORAGE_KEYS.COMPANIES, INITIAL_COMPANIES);
      return INITIAL_COMPANIES;
    }
    return comps;
  }

  static getCompanyById(id: string): Company | undefined {
    return this.getCompanies().find(c => c.id === id);
  }

  static getActiveCompany(): Company {
    let active = getLocal<Company | null>(STORAGE_KEYS.ACTIVE_COMPANY, null);
    if (!active || !active.id) {
      const comps = this.getCompanies();
      active = comps[0] || INITIAL_COMPANIES[0];
      setLocal(STORAGE_KEYS.ACTIVE_COMPANY, active);
    }
    return active;
  }

  static setActiveCompany(company: Company): void {
    setLocal(STORAGE_KEYS.ACTIVE_COMPANY, company);
    this.syncCompanyInfoFromCompany(company);
    window.dispatchEvent(new CustomEvent('jvm-company-changed', { detail: { company } }));
    window.dispatchEvent(new Event('jvm-data-changed'));
  }

  static setActiveCompanyById(companyId: string): Company | null {
    const comp = this.getCompanyById(companyId);
    if (comp) {
      this.setActiveCompany(comp);
      return comp;
    }
    return null;
  }

  static syncCompanyInfoFromCompany(company: Company): void {
    const currentInfo = this.getCompanyInfo();
    const formattedCityState = `${company.city || ''} - ${company.state || ''}${company.cep ? `, CEP: ${company.cep}` : ''}`.trim();
    const updatedInfo: CompanyLabInfo = {
      ...currentInfo,
      name: company.name,
      legalName: company.legalName,
      cnpj: company.cnpj,
      creaCompanyRegister: company.creaCompanyRegister || currentInfo.creaCompanyRegister,
      address: company.address || currentInfo.address,
      number: company.number || currentInfo.number,
      neighborhood: company.neighborhood || currentInfo.neighborhood,
      city: company.city || currentInfo.city,
      state: company.state || currentInfo.state,
      cep: company.cep || currentInfo.cep,
      cityState: formattedCityState || currentInfo.cityState,
      phone: company.phone || currentInfo.phone,
      email: company.email || currentInfo.email,
      website: company.website || currentInfo.website,
      logoUrl: company.logoUrl !== undefined ? company.logoUrl : currentInfo.logoUrl,
      technicalResponsible: company.technicalResponsible || currentInfo.technicalResponsible,
      certificateEmissionSettings: company.certificateEmissionSettings || currentInfo.certificateEmissionSettings
    };
    setLocal(STORAGE_KEYS.COMPANY, updatedInfo);
  }

  static saveCompany(company: Company): Company {
    const companies = this.getCompanies();
    const existingIdx = companies.findIndex(c => c.id === company.id);
    const updatedComp: Company = {
      ...company,
      updatedAt: new Date().toISOString()
    };
    if (existingIdx < 0) {
      updatedComp.createdAt = updatedComp.createdAt || new Date().toISOString();
      companies.push(updatedComp);
      this.addAuditLog('CADASTRO', 'Empresa', company.id, `Nova empresa/laboratório cadastrado: ${company.name} (CNPJ ${company.cnpj})`, undefined, undefined, company.id);
    } else {
      companies[existingIdx] = updatedComp;
      this.addAuditLog('ALTERACAO', 'Empresa', company.id, `Dados cadastrais da empresa atualizados: ${company.name}`, undefined, undefined, company.id);
    }
    setLocal(STORAGE_KEYS.COMPANIES, companies);
    this.enqueueSync('company', existingIdx < 0 ? 'create' : 'update', company.id, updatedComp);

    const active = this.getActiveCompany();
    if (active.id === company.id) {
      this.setActiveCompany(updatedComp);
    }
    window.dispatchEvent(new Event('jvm-data-changed'));
    return updatedComp;
  }

  // Current User
  static getCurrentUser(): User {
    return getLocal<User>(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[1]);
  }

  static setCurrentUser(user: User): void {
    setLocal(STORAGE_KEYS.CURRENT_USER, user);
    window.dispatchEvent(new Event('jvm-data-changed'));
  }

  static getUsers(companyId?: string): User[] {
    const allUsers = getLocal<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    const targetCompId = companyId !== undefined ? companyId : this.getActiveCompany().id;
    if (targetCompId === 'ALL') {
      return allUsers;
    }
    return allUsers.filter(u => u.isMasterAdmin || (u.companyId || 'comp-jvm') === targetCompId);
  }

  static saveUser(user: User): User {
    const allUsers = getLocal<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    const existingIdx = allUsers.findIndex(u => u.id === user.id);
    const isNew = existingIdx < 0;
    const activeComp = this.getActiveCompany();
    const targetCompId = user.companyId || activeComp.id;

    // A senha informada vira "senha inicial" enviada ao banco (criptografada lá)
    // e nunca é guardada na lista local de usuários.
    const { password: typedPassword, ...userWithoutPassword } = user;
    if (typedPassword && typedPassword.trim()) {
      this.setPendingInitialPassword(user.id, typedPassword.trim());
    }

    const updatedUser: User = {
      ...(userWithoutPassword as User),
      companyId: targetCompId,
      companyName: user.companyName || activeComp.name,
      active: user.active ?? true
    };

    if (isNew) {
      allUsers.push(updatedUser);
      this.addAuditLog('CADASTRO', 'Usuario', user.id, `Novo usuário cadastrado: ${user.name} (${user.cargo || user.role})`, undefined, undefined, targetCompId);
    } else {
      allUsers[existingIdx] = updatedUser;
      this.addAuditLog('ALTERACAO', 'Usuario', user.id, `Dados de usuário atualizados: ${user.name}`, undefined, undefined, targetCompId);
    }

    setLocal(STORAGE_KEYS.USERS, allUsers);
    this.enqueueSync('user', isNew ? 'create' : 'update', user.id, updatedUser);
    window.dispatchEvent(new Event('jvm-data-changed'));
    return updatedUser;
  }

  // ---------------------------------------------------------------------------
  // Senha inicial de usuários recém-criados (mantida só até ser enviada ao banco)
  // ---------------------------------------------------------------------------
  private static PENDING_PASSWORDS_KEY = 'jvm_pending_initial_passwords';

  static setPendingInitialPassword(userId: string, password: string): void {
    const all = getLocal<Record<string, string>>(this.PENDING_PASSWORDS_KEY, {});
    all[userId] = password;
    setLocal(this.PENDING_PASSWORDS_KEY, all);
  }

  static getPendingInitialPasswords(): Record<string, string> {
    return getLocal<Record<string, string>>(this.PENDING_PASSWORDS_KEY, {});
  }

  static clearPendingInitialPassword(userId: string): void {
    const all = getLocal<Record<string, string>>(this.PENDING_PASSWORDS_KEY, {});
    delete all[userId];
    setLocal(this.PENDING_PASSWORDS_KEY, all);
  }

  // Company Info
  static getCompanyInfo(): CompanyLabInfo {
    const info = getLocal<CompanyLabInfo>(STORAGE_KEYS.COMPANY, JVM_COMPANY_INFO);
    let city = info.city;
    let state = info.state;
    let cep = info.cep;
    let number = info.number;
    let neighborhood = info.neighborhood;
    let complement = info.complement;

    if ((!city || !state || !cep) && info.cityState) {
      const cepMatch = info.cityState.match(/CEP:?\s*([\d.-]+)/i);
      if (cepMatch && !cep) {
        cep = cepMatch[1].trim();
      }
      const cleanStr = info.cityState.replace(/,?\s*CEP:?.*$/i, '').trim();
      const parts = cleanStr.split(/[\/-]/).map(s => s.trim());
      if (!city && parts[0]) city = parts[0];
      if (!state && parts[1]) state = parts[1];
    }

    if (!number && info.address) {
      const numMatch = info.address.match(/,\s*([\d\w\s/]+?)(?:\s*-\s*|$)/);
      if (numMatch) {
        number = numMatch[1].trim();
      }
    }

    const defaultEmissionSettings = JVM_COMPANY_INFO.certificateEmissionSettings!;
    const emissionSettings = {
      ...defaultEmissionSettings,
      ...(info.certificateEmissionSettings || {})
    };

    // Campos da antiga integração Hostinger (removida) não são mais expostos
    const {
      hostingerPlatformUrl: legacyPlatformUrl,
      hostingerApiKey: _legacyApiKey,
      hostingerAutoSync: _legacyAutoSync,
      lastHostingerSyncTime: _legacySyncTime,
      ...cleanInfo
    } = info as CompanyLabInfo & Record<string, any>;
    const currentValidationUrl = normalizeValidationBaseUrl(info.validationBaseUrl || legacyPlatformUrl);

    return {
      ...cleanInfo,
      instagram: info.instagram || '@jvmengenharia',
      number: number || '1420',
      neighborhood: neighborhood || 'Distrito Industrial',
      complement: complement || 'Módulo 04',
      city: city || 'Campinas',
      state: state || 'SP',
      cep: cep || '13080-000',
      cityState: info.cityState || `${city || 'Campinas'} - ${state || 'SP'}, CEP: ${cep || '13080-000'}`,
      validationBaseUrl: currentValidationUrl,
      certificateEmissionSettings: emissionSettings
    };
  }

  static saveCompanyInfo(info: CompanyLabInfo): void {
    const {
      hostingerPlatformUrl: _hp,
      hostingerApiKey: _hk,
      hostingerAutoSync: _ha,
      lastHostingerSyncTime: _hl,
      ...cleanInfo
    } = info as CompanyLabInfo & Record<string, any>;
    info = cleanInfo as CompanyLabInfo;
    const formattedCityState = `${info.city || ''} - ${info.state || ''}${info.cep ? `, CEP: ${info.cep}` : ''}`.trim();
    const updated: CompanyLabInfo = {
      ...info,
      logoUrl: info.logoUrl !== undefined ? info.logoUrl : '',
      instagram: info.instagram !== undefined ? info.instagram.trim() : '',
      validationBaseUrl: normalizeValidationBaseUrl(info.validationBaseUrl || DEFAULT_VALIDATION_BASE_URL),
      address: info.address?.trim() || '',
      number: info.number?.trim() || '',
      neighborhood: info.neighborhood?.trim() || '',
      complement: info.complement?.trim() || '',
      city: info.city?.trim() || '',
      state: info.state?.trim().toUpperCase() || '',
      cep: info.cep?.trim() || '',
      cityState: formattedCityState || info.cityState || '',
      certificateEmissionSettings: info.certificateEmissionSettings || JVM_COMPANY_INFO.certificateEmissionSettings
    };
    
    setLocal(STORAGE_KEYS.COMPANY, updated);
    this.enqueueSync('company_info', 'update', this.getActiveCompany().id);

    if (info.technicalResponsible?.name) {
      // Atualiza o RT na lista COMPLETA de usuários (antes a lista filtrada
      // pela empresa ativa sobrescrevia e apagava usuários das outras empresas)
      const activeId = this.getActiveCompany().id;
      const allUsers = getLocal<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
      const rtIdx = allUsers.findIndex(u => u.role === 'responsavel_tecnico' && (u.isMasterAdmin || (u.companyId || 'comp-jvm') === activeId));
      if (rtIdx >= 0) {
        allUsers[rtIdx] = {
          ...allUsers[rtIdx],
          name: info.technicalResponsible.name,
          cargo: info.technicalResponsible.title || allUsers[rtIdx].cargo,
          creaOrCft: info.technicalResponsible.creaNumber || allUsers[rtIdx].creaOrCft
        };
        setLocal(STORAGE_KEYS.USERS, allUsers);
        this.enqueueSync('user', 'update', allUsers[rtIdx].id);
      }
    }

    this.addAuditLog('ALTERACAO', 'Configurações', 'info', 'Atualização dos dados cadastrais, emissão de laudos/certificados e logotipo da JVM Engenharia');
    window.dispatchEvent(new Event('jvm-data-changed'));
  }

  static updateCompanyInfo(info: CompanyLabInfo): void {
    this.saveCompanyInfo(info);
  }

  /**
   * Grava dados técnicos do laboratório vindos do Supabase ou metadados de
   * sincronização, sem gerar auditoria nem reenfileirar (evita laço infinito).
   */
  static setCompanyInfoSilently(info: CompanyLabInfo): void {
    setLocal(STORAGE_KEYS.COMPANY, info);
  }

  // Clients
  static getClients(companyId?: string): Client[] {
    const allClients = getLocal<Client[]>(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS).filter(c => !c.deletedAt);
    const targetCompId = companyId !== undefined ? companyId : this.getActiveCompany().id;
    if (targetCompId === 'ALL') {
      return allClients;
    }
    return allClients.filter(c => (c.companyId || 'comp-jvm') === targetCompId);
  }

  static saveClient(client: Client): Client {
    const allClients = getLocal<Client[]>(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
    let existingIdx = allClients.findIndex(c => c.id === client.id);
    const isNew = existingIdx < 0;
    const activeComp = this.getActiveCompany();
    const targetCompId = client.companyId || activeComp.id;

    // Safety lock: If new client ID but identical clean CNPJ exists in the same company, merge/update existing to prevent duplication
    const cleanNewCnpj = (client.cnpj || '').replace(/\D/g, '');
    if (isNew && cleanNewCnpj && cleanNewCnpj.length >= 11) {
      const duplicateCnpjIdx = allClients.findIndex(c => 
        !c.deletedAt && (c.companyId || 'comp-jvm') === targetCompId && (c.cnpj || '').replace(/\D/g, '') === cleanNewCnpj
      );
      if (duplicateCnpjIdx >= 0) {
        existingIdx = duplicateCnpjIdx;
      }
    }

    const updatedClient: Client = {
      ...(existingIdx >= 0 ? allClients[existingIdx] : {}),
      ...client,
      companyId: targetCompId,
      id: existingIdx >= 0 ? allClients[existingIdx].id : client.id,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending'
    };

    if (existingIdx < 0) {
      updatedClient.createdAt = new Date().toISOString();
      allClients.unshift(updatedClient);
      this.addAuditLog('CADASTRO', 'Cliente', client.id, `Novo cliente cadastrado: ${client.razaoSocial} (CNPJ ${client.cnpj})`, undefined, undefined, targetCompId);
    } else {
      allClients[existingIdx] = updatedClient;
      this.addAuditLog('ALTERACAO', 'Cliente', updatedClient.id, `Cliente atualizado: ${updatedClient.razaoSocial} (CNPJ ${updatedClient.cnpj})`, undefined, undefined, targetCompId);
    }

    setLocal(STORAGE_KEYS.CLIENTS, allClients);
    
    this.enqueueSync('client', existingIdx < 0 ? 'create' : 'update', updatedClient.id, updatedClient);
    window.dispatchEvent(new Event('jvm-data-changed'));
    return updatedClient;
  }

  static deleteClient(id: string): void {
    // Exclusão lógica: propagada a todos os dispositivos via deleted_at
    const clients = getLocal<Client[]>(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
    const client = clients.find(c => c.id === id);
    if (!client) return;
    client.deletedAt = new Date().toISOString();
    client.updatedAt = client.deletedAt;
    client.syncStatus = 'pending';
    setLocal(STORAGE_KEYS.CLIENTS, clients);
    this.addAuditLog('EXCLUSAO', 'Cliente', id, `Cliente excluído: ${client.razaoSocial}`, undefined, undefined, client.companyId);
    this.enqueueSync('client', 'delete', id);
    window.dispatchEvent(new Event('jvm-data-changed'));
  }

  // Equipment
  static getEquipment(companyId?: string): Equipment[] {
    const eqs = getLocal<Equipment[]>(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    let modified = false;
    eqs.forEach(e => {
      if (e.type === 'capacete_classe_b' && (e.dielectricClass as string === 'B' || !e.dielectricClass)) {
        e.dielectricClass = '2';
        modified = true;
      }
    });
    if (modified) {
      setLocal(STORAGE_KEYS.EQUIPMENT, eqs);
    }
    const nonDeleted = eqs.filter(e => !e.deletedAt);
    const targetCompId = companyId !== undefined ? companyId : this.getActiveCompany().id;
    if (targetCompId === 'ALL') {
      return nonDeleted;
    }
    return nonDeleted.filter(e => (e.companyId || 'comp-jvm') === targetCompId);
  }

  static getEquipmentById(id: string): Equipment | undefined {
    const all = getLocal<Equipment[]>(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT).filter(e => !e.deletedAt);
    return all.find(e => e.id === id || e.uuid === id || e.qrCode === id || e.tag === id);
  }

  static saveEquipment(equipment: Equipment): Equipment {
    const all = getLocal<Equipment[]>(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    const existingIdx = all.findIndex(e => e.id === equipment.id);
    const isNew = existingIdx < 0;
    const activeComp = this.getActiveCompany();
    const targetCompId = equipment.companyId || activeComp.id;

    const deviceId = getDeviceId();
    const updatedEq: Equipment = {
      ...equipment,
      companyId: targetCompId,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
      syncVersion: (equipment.syncVersion || 0) + 1,
      deviceId
    };

    if (isNew) {
      updatedEq.createdAt = new Date().toISOString();
      all.unshift(updatedEq);
      this.addAuditLog('CADASTRO', 'Equipamento', equipment.id, `Novo equipamento cadastrado: Tag ${equipment.tag} (${equipment.type})`, undefined, undefined, targetCompId);
    } else {
      all[existingIdx] = updatedEq;
      this.addAuditLog('ALTERACAO', 'Equipamento', equipment.id, `Equipamento atualizado: Tag ${equipment.tag}`, undefined, undefined, targetCompId);
    }

    setLocal(STORAGE_KEYS.EQUIPMENT, all);

    this.enqueueSync('equipment', isNew ? 'create' : 'update', equipment.id, updatedEq);
    window.dispatchEvent(new Event('jvm-data-changed'));
    return updatedEq;
  }

  static deleteEquipment(id: string): void {
    const all = getLocal<Equipment[]>(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    const eq = all.find(e => e.id === id);
    if (eq) {
      eq.deletedAt = new Date().toISOString();
      eq.updatedAt = eq.deletedAt;
      eq.syncStatus = 'pending';
      setLocal(STORAGE_KEYS.EQUIPMENT, all);
      this.addAuditLog('EXCLUSAO', 'Equipamento', id, `Equipamento excluído/descartado: Tag ${eq.tag}`);
      this.enqueueSync('equipment', 'delete', id, eq);
      window.dispatchEvent(new Event('jvm-data-changed'));
    }
  }

  static deleteMultipleEquipment(ids: string[]): number {
    if (!ids || ids.length === 0) return 0;
    const all = getLocal<Equipment[]>(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    const idSet = new Set(ids);
    let deletedCount = 0;
    const deletedTags: string[] = [];

    all.forEach(eq => {
      if (idSet.has(eq.id) && !eq.deletedAt) {
        eq.deletedAt = new Date().toISOString();
        eq.updatedAt = eq.deletedAt;
        eq.syncStatus = 'pending';
        deletedCount++;
        deletedTags.push(eq.tag);
        this.enqueueSync('equipment', 'delete', eq.id, eq);
      }
    });

    if (deletedCount > 0) {
      setLocal(STORAGE_KEYS.EQUIPMENT, all);
      this.addAuditLog(
        'EXCLUSAO', 
        'Equipamento', 
        ids.join(', '), 
        `Exclusão em lote de ${deletedCount} equipamento(s): ${deletedTags.slice(0, 10).join(', ')}${deletedTags.length > 10 ? ` e mais ${deletedTags.length - 10}...` : ''}`
      );
      window.dispatchEvent(new Event('jvm-data-changed'));
    }

    return deletedCount;
  }

  // Service Orders
  static getServiceOrders(companyId?: string): ServiceOrder[] {
    const all = getLocal<ServiceOrder[]>(STORAGE_KEYS.SERVICE_ORDERS, INITIAL_SERVICE_ORDERS).filter(o => !o.deletedAt);
    const targetCompId = companyId !== undefined ? companyId : this.getActiveCompany().id;
    if (targetCompId === 'ALL') {
      return all;
    }
    return all.filter(o => (o.companyId || 'comp-jvm') === targetCompId);
  }

  static getWorkOrders(companyId?: string): ServiceOrder[] {
    return this.getServiceOrders(companyId);
  }

  static generateNextOSNumber(): string {
    // Busca todas as ordens de serviço de todas as empresas para garantir unicidade absoluta
    const allOrders = this.getServiceOrders('ALL');
    const now = new Date();
    const shortYear = String(now.getFullYear()).slice(-2); // Ex: '26'
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${shortYear}${currentMonth}`; // Ex: '2608'
    const fullYearMonth = `${currentYear}${currentMonth}`; // Ex: '202608'

    const currentOrders = allOrders
      .filter(o => o.osNumber && (o.osNumber.includes(yearMonth) || o.osNumber.includes(fullYearMonth) || o.osNumber.startsWith('OS-')))
      .map(o => {
        const matchYM = o.osNumber.match(new RegExp(`(?:${yearMonth}|${fullYearMonth})[-_]?(\\d+)`));
        if (matchYM && matchYM[1]) {
          return parseInt(matchYM[1], 10) || 0;
        }
        const matchEnd = o.osNumber.match(/(\d{1,6})$/);
        return matchEnd ? parseInt(matchEnd[1], 10) || 0 : 0;
      });
    let maxNum = currentOrders.length > 0 ? Math.max(...currentOrders) : 0;
    
    // Gera o próximo número e garante que não colide com nenhuma OS existente
    let candidate = `OS-${yearMonth}-${String(maxNum + 1).padStart(4, '0')}`;
    while (allOrders.some(o => o.osNumber === candidate)) {
      maxNum++;
      candidate = `OS-${yearMonth}-${String(maxNum + 1).padStart(4, '0')}`;
    }
    return candidate;
  }

  static saveServiceOrder(os: ServiceOrder): ServiceOrder {
    const all = getLocal<ServiceOrder[]>(STORAGE_KEYS.SERVICE_ORDERS, INITIAL_SERVICE_ORDERS);
    const existingIdx = all.findIndex(o => o.id === os.id);
    const isNew = existingIdx < 0;
    const activeComp = this.getActiveCompany();

    // Se a OS tiver clientId, busca o cliente para garantir companyId e clientName consistentes
    let resolvedClientName = os.clientName;
    let resolvedCompanyId = os.companyId;
    if (os.clientId) {
      const clientObj = this.getClients('ALL').find(c => c.id === os.clientId);
      if (clientObj) {
        if (!resolvedClientName || resolvedClientName === 'Cliente') {
          resolvedClientName = clientObj.nomeFantasia || clientObj.razaoSocial;
        }
        if (!resolvedCompanyId && (clientObj as any).companyId) {
          resolvedCompanyId = (clientObj as any).companyId;
        }
      }
    }

    const targetCompId = resolvedCompanyId || activeComp.id || 'comp-jvm';

    const updatedOS: ServiceOrder = {
      ...os,
      clientName: resolvedClientName || os.clientName || 'Cliente Geral',
      companyId: targetCompId,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending'
    };

    if (isNew) {
      updatedOS.createdAt = new Date().toISOString();
      all.unshift(updatedOS);
      this.addAuditLog('CADASTRO', 'OrdemDeServico', os.id, `Nova OS aberta: ${os.osNumber} para ${updatedOS.clientName}`, undefined, undefined, targetCompId);
    } else {
      all[existingIdx] = updatedOS;
      this.addAuditLog('ALTERACAO', 'OrdemDeServico', os.id, `OS atualizada: ${os.osNumber} (Status: ${os.status})`, undefined, undefined, targetCompId);
    }

    setLocal(STORAGE_KEYS.SERVICE_ORDERS, all);

    this.enqueueSync('service_order', isNew ? 'create' : 'update', os.id, updatedOS);
    window.dispatchEvent(new Event('jvm-data-changed'));
    return updatedOS;
  }

  static deleteServiceOrder(id: string): void {
    const all = getLocal<ServiceOrder[]>(STORAGE_KEYS.SERVICE_ORDERS, INITIAL_SERVICE_ORDERS);
    const os = all.find(o => o.id === id);
    if (os) {
      os.deletedAt = new Date().toISOString();
      os.updatedAt = os.deletedAt;
      os.syncStatus = 'pending';
      setLocal(STORAGE_KEYS.SERVICE_ORDERS, all);
      this.addAuditLog('EXCLUSAO', 'OrdemDeServico', id, `Ordem de Serviço excluída: ${os.osNumber} (${os.clientName || 'Cliente'})`, undefined, undefined, os.companyId);
      this.enqueueSync('service_order', 'delete', id, os);
      window.dispatchEvent(new Event('jvm-data-changed'));
    }
  }

  static deleteMultipleServiceOrders(ids: string[]): void {
    const all = getLocal<ServiceOrder[]>(STORAGE_KEYS.SERVICE_ORDERS, INITIAL_SERVICE_ORDERS);
    const now = new Date().toISOString();
    let deletedCount = 0;

    ids.forEach(id => {
      const os = all.find(o => o.id === id);
      if (os && !os.deletedAt) {
        os.deletedAt = now;
        os.updatedAt = now;
        os.syncStatus = 'pending';
        this.addAuditLog('EXCLUSAO', 'OrdemDeServico', id, `Ordem de Serviço excluída em lote: ${os.osNumber}`, undefined, undefined, os.companyId);
        this.enqueueSync('service_order', 'delete', os.id, os);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      setLocal(STORAGE_KEYS.SERVICE_ORDERS, all);
      window.dispatchEvent(new Event('jvm-data-changed'));
    }
  }

  // Lab Instruments
  static getInstruments(companyId?: string): LabInstrument[] {
    const all = getLocal<LabInstrument[]>(STORAGE_KEYS.INSTRUMENTS, INITIAL_INSTRUMENTS).filter(i => !i.deletedAt);
    const targetCompId = companyId !== undefined ? companyId : this.getActiveCompany().id;
    if (targetCompId === 'ALL') {
      return all;
    }
    return all.filter(i => (i.companyId || 'comp-jvm') === targetCompId);
  }

  static saveInstrument(inst: LabInstrument): LabInstrument {
    const instruments = getLocal<LabInstrument[]>(STORAGE_KEYS.INSTRUMENTS, INITIAL_INSTRUMENTS);
    const existingIdx = instruments.findIndex(i => i.id === inst.id);
    const activeComp = this.getActiveCompany();
    const targetCompId = inst.companyId || activeComp.id;

    const updatedInst: LabInstrument = {
      ...inst,
      companyId: targetCompId,
      createdAt: inst.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending'
    };

    if (existingIdx < 0) {
      instruments.unshift(updatedInst);
      this.addAuditLog('CADASTRO', 'InstrumentoEnsaio', inst.id, `Instrumento cadastrado: ${inst.type} - ${inst.model} (Calibração ${inst.calibrationCertNumber})`, undefined, undefined, targetCompId);
    } else {
      instruments[existingIdx] = updatedInst;
      this.addAuditLog('ALTERACAO', 'InstrumentoEnsaio', inst.id, `Instrumento atualizado: ${inst.type} - ${inst.model}`, undefined, undefined, targetCompId);
    }
    setLocal(STORAGE_KEYS.INSTRUMENTS, instruments);
    this.enqueueSync('instrument', existingIdx < 0 ? 'create' : 'update', inst.id);
    window.dispatchEvent(new Event('jvm-data-changed'));
    return updatedInst;
  }

  static deleteInstrument(id: string): void {
    const instruments = getLocal<LabInstrument[]>(STORAGE_KEYS.INSTRUMENTS, INITIAL_INSTRUMENTS);
    const inst = instruments.find(i => i.id === id);
    if (!inst) return;
    inst.deletedAt = new Date().toISOString();
    inst.updatedAt = inst.deletedAt;
    inst.syncStatus = 'pending';
    setLocal(STORAGE_KEYS.INSTRUMENTS, instruments);
    this.addAuditLog('EXCLUSAO', 'InstrumentoEnsaio', id, `Instrumento removido: ${inst.type} - ${inst.model}`, undefined, undefined, inst.companyId);
    this.enqueueSync('instrument', 'delete', id);
    window.dispatchEvent(new Event('jvm-data-changed'));
  }

  // Norms and Criteria
  /** Corrige registros de norma incompletos (vindos de versões antigas ou da nuvem). */
  private static sanitizeNorm(raw: any): NormCriterion | null {
    if (!raw || typeof raw !== 'object' || !raw.id) return null;
    const seed = INITIAL_NORMS.find(s => s.id === raw.id);
    const n: any = { ...(seed || {}), ...raw };
    const str = (v: any, fb: string) => (typeof v === 'string' ? v : (v === null || v === undefined ? fb : String(v)));
    const num = (v: any, fb: number) => {
      const x = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
      return isNaN(x) ? fb : x;
    };
    n.normCode = str(n.normCode, 'Norma');
    n.normName = str(n.normName, n.normCode);
    n.dielectricClass = str(n.dielectricClass, '0');
    n.voltageType = str(n.voltageType, 'AC');
    n.currentUnit = str(n.currentUnit, 'mA');
    n.testVoltage_kV = num(n.testVoltage_kV, 0);
    n.testDurationSeconds = num(n.testDurationSeconds, 60);
    n.maxLeakageCurrent = num(n.maxLeakageCurrent, 0);
    n.applicableEquipmentTypes = Array.isArray(n.applicableEquipmentTypes)
      ? n.applicableEquipmentTypes.filter((t: any) => typeof t === 'string')
      : [];
    if (n.gloveLengthLimits && typeof n.gloveLengthLimits !== 'object') delete n.gloveLengthLimits;
    return n as NormCriterion;
  }

  static getNorms(): NormCriterion[] {
    const stored = getLocal<any[]>(STORAGE_KEYS.NORMS, INITIAL_NORMS);
    const norms: NormCriterion[] = (Array.isArray(stored) ? stored : INITIAL_NORMS)
      .map(n => this.sanitizeNorm(n))
      .filter((n): n is NormCriterion => !!n);
    // Ensure all standard seed criteria (such as ASTM D178-22 and ASTM D1048) are always included
    const existingIds = new Set(norms.map(n => n.id));
    let missingAdded = false;
    INITIAL_NORMS.forEach(seed => {
      if (!existingIds.has(seed.id)) {
        norms.push(seed);
        existingIds.add(seed.id);
        missingAdded = true;
      }
    });
    // Ensure capacete norm uses dielectric class 2
    norms.forEach(n => {
      if (n.applicableEquipmentTypes?.includes('capacete_classe_b') && (n.dielectricClass as string === 'B' || !n.dielectricClass)) {
        n.dielectricClass = '2';
        n.normName = 'Capacete de Segurança Classe B (Classe 2 - Até 20.000V)';
        missingAdded = true;
      }
    });
    if (missingAdded) {
      setLocal(STORAGE_KEYS.NORMS, norms);
    }
    return norms.filter(n => !n.deletedAt);
  }

  static saveNorm(norm: NormCriterion): NormCriterion {
    const allNorms = getLocal<NormCriterion[]>(STORAGE_KEYS.NORMS, INITIAL_NORMS);
    const existingIdx = allNorms.findIndex(n => n.id === norm.id);
    const currentUser = this.getCurrentUser();
    (norm as any).updatedAt = new Date().toISOString();

    if (existingIdx < 0) {
      allNorms.unshift(norm);
      this.addAuditLog('ALTERACAO_CRITERIOS', 'NormaCritério', norm.id, `Nova norma/critério cadastrado: ${norm.normCode} - Classe ${norm.dielectricClass}`);
    } else {
      const existing = allNorms[existingIdx];
      const history = existing.history || [];
      history.unshift({
        date: new Date().toISOString().split('T')[0],
        user: currentUser.name,
        changeDescription: `Parâmetros atualizados (Tensão ${norm.testVoltage_kV}kV, Limite ${norm.maxLeakageCurrent}${norm.currentUnit})`
      });
      norm.history = history;
      allNorms[existingIdx] = norm;
      this.addAuditLog('ALTERACAO_CRITERIOS', 'NormaCritério', norm.id, `Critério técnico modificado: ${norm.normCode} - Classe ${norm.dielectricClass}`);
    }

    setLocal(STORAGE_KEYS.NORMS, allNorms);
    this.enqueueSync('norm', existingIdx < 0 ? 'create' : 'update', norm.id, norm);
    window.dispatchEvent(new Event('jvm-data-changed'));
    return norm;
  }

  static deleteNorm(id: string): void {
    const allNorms = getLocal<NormCriterion[]>(STORAGE_KEYS.NORMS, INITIAL_NORMS);
    const norm = allNorms.find(n => n.id === id);
    if (norm) {
      norm.deletedAt = new Date().toISOString();
      (norm as any).updatedAt = norm.deletedAt;
      setLocal(STORAGE_KEYS.NORMS, allNorms);
      this.addAuditLog('EXCLUSAO', 'NormaCritério', id, `Parâmetro normativo excluído: ${norm.normCode} - ${norm.normName} (Classe ${norm.dielectricClass})`);
      this.enqueueSync('norm', 'delete', id);
      window.dispatchEvent(new Event('jvm-data-changed'));
    }
  }

  // Tests & Reports & Certificates
  static getTests(companyId?: string): TestRecord[] {
    const all = getLocal<TestRecord[]>(STORAGE_KEYS.TESTS, INITIAL_TEST_RECORDS).filter(t => !t.deletedAt);
    const targetCompId = companyId !== undefined ? companyId : this.getActiveCompany().id;
    if (targetCompId === 'ALL') {
      return all;
    }
    return all.filter(t => (t.companyId || 'comp-jvm') === targetCompId);
  }

  static getTestById(id: string): TestRecord | undefined {
    const all = getLocal<TestRecord[]>(STORAGE_KEYS.TESTS, INITIAL_TEST_RECORDS).filter(t => !t.deletedAt);
    return all.find(t => t.id === id || t.uuid === id || t.testNumber === id || t.reportNumber === id || t.certificateNumber === id || t.validationCode === id);
  }

  static deleteTestRecord(id: string): void {
    const all = getLocal<TestRecord[]>(STORAGE_KEYS.TESTS, INITIAL_TEST_RECORDS);
    const test = all.find(t => t.id === id || t.uuid === id);
    if (test) {
      test.deletedAt = new Date().toISOString();
      test.updatedAt = test.deletedAt;
      test.syncStatus = 'pending';
      setLocal(STORAGE_KEYS.TESTS, all);
      this.addAuditLog('EXCLUSAO', 'EnsaioDielétrico', test.id, `Ensaio excluído: ${test.testNumber || test.reportNumber || test.id} (Tag: ${test.equipmentTag} - ${test.clientName})`, undefined, undefined, test.companyId);
      this.enqueueSync('test', 'delete', test.id, test);
      window.dispatchEvent(new Event('jvm-data-changed'));
    }
  }

  static deleteTest(id: string): void {
    this.deleteTestRecord(id);
  }

  static deleteMultipleTests(ids: string[]): void {
    if (!ids || ids.length === 0) return;
    const all = getLocal<TestRecord[]>(STORAGE_KEYS.TESTS, INITIAL_TEST_RECORDS);
    const now = new Date().toISOString();
    let deletedCount = 0;
    
    ids.forEach(id => {
      const test = all.find(t => t.id === id || t.uuid === id);
      if (test) {
        test.deletedAt = now;
        test.updatedAt = now;
        test.syncStatus = 'pending';
        this.addAuditLog('EXCLUSAO', 'EnsaioDielétrico', test.id, `Ensaio excluído em lote: ${test.testNumber || test.reportNumber || test.id}`, undefined, undefined, test.companyId);
        this.enqueueSync('test', 'delete', test.id, test);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      setLocal(STORAGE_KEYS.TESTS, all);
      window.dispatchEvent(new Event('jvm-data-changed'));
    }
  }

  static generateNextTestNumber(): string {
    const tests = this.getTests();
    const now = new Date();
    const shortYear = String(now.getFullYear()).slice(-2); // Ex: '26'
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${shortYear}${currentMonth}`; // Ex: '2608'
    const fullYearMonth = `${currentYear}${currentMonth}`; // Ex: '202608'

    const seqs = tests
      .filter(t => t.testNumber && (t.testNumber.includes(yearMonth) || t.testNumber.includes(fullYearMonth) || t.testNumber.startsWith('ENS-')))
      .map(t => {
        const matchYM = t.testNumber.match(new RegExp(`(?:${yearMonth}|${fullYearMonth})[-_]?(\\d+)`));
        if (matchYM && matchYM[1]) {
          return parseInt(matchYM[1], 10) || 0;
        }
        const matchEnd = t.testNumber.match(/(\d{1,6})$/);
        return matchEnd ? parseInt(matchEnd[1], 10) || 0 : 0;
      });
    const nextNum = (seqs.length > 0 ? Math.max(...seqs) : 0) + 1;
    return `ENS-${yearMonth}-${String(nextNum).padStart(4, '0')}`;
  }

  static generateNextReportNumber(): string {
    const tests = this.getTests();
    const company = this.getCompanyInfo();
    const now = new Date();
    const shortYear = String(now.getFullYear()).slice(-2); // Ex: '26'
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${shortYear}${currentMonth}`; // Ex: '2608'
    const fullYearMonth = `${currentYear}${currentMonth}`; // Ex: '202608'

    let rawPrefix = company?.certificateEmissionSettings?.reportPrefix?.trim() || 'LAU-';
    const prefix = rawPrefix.endsWith('-') ? rawPrefix : `${rawPrefix}-`;

    const seqs = tests
      .filter(t => t.reportNumber && (t.reportNumber.includes(yearMonth) || t.reportNumber.includes(fullYearMonth) || t.reportNumber.startsWith(prefix) || t.reportNumber.startsWith('LAU-')))
      .map(t => {
        const matchYM = t.reportNumber.match(new RegExp(`(?:${yearMonth}|${fullYearMonth})[-_]?(\\d+)`));
        if (matchYM && matchYM[1]) {
          return parseInt(matchYM[1], 10) || 0;
        }
        const matchEnd = t.reportNumber.match(/(\d{1,6})$/);
        return matchEnd ? parseInt(matchEnd[1], 10) || 0 : 0;
      });
    const nextNum = (seqs.length > 0 ? Math.max(...seqs) : 0) + 1;
    return `${prefix}${yearMonth}-${String(nextNum).padStart(4, '0')}`;
  }

  static generateNextCertificateNumber(): string {
    const tests = this.getTests();
    const company = this.getCompanyInfo();
    const now = new Date();
    const shortYear = String(now.getFullYear()).slice(-2); // Ex: '26'
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${shortYear}${currentMonth}`; // Ex: '2608'
    const fullYearMonth = `${currentYear}${currentMonth}`; // Ex: '202608'

    let rawPrefix = company?.certificateEmissionSettings?.certificatePrefix?.trim() || 'CERT-';
    const prefix = rawPrefix.endsWith('-') ? rawPrefix : `${rawPrefix}-`;

    const seqs = tests
      .filter(t => t.certificateNumber && (t.certificateNumber.includes(yearMonth) || t.certificateNumber.includes(fullYearMonth) || t.certificateNumber.startsWith(prefix) || t.certificateNumber.startsWith('CERT-')))
      .map(t => {
        const matchYM = t.certificateNumber!.match(new RegExp(`(?:${yearMonth}|${fullYearMonth})[-_]?(\\d+)`));
        if (matchYM && matchYM[1]) {
          return parseInt(matchYM[1], 10) || 0;
        }
        const matchEnd = t.certificateNumber!.match(/(\d{1,6})$/);
        return matchEnd ? parseInt(matchEnd[1], 10) || 0 : 0;
      });
    const nextNum = (seqs.length > 0 ? Math.max(...seqs) : 0) + 1;
    return `${prefix}${yearMonth}-${String(nextNum).padStart(4, '0')}`;
  }

  static generateValidationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const now = new Date();
    const shortYear = String(now.getFullYear()).slice(-2); // Ex: '26'
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    let code = `VAL-JVM-${shortYear}${currentMonth}-`;
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  static saveTestRecord(test: TestRecord): TestRecord {
    const tests = getLocal<TestRecord[]>(STORAGE_KEYS.TESTS, INITIAL_TEST_RECORDS);
    const existingIdx = tests.findIndex(t => t.id === test.id);
    const isNew = existingIdx < 0;
    const activeComp = this.getActiveCompany();
    const targetCompId = test.companyId || activeComp.id;
    const targetCompName = test.companyName || activeComp.name;

    const deviceId = getDeviceId();
    const updatedTest: TestRecord = {
      ...test,
      companyId: targetCompId,
      companyName: targetCompName,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
      syncVersion: (test.syncVersion || 0) + 1,
      deviceId
    };

    if (isNew) {
      updatedTest.createdAt = new Date().toISOString();
      tests.unshift(updatedTest);
      
      this.addAuditLog(
        test.result === 'APROVADO' ? 'APROVACAO' : 'REPROVACAO',
        'EnsaioDielétrico',
        test.id,
        `Ensaio ${test.testNumber} concluído (${test.result}). Equipamento: Tag ${test.equipmentTag}. Laudo: ${test.reportNumber}`,
        undefined,
        undefined,
        targetCompId
      );

      if (test.result === 'APROVADO' && test.certificateNumber) {
        this.addAuditLog(
          'EMISSAO_CERTIFICADO',
          'CertificadoConformidade',
          test.id,
          `Certificado ${test.certificateNumber} emitido com validade até ${test.retestDueDate}. Código: ${test.validationCode}`,
          undefined,
          undefined,
          targetCompId
        );
      }

      // Update or create Equipment in inventory and link to Customer & Service Order (OS)
      let eq = this.getEquipmentById(test.equipmentId);
      if (!eq && test.equipmentTag) {
        eq = this.getEquipment().find(e => e.tag === test.equipmentTag && (!test.clientId || e.clientId === test.clientId));
      }

      const allOS = this.getServiceOrders();
      const matchingOS = (test.serviceOrderId && test.serviceOrderId !== 'os-geral')
        ? allOS.find(o => o.id === test.serviceOrderId || o.osNumber === test.serviceOrderNumber)
        : (test.serviceOrderNumber && test.serviceOrderNumber !== 'OS-AVULSA')
        ? allOS.find(o => o.osNumber === test.serviceOrderNumber)
        : undefined;

      if (eq) {
        eq.lastTestDate = test.testDate;
        eq.nextTestDueDate = test.retestDueDate;
        eq.status = test.result === 'APROVADO' ? 'em_uso' : 'reprovado';
        if (test.clientId) eq.clientId = test.clientId;
        if (test.clientName) eq.clientName = test.clientName;
        if (matchingOS) {
          eq.serviceOrderId = matchingOS.id;
          eq.serviceOrderNumber = matchingOS.osNumber;
        }
        if (test.collaboratorName) eq.collaboratorName = test.collaboratorName;
        if (test.collaboratorRegistration) eq.collaboratorRegistration = test.collaboratorRegistration;
        if (test.collaboratorSector) eq.collaboratorSector = test.collaboratorSector;
        this.saveEquipment(eq);
      } else if (test.equipmentTag) {
        const newEq: Equipment = {
          id: test.equipmentId || ('eq-' + Date.now()),
          uuid: test.uuid || ('uuid-' + Math.random().toString(36).substring(2, 9)),
          companyId: targetCompId,
          type: test.equipmentType,
          tag: test.equipmentTag,
          qrCode: test.equipmentTag,
          manufacturer: 'Fabricante Homologado',
          model: 'Modelo Padrão',
          serialNumber: test.equipmentSerial || 'S/N',
          caNumber: test.equipmentCa,
          dielectricClass: test.equipmentClass || test.appliedClass || '2',
          clientId: test.clientId,
          clientName: test.clientName,
          serviceOrderId: matchingOS?.id,
          serviceOrderNumber: matchingOS?.osNumber,
          collaboratorName: test.collaboratorName,
          collaboratorRegistration: test.collaboratorRegistration,
          collaboratorSector: test.collaboratorSector,
          lastTestDate: test.testDate,
          nextTestDueDate: test.retestDueDate,
          retestIntervalMonths: 6,
          status: test.result === 'APROVADO' ? 'em_uso' : 'reprovado',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.saveEquipment(newEq);
        eq = newEq;
      }

      // Link equipment to the respective Service Order (OS)
      if (matchingOS && eq) {
        const currentEqIds = matchingOS.equipmentIds || [];
        if (!currentEqIds.includes(eq.id)) {
          const updatedOS: ServiceOrder = {
            ...matchingOS,
            equipmentIds: [...currentEqIds, eq.id],
            status: (matchingOS.status === 'aberta' || matchingOS.status === 'agendada') ? 'em_execucao' : matchingOS.status,
            updatedAt: new Date().toISOString()
          };
          this.saveServiceOrder(updatedOS);
        }
      }
    } else {
      tests[existingIdx] = updatedTest;
      this.addAuditLog('ALTERACAO', 'EnsaioDielétrico', test.id, `Ensaio ${test.testNumber} atualizado`, undefined, undefined, targetCompId);

      // Ensure equipment and OS link are maintained on test edit
      const eq = this.getEquipmentById(test.equipmentId);
      const allOS = this.getServiceOrders();
      const matchingOS = (test.serviceOrderId && test.serviceOrderId !== 'os-geral')
        ? allOS.find(o => o.id === test.serviceOrderId || o.osNumber === test.serviceOrderNumber)
        : (test.serviceOrderNumber && test.serviceOrderNumber !== 'OS-AVULSA')
        ? allOS.find(o => o.osNumber === test.serviceOrderNumber)
        : undefined;

      if (eq) {
        eq.lastTestDate = test.testDate;
        eq.nextTestDueDate = test.retestDueDate;
        eq.status = test.result === 'APROVADO' ? 'em_uso' : 'reprovado';
        if (matchingOS) {
          eq.serviceOrderId = matchingOS.id;
          eq.serviceOrderNumber = matchingOS.osNumber;
        }
        this.saveEquipment(eq);
      }

      if (matchingOS && test.equipmentId) {
        const currentEqIds = matchingOS.equipmentIds || [];
        if (!currentEqIds.includes(test.equipmentId)) {
          const updatedOS: ServiceOrder = {
            ...matchingOS,
            equipmentIds: [...currentEqIds, test.equipmentId],
            updatedAt: new Date().toISOString()
          };
          this.saveServiceOrder(updatedOS);
        }
      }
    }

    // Save locally to LocalStorage & IndexedDB
    setLocal(STORAGE_KEYS.TESTS, tests);

    this.enqueueSync('test', isNew ? 'create' : 'update', test.id, updatedTest);
    window.dispatchEvent(new Event('jvm-data-changed'));
    return updatedTest;
  }

  // Consolidated Technical Reports (Relatórios Técnicos / Dossiês)
  static getConsolidatedReports(companyId?: string): ConsolidatedReport[] {
    const all = getLocal<ConsolidatedReport[]>(STORAGE_KEYS.REPORTS, []).filter(r => !r.deletedAt);
    const targetCompId = companyId !== undefined ? companyId : this.getActiveCompany().id;
    if (targetCompId === 'ALL') {
      return all;
    }
    return all.filter(r => (r.companyId || 'comp-jvm') === targetCompId);
  }

  static getConsolidatedReportById(id: string): ConsolidatedReport | undefined {
    return this.getConsolidatedReports().find(r => r.id === id || r.reportCode === id);
  }

  static generateNextReportCode(): string {
    const now = new Date();
    const shortYear = String(now.getFullYear()).slice(-2); // Ex: '26'
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${shortYear}${currentMonth}`; // Ex: '2608'
    const fullYearMonth = `${currentYear}${currentMonth}`; // Ex: '202608'

    const reports = this.getConsolidatedReports();
    const seqs = reports
      .filter(r => r.reportCode && (r.reportCode.includes(yearMonth) || r.reportCode.includes(fullYearMonth) || r.reportCode.startsWith('REL-TEC-')))
      .map(r => {
        const matchYM = r.reportCode.match(new RegExp(`(?:${yearMonth}|${fullYearMonth})[-_]?(\\d+)`));
        if (matchYM && matchYM[1]) {
          return parseInt(matchYM[1], 10) || 0;
        }
        const matchEnd = r.reportCode.match(/(\d{1,6})$/);
        return matchEnd ? parseInt(matchEnd[1], 10) || 0 : 0;
      });
    const nextNum = (seqs.length > 0 ? Math.max(...seqs) : 0) + 1;
    return `REL-TEC-${yearMonth}-${String(nextNum).padStart(4, '0')}`;
  }

  static saveConsolidatedReport(report: ConsolidatedReport): ConsolidatedReport {
    const reports = getLocal<ConsolidatedReport[]>(STORAGE_KEYS.REPORTS, []);
    const existingIdx = reports.findIndex(r => r.id === report.id);
    const isNew = existingIdx < 0;
    const activeComp = this.getActiveCompany();
    const targetCompId = report.companyId || activeComp.id;

    const updatedReport: ConsolidatedReport = {
      ...report,
      companyId: targetCompId,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending'
    };

    if (isNew) {
      reports.unshift(updatedReport);
      this.addAuditLog('CADASTRO', 'RelatórioConsolidado', report.id, `Relatório Técnico ${report.reportCode} gerado para ${report.clientName} com ${report.testIds.length} laudos vinculados`, undefined, undefined, targetCompId);
    } else {
      reports[existingIdx] = updatedReport;
      this.addAuditLog('ALTERACAO', 'RelatórioConsolidado', report.id, `Relatório Técnico ${report.reportCode} atualizado`, undefined, undefined, targetCompId);
    }

    setLocal(STORAGE_KEYS.REPORTS, reports);
    this.enqueueSync('report', isNew ? 'create' : 'update', updatedReport.id);
    window.dispatchEvent(new Event('jvm-data-changed'));
    return updatedReport;
  }

  static deleteConsolidatedReport(id: string): void {
    const reports = getLocal<ConsolidatedReport[]>(STORAGE_KEYS.REPORTS, []);
    const target = reports.find(r => r.id === id || r.reportCode === id);
    if (target) {
      target.deletedAt = new Date().toISOString();
      target.updatedAt = target.deletedAt;
      target.syncStatus = 'pending';
      setLocal(STORAGE_KEYS.REPORTS, reports);
      this.enqueueSync('report', 'delete', target.id);
      this.addAuditLog('EXCLUSAO', 'RelatórioConsolidado', target.id, `Relatório Técnico ${target.reportCode} excluído`, undefined, undefined, target.companyId);
      window.dispatchEvent(new Event('jvm-data-changed'));
    }
  }

  // Audit Logs
  static getAuditLogs(companyId?: string): AuditLog[] {
    const all = getLocal<AuditLog[]>(STORAGE_KEYS.AUDIT, INITIAL_AUDIT_LOGS);
    const targetCompId = companyId !== undefined ? companyId : this.getActiveCompany().id;
    if (targetCompId === 'ALL') {
      return all;
    }
    return all.filter(l => (l.companyId || 'comp-jvm') === targetCompId);
  }

  static addAuditLog(
    action: AuditLog['action'], 
    entityType: string, 
    entityId: string, 
    description: string,
    previousValue?: string,
    newValue?: string,
    companyId?: string
  ): void {
    const logs = getLocal<AuditLog[]>(STORAGE_KEYS.AUDIT, INITIAL_AUDIT_LOGS);
    const currentUser = this.getCurrentUser();
    const activeComp = this.getActiveCompany();
    const targetCompId = companyId || currentUser?.companyId || activeComp.id;

    const newLog: AuditLog = {
      id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      companyId: targetCompId,
      action,
      userName: currentUser ? currentUser.name : 'Sistema',
      userRole: currentUser ? currentUser.role : 'admin',
      dateTime: new Date().toISOString(),
      ipAddress: '127.0.0.1 (Local/PWA)',
      device: getDeviceId(),
      entityType,
      entityId,
      description,
      previousValue: previousValue || '',
      newValue: newValue || ''
    };
    logs.unshift(newLog);
    if (logs.length > 300) logs.length = 300;
    setLocal(STORAGE_KEYS.AUDIT, logs);
    this.enqueueSync('audit', 'create', newLog.id, newLog);
  }

  // ===========================================================================
  // FILA DE SINCRONIZAÇÃO (OUTBOX) -> SUPABASE
  // ===========================================================================
  static getSyncQueue(): SyncQueueItem[] {
    return getLocal<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
  }

  /**
   * Coloca um registro na fila de envio ao Supabase e agenda o envio.
   * O parâmetro `data` é mantido por compatibilidade, mas não é armazenado:
   * no envio o registro é lido do cache local na versão mais recente.
   */
  static enqueueSync(
    entityType: SyncQueueItem['entityType'],
    action: SyncQueueItem['action'],
    entityId: string,
    _data?: any
  ): void {
    this.enqueueMany([{ entityType, action, entityId }]);
  }

  /** Enfileira vários registros com uma única gravação da fila. */
  static enqueueMany(items: Array<{ entityType: SyncEntityType; action: SyncQueueItem['action']; entityId: string }>): void {
    if (!items || items.length === 0) return;
    const queue = this.getSyncQueue();
    const indexByKey = new Map<string, number>();
    queue.forEach((q, idx) => indexByKey.set(`${q.entityType}:${q.entityId}`, idx));
    const deviceId = getDeviceId();
    const now = new Date().toISOString();

    items.forEach(({ entityType, action, entityId }) => {
      if (!entityId) return;
      const key = `${entityType}:${entityId}`;
      const newItem: SyncQueueItem = {
        id: 'sq-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        entityType,
        action,
        entityId,
        timestamp: now,
        deviceId,
        retryCount: 0
      };
      const existingIdx = indexByKey.get(key);
      if (existingIdx !== undefined) {
        const prev = queue[existingIdx];
        // Um "create" ainda não enviado continua sendo create; exclusão prevalece
        newItem.action = action === 'delete' ? 'delete' : (prev.action === 'create' ? 'create' : action);
        queue[existingIdx] = newItem;
      } else {
        indexByKey.set(key, queue.length);
        queue.push(newItem);
      }
    });

    setLocal(STORAGE_KEYS.SYNC_QUEUE, queue);
    scheduleCloudSync();
  }

  static clearSyncQueueItem(id: string): void {
    const queue = this.getSyncQueue().filter(q => q.id !== id);
    setLocal(STORAGE_KEYS.SYNC_QUEUE, queue);
  }

  static clearSyncQueue(): void {
    setLocal(STORAGE_KEYS.SYNC_QUEUE, []);
    window.dispatchEvent(new Event('jvm-data-changed'));
  }

  /** Itens prontos para envio (respeita o intervalo de nova tentativa). */
  static getDueSyncQueue(force: boolean = false): SyncQueueItem[] {
    const now = Date.now();
    return this.getSyncQueue().filter(q => force || !q.nextAttemptAt || new Date(q.nextAttemptAt).getTime() <= now);
  }

  /** Lê o registro bruto (inclusive excluídos logicamente) para envio. */
  static getLocalRecordForSync(entityType: SyncEntityType, entityId: string): any | null {
    if (entityType === 'company_info') {
      return this.getCompanyById(entityId) || null;
    }
    const key = ENTITY_STORAGE_KEY[entityType];
    if (!key) return null;
    const list = getLocal<any[]>(key, []);
    return list.find(i => i && i.id === entityId) || null;
  }

  /**
   * Conclui itens enviados com sucesso. Só remove da fila a MESMA versão do
   * item que foi enviada: se o registro foi editado durante o envio, o novo
   * item permanece pendente (antes a edição era marcada como sincronizada
   * sem ter sido enviada).
   */
  static completeSyncItems(sent: SyncQueueItem[]): void {
    if (!sent || sent.length === 0) return;
    const sentIds = new Set(sent.map(i => i.id));
    const queue = this.getSyncQueue().filter(q => !sentIds.has(q.id));
    setLocal(STORAGE_KEYS.SYNC_QUEUE, queue);

    const stillPending = new Set(queue.map(q => `${q.entityType}:${q.entityId}`));
    const byKey = new Map<string, Set<string>>();
    sent.forEach(item => {
      if (item.entityType === 'audit' || item.entityType === 'company_info') return;
      if (stillPending.has(`${item.entityType}:${item.entityId}`)) return;
      const storageKey = ENTITY_STORAGE_KEY[item.entityType];
      if (!storageKey) return;
      if (!byKey.has(storageKey)) byKey.set(storageKey, new Set());
      byKey.get(storageKey)!.add(item.entityId);
    });
    byKey.forEach((ids, storageKey) => {
      const items = getLocal<any[]>(storageKey, []);
      let changed = false;
      items.forEach(i => {
        if (i && ids.has(i.id) && i.syncStatus !== 'synced') {
          i.syncStatus = 'synced';
          changed = true;
        }
      });
      if (changed) setLocal(storageKey, items);
    });
    setLocal(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  }

  /** Registra falha de envio com espera progressiva. O item NUNCA é descartado. */
  static failSyncItems(failed: Array<{ item: SyncQueueItem; error: string }>): void {
    if (!failed || failed.length === 0) return;
    const byId = new Map(failed.map(f => [f.item.id, f.error]));
    const queue = this.getSyncQueue();
    queue.forEach(q => {
      const err = byId.get(q.id);
      if (err === undefined) return;
      q.retryCount = (q.retryCount || 0) + 1;
      q.lastError = err.slice(0, 300);
      const waitMs = Math.min(30 * 60 * 1000, 15000 * Math.pow(2, Math.min(q.retryCount - 1, 7)));
      q.nextAttemptAt = new Date(Date.now() + waitMs).toISOString();
    });
    setLocal(STORAGE_KEYS.SYNC_QUEUE, queue);
  }

  /** Remove da fila itens cujo registro não existe mais localmente. */
  static dropOrphanSyncItems(items: SyncQueueItem[]): void {
    if (!items.length) return;
    const ids = new Set(items.map(i => i.id));
    setLocal(STORAGE_KEYS.SYNC_QUEUE, this.getSyncQueue().filter(q => !ids.has(q.id)));
  }

  /** Atualiza URLs de fotos de um ensaio após envio ao Supabase Storage (sem reenfileirar). */
  static replaceTestMediaUrls(testId: string, urlMap: Record<string, string>): void {
    if (!urlMap || Object.keys(urlMap).length === 0) return;
    const tests = getLocal<TestRecord[]>(STORAGE_KEYS.TESTS, []);
    const t = tests.find(x => x.id === testId);
    if (!t) return;
    const swap = (u?: string) => (u && urlMap[u]) ? urlMap[u] : u;
    if (Array.isArray(t.photos)) {
      t.photos = t.photos.map(ph => ({ ...ph, url: swap(ph.url) || ph.url }));
    }
    if (Array.isArray(t.visualInspection)) {
      t.visualInspection = t.visualInspection.map((v: any) => v && v.photoUrl ? { ...v, photoUrl: swap(v.photoUrl) } : v);
    }
    setLocal(STORAGE_KEYS.TESTS, tests);
  }

  /** Mantido por compatibilidade com telas antigas. */
  static markSynced(entityType: string, entityId: string): void {
    const et = (TABLE_ENTITY[entityType] || entityType) as SyncEntityType;
    const items = this.getSyncQueue().filter(q => q.entityType === et && q.entityId === entityId);
    this.completeSyncItems(items);
  }

  static markAllSynced(entityType: string, entityIds: string[]): void {
    const et = (TABLE_ENTITY[entityType] || entityType) as SyncEntityType;
    const idSet = new Set(entityIds);
    const items = this.getSyncQueue().filter(q => q.entityType === et && idSet.has(q.entityId));
    this.completeSyncItems(items);
  }

  // ---------------------------------------------------------------------------
  // Cursores do pull incremental (updated_at do servidor por tabela)
  // ---------------------------------------------------------------------------
  static getPullCursor(table: string): string | null {
    return getLocal<Record<string, string>>(STORAGE_KEYS.PULL_CURSORS, {})[table] || null;
  }

  static setPullCursor(table: string, cursor: string): void {
    const all = getLocal<Record<string, string>>(STORAGE_KEYS.PULL_CURSORS, {});
    all[table] = cursor;
    setLocal(STORAGE_KEYS.PULL_CURSORS, all);
  }

  static resetPullCursors(): void {
    setLocal(STORAGE_KEYS.PULL_CURSORS, {});
  }

  static isBootstrapDone(): boolean {
    return !!getLocal<string | null>(STORAGE_KEYS.BOOTSTRAP_V61, null);
  }

  static setBootstrapDone(): void {
    setLocal(STORAGE_KEYS.BOOTSTRAP_V61, new Date().toISOString());
  }

  /**
   * Migração única para a sincronização v6.1: enfileira todos os registros
   * locais para que o Supabase receba a cópia completa (payload) e as tabelas
   * que antes só existiam no Firebase (normas, relatórios, dados do laboratório).
   */
  static enqueueAllForBootstrap(): number {
    const items: Array<{ entityType: SyncEntityType; action: SyncQueueItem['action']; entityId: string }> = [];
    /**
     * Registros de DEMONSTRAÇÃO nunca editados não são enviados: um navegador
     * novo (ex.: versão local em localhost) começa com dados fictícios, que
     * não devem ir para o banco real. Seeds editados pelo usuário são enviados.
     */
    const isUntouchedSeed = (r: any, seeds: any[]): boolean => {
      const seed = seeds.find(x => x && x.id === r.id);
      if (!seed) return false;
      if (r.deletedAt) return false;
      if (seed.updatedAt || r.updatedAt) return seed.updatedAt === r.updatedAt;
      const strip = (o: any) => { const { syncStatus, ...rest } = o || {}; return JSON.stringify(rest); };
      return strip(seed) === strip(r);
    };
    const add = (entityType: SyncEntityType, list: any[], seeds: any[] = []) => {
      list.forEach(r => {
        if (!r || !r.id) return;
        if (seeds.length && isUntouchedSeed(r, seeds)) return;
        items.push({ entityType, action: r.deletedAt ? 'delete' : 'update', entityId: r.id });
      });
    };
    add('company', getLocal<any[]>(STORAGE_KEYS.COMPANIES, []), INITIAL_COMPANIES);
    add('user', getLocal<any[]>(STORAGE_KEYS.USERS, []), INITIAL_USERS);
    add('client', getLocal<any[]>(STORAGE_KEYS.CLIENTS, []), INITIAL_CLIENTS);
    add('equipment', getLocal<any[]>(STORAGE_KEYS.EQUIPMENT, []), INITIAL_EQUIPMENT);
    add('service_order', getLocal<any[]>(STORAGE_KEYS.SERVICE_ORDERS, []), INITIAL_SERVICE_ORDERS);
    add('instrument', getLocal<any[]>(STORAGE_KEYS.INSTRUMENTS, []), INITIAL_INSTRUMENTS);
    add('norm', getLocal<any[]>(STORAGE_KEYS.NORMS, [])); // normas técnicas oficiais: sempre enviadas
    add('test', getLocal<any[]>(STORAGE_KEYS.TESTS, []), INITIAL_TEST_RECORDS);
    add('report', getLocal<any[]>(STORAGE_KEYS.REPORTS, []));
    items.push({ entityType: 'company_info', action: 'update', entityId: this.getActiveCompany().id });
    this.enqueueMany(items);
    return items.length;
  }

  /**
   * Aplica no cache local os registros recebidos do Supabase, SEM reenfileirar.
   * Registros com alteração local ainda não enviada são preservados (a versão
   * local será enviada e prevalecerá). Exclusões remotas são aplicadas.
   */
  static saveFromRemote(entityTypeOrTable: string, incomingItems: any[]): number {
    if (!incomingItems || incomingItems.length === 0) return 0;
    const entityType = (TABLE_ENTITY[entityTypeOrTable] || entityTypeOrTable) as SyncEntityType;
    const storageKey = ENTITY_STORAGE_KEY[entityType];
    if (!storageKey || entityType === 'audit') return 0;

    const pendingIds = new Set(
      this.getSyncQueue()
        .filter(q => q.entityType === entityType)
        .map(q => q.entityId)
    );

    const localList = getLocal<any[]>(storageKey, []);
    const indexById = new Map<string, number>();
    localList.forEach((item, idx) => {
      if (item && item.id) indexById.set(item.id, idx);
    });

    let changed = 0;
    incomingItems.forEach(incoming => {
      if (!incoming || !incoming.id) return;
      if (pendingIds.has(incoming.id)) return;
      const idx = indexById.get(incoming.id);
      const existing = idx !== undefined ? localList[idx] : undefined;
      const merged: any = { ...(existing || {}), ...incoming, syncStatus: 'synced' };
      if (!incoming.deletedAt) delete merged.deletedAt;
      if (idx !== undefined) {
        // Ignora registros idênticos (janela de sobreposição do cursor / eco do próprio envio)
        if (JSON.stringify(existing) === JSON.stringify(merged)) return;
        localList[idx] = merged;
      } else {
        if (incoming.deletedAt) return; // não baixa registros já excluídos
        indexById.set(incoming.id, localList.length);
        localList.push(merged);
      }
      changed++;
    });

    if (changed > 0) setLocal(storageKey, localList);
    return changed;
  }

  static getPendingStats(): {
    totalPending: number;
    pendingTests: number;
    pendingEquipment: number;
    pendingServiceOrders: number;
    pendingClients: number;
    pendingPhotos: number;
    lastSyncTime: string;
  } {
    const queue = this.getSyncQueue().filter(q => q.entityType !== 'audit');
    const count = (t: SyncEntityType) => queue.filter(q => q.entityType === t).length;
    const pendingTestIds = new Set(queue.filter(q => q.entityType === 'test').map(q => q.entityId));
    let pendingPhotos = 0;
    getLocal<TestRecord[]>(STORAGE_KEYS.TESTS, []).forEach(t => {
      if (pendingTestIds.has(t.id) && Array.isArray(t.photos)) {
        pendingPhotos += t.photos.filter(p => p.url && p.url.startsWith('data:')).length;
      }
    });
    const lastSync = getLocal<string | null>(STORAGE_KEYS.LAST_SYNC, null);

    return {
      totalPending: queue.length,
      pendingTests: count('test'),
      pendingEquipment: count('equipment'),
      pendingServiceOrders: count('service_order'),
      pendingClients: count('client'),
      pendingPhotos,
      lastSyncTime: lastSync ? new Date(lastSync).toLocaleString('pt-BR') : 'Ainda não sincronizado'
    };
  }

  /** Envia imediatamente a fila ao Supabase. */
  static async flushSyncQueue(): Promise<{
    success: boolean;
    pushedCount: number;
    details?: { tests: number; equipment: number; serviceOrders: number; clients: number; photos: number };
    message?: string;
    error?: string;
  }> {
    const { SupabaseService } = await import('./supabaseService');
    const res = await SupabaseService.flushQueue({ force: true });
    return {
      success: res.errors.length === 0,
      pushedCount: res.pushed,
      details: res.details,
      message: res.pushed > 0
        ? `${res.pushed} registro(s) enviado(s) ao Supabase.`
        : 'Todos os registros já estão atualizados no Supabase.',
      error: res.errors.length > 0 ? res.errors.slice(0, 3).join(' | ') : undefined
    };
  }

  static getConflicts(): SyncConflict[] {
    return getLocal<SyncConflict[]>(STORAGE_KEYS.CONFLICTS, []);
  }

  static saveConflict(conflict: SyncConflict): void {
    const conflicts = this.getConflicts();
    conflicts.unshift(conflict);
    setLocal(STORAGE_KEYS.CONFLICTS, conflicts);
  }

  static resolveConflict(conflictId: string, choice: 'keep_a' | 'keep_b' | 'merge', mergedData?: any): void {
    const conflicts = this.getConflicts();
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    conflict.resolved = true;
    conflict.resolvedAt = new Date().toISOString();
    conflict.resolutionChoice = choice;

    const chosenData = choice === 'keep_a' 
      ? conflict.deviceA.data 
      : choice === 'keep_b' 
      ? conflict.deviceB.data 
      : mergedData;

    if (conflict.entityType === 'equipment') {
      this.saveEquipment(chosenData);
    } else if (conflict.entityType === 'client') {
      this.saveClient(chosenData);
    } else if (conflict.entityType === 'service_order') {
      this.saveServiceOrder(chosenData);
    } else if (conflict.entityType === 'test') {
      this.saveTestRecord(chosenData);
    }

    setLocal(STORAGE_KEYS.CONFLICTS, conflicts);
    this.addAuditLog('SINCRONIZACAO', 'Conflito', conflictId, `Conflito de sincronização resolvido via opção: ${choice}`);
  }

  // ===========================================================================
  // GRAVAÇÃO EM LOTE (restauração de backup)
  // Mescla por ID na lista COMPLETA (antes substituía tudo e apagava os dados
  // das outras empresas) e envia os registros restaurados ao Supabase.
  // ===========================================================================
  private static mergeBulk<T extends { id: string }>(key: string, entityType: SyncEntityType, items: T[]): void {
    if (!items || items.length === 0) return;
    const current = getLocal<any[]>(key, []);
    const indexById = new Map<string, number>();
    current.forEach((c, idx) => c && c.id && indexById.set(c.id, idx));
    items.forEach(item => {
      if (!item || !item.id) return;
      const pending = { ...item, syncStatus: 'pending' };
      const idx = indexById.get(item.id);
      if (idx !== undefined) current[idx] = { ...current[idx], ...pending };
      else {
        indexById.set(item.id, current.length);
        current.push(pending);
      }
    });
    setLocal(key, current);
    if (entityType !== 'audit') {
      this.enqueueMany(items.filter(i => i && i.id).map(i => ({
        entityType,
        action: (i as any).deletedAt ? 'delete' as const : 'update' as const,
        entityId: i.id
      })));
    }
    window.dispatchEvent(new Event('jvm-data-changed'));
  }

  static saveClients(clients: Client[]): void {
    this.mergeBulk(STORAGE_KEYS.CLIENTS, 'client', clients);
  }

  static saveAllEquipment(equipment: Equipment[]): void {
    this.mergeBulk(STORAGE_KEYS.EQUIPMENT, 'equipment', equipment);
  }

  static saveAllServiceOrders(orders: ServiceOrder[]): void {
    this.mergeBulk(STORAGE_KEYS.SERVICE_ORDERS, 'service_order', orders);
  }

  static saveAllInstruments(instruments: LabInstrument[]): void {
    this.mergeBulk(STORAGE_KEYS.INSTRUMENTS, 'instrument', instruments);
  }

  static saveAllNorms(norms: NormCriterion[]): void {
    this.mergeBulk(STORAGE_KEYS.NORMS, 'norm', norms);
  }

  static saveAllTests(tests: TestRecord[]): void {
    this.mergeBulk(STORAGE_KEYS.TESTS, 'test', tests);
  }

  static saveUsers(users: User[]): void {
    // Backups antigos podem conter senhas: nunca são restauradas no aparelho
    this.mergeBulk(STORAGE_KEYS.USERS, 'user', (users || []).map(u => {
      const { password: _pw, ...rest } = u || ({} as User);
      return rest as User;
    }));
  }

  static saveAuditLogs(logs: AuditLog[]): void {
    if (!logs || logs.length === 0) return;
    const current = getLocal<AuditLog[]>(STORAGE_KEYS.AUDIT, []);
    const ids = new Set(current.map(l => l.id));
    const merged = [...logs.filter(l => l && !ids.has(l.id)), ...current]
      .sort((a, b) => (b.dateTime || '').localeCompare(a.dateTime || ''))
      .slice(0, 300);
    setLocal(STORAGE_KEYS.AUDIT, merged);
    window.dispatchEvent(new Event('jvm-data-changed'));
  }

  // Full backup & export
  static exportFullBackupJSON(): string {
    const backup = {
      exportDate: new Date().toISOString(),
      company: this.getCompanyInfo(),
      clients: this.getClients(),
      equipment: this.getEquipment(),
      serviceOrders: this.getServiceOrders(),
      instruments: this.getInstruments(),
      norms: this.getNorms(),
      tests: this.getTests(),
      audit: this.getAuditLogs(),
      users: this.getUsers()
    };
    return JSON.stringify(backup, null, 2);
  }

  static importFullBackupJSON(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (Array.isArray(data.clients)) this.saveClients(data.clients);
      if (Array.isArray(data.equipment)) this.saveAllEquipment(data.equipment);
      if (Array.isArray(data.serviceOrders)) this.saveAllServiceOrders(data.serviceOrders);
      if (Array.isArray(data.instruments)) this.saveAllInstruments(data.instruments);
      if (Array.isArray(data.norms)) this.saveAllNorms(data.norms);
      if (Array.isArray(data.tests)) this.saveAllTests(data.tests);
      if (Array.isArray(data.users)) this.saveUsers(data.users);
      if (Array.isArray(data.audit)) this.saveAuditLogs(data.audit);
      if (data.company && data.company.name) {
        const current = this.getCompanyInfo();
        this.saveCompanyInfo({
          ...data.company,
          // preserva a conexão Supabase deste aparelho
          supabaseUrl: current.supabaseUrl,
          supabaseAnonKey: current.supabaseAnonKey,
          supabaseEnabled: current.supabaseEnabled,
          supabaseAutoSync: current.supabaseAutoSync
        });
      }
      this.addAuditLog('CADASTRO', 'Backup', 'import', 'Restauração completa de backup JSON realizada e enviada ao Supabase.');
      window.dispatchEvent(new Event('jvm-data-changed'));
      return true;
    } catch (err) {
      console.error('Falha ao importar backup JSON:', err);
      return false;
    }
  }

  static importBackupJSON(jsonStr: string): { success: boolean; error?: string } {
    try {
      const ok = this.importFullBackupJSON(jsonStr);
      return { success: ok };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  static resetToSeedData(): void {
    this.resetToDemoData();
  }

  static exportTestsToCSV(): string {
    const tests = this.getTests();
    const headers = [
      'Nº Laudo',
      'Nº Certificado',
      'Data Ensaio',
      'Cliente',
      'Tag Equipamento',
      'Tipo Equipamento',
      'Classe',
      'Tensão (kV)',
      'Tipo Tensão',
      'Fuga Medida (mA)',
      'Limite Máximo (mA)',
      'Resultado',
      'Próximo Reensaio',
      'Código Validação'
    ];

    const rows = tests.map(t => [
      t.reportNumber,
      t.certificateNumber || 'N/A',
      t.testDate,
      `"${(t.clientName || '').replace(/"/g, '""')}"`,
      t.equipmentTag,
      t.equipmentType,
      t.equipmentClass,
      t.appliedVoltage_kV,
      t.voltageType,
      t.measuredLeakageCurrent_mA,
      t.leakageCurrentLimit_mA,
      t.result,
      t.retestDueDate,
      t.validationCode
    ]);

    return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  }

  /**
   * Sincronização completa com o Supabase (banco único da plataforma):
   * envia a fila local e baixa as alterações feitas em outros dispositivos.
   */
  static async syncWithCentralServer(isOnline: boolean = true): Promise<{ 
    success: boolean; 
    pushedCount: number; 
    pulledCount?: number;
    details?: { tests: number; equipment: number; serviceOrders: number; clients: number; photos: number };
    message?: string;
    error?: string;
  }> {
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { 
        success: false, 
        pushedCount: 0, 
        error: 'Dispositivo sem conexão com a internet. Os ensaios permanecem salvos no aparelho e serão enviados ao Supabase automaticamente quando a conexão voltar.' 
      };
    }

    const { SupabaseService } = await import('./supabaseService');
    const res = await SupabaseService.syncNow();
    const pending = this.getSyncQueue().filter(q => q.entityType !== 'audit').length;

    if (res.errors.length > 0 && res.pushed === 0 && res.pulled === 0) {
      return {
        success: false,
        pushedCount: 0,
        pulledCount: 0,
        details: res.details,
        error: `Não foi possível sincronizar com o Supabase: ${res.errors[0]}`
      };
    }

    return {
      success: true,
      pushedCount: res.pushed,
      pulledCount: res.pulled,
      details: res.details,
      message: `Supabase: ${res.pushed} registro(s) enviado(s), ${res.pulled} recebido(s)` +
        (pending > 0 ? `. ${pending} item(ns) aguardando nova tentativa.` : '.')
    };
  }

  /**
   * Restaura a base LOCAL de demonstração. Não envia nada ao Supabase:
   * os cursores são zerados para que a próxima sincronização baixe
   * novamente todos os dados reais da nuvem.
   */
  static resetToDemoData(): void {
    setLocal(STORAGE_KEYS.NORMS, INITIAL_NORMS);
    setLocal(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
    setLocal(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    setLocal(STORAGE_KEYS.SERVICE_ORDERS, INITIAL_SERVICE_ORDERS);
    setLocal(STORAGE_KEYS.INSTRUMENTS, INITIAL_INSTRUMENTS);
    setLocal(STORAGE_KEYS.TESTS, INITIAL_TEST_RECORDS);
    setLocal(STORAGE_KEYS.USERS, INITIAL_USERS);
    setLocal(STORAGE_KEYS.AUDIT, INITIAL_AUDIT_LOGS);
    const current = getLocal<CompanyLabInfo>(STORAGE_KEYS.COMPANY, JVM_COMPANY_INFO);
    setLocal(STORAGE_KEYS.COMPANY, {
      ...JVM_COMPANY_INFO,
      supabaseUrl: current.supabaseUrl,
      supabaseAnonKey: current.supabaseAnonKey,
      supabaseEnabled: current.supabaseEnabled,
      supabaseAutoSync: current.supabaseAutoSync
    });
    setLocal(STORAGE_KEYS.SYNC_QUEUE, []);
    setLocal(STORAGE_KEYS.CONFLICTS, []);
    setLocal(STORAGE_KEYS.PULL_CURSORS, {});

    this.addAuditLog('ALTERACAO', 'BancoDeDados', 'reset', 'Base local restaurada para os padrões oficiais da JVM Engenharia');
    window.dispatchEvent(new Event('jvm-data-changed'));
  }
}

// Auto init on module load
DielectricStorageService.init();
