-- =========================================================================
-- RECRIAR O BANCO DE DADOS DO ZERO   (APAGA TUDO - IRREVERSÍVEL)
--
-- 1. Apaga TODAS as tabelas do schema "public" (do app e de outros sistemas),
--    com todos os dados, além das funções e gatilhos antigos.
-- 2. Cria tudo novo no padrão deste projeto (mesmo conteúdo do schema.sql).
-- 3. No final, crie o primeiro usuário (seção "PRIMEIRO USUÁRIO").
--
-- Antes de executar: feche/atualize todas as versões antigas do app.
-- Fotos antigas: apague em Storage > jvm-evidencias (selecionar tudo > Delete).
-- =========================================================================

-- -------------------------------------------------------------------------
-- PARTE 1 - APAGAR TUDO
-- -------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Views
  FOR r IN SELECT table_name FROM information_schema.views WHERE table_schema = 'public' LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', r.table_name);
    RAISE NOTICE 'View apagada: %', r.table_name;
  END LOOP;

  -- Tabelas
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
    RAISE NOTICE 'Tabela apagada: %', r.tablename;
  END LOOP;

  -- Funções criadas no schema public (as de extensões são preservadas)
  FOR r IN
    SELECT p.oid::regprocedure::text AS assinatura
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.assinatura);
    RAISE NOTICE 'Função apagada: %', r.assinatura;
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- PARTE 2 - CRIAR TUDO NOVO (padrão deste projeto)
-- -------------------------------------------------------------------------
-- =========================================================================
-- DIELECTRIC LAB - ESQUEMA SUPABASE (POSTGRESQL) - BANCO ÚNICO DA PLATAFORMA
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
--
-- Segurança v7:
--   * login pelo Supabase Auth (contas criadas a partir de public.users)
--   * cada usuário só lê/grava dados da própria empresa (Row Level Security)
--   * a chave pública do app não acessa as tabelas diretamente
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
-- Garante TODAS as colunas usadas pelo app em tabelas criadas por versões antigas
-- (sem NOT NULL/UNIQUE/FK para não falhar com dados já existentes)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS technical_responsible TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS lab_info JSONB;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS crea_or_cft TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_master_admin BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_settings JSONB;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contato_responsavel TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_cadastro TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS uuid TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS service_order_id TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS service_order_number TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS tag TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS ca_number TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS asset_number TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS dielectric_class TEXT DEFAULT '0';
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS size_or_length TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS glove_length_mm INTEGER;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS blanket_type TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS blanket_style TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS blanket_dimensions TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS matting_surface TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS matting_thickness_mm NUMERIC(6,2);
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS matting_dimensions TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS ladder_type TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS ladder_rungs_count INTEGER;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS ladder_length_extended_m NUMERIC(6,2);
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS ladder_load_capacity_kg INTEGER;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS isolated_tools JSONB;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'em_uso';
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS collaborator_name TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS collaborator_registration TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS collaborator_sector TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS last_test_date DATE;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS next_test_due_date DATE;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS retest_interval_months INTEGER DEFAULT 6;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS os_number TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aberta';
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS scheduled_for DATE;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS technician_id TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS technician_name TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS technician_cft_crea TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS art_number TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS service_location TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS scope_description TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS equipment_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 0;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS approved_items INTEGER DEFAULT 0;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS reproved_items INTEGER DEFAULT 0;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS technical_notes TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS uuid TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS test_number TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS report_number TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS certificate_number TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS validation_code TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS document_hash TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS equipment_id TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS equipment_tag TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS equipment_type TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS equipment_class TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS equipment_serial TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS equipment_ca TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS collaborator_name TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS collaborator_registration TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS collaborator_sector TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS service_order_id TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS service_order_number TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS art_number TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS technician_id TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS technician_name TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS technician_cft_or_crea TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS tech_responsible_id TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS tech_responsible_name TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS tech_responsible_crea TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS test_date DATE;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS test_time TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS norm_code TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS procedure_code TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS applied_class TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS applied_voltage_kv NUMERIC(8,2);
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS voltage_type TEXT DEFAULT 'AC';
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS application_duration_seconds INTEGER;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS measured_leakage_current_ma NUMERIC(8,3);
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS leakage_current_limit_ma NUMERIC(8,3);
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS current_unit TEXT DEFAULT 'mA';
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS withstand_without_puncture BOOLEAN DEFAULT true;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS glove_length_mm INTEGER;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS matting_surface TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS matting_thickness_mm NUMERIC(6,2);
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS isolated_tools JSONB;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS tools_evaluation JSONB;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS environmental JSONB;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS visual_inspection JSONB;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS visual_inspection_passed BOOLEAN DEFAULT true;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS instruments_used JSONB;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS result TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS result_rationale TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS approved_opinion TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS reproved_opinion TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS technical_notes TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS retest_due_date DATE;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS technician_signature JSONB;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS tech_responsible_signature JSONB;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS client_signature JSONB;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.test_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS tag TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS calibration_cert_number TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS calibration_date DATE;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS calibration_expiry_date DATE;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS calibration_lab TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS resolution TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS accuracy TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS operational_status TEXT DEFAULT 'ativo';
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.lab_instruments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.norms ADD COLUMN IF NOT EXISTS norm_code TEXT;
ALTER TABLE public.norms ADD COLUMN IF NOT EXISTS norm_name TEXT;
ALTER TABLE public.norms ADD COLUMN IF NOT EXISTS dielectric_class TEXT;
ALTER TABLE public.norms ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.norms ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.norms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.norms ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.norms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.consolidated_reports ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.consolidated_reports ADD COLUMN IF NOT EXISTS report_code TEXT;
ALTER TABLE public.consolidated_reports ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.consolidated_reports ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.consolidated_reports ADD COLUMN IF NOT EXISTS emission_date DATE;
ALTER TABLE public.consolidated_reports ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.consolidated_reports ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.consolidated_reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.consolidated_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.consolidated_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS date_time TIMESTAMPTZ;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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


