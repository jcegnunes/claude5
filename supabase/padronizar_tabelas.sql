-- =========================================================================
-- PADRONIZAR AS TABELAS NO MODELO DESTE PROJETO   (IRREVERSÍVEL)
--
-- Mantém SOMENTE as colunas definidas em supabase/schema.sql nas tabelas do
-- app e remove as colunas criadas por outros sistemas (ex.: numero_os,
-- cliente_nome). Os dados dessas colunas extras são perdidos — exceto o
-- número da OS e o nome do cliente, copiados antes para as colunas padrão.
--
-- COMO USAR
--   1. Faça um backup (Database > Backups).
--   2. Execute primeiro o supabase/schema.sql.
--   3. Execute este arquivo. As mensagens (NOTICE) listam tudo que foi feito.
--
-- TABELAS DE OUTROS SISTEMAS: por segurança, são apenas LISTADAS.
-- Para apagá-las também, troque  apagar_tabelas_extras := false  por  true
-- (no bloco 4 abaixo) e execute de novo.
-- =========================================================================

-- 1. Preserva dados de colunas antigas equivalentes antes de removê-las
DO $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('service_orders', 'numero_os',    'os_number'),
      ('service_orders', 'cliente_nome', 'client_name')
    ) AS x(tbl, antiga, padrao)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = m.tbl AND column_name = m.antiga)
       AND EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = m.tbl AND column_name = m.padrao) THEN
      EXECUTE format(
        'UPDATE public.%I SET %I = %I::text WHERE (%I IS NULL OR %I = '''') AND %I IS NOT NULL',
        m.tbl, m.padrao, m.antiga, m.padrao, m.padrao, m.antiga);
      RAISE NOTICE 'Dados copiados: %.% -> %', m.tbl, m.antiga, m.padrao;
    END IF;
  END LOOP;
END $$;

-- Remove o gatilho de compatibilidade da versão anterior (se existir)
DROP TRIGGER IF EXISTS jvm_sync_numero_os ON public.service_orders;
DROP FUNCTION IF EXISTS public.jvm_sync_numero_os();

-- Colunas do padrão (tabela, coluna, tipo)
DROP TABLE IF EXISTS pg_temp.jvm_padrao;
CREATE TEMP TABLE jvm_padrao (tbl TEXT, col TEXT, tipo TEXT);
INSERT INTO jvm_padrao VALUES
  ('companies','id','text'),
  ('companies','name','text'),
  ('companies','legal_name','text'),
  ('companies','cnpj','text'),
  ('companies','inscricao_estadual','text'),
  ('companies','city','text'),
  ('companies','state','text'),
  ('companies','cep','text'),
  ('companies','phone','text'),
  ('companies','email','text'),
  ('companies','logo_url','text'),
  ('companies','technical_responsible','text'),
  ('companies','active','boolean'),
  ('companies','lab_info','jsonb'),
  ('companies','payload','jsonb'),
  ('companies','device_id','text'),
  ('companies','deleted_at','timestamp with time zone'),
  ('companies','created_at','timestamp with time zone'),
  ('companies','updated_at','timestamp with time zone'),
  ('users','id','text'),
  ('users','company_id','text'),
  ('users','company_name','text'),
  ('users','name','text'),
  ('users','email','text'),
  ('users','role','text'),
  ('users','cargo','text'),
  ('users','registration_number','text'),
  ('users','crea_or_cft','text'),
  ('users','phone','text'),
  ('users','password_hash','text'),
  ('users','active','boolean'),
  ('users','is_master_admin','boolean'),
  ('users','signature_url','text'),
  ('users','custom_settings','jsonb'),
  ('users','payload','jsonb'),
  ('users','device_id','text'),
  ('users','deleted_at','timestamp with time zone'),
  ('users','created_at','timestamp with time zone'),
  ('users','updated_at','timestamp with time zone'),
  ('users','username','text'),
  ('clients','id','text'),
  ('clients','company_id','text'),
  ('clients','razao_social','text'),
  ('clients','nome_fantasia','text'),
  ('clients','cnpj','text'),
  ('clients','inscricao_estadual','text'),
  ('clients','email','text'),
  ('clients','telefone','text'),
  ('clients','contato_responsavel','text'),
  ('clients','endereco','text'),
  ('clients','cidade','text'),
  ('clients','estado','text'),
  ('clients','cep','text'),
  ('clients','data_cadastro','timestamp with time zone'),
  ('clients','status','text'),
  ('clients','observacoes','text'),
  ('clients','payload','jsonb'),
  ('clients','device_id','text'),
  ('clients','deleted_at','timestamp with time zone'),
  ('clients','created_at','timestamp with time zone'),
  ('clients','updated_at','timestamp with time zone'),
  ('equipment','id','text'),
  ('equipment','company_id','text'),
  ('equipment','uuid','text'),
  ('equipment','client_id','text'),
  ('equipment','client_name','text'),
  ('equipment','service_order_id','text'),
  ('equipment','service_order_number','text'),
  ('equipment','type','text'),
  ('equipment','tag','text'),
  ('equipment','serial_number','text'),
  ('equipment','ca_number','text'),
  ('equipment','asset_number','text'),
  ('equipment','manufacturer','text'),
  ('equipment','model','text'),
  ('equipment','dielectric_class','text'),
  ('equipment','size_or_length','text'),
  ('equipment','glove_length_mm','integer'),
  ('equipment','blanket_type','text'),
  ('equipment','blanket_style','text'),
  ('equipment','blanket_dimensions','text'),
  ('equipment','matting_surface','text'),
  ('equipment','matting_thickness_mm','numeric'),
  ('equipment','matting_dimensions','text'),
  ('equipment','ladder_type','text'),
  ('equipment','ladder_rungs_count','integer'),
  ('equipment','ladder_length_extended_m','numeric'),
  ('equipment','ladder_load_capacity_kg','integer'),
  ('equipment','isolated_tools','jsonb'),
  ('equipment','status','text'),
  ('equipment','collaborator_name','text'),
  ('equipment','collaborator_registration','text'),
  ('equipment','collaborator_sector','text'),
  ('equipment','last_test_date','date'),
  ('equipment','next_test_due_date','date'),
  ('equipment','retest_interval_months','integer'),
  ('equipment','qr_code','text'),
  ('equipment','payload','jsonb'),
  ('equipment','device_id','text'),
  ('equipment','deleted_at','timestamp with time zone'),
  ('equipment','created_at','timestamp with time zone'),
  ('equipment','updated_at','timestamp with time zone'),
  ('service_orders','id','text'),
  ('service_orders','company_id','text'),
  ('service_orders','os_number','text'),
  ('service_orders','client_id','text'),
  ('service_orders','client_name','text'),
  ('service_orders','status','text'),
  ('service_orders','priority','text'),
  ('service_orders','opened_at','timestamp with time zone'),
  ('service_orders','scheduled_for','date'),
  ('service_orders','completed_at','timestamp with time zone'),
  ('service_orders','technician_id','text'),
  ('service_orders','technician_name','text'),
  ('service_orders','technician_cft_crea','text'),
  ('service_orders','art_number','text'),
  ('service_orders','service_location','text'),
  ('service_orders','scope_description','text'),
  ('service_orders','equipment_ids','jsonb'),
  ('service_orders','total_items','integer'),
  ('service_orders','approved_items','integer'),
  ('service_orders','reproved_items','integer'),
  ('service_orders','technical_notes','text'),
  ('service_orders','payload','jsonb'),
  ('service_orders','device_id','text'),
  ('service_orders','deleted_at','timestamp with time zone'),
  ('service_orders','created_at','timestamp with time zone'),
  ('service_orders','updated_at','timestamp with time zone'),
  ('test_records','id','text'),
  ('test_records','company_id','text'),
  ('test_records','uuid','text'),
  ('test_records','test_number','text'),
  ('test_records','report_number','text'),
  ('test_records','certificate_number','text'),
  ('test_records','validation_code','text'),
  ('test_records','document_hash','text'),
  ('test_records','client_id','text'),
  ('test_records','client_name','text'),
  ('test_records','equipment_id','text'),
  ('test_records','equipment_tag','text'),
  ('test_records','equipment_type','text'),
  ('test_records','equipment_class','text'),
  ('test_records','equipment_serial','text'),
  ('test_records','equipment_ca','text'),
  ('test_records','collaborator_name','text'),
  ('test_records','collaborator_registration','text'),
  ('test_records','collaborator_sector','text'),
  ('test_records','service_order_id','text'),
  ('test_records','service_order_number','text'),
  ('test_records','art_number','text'),
  ('test_records','technician_id','text'),
  ('test_records','technician_name','text'),
  ('test_records','technician_cft_or_crea','text'),
  ('test_records','tech_responsible_id','text'),
  ('test_records','tech_responsible_name','text'),
  ('test_records','tech_responsible_crea','text'),
  ('test_records','test_date','date'),
  ('test_records','test_time','text'),
  ('test_records','location','text'),
  ('test_records','norm_code','text'),
  ('test_records','procedure_code','text'),
  ('test_records','applied_class','text'),
  ('test_records','applied_voltage_kv','numeric'),
  ('test_records','voltage_type','text'),
  ('test_records','application_duration_seconds','integer'),
  ('test_records','measured_leakage_current_ma','numeric'),
  ('test_records','leakage_current_limit_ma','numeric'),
  ('test_records','current_unit','text'),
  ('test_records','withstand_without_puncture','boolean'),
  ('test_records','glove_length_mm','integer'),
  ('test_records','matting_surface','text'),
  ('test_records','matting_thickness_mm','numeric'),
  ('test_records','isolated_tools','jsonb'),
  ('test_records','tools_evaluation','jsonb'),
  ('test_records','environmental','jsonb'),
  ('test_records','visual_inspection','jsonb'),
  ('test_records','visual_inspection_passed','boolean'),
  ('test_records','instruments_used','jsonb'),
  ('test_records','result','text'),
  ('test_records','result_rationale','text'),
  ('test_records','approved_opinion','text'),
  ('test_records','reproved_opinion','text'),
  ('test_records','technical_notes','text'),
  ('test_records','retest_due_date','date'),
  ('test_records','technician_signature','jsonb'),
  ('test_records','tech_responsible_signature','jsonb'),
  ('test_records','client_signature','jsonb'),
  ('test_records','photos','jsonb'),
  ('test_records','payload','jsonb'),
  ('test_records','device_id','text'),
  ('test_records','deleted_at','timestamp with time zone'),
  ('test_records','created_at','timestamp with time zone'),
  ('test_records','updated_at','timestamp with time zone'),
  ('lab_instruments','id','text'),
  ('lab_instruments','company_id','text'),
  ('lab_instruments','name','text'),
  ('lab_instruments','type','text'),
  ('lab_instruments','manufacturer','text'),
  ('lab_instruments','model','text'),
  ('lab_instruments','serial_number','text'),
  ('lab_instruments','tag','text'),
  ('lab_instruments','calibration_cert_number','text'),
  ('lab_instruments','calibration_date','date'),
  ('lab_instruments','calibration_expiry_date','date'),
  ('lab_instruments','calibration_lab','text'),
  ('lab_instruments','resolution','text'),
  ('lab_instruments','accuracy','text'),
  ('lab_instruments','operational_status','text'),
  ('lab_instruments','payload','jsonb'),
  ('lab_instruments','device_id','text'),
  ('lab_instruments','deleted_at','timestamp with time zone'),
  ('lab_instruments','created_at','timestamp with time zone'),
  ('lab_instruments','updated_at','timestamp with time zone'),
  ('norms','id','text'),
  ('norms','norm_code','text'),
  ('norms','norm_name','text'),
  ('norms','dielectric_class','text'),
  ('norms','payload','jsonb'),
  ('norms','device_id','text'),
  ('norms','deleted_at','timestamp with time zone'),
  ('norms','created_at','timestamp with time zone'),
  ('norms','updated_at','timestamp with time zone'),
  ('consolidated_reports','id','text'),
  ('consolidated_reports','company_id','text'),
  ('consolidated_reports','report_code','text'),
  ('consolidated_reports','client_id','text'),
  ('consolidated_reports','client_name','text'),
  ('consolidated_reports','emission_date','date'),
  ('consolidated_reports','payload','jsonb'),
  ('consolidated_reports','device_id','text'),
  ('consolidated_reports','deleted_at','timestamp with time zone'),
  ('consolidated_reports','created_at','timestamp with time zone'),
  ('consolidated_reports','updated_at','timestamp with time zone'),
  ('audit_logs','id','text'),
  ('audit_logs','company_id','text'),
  ('audit_logs','action','text'),
  ('audit_logs','user_name','text'),
  ('audit_logs','entity_type','text'),
  ('audit_logs','entity_id','text'),
  ('audit_logs','description','text'),
  ('audit_logs','date_time','timestamp with time zone'),
  ('audit_logs','payload','jsonb'),
  ('audit_logs','device_id','text'),
  ('audit_logs','deleted_at','timestamp with time zone'),
  ('audit_logs','created_at','timestamp with time zone'),
  ('audit_logs','updated_at','timestamp with time zone');

-- 2. Remove as colunas que não fazem parte do padrão
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN (SELECT DISTINCT tbl FROM jvm_padrao)
       AND NOT EXISTS (SELECT 1 FROM jvm_padrao p WHERE p.tbl = c.table_name AND p.col = c.column_name)
     ORDER BY c.table_name, c.column_name
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN %I CASCADE', r.table_name, r.column_name);
    RAISE NOTICE 'Coluna removida: %.%', r.table_name, r.column_name;
  END LOOP;
END $$;

-- 3. Aponta colunas do padrão com TIPO diferente do esperado (só informa)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name, c.data_type, p.tipo
      FROM information_schema.columns c
      JOIN jvm_padrao p ON p.tbl = c.table_name AND p.col = c.column_name
     WHERE c.table_schema = 'public'
       AND c.data_type <> p.tipo
  LOOP
    RAISE WARNING 'Tipo diferente do padrão em %.%: está % (esperado %)', r.table_name, r.column_name, r.data_type, r.tipo;
  END LOOP;
END $$;

-- 4. Tabelas de outros sistemas no schema public
DO $$
DECLARE
  apagar_tabelas_extras BOOLEAN := false;   -- troque para true para apagá-las
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.table_name
      FROM information_schema.tables t
     WHERE t.table_schema = 'public'
       AND t.table_type = 'BASE TABLE'
       AND t.table_name NOT IN (SELECT DISTINCT tbl FROM jvm_padrao)
     ORDER BY t.table_name
  LOOP
    IF apagar_tabelas_extras THEN
      EXECUTE format('DROP TABLE public.%I CASCADE', r.table_name);
      RAISE NOTICE 'Tabela de outro sistema APAGADA: %', r.table_name;
    ELSE
      RAISE NOTICE 'Tabela de outro sistema encontrada (mantida): %', r.table_name;
    END IF;
  END LOOP;
END $$;

-- 5. Conferência: colunas atuais de cada tabela do app
SELECT table_name AS tabela, string_agg(column_name, ', ' ORDER BY ordinal_position) AS colunas
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name IN (SELECT DISTINCT tbl FROM jvm_padrao)
 GROUP BY table_name
 ORDER BY table_name;

DROP TABLE IF EXISTS pg_temp.jvm_padrao;
