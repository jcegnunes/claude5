/**
 * Configuração Oficial do Supabase para o JVM Dielectric Lab
 * 
 * Contém parâmetros de conexão, endpoints de API e metadados das tabelas.
 */

export interface SupabaseAppletConfig {
  projectId: string;
  projectRef: string;
  appName: string;
  supabaseUrl: string;
  restUrl: string;
  authUrl: string;
  storageUrl: string;
  graphqlUrl: string;
  anonKey: string;
  platform: 'web' | 'mobile' | 'desktop';
  database: {
    engine: string;
    version: string;
    schemas: string[];
    tables: string[];
  };
  features: {
    rowLevelSecurity: boolean;
    realtime: boolean;
    autoSync: boolean;
    offlineFirst: boolean;
    bidirectionalSync: boolean;
  };
}

export const SUPABASE_PROJECT_CONFIG: SupabaseAppletConfig = {
  projectId: 'cdtbzbshylrcprvmjpgc',
  projectRef: 'cdtbzbshylrcprvmjpgc',
  appName: 'JVM Dielectric Lab',
  supabaseUrl: 'https://cdtbzbshylrcprvmjpgc.supabase.co',
  restUrl: 'https://cdtbzbshylrcprvmjpgc.supabase.co/rest/v1',
  authUrl: 'https://cdtbzbshylrcprvmjpgc.supabase.co/auth/v1',
  storageUrl: 'https://cdtbzbshylrcprvmjpgc.supabase.co/storage/v1',
  graphqlUrl: 'https://cdtbzbshylrcprvmjpgc.supabase.co/graphql/v1',
  anonKey: 'sb_publishable_j3sUJcAb-zBEQI_S09u2Cg_X1-WJ-8M',
  platform: 'web',
  database: {
    engine: 'PostgreSQL',
    version: '15',
    schemas: ['public'],
    tables: [
      'companies',
      'users',
      'clients',
      'equipment',
      'service_orders',
      'test_records',
      'lab_instruments',
      'norms',
      'consolidated_reports',
      'audit_logs'
    ]
  },
  features: {
    rowLevelSecurity: true,
    realtime: true,
    autoSync: true,
    offlineFirst: true,
    bidirectionalSync: true
  }
};

export default SUPABASE_PROJECT_CONFIG;