-- =========================================================================
-- COMPATIBILIDADE COM TABELAS CRIADAS POR OUTROS SISTEMAS
-- Se uma tabela já existia com colunas próprias OBRIGATÓRIAS (ex.: "numero_os"
-- criada por outro app), o app web não as preenche e o banco recusava a
-- gravação (erro 23502). Aqui essas colunas extras deixam de ser obrigatórias
-- (nenhum dado é apagado) e as equivalentes conhecidas são preenchidas.
-- =========================================================================
DO $$
DECLARE
  r RECORD;
  spec RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
    ('companies', ARRAY['id', 'name', 'legal_name', 'cnpj', 'inscricao_estadual', 'city', 'state', 'cep', 'phone', 'email', 'logo_url', 'technical_responsible', 'active', 'lab_info', 'payload', 'device_id', 'deleted_at', 'created_at', 'updated_at']),
    ('users', ARRAY['id', 'company_id', 'company_name', 'name', 'email', 'role', 'cargo', 'registration_number', 'crea_or_cft', 'phone', 'password_hash', 'active', 'is_master_admin', 'signature_url', 'custom_settings', 'payload', 'device_id', 'deleted_at', 'created_at', 'updated_at', 'username']),
    ('clients', ARRAY['id', 'company_id', 'razao_social', 'nome_fantasia', 'cnpj', 'inscricao_estadual', 'email', 'telefone', 'contato_responsavel', 'endereco', 'cidade', 'estado', 'cep', 'data_cadastro', 'status', 'observacoes', 'payload', 'device_id', 'deleted_at', 'created_at', 'updated_at']),
    ('equipment', ARRAY['id', 'company_id', 'uuid', 'client_id', 'client_name', 'service_order_id', 'service_order_number', 'type', 'tag', 'serial_number', 'ca_number', 'asset_number', 'manufacturer', 'model', 'dielectric_class', 'size_or_length', 'glove_length_mm', 'blanket_type', 'blanket_style', 'blanket_dimensions', 'matting_surface', 'matting_thickness_mm', 'matting_dimensions', 'ladder_type', 'ladder_rungs_count', 'ladder_length_extended_m', 'ladder_load_capacity_kg', 'isolated_tools', 'status', 'collaborator_name', 'collaborator_registration', 'collaborator_sector', 'last_test_date', 'next_test_due_date', 'retest_interval_months', 'qr_code', 'payload', 'device_id', 'deleted_at', 'created_at', 'updated_at']),
    ('service_orders', ARRAY['id', 'company_id', 'os_number', 'client_id', 'client_name', 'status', 'priority', 'opened_at', 'scheduled_for', 'completed_at', 'technician_id', 'technician_name', 'technician_cft_crea', 'art_number', 'service_location', 'scope_description', 'equipment_ids', 'total_items', 'approved_items', 'reproved_items', 'technical_notes', 'payload', 'device_id', 'deleted_at', 'created_at', 'updated_at']),
    ('test_records', ARRAY['id', 'company_id', 'uuid', 'test_number', 'report_number', 'certificate_number', 'validation_code', 'document_hash', 'client_id', 'client_name', 'equipment_id', 'equipment_tag', 'equipment_type', 'equipment_class', 'equipment_serial', 'equipment_ca', 'collaborator_name', 'collaborator_registration', 'collaborator_sector', 'service_order_id', 'service_order_number', 'art_number', 'technician_id', 'technician_name', 'technician_cft_or_crea', 'tech_responsible_id', 'tech_responsible_name', 'tech_responsible_crea', 'test_date', 'test_time', 'location', 'norm_code', 'procedure_code', 'applied_class', 'applied_voltage_kv', 'voltage_type', 'application_duration_seconds', 'measured_leakage_current_ma', 'leakage_current_limit_ma', 'current_unit', 'withstand_without_puncture', 'glove_length_mm', 'matting_surface', 'matting_thickness_mm', 'isolated_tools', 'tools_evaluation', 'environmental', 'visual_inspection', 'visual_inspection_passed', 'instruments_used', 'result', 'result_rationale', 'approved_opinion', 'reproved_opinion', 'technical_notes', 'retest_due_date', 'technician_signature', 'tech_responsible_signature', 'client_signature', 'photos', 'payload', 'device_id', 'deleted_at', 'created_at', 'updated_at']),
    ('lab_instruments', ARRAY['id', 'company_id', 'name', 'type', 'manufacturer', 'model', 'serial_number', 'tag', 'calibration_cert_number', 'calibration_date', 'calibration_expiry_date', 'calibration_lab', 'resolution', 'accuracy', 'operational_status', 'payload', 'device_id', 'deleted_at', 'created_at', 'updated_at']),
    ('norms', ARRAY['id', 'norm_code', 'norm_name', 'dielectric_class', 'payload', 'device_id', 'deleted_at', 'created_at', 'updated_at', 'company_id', 'norm_id']),
    ('consolidated_reports', ARRAY['id', 'company_id', 'report_code', 'client_id', 'client_name', 'emission_date', 'payload', 'device_id', 'deleted_at', 'created_at', 'updated_at']),
    ('audit_logs', ARRAY['id', 'company_id', 'action', 'user_name', 'entity_type', 'entity_id', 'description', 'date_time', 'payload', 'device_id', 'deleted_at', 'created_at', 'updated_at'])
    ) AS x(tbl, cols)
  LOOP
    FOR r IN
      SELECT c.column_name
        FROM information_schema.columns c
       WHERE c.table_schema = 'public'
         AND c.table_name = spec.tbl
         AND c.is_nullable = 'NO'
         AND c.column_default IS NULL
         AND NOT (c.column_name = ANY (spec.cols))
    LOOP
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', spec.tbl, r.column_name);
      RAISE NOTICE 'Coluna extra %.% deixou de ser obrigatória', spec.tbl, r.column_name;
    END LOOP;
  END LOOP;
