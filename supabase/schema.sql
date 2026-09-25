-- =========================================================================
-- JVM DIELECTRIC LAB - ESQUEMA SUPABASE (POSTGRESQL) - BANCO ÚNICO DA PLATAFORMA
-- Projeto: cdtbzbshylrcprvmjpgc  |  https://cdtbzbshylrcprvmjpgc.supabase.co
--
-- Este script é IDEMPOTENTE: pode ser executado quantas vezes for necessário
-- no SQL Editor do Supabase. Em bancos já existentes ele apenas aplica as
-- migrações (novas colunas, índices, gatilhos, Realtime e Storage) sem apagar
-- nenhum dado.
--
-- Sincronização v6.1:
--   * payload JSONB  -> cópia fiel do registro (nenhum campo do ensaio se perde)
--   * deleted_at     -> exclusão lógica propagada para todos os dispositivos
--   * updated_at     -> definido SEMPRE pelo servidor (cursor de pull incremental)
--   * Realtime       -> alterações chegam aos outros dispositivos em segundos
--   * Storage        -> fotos dos ensaios no bucket público "jvm-evidencias"
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. companies (Empresas / Laboratórios)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  city TEXT,
  state TEXT,
  cep TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  technical_responsible TEXT,
  active BOOLEAN DEFAULT true,
  lab_info JSONB,
  payload JSONB,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 2. users (Usuários / Técnicos / RTs)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  company_name TEXT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  cargo TEXT,
  registration_number TEXT,
  crea_or_cft TEXT,
  phone TEXT,
  password_hash TEXT,
  active BOOLEAN DEFAULT true,
  is_master_admin BOOLEAN DEFAULT false,
  signature_url TEXT,
  custom_settings JSONB,
  payload JSONB,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 3. clients (Clientes tomadores de serviço)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL,
  inscricao_estadual TEXT,
  email TEXT,
  telefone TEXT,
  contato_responsavel TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  data_cadastro TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'ativo',
  observacoes TEXT,
  payload JSONB,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 4. equipment (EPI / EPC)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipment (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  uuid TEXT UNIQUE NOT NULL,
  client_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  service_order_id TEXT,
  service_order_number TEXT,
  type TEXT NOT NULL,
  tag TEXT NOT NULL,
  serial_number TEXT,
  ca_number TEXT,
  asset_number TEXT,
  manufacturer TEXT,
  model TEXT,
  dielectric_class TEXT DEFAULT '0',
  size_or_length TEXT,
  glove_length_mm INTEGER,
  blanket_type TEXT,
  blanket_style TEXT,
  blanket_dimensions TEXT,
  matting_surface TEXT,
  matting_thickness_mm NUMERIC(6,2),
  matting_dimensions TEXT,
  ladder_type TEXT,
  ladder_rungs_count INTEGER,
  ladder_length_extended_m NUMERIC(6,2),
  ladder_load_capacity_kg INTEGER,
  isolated_tools JSONB,
  status TEXT DEFAULT 'em_uso',
  collaborator_name TEXT,
  collaborator_registration TEXT,
  collaborator_sector TEXT,
  last_test_date DATE,
  next_test_due_date DATE,
  retest_interval_months INTEGER DEFAULT 6,
  qr_code TEXT,
  payload JSONB,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 5. service_orders (Ordens de Serviço)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_orders (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  os_number TEXT NOT NULL,
  client_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  status TEXT DEFAULT 'aberta',
  priority TEXT DEFAULT 'normal',
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_for DATE,
  completed_at TIMESTAMPTZ,
  technician_id TEXT,
  technician_name TEXT,
  technician_cft_crea TEXT,
  art_number TEXT,
  service_location TEXT,
  scope_description TEXT,
  equipment_ids JSONB DEFAULT '[]'::jsonb,
  total_items INTEGER DEFAULT 0,
  approved_items INTEGER DEFAULT 0,
  reproved_items INTEGER DEFAULT 0,
  technical_notes TEXT,
  payload JSONB,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 6. test_records (Ensaios, Laudos e Certificados)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_records (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  uuid TEXT UNIQUE NOT NULL,
  test_number TEXT NOT NULL,
  report_number TEXT NOT NULL,
  certificate_number TEXT,
  validation_code TEXT UNIQUE NOT NULL,
  document_hash TEXT NOT NULL,
  client_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  equipment_id TEXT REFERENCES public.equipment(id) ON DELETE SET NULL,
  equipment_tag TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  equipment_class TEXT NOT NULL,
  equipment_serial TEXT,
  equipment_ca TEXT,
  collaborator_name TEXT,
  collaborator_registration TEXT,
  collaborator_sector TEXT,
  service_order_id TEXT,
  service_order_number TEXT,
  art_number TEXT,
  technician_id TEXT,
  technician_name TEXT,
  technician_cft_or_crea TEXT,
  tech_responsible_id TEXT,
  tech_responsible_name TEXT,
  tech_responsible_crea TEXT,
  test_date DATE NOT NULL,
  test_time TEXT,
  location TEXT,
  norm_code TEXT NOT NULL,
  procedure_code TEXT,
  applied_class TEXT NOT NULL,
  applied_voltage_kv NUMERIC(8,2) NOT NULL,
  voltage_type TEXT DEFAULT 'AC',
  application_duration_seconds INTEGER NOT NULL,
  measured_leakage_current_ma NUMERIC(8,3) NOT NULL,
  leakage_current_limit_ma NUMERIC(8,3) NOT NULL,
  current_unit TEXT DEFAULT 'mA',
  withstand_without_puncture BOOLEAN NOT NULL DEFAULT true,
  glove_length_mm INTEGER,
  matting_surface TEXT,
  matting_thickness_mm NUMERIC(6,2),
  isolated_tools JSONB,
  tools_evaluation JSONB,
  environmental JSONB,
  visual_inspection JSONB,
  visual_inspection_passed BOOLEAN DEFAULT true,
  instruments_used JSONB,
  result TEXT NOT NULL,
  result_rationale TEXT,
  approved_opinion TEXT,
  reproved_opinion TEXT,
  technical_notes TEXT,
  retest_due_date DATE,
  technician_signature JSONB,
  tech_responsible_signature JSONB,
  client_signature JSONB,
  photos JSONB DEFAULT '[]'::jsonb,
  payload JSONB,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 7. lab_instruments (Instrumentos do laboratório)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_instruments (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  tag TEXT,
  calibration_cert_number TEXT,
  calibration_date DATE,
  calibration_expiry_date DATE,
  calibration_lab TEXT,
  resolution TEXT,
  accuracy TEXT,
  operational_status TEXT DEFAULT 'ativo',
  payload JSONB,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 8. norms (Normas e critérios técnicos) - antes só existiam no Firebase
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.norms (
  id TEXT PRIMARY KEY,
  norm_code TEXT,
  norm_name TEXT,
  dielectric_class TEXT,
  payload JSONB NOT NULL,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 9. consolidated_reports (Relatórios Técnicos / Dossiês)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consolidated_reports (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  report_code TEXT,
  client_id TEXT,
  client_name TEXT,
  emission_date DATE,
  payload JSONB NOT NULL,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 10. audit_logs (Trilha de auditoria)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  action TEXT,
  user_name TEXT,
  entity_type TEXT,
  entity_id TEXT,
  description TEXT,
  date_time TIMESTAMPTZ,
  payload JSONB NOT NULL,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- MIGRAÇÃO PARA BANCOS JÁ EXISTENTES (versões anteriores do app)
-- =========================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','users','clients','equipment','service_orders','test_records','lab_instruments','norms','consolidated_reports','audit_logs']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS payload JSONB', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS device_id TEXT', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (updated_at)', 'idx_' || t || '_updated_at', t);
  END LOOP;
END $$;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS lab_info JSONB;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS company_id TEXT;

-- Numeração de laudo/ensaio/OS é gerada offline em cada dispositivo: a
-- restrição UNIQUE fazia o Supabase REJEITAR ensaios legítimos de outro
-- tablet com o mesmo número. A unicidade forte fica no validation_code/uuid.
ALTER TABLE public.test_records DROP CONSTRAINT IF EXISTS test_records_test_number_key;
ALTER TABLE public.test_records DROP CONSTRAINT IF EXISTS test_records_report_number_key;
ALTER TABLE public.service_orders DROP CONSTRAINT IF EXISTS service_orders_os_number_key;

-- -------------------------------------------------------------------------
-- ÍNDICES
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_company ON public.users(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_cnpj ON public.clients(cnpj);
CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_tag ON public.equipment(tag);
CREATE INDEX IF NOT EXISTS idx_equipment_client ON public.equipment(client_id);
CREATE INDEX IF NOT EXISTS idx_equipment_company ON public.equipment(company_id);
CREATE INDEX IF NOT EXISTS idx_so_number ON public.service_orders(os_number);
CREATE INDEX IF NOT EXISTS idx_so_company ON public.service_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_test_number ON public.test_records(test_number);
CREATE INDEX IF NOT EXISTS idx_test_report_number ON public.test_records(report_number);
CREATE INDEX IF NOT EXISTS idx_test_cert_number ON public.test_records(certificate_number);
CREATE INDEX IF NOT EXISTS idx_test_validation_code ON public.test_records(validation_code);
CREATE INDEX IF NOT EXISTS idx_test_equipment ON public.test_records(equipment_id);
CREATE INDEX IF NOT EXISTS idx_test_company ON public.test_records(company_id);
CREATE INDEX IF NOT EXISTS idx_test_date ON public.test_records(test_date);
CREATE INDEX IF NOT EXISTS idx_lab_inst_company ON public.lab_instruments(company_id);
CREATE INDEX IF NOT EXISTS idx_reports_company ON public.consolidated_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_company ON public.audit_logs(company_id);

-- -------------------------------------------------------------------------
-- updated_at SEMPRE pelo relógio do servidor (INSERT e UPDATE).
-- É o cursor do pull incremental: relógio errado no tablet não perde dados.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','users','clients','equipment','service_orders','test_records','lab_instruments','norms','consolidated_reports','audit_logs']
  LOOP
    -- remove gatilhos antigos (somente BEFORE UPDATE) das versões anteriores
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trigger_' || t || '_updated', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'jvm_set_updated_at', t);
    EXECUTE format('CREATE TRIGGER jvm_set_updated_at BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS trigger_so_updated ON public.service_orders;
DROP TRIGGER IF EXISTS trigger_test_updated ON public.test_records;
DROP TRIGGER IF EXISTS trigger_instruments_updated ON public.lab_instruments;

-- -------------------------------------------------------------------------
-- ROW LEVEL SECURITY (acesso pela chave pública do app)
-- -------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','users','clients','equipment','service_orders','test_records','lab_instruments','norms','consolidated_reports','audit_logs']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Permitir acesso completo a ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', 'Permitir acesso completo a ' || t, t);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- REALTIME: publica as tabelas para atualização instantânea entre dispositivos
-- -------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  FOREACH t IN ARRAY ARRAY['companies','users','clients','equipment','service_orders','test_records','lab_instruments','norms','consolidated_reports']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- STORAGE: bucket público para fotos/evidências dos ensaios
-- (retira as fotos base64 de dentro das linhas e do armazenamento do aparelho)
-- -------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('jvm-evidencias', 'jvm-evidencias', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "jvm_evidencias_select" ON storage.objects;
CREATE POLICY "jvm_evidencias_select" ON storage.objects FOR SELECT USING (bucket_id = 'jvm-evidencias');
DROP POLICY IF EXISTS "jvm_evidencias_insert" ON storage.objects;
CREATE POLICY "jvm_evidencias_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'jvm-evidencias');
DROP POLICY IF EXISTS "jvm_evidencias_update" ON storage.objects;
CREATE POLICY "jvm_evidencias_update" ON storage.objects FOR UPDATE USING (bucket_id = 'jvm-evidencias') WITH CHECK (bucket_id = 'jvm-evidencias');

-- -------------------------------------------------------------------------
-- DADOS INICIAIS: empresa padrão e administrador master
-- -------------------------------------------------------------------------
INSERT INTO public.companies (id, name, legal_name, cnpj, city, state, phone, email, active)
VALUES (
  'comp-jvm',
  'JVM Engenharia & Treinamentos',
  'JVM Engenharia e Segurança do Trabalho Ltda',
  '38.456.789/0001-12',
  'Campinas',
  'SP',
  '(11) 98765-4321',
  'contato@jvmengenharia.com.br',
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (
  id, company_id, company_name, name, email, role, cargo,
  registration_number, crea_or_cft, phone, password_hash, active, is_master_admin
)
VALUES (
  'usr-master-admin-001', 'comp-jvm', 'JVM Engenharia & Treinamentos',
  'Eng. João Nunes da Silva', 'joao.nunues@jvmengenharia.com.br',
  'responsavel_tecnico', 'Engenheiro Eletricista / Responsável Técnico',
  'CREA/SP 506894123-0', 'CREA/SP 506894123-0', '(11) 98765-4321',
  'Jvm@141519', true, true
) ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- FIM DO SCRIPT
-- =========================================================================
