/** Chaves de armazenamento local do app. */
export const STORAGE_KEYS = {
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
  NUMBER_BLOCKS: 'jvm_dielectric_number_blocks',
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

/**
 * Chaves guardadas no IndexedDB (dados que crescem: ensaios com fotos e
 * assinaturas, EPIs, clientes, fila de envio...). As demais são pequenas e
 * continuam no localStorage (usuário da sessão, id do aparelho, cursores).
 */
export const MANAGED_STORAGE_KEYS: string[] = [
  STORAGE_KEYS.COMPANIES,
  STORAGE_KEYS.CLIENTS,
  STORAGE_KEYS.EQUIPMENT,
  STORAGE_KEYS.SERVICE_ORDERS,
  STORAGE_KEYS.INSTRUMENTS,
  STORAGE_KEYS.NORMS,
  STORAGE_KEYS.TESTS,
  STORAGE_KEYS.USERS,
  STORAGE_KEYS.AUDIT,
  STORAGE_KEYS.CONFLICTS,
  STORAGE_KEYS.SYNC_QUEUE,
  STORAGE_KEYS.REPORTS,
  STORAGE_KEYS.COMPANY
];