END $$;


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
-- REALTIME: publica as tabelas para atualização instantânea entre dispositivos
-- -------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  FOREACH t IN ARRAY ARRAY['companies','clients','equipment','service_orders','test_records','lab_instruments','norms','consolidated_reports']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- =========================================================================
-- SEGURANÇA v7 — LOGIN PELO SUPABASE AUTH + ISOLAMENTO POR EMPRESA (RLS)
--
-- * O login é feito pelo Supabase Auth. Cada linha de public.users com senha
--   ganha automaticamente uma conta de login (auth.users) com a MESMA senha.
-- * A chave pública do app (anon) NÃO lê nem grava nenhuma tabela. Só pode:
--     - descobrir o e-mail de login a partir do nome de usuário;
--     - consultar UM certificado pelo código de validação (portal do QR Code);
--     - enviar fotos da câmera remota para a pasta "camera-remota" do Storage.
-- * Usuários logados só enxergam e gravam dados da PRÓPRIA empresa.
--   O administrador master (is_master_admin) enxerga todas as empresas.
-- * Perfil "cliente" só consulta: não grava ensaios, EPIs, clientes etc.
-- * Normas: a versão oficial é comum a todas as empresas. Quando uma empresa
--   edita/cria/exclui uma norma, a alteração vale SOMENTE para ela.
--
-- COMO CADASTRAR / TROCAR SENHA (SQL Editor):
--   UPDATE public.users SET password_hash = 'NovaSenha@2026'
--    WHERE email = 'tecnico@empresa.com.br';
--   -> a senha é criptografada e a conta de login é criada/atualizada.
-- COMO DEFINIR UM NOME DE USUÁRIO (opcional, além do e-mail):
--   UPDATE public.users SET username = 'joao.nunes' WHERE email = '...';
-- COMO BLOQUEAR UM USUÁRIO (encerra também as sessões abertas):
--   UPDATE public.users SET active = false WHERE email = '...';
--
-- IMPORTANTE: no painel do Supabase, desative o cadastro público:
--   Authentication > Sign In / Providers > "Allow new users to sign up" = OFF
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
  ON public.users (lower(username))
  WHERE username IS NOT NULL AND username <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user
  ON public.users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Quem criou a empresa (permite o "Cadastre sua empresa" do primeiro acesso)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_by UUID;

-- Normas por empresa:
--   company_id NULO  -> versão oficial (comum a todas as empresas)
--   company_id       -> versão da empresa (substitui a oficial só para ela)
--   norm_id          -> id da norma no app (o mesmo nas duas versões)
ALTER TABLE public.norms ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.norms ADD COLUMN IF NOT EXISTS norm_id TEXT;
UPDATE public.norms SET norm_id = id WHERE norm_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_norms_company ON public.norms(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_norms_company_norm
  ON public.norms (company_id, norm_id)
  WHERE company_id IS NOT NULL;

-- Tapetes isolantes (ASTM D178-22): limite de corrente de fuga fixo de 100 mA
-- para todas as classes (a norma não estipula valor). Corrige normas já gravadas
-- (oficiais e das empresas); ensaios e laudos já emitidos NÃO são alterados.
UPDATE public.norms
   SET payload = jsonb_set(jsonb_set(payload, '{maxLeakageCurrent}', '100'::jsonb), '{currentUnit}', '"mA"'::jsonb)
 WHERE payload->'applicableEquipmentTypes' ? 'tapete_isolante'
   AND (CASE WHEN COALESCE(payload->>'maxLeakageCurrent', '') ~ '^[0-9]+(\.[0-9]+)?$'
             THEN (payload->>'maxLeakageCurrent')::numeric <> 100
             ELSE true END
        OR COALESCE(payload->>'currentUnit', '') <> 'mA');

-- Funções antigas de login (senha conferida com a chave pública): removidas
DROP FUNCTION IF EXISTS public.jvm_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.jvm_set_initial_password(TEXT, TEXT);

-- -------------------------------------------------------------------------
-- Funções auxiliares: quem é o usuário logado
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jvm_my_company()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.company_id FROM public.users u
   WHERE u.auth_user_id = auth.uid() AND u.deleted_at IS NULL AND u.active IS NOT FALSE
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.jvm_my_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.role FROM public.users u
   WHERE u.auth_user_id = auth.uid() AND u.deleted_at IS NULL AND u.active IS NOT FALSE
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.jvm_is_master()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT u.is_master_admin FROM public.users u
     WHERE u.auth_user_id = auth.uid() AND u.deleted_at IS NULL AND u.active IS NOT FALSE
     LIMIT 1
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.jvm_is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.jvm_is_master() OR COALESCE(public.jvm_my_role() = 'admin', false)
$$;

-- Perfis que podem gravar dados (o perfil "cliente" só consulta)
CREATE OR REPLACE FUNCTION public.jvm_can_write()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.jvm_is_master()
      OR COALESCE(public.jvm_my_role() IN ('admin', 'responsavel_tecnico', 'tecnico', 'administrativo'), false)
$$;

-- Pasta da empresa no Storage (mesma regra de nome usada pelo app)
CREATE OR REPLACE FUNCTION public.jvm_storage_folder()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT regexp_replace(COALESCE(public.jvm_my_company(), ''), '[^a-zA-Z0-9_-]', '_', 'g')
$$;

DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['jvm_my_company()','jvm_my_role()','jvm_is_master()','jvm_is_admin()','jvm_can_write()','jvm_storage_folder()']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- Senhas: criptografadas automaticamente (bcrypt)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jvm_hash_user_password()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.password_hash IS NULL OR NEW.password_hash = '') THEN
    -- o app nunca apaga a senha por engano
    NEW.password_hash := OLD.password_hash;
  ELSIF NEW.password_hash IS NOT NULL AND NEW.password_hash <> ''
        AND NEW.password_hash !~ '^\$2[aby]\$' THEN
    NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf', 10));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jvm_hash_password ON public.users;
CREATE TRIGGER jvm_hash_password
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.jvm_hash_user_password();

-- -------------------------------------------------------------------------
-- Proteção dos campos de permissão em public.users (gravações pelo app)
-- Quem não tem permissão não consegue se promover: o valor antigo é mantido
-- (sem erro, para não travar a fila de sincronização de aparelhos antigos).
-- Gravações feitas no SQL Editor / painel não passam por estas regras.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jvm_guard_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_master BOOLEAN;
  v_admin BOOLEAN;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  v_master := public.jvm_is_master();
  v_admin := public.jvm_is_admin();

  IF TG_OP = 'INSERT' THEN
    NEW.auth_user_id := NULL;
    IF NOT v_master THEN NEW.is_master_admin := false; END IF;
    IF NEW.role = 'admin' AND NOT v_admin THEN NEW.role := 'tecnico'; END IF;
    RETURN NEW;
  END IF;

  NEW.auth_user_id := OLD.auth_user_id;
  IF NOT v_master THEN
    NEW.is_master_admin := OLD.is_master_admin;
  END IF;
  IF NOT v_admin THEN
    NEW.role := OLD.role;
    NEW.active := OLD.active;
    NEW.email := OLD.email;
    NEW.username := OLD.username;
    NEW.deleted_at := OLD.deleted_at;
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id AND NOT v_master THEN
    -- Única troca permitida: primeiro acesso, o próprio usuário (ainda sem
    -- empresa) se vincula à empresa que ele mesmo acabou de cadastrar.
    IF NOT (OLD.company_id IS NULL
            AND OLD.auth_user_id = auth.uid()
            AND EXISTS (SELECT 1 FROM public.companies c
                         WHERE c.id = NEW.company_id AND c.created_by = auth.uid())) THEN
      NEW.company_id := OLD.company_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jvm_guard_users ON public.users;
CREATE TRIGGER jvm_guard_users
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.jvm_guard_users();

CREATE OR REPLACE FUNCTION public.jvm_guard_companies()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jvm_guard_companies ON public.companies;
CREATE TRIGGER jvm_guard_companies
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.jvm_guard_companies();

-- -------------------------------------------------------------------------
-- Conta de login (auth.users) sincronizada com public.users
-- * senha cadastrada no SQL Editor  -> cria/atualiza a conta de login
-- * e-mail alterado                 -> e-mail de login alterado
-- * active = false ou excluído      -> login bloqueado e sessões encerradas
-- Pelo app (chave pública/usuário logado) só o bloqueio e o e-mail de contas
-- já vinculadas são propagados: o app nunca cria nem vincula contas.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jvm_sync_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_from_api BOOLEAN := COALESCE(auth.role(), '') IN ('anon', 'authenticated');
  v_email TEXT := lower(trim(COALESCE(NEW.email, '')));
  v_uid UUID := NEW.auth_user_id;
  v_has_pwd BOOLEAN := COALESCE(NEW.password_hash ~ '^\$2[aby]\$', false);
  v_blocked BOOLEAN := (NEW.active IS FALSE OR NEW.deleted_at IS NOT NULL);
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.auth_user_id IS NOT NULL
     AND NEW.email IS NOT DISTINCT FROM OLD.email
     AND NEW.password_hash IS NOT DISTINCT FROM OLD.password_hash
     AND NEW.active IS NOT DISTINCT FROM OLD.active
     AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    IF v_from_api OR NOT v_has_pwd OR v_email = '' THEN
      RETURN NEW;
    END IF;
    -- conta de login já existente com este e-mail (ex.: banco recriado)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = v_email LIMIT 1;
    IF v_uid IS NULL THEN
      v_uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        v_email, NEW.password_hash, NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', NEW.name), NOW(), NOW(),
        '', '', '', ''
      );
      INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (v_uid::text, v_uid,
              jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
              'email', NOW(), NOW(), NOW());
    END IF;
    NEW.auth_user_id := v_uid;
  END IF;

  UPDATE auth.users
     SET email = CASE WHEN v_email <> '' THEN v_email ELSE email END,
         encrypted_password = CASE WHEN v_has_pwd AND NOT v_from_api THEN NEW.password_hash ELSE encrypted_password END,
         banned_until = CASE WHEN v_blocked THEN 'infinity'::timestamptz ELSE NULL END,
         updated_at = NOW()
   WHERE id = v_uid;

  IF v_email <> '' THEN
    UPDATE auth.identities
       SET identity_data = identity_data || jsonb_build_object('email', v_email),
           updated_at = NOW()
     WHERE user_id = v_uid AND provider = 'email';
  END IF;

  IF v_blocked THEN
    DELETE FROM auth.sessions WHERE user_id = v_uid;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.jvm_sync_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS jvm_sync_auth ON public.users;
CREATE TRIGGER jvm_sync_auth
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.jvm_sync_auth_user();

-- Migração: senhas antigas em texto puro são criptografadas...
UPDATE public.users
   SET password_hash = password_hash
 WHERE password_hash IS NOT NULL
   AND password_hash <> ''
   AND password_hash !~ '^\$2[aby]\$';

-- ...e todo usuário com senha ganha a conta de login (mesma senha de antes)
UPDATE public.users
   SET password_hash = password_hash
 WHERE auth_user_id IS NULL
   AND deleted_at IS NULL
   AND password_hash ~ '^\$2[aby]\$';

-- -------------------------------------------------------------------------
-- Funções chamadas pelo app
-- -------------------------------------------------------------------------
-- Login por nome de usuário: devolve o e-mail de login. Para quem digita o
-- próprio e-mail, devolve o texto digitado (não revela se a conta existe).
CREATE OR REPLACE FUNCTION public.jvm_login_email(p_login TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_login TEXT := lower(trim(COALESCE(p_login, '')));
  v_email TEXT;
BEGIN
  IF v_login = '' THEN
    RETURN NULL;
  END IF;
  IF position('@' IN v_login) > 0 THEN
    RETURN v_login;
  END IF;
  SELECT lower(u.email) INTO v_email
    FROM public.users u
   WHERE u.deleted_at IS NULL
     AND u.auth_user_id IS NOT NULL
     AND u.username IS NOT NULL
     AND lower(u.username) = v_login
   LIMIT 1;
  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.jvm_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jvm_login_email(TEXT) TO anon, authenticated;

-- Perfil do usuário logado (sem a senha)
CREATE OR REPLACE FUNCTION public.jvm_me()
RETURNS JSON
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u public.users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Sessão inválida. Entre novamente.');
  END IF;
  SELECT * INTO u FROM public.users
   WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Usuário não cadastrado no sistema. Contate o administrador.');
  END IF;
  IF u.active IS FALSE THEN
    RETURN json_build_object('ok', false, 'error', 'Usuário inativo. Contate o administrador.');
  END IF;
  RETURN json_build_object('ok', true, 'user', to_jsonb(u) - 'password_hash');
END;
$$;

REVOKE ALL ON FUNCTION public.jvm_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.jvm_me() TO authenticated;

-- Portal público /validar/CODIGO: devolve UM ensaio pelo código de validação
-- (o código aleatório impresso no QR Code). Números de laudo/certificado são
-- sequenciais e por isso NÃO são aceitos aqui.
CREATE OR REPLACE FUNCTION public.jvm_validar_certificado(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := upper(trim(COALESCE(p_code, '')));
  t public.test_records%ROWTYPE;
  c public.companies%ROWTYPE;
BEGIN
  IF length(v_code) < 6 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO t FROM public.test_records
   WHERE validation_code = v_code AND deleted_at IS NULL
   ORDER BY updated_at DESC
   LIMIT 1;
  IF NOT FOUND THEN
    PERFORM pg_sleep(0.3);
    RETURN NULL;
  END IF;
  SELECT * INTO c FROM public.companies WHERE id = t.company_id;
  RETURN json_build_object(
    'test', to_jsonb(t) - 'device_id',
    'company', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', c.id, 'name', c.name, 'legal_name', c.legal_name, 'cnpj', c.cnpj, 'lab_info', c.lab_info
    ) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.jvm_validar_certificado(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jvm_validar_certificado(TEXT) TO anon, authenticated;

-- -------------------------------------------------------------------------
-- NUMERAÇÃO SEM DUPLICIDADE ENTRE APARELHOS
-- Cada aparelho reserva uma faixa de números (ensaio, laudo, certificado, OS)
-- quando está online e a usa depois, mesmo sem internet. A sequência é
-- contínua por empresa e tipo (o mês aparece só no formato do número).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.number_sequences (
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  last_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (company_id, kind)
);
ALTER TABLE public.number_sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.number_sequences FROM anon, authenticated;

-- Maior sequência já usada (mesma regra do app): número após o mês atual
-- ("LAU-2609-0012" -> 12) ou dígitos finais ("ENS-2608-0045" -> 45)
CREATE OR REPLACE FUNCTION public.jvm_number_sequence(p_number TEXT, p_period TEXT)
RETURNS BIGINT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(
    substring(p_number FROM '(?:20' || p_period || '|' || p_period || ')[-_]?(\d{1,9})'),
    substring(p_number FROM '(\d{1,9})$')
  )::BIGINT
$$;

CREATE OR REPLACE FUNCTION public.jvm_reserve_numbers(p_kind TEXT, p_period TEXT, p_quantity INTEGER, p_local_max BIGINT DEFAULT 0)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company TEXT := public.jvm_my_company();
  v_used BIGINT := 0;
  v_last BIGINT;
BEGIN
  IF v_company IS NULL OR NOT public.jvm_can_write() THEN
    RAISE EXCEPTION 'Sem permissão para reservar numeração.' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('test', 'report', 'certificate', 'os') THEN
    RAISE EXCEPTION 'Tipo de numeração inválido: %', p_kind USING ERRCODE = '22023';
  END IF;
  IF p_period IS NULL OR p_period !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'Período inválido: %', p_period USING ERRCODE = '22023';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 200 THEN
    RAISE EXCEPTION 'Quantidade inválida: %', p_quantity USING ERRCODE = '22023';
  END IF;

  -- Números já gravados no banco (inclusive os de versões anteriores do app)
  IF p_kind = 'os' THEN
    SELECT COALESCE(max(public.jvm_number_sequence(os_number, p_period)), 0) INTO v_used
      FROM public.service_orders WHERE company_id = v_company;
  ELSIF p_kind = 'test' THEN
    SELECT COALESCE(max(public.jvm_number_sequence(test_number, p_period)), 0) INTO v_used
      FROM public.test_records WHERE company_id = v_company;
  ELSIF p_kind = 'report' THEN
    SELECT COALESCE(max(public.jvm_number_sequence(report_number, p_period)), 0) INTO v_used
      FROM public.test_records WHERE company_id = v_company;
  ELSE
    SELECT COALESCE(max(public.jvm_number_sequence(certificate_number, p_period)), 0) INTO v_used
      FROM public.test_records WHERE company_id = v_company;
  END IF;

  INSERT INTO public.number_sequences (company_id, kind, last_value)
  VALUES (v_company, p_kind, 0)
  ON CONFLICT (company_id, kind) DO NOTHING;

  -- Bloqueia a linha: dois aparelhos reservando ao mesmo tempo recebem faixas diferentes
  SELECT last_value INTO v_last
    FROM public.number_sequences
   WHERE company_id = v_company AND kind = p_kind
   FOR UPDATE;

  v_last := GREATEST(v_last, v_used, COALESCE(p_local_max, 0));

  UPDATE public.number_sequences
     SET last_value = v_last + p_quantity, updated_at = NOW()
   WHERE company_id = v_company AND kind = p_kind;

  RETURN json_build_object('start', v_last + 1, 'end', v_last + p_quantity);
END;
$$;

REVOKE ALL ON FUNCTION public.jvm_reserve_numbers(TEXT, TEXT, INTEGER, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.jvm_reserve_numbers(TEXT, TEXT, INTEGER, BIGINT) TO authenticated;

-- -------------------------------------------------------------------------
-- CONFLITO DE EDIÇÃO ENTRE APARELHOS
-- O app envia em base_updated_at a versão do servidor em que a edição se
-- baseou. Se o registro foi alterado depois disso por OUTRO aparelho, a
-- gravação é recusada (código JV409) e o app pede para escolher a versão.
-- -------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','equipment','service_orders','test_records','lab_instruments','consolidated_reports']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS base_updated_at TIMESTAMPTZ', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.jvm_check_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.base_updated_at IS NOT NULL
     AND OLD.updated_at IS NOT NULL
     AND OLD.updated_at > NEW.base_updated_at
     AND OLD.device_id IS DISTINCT FROM NEW.device_id THEN
    RAISE EXCEPTION 'Conflito de edição: o registro % foi alterado em outro aparelho.', OLD.id
      USING ERRCODE = 'JV409';
  END IF;
  -- a coluna só transporta a versão de base: não fica gravada
  NEW.base_updated_at := NULL;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','equipment','service_orders','test_records','lab_instruments','consolidated_reports']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS jvm_check_conflict ON public.%I', t);
    EXECUTE format('CREATE TRIGGER jvm_check_conflict BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.jvm_check_conflict()', t);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Remove TODAS as políticas antigas destas tabelas (inclusive as liberadas
-- "Permitir acesso completo" e as criadas por outros sistemas).
-- -------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','users','clients','equipment','service_orders','test_records','lab_instruments','norms','consolidated_reports','audit_logs']
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- a chave pública não acessa nenhuma tabela diretamente
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;

  -- Dados da empresa (mesmas regras para todas estas tabelas)
  FOREACH t IN ARRAY ARRAY['clients','equipment','service_orders','test_records','lab_instruments','consolidated_reports']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format($p$CREATE POLICY jvm_select ON public.%I FOR SELECT TO authenticated
      USING (company_id = (SELECT public.jvm_my_company()) OR (SELECT public.jvm_is_master()))$p$, t);
    EXECUTE format($p$CREATE POLICY jvm_insert ON public.%I FOR INSERT TO authenticated
      WITH CHECK ((company_id = (SELECT public.jvm_my_company()) OR (SELECT public.jvm_is_master()))
                  AND (SELECT public.jvm_can_write()))$p$, t);
    EXECUTE format($p$CREATE POLICY jvm_update ON public.%I FOR UPDATE TO authenticated
      USING (company_id = (SELECT public.jvm_my_company()) OR (SELECT public.jvm_is_master()))
      WITH CHECK ((company_id = (SELECT public.jvm_my_company()) OR (SELECT public.jvm_is_master()))
                  AND (SELECT public.jvm_can_write()))$p$, t);
    EXECUTE format($p$CREATE POLICY jvm_delete ON public.%I FOR DELETE TO authenticated
      USING ((company_id = (SELECT public.jvm_my_company()) AND (SELECT public.jvm_is_admin()))
             OR (SELECT public.jvm_is_master()))$p$, t);
  END LOOP;
END $$;

-- Auditoria: grava e consulta a própria empresa; registros não são alterados
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
CREATE POLICY jvm_select ON public.audit_logs FOR SELECT TO authenticated
  USING (company_id = (SELECT public.jvm_my_company()) OR (SELECT public.jvm_is_master()));
CREATE POLICY jvm_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT public.jvm_my_company()) OR (SELECT public.jvm_is_master()));

-- Empresas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
CREATE POLICY jvm_select ON public.companies FOR SELECT TO authenticated
  USING (id = (SELECT public.jvm_my_company())
         OR created_by = auth.uid()
         OR (SELECT public.jvm_is_master()));
-- Cadastro de empresa: somente quem ainda não tem empresa (primeiro acesso)
CREATE POLICY jvm_insert ON public.companies FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.jvm_can_write())
              AND ((SELECT public.jvm_my_company()) IS NULL
                   OR id = (SELECT public.jvm_my_company())
                   OR (SELECT public.jvm_is_master())));
CREATE POLICY jvm_update ON public.companies FOR UPDATE TO authenticated
  USING (id = (SELECT public.jvm_my_company())
         OR created_by = auth.uid()
         OR (SELECT public.jvm_is_master()))
  WITH CHECK ((SELECT public.jvm_can_write())
              AND (id = (SELECT public.jvm_my_company())
                   OR created_by = auth.uid()
                   OR (SELECT public.jvm_is_master())));
CREATE POLICY jvm_delete ON public.companies FOR DELETE TO authenticated
  USING ((SELECT public.jvm_is_master()));

-- Usuários: a coluna de senha e o vínculo de login nunca são lidos/gravados pelo app
REVOKE ALL ON public.users FROM authenticated;
GRANT SELECT (
  id, company_id, company_name, name, email, username, role, cargo,
  registration_number, crea_or_cft, phone, active, is_master_admin,
  signature_url, custom_settings, payload, device_id, deleted_at,
  created_at, updated_at
) ON public.users TO authenticated;
GRANT INSERT (
  id, company_id, company_name, name, email, username, role, cargo,
  registration_number, crea_or_cft, phone, active, is_master_admin,
  signature_url, custom_settings, payload, device_id, deleted_at
) ON public.users TO authenticated;
GRANT UPDATE (
  id, company_id, company_name, name, email, username, role, cargo,
  registration_number, crea_or_cft, phone, active, is_master_admin,
  signature_url, custom_settings, payload, device_id, deleted_at
) ON public.users TO authenticated;
GRANT DELETE ON public.users TO authenticated;

CREATE POLICY jvm_select ON public.users FOR SELECT TO authenticated
  USING (company_id = (SELECT public.jvm_my_company())
         OR auth_user_id = auth.uid()
         OR (SELECT public.jvm_is_master()));
CREATE POLICY jvm_insert ON public.users FOR INSERT TO authenticated
  WITH CHECK ((company_id = (SELECT public.jvm_my_company()) AND (SELECT public.jvm_can_write()))
              OR (SELECT public.jvm_is_master()));
CREATE POLICY jvm_update ON public.users FOR UPDATE TO authenticated
  USING (company_id = (SELECT public.jvm_my_company())
         OR auth_user_id = auth.uid()
         OR (SELECT public.jvm_is_master()))
  WITH CHECK ((company_id = (SELECT public.jvm_my_company()) AND (SELECT public.jvm_can_write()))
              OR auth_user_id = auth.uid()
              OR (SELECT public.jvm_is_master()));
CREATE POLICY jvm_delete ON public.users FOR DELETE TO authenticated
  USING ((company_id = (SELECT public.jvm_my_company()) AND (SELECT public.jvm_is_admin()))
         OR (SELECT public.jvm_is_master()));

-- Normas técnicas: todos leem a versão oficial e a da própria empresa.
-- Admin/RT gravam somente versões da própria empresa; a versão oficial só é
-- alterada pelo SQL Editor (ou pelo administrador master).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.norms TO authenticated;
CREATE POLICY jvm_select ON public.norms FOR SELECT TO authenticated
  USING (company_id IS NULL
         OR company_id = (SELECT public.jvm_my_company())
         OR (SELECT public.jvm_is_master()));
CREATE POLICY jvm_insert ON public.norms FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.jvm_is_master())
              OR (company_id = (SELECT public.jvm_my_company())
                  AND COALESCE((SELECT public.jvm_my_role()) IN ('admin', 'responsavel_tecnico'), false)));
CREATE POLICY jvm_update ON public.norms FOR UPDATE TO authenticated
  USING ((SELECT public.jvm_is_master())
         OR company_id = (SELECT public.jvm_my_company()))
  WITH CHECK ((SELECT public.jvm_is_master())
              OR (company_id = (SELECT public.jvm_my_company())
                  AND COALESCE((SELECT public.jvm_my_role()) IN ('admin', 'responsavel_tecnico'), false)));
CREATE POLICY jvm_delete ON public.norms FOR DELETE TO authenticated
  USING ((SELECT public.jvm_is_master())
         OR (company_id = (SELECT public.jvm_my_company()) AND (SELECT public.jvm_is_admin())));

-- A tabela de usuários fica fora do Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.users;
EXCEPTION WHEN others THEN NULL;
END $$;

-- -------------------------------------------------------------------------
-- STORAGE: fotos/evidências dos ensaios (bucket "jvm-evidencias")
-- * Leitura pública pela URL da foto (usada nos laudos e no portal do QR Code)
-- * Envio/alteração: só usuário logado, na pasta da própria empresa
-- * Câmera remota (celular sem login): só ENVIA imagens para "camera-remota/"
-- -------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('jvm-evidencias', 'jvm-evidencias', true, 10485760, ARRAY['image/*'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "jvm_evidencias_select" ON storage.objects;
DROP POLICY IF EXISTS "jvm_evidencias_insert" ON storage.objects;
DROP POLICY IF EXISTS "jvm_evidencias_update" ON storage.objects;
DROP POLICY IF EXISTS "jvm_evidencias_camera_insert" ON storage.objects;

CREATE POLICY "jvm_evidencias_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'jvm-evidencias'
         AND ((storage.foldername(name))[1] = (SELECT public.jvm_storage_folder())
              OR (SELECT public.jvm_is_master())));
CREATE POLICY "jvm_evidencias_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'jvm-evidencias'
              AND (SELECT public.jvm_can_write())
              AND ((storage.foldername(name))[1] = (SELECT public.jvm_storage_folder())
                   OR (SELECT public.jvm_is_master())));
CREATE POLICY "jvm_evidencias_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'jvm-evidencias'
         AND ((storage.foldername(name))[1] = (SELECT public.jvm_storage_folder())
              OR (SELECT public.jvm_is_master())))
  WITH CHECK (bucket_id = 'jvm-evidencias'
              AND ((storage.foldername(name))[1] = (SELECT public.jvm_storage_folder())
                   OR (SELECT public.jvm_is_master())));
CREATE POLICY "jvm_evidencias_camera_insert" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'jvm-evidencias'
              AND (storage.foldername(name))[1] = 'camera-remota');

-- =========================================================================
-- BLOQUEIO DE DADOS DE DEMONSTRAÇÃO
-- Versões antigas do app (prévia do AI Studio, sites/celulares desatualizados)
-- reenviam as empresas de demonstração a cada abertura e "repovoam" o banco
-- mesmo depois de zerado. Estas gravações passam a ser recusadas.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.jvm_block_demo_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_company TEXT;
BEGIN
  IF TG_TABLE_NAME = 'companies' THEN
    v_company := NEW.id;
  ELSE
    v_company := to_jsonb(NEW) ->> 'company_id';
  END IF;

  IF v_company IN ('comp-jvm', 'comp-voltsafe', 'comp-altatensao') THEN
    RAISE EXCEPTION 'Dados de demonstração bloqueados (empresa %). Atualize o app para a versão mais recente.', v_company
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_TABLE_NAME = 'users'
     AND NEW.id IN ('usr-master-admin-001', 'usr-1', 'usr-2', 'usr-3', 'usr-4', 'usr-5', 'usr-6') THEN
    RAISE EXCEPTION 'Usuário de demonstração bloqueado (%). Atualize o app para a versão mais recente.', NEW.id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','users','clients','equipment','service_orders','test_records','lab_instruments','consolidated_reports','audit_logs']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS jvm_block_demo ON public.%I', t);
    EXECUTE format('CREATE TRIGGER jvm_block_demo BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.jvm_block_demo_data()', t);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- DADOS INICIAIS: nenhum. O banco começa vazio.
-- Crie o primeiro usuário com o comando abaixo (ajuste os dados). A conta de
-- login é criada automaticamente com a senha informada. No primeiro acesso,
-- ele cadastra a própria empresa pela tela do sistema.
-- is_master_admin = true dá acesso a TODAS as empresas do banco: use apenas
-- para o administrador da plataforma.
--
--   INSERT INTO public.users (id, name, email, username, role, is_master_admin, password_hash)
--   VALUES ('usr-admin', 'Seu Nome', 'voce@suaempresa.com.br', 'admin',
--           'admin', true, 'SuaSenhaForte');
-- -------------------------------------------------------------------------

-- =========================================================================
-- FIM DO SCRIPT
-- =========================================================================

-- -------------------------------------------------------------------------
-- PARTE 3 - PRIMEIRO USUÁRIO
-- Troque nome, e-mail, usuário e senha, REMOVA os dois traços do início das
-- 3 linhas abaixo e execute somente elas (selecione e clique em Run).
-- No primeiro acesso ao app, esse usuário cadastra a empresa.
-- -------------------------------------------------------------------------
-- INSERT INTO public.users (id, name, email, username, role, is_master_admin, password_hash)
-- VALUES ('usr-admin', 'Seu Nome', 'voce@suaempresa.com.br', 'admin',
--         'admin', true, 'SuaSenhaForte');

-- Conferência: tabelas criadas
SELECT table_name AS tabela_criada
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
 ORDER BY table_name;
