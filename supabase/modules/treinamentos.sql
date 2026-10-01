-- =========================================================================
-- MÓDULO TREINAMENTOS - CERTIFICADOS DE TREINAMENTO (NR-10, NR-35, ...)
--
-- Módulo independente: só cria/altera as tabelas training_* e as funções
-- jvm_training_*. Pode ser executado e alterado sem mexer nos ensaios.
-- Requer o schema.sql da plataforma (empresas, usuários e regras de acesso).
--
-- IDEMPOTENTE: execute no SQL Editor do Supabase DEPOIS do schema.sql,
-- quantas vezes for necessário, sem apagar dados.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Cursos (nome, norma, carga horária, validade, conteúdo programático)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_courses (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  code TEXT,
  name TEXT NOT NULL,
  norm_reference TEXT,
  workload_hours NUMERIC,
  validity_months INTEGER,
  active BOOLEAN DEFAULT TRUE,
  payload JSONB,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  base_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- Instrutores (qualificação, registro profissional e assinatura)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_instructors (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  qualification TEXT,
  registration TEXT,
  active BOOLEAN DEFAULT TRUE,
  payload JSONB,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  base_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- Turmas (curso, datas, local, instrutores e alunos com presença e nota)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_classes (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  class_number TEXT,
  course_id TEXT,
  course_name TEXT,
  client_id TEXT,
  client_name TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT,
  status TEXT DEFAULT 'planejada',
  payload JSONB,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  base_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- Certificados emitidos (um por aluno aprovado ou emissão individual)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_certificates (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  certificate_number TEXT,
  validation_code TEXT,
  class_id TEXT,
  course_id TEXT,
  course_name TEXT,
  participant_name TEXT NOT NULL,
  participant_cpf TEXT,
  participant_company TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'valido',
  payload JSONB,
  device_id TEXT,
  deleted_at TIMESTAMPTZ,
  base_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_courses_company ON public.training_courses (company_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_training_instructors_company ON public.training_instructors (company_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_training_classes_company ON public.training_classes (company_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_training_certificates_company ON public.training_certificates (company_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_training_certificates_expiry ON public.training_certificates (company_id, expiry_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_certificates_code
  ON public.training_certificates (validation_code) WHERE validation_code IS NOT NULL;

-- -------------------------------------------------------------------------
-- Data de alteração definida pelo servidor, conflito entre aparelhos,
-- bloqueio de dados de demonstração e regras de acesso por empresa
-- (as mesmas funções usadas pelas demais tabelas da plataforma)
-- -------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['training_courses','training_instructors','training_classes','training_certificates']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS jvm_set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER jvm_set_updated_at BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS jvm_check_conflict ON public.%I', t);
    EXECUTE format('CREATE TRIGGER jvm_check_conflict BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.jvm_check_conflict()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS jvm_block_demo ON public.%I', t);
    EXECUTE format('CREATE TRIGGER jvm_block_demo BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.jvm_block_demo_data()', t);

    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    -- só quem tem acesso ao módulo Treinamentos (cadastro do usuário)
    EXECUTE format($p$CREATE POLICY jvm_select ON public.%I FOR SELECT TO authenticated
      USING ((company_id = (SELECT public.jvm_my_company()) OR (SELECT public.jvm_is_master()))
             AND (SELECT public.jvm_can_use_module('treinamentos')))$p$, t);
    EXECUTE format($p$CREATE POLICY jvm_insert ON public.%I FOR INSERT TO authenticated
      WITH CHECK ((company_id = (SELECT public.jvm_my_company()) OR (SELECT public.jvm_is_master()))
                  AND (SELECT public.jvm_can_write()) AND (SELECT public.jvm_can_use_module('treinamentos')))$p$, t);
    EXECUTE format($p$CREATE POLICY jvm_update ON public.%I FOR UPDATE TO authenticated
      USING ((company_id = (SELECT public.jvm_my_company()) OR (SELECT public.jvm_is_master()))
             AND (SELECT public.jvm_can_use_module('treinamentos')))
      WITH CHECK ((company_id = (SELECT public.jvm_my_company()) OR (SELECT public.jvm_is_master()))
                  AND (SELECT public.jvm_can_write()) AND (SELECT public.jvm_can_use_module('treinamentos')))$p$, t);
    EXECUTE format($p$CREATE POLICY jvm_delete ON public.%I FOR DELETE TO authenticated
      USING (((company_id = (SELECT public.jvm_my_company()) AND (SELECT public.jvm_is_admin()))
             OR (SELECT public.jvm_is_master())) AND (SELECT public.jvm_can_use_module('treinamentos')))$p$, t);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- NUMERAÇÃO (turmas TUR-AAMM-0001 e certificados TRE-AAMM-0001)
-- Mesma regra dos ensaios: cada aparelho reserva uma faixa quando online.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jvm_training_reserve_numbers(p_kind TEXT, p_period TEXT, p_quantity INTEGER, p_local_max BIGINT DEFAULT 0)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company TEXT := public.jvm_my_company();
  v_kind TEXT;
  v_used BIGINT := 0;
  v_last BIGINT;
BEGIN
  IF v_company IS NULL OR NOT public.jvm_can_write() OR NOT public.jvm_can_use_module('treinamentos') THEN
    RAISE EXCEPTION 'Sem permissão para reservar numeração.' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('class', 'certificate') THEN
    RAISE EXCEPTION 'Tipo de numeração inválido: %', p_kind USING ERRCODE = '22023';
  END IF;
  IF p_period IS NULL OR p_period !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'Período inválido: %', p_period USING ERRCODE = '22023';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 200 THEN
    RAISE EXCEPTION 'Quantidade inválida: %', p_quantity USING ERRCODE = '22023';
  END IF;

  v_kind := 'training_' || p_kind;
  IF p_kind = 'class' THEN
    SELECT COALESCE(max(public.jvm_number_sequence(class_number, p_period)), 0) INTO v_used
      FROM public.training_classes WHERE company_id = v_company;
  ELSE
    SELECT COALESCE(max(public.jvm_number_sequence(certificate_number, p_period)), 0) INTO v_used
      FROM public.training_certificates WHERE company_id = v_company;
  END IF;

  INSERT INTO public.number_sequences (company_id, kind, last_value)
  VALUES (v_company, v_kind, 0)
  ON CONFLICT (company_id, kind) DO NOTHING;

  SELECT last_value INTO v_last
    FROM public.number_sequences
   WHERE company_id = v_company AND kind = v_kind
   FOR UPDATE;

  v_last := GREATEST(v_last, v_used, COALESCE(p_local_max, 0));

  UPDATE public.number_sequences
     SET last_value = v_last + p_quantity, updated_at = NOW()
   WHERE company_id = v_company AND kind = v_kind;

  RETURN json_build_object('start', v_last + 1, 'end', v_last + p_quantity);
END;
$$;

REVOKE ALL ON FUNCTION public.jvm_training_reserve_numbers(TEXT, TEXT, INTEGER, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.jvm_training_reserve_numbers(TEXT, TEXT, INTEGER, BIGINT) TO authenticated;

-- -------------------------------------------------------------------------
-- VALIDAÇÃO PÚBLICA DO CERTIFICADO DE TREINAMENTO (QR Code, sem login)
-- Devolve só os dados impressos no certificado; o CPF sai mascarado (LGPD).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jvm_validar_treinamento(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := upper(trim(COALESCE(p_code, '')));
  t public.training_certificates%ROWTYPE;
  c public.companies%ROWTYPE;
  v_cpf TEXT;
  v_p JSONB;
BEGIN
  IF length(v_code) < 6 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO t FROM public.training_certificates
   WHERE validation_code = v_code AND deleted_at IS NULL
   LIMIT 1;
  IF NOT FOUND THEN
    PERFORM pg_sleep(0.3);
    RETURN NULL;
  END IF;
  SELECT * INTO c FROM public.companies WHERE id = t.company_id;

  v_p := COALESCE(t.payload, '{}'::jsonb);
  v_cpf := regexp_replace(COALESCE(t.participant_cpf, ''), '\D', '', 'g');
  IF length(v_cpf) = 11 THEN
    v_cpf := '***.' || substr(v_cpf, 4, 3) || '.' || substr(v_cpf, 7, 3) || '-**';
  ELSE
    v_cpf := NULL;
  END IF;

  RETURN json_build_object(
    'certificate', jsonb_strip_nulls(jsonb_build_object(
      'certificateNumber', t.certificate_number,
      'validationCode', t.validation_code,
      'participantName', t.participant_name,
      'participantCpfMasked', v_cpf,
      'participantCompany', t.participant_company,
      'courseName', t.course_name,
      'normReference', v_p ->> 'normReference',
      'workloadHours', v_p -> 'workloadHours',
      'modality', v_p ->> 'modality',
      'startDate', v_p ->> 'startDate',
      'endDate', v_p ->> 'endDate',
      'issueDate', t.issue_date,
      'expiryDate', t.expiry_date,
      'status', t.status,
      'cancelReason', v_p ->> 'cancelReason',
      'instructorNames', v_p -> 'instructorNames',
      'technicalResponsibleName', v_p ->> 'technicalResponsibleName'
    )),
    'company', json_build_object('name', c.name, 'legal_name', c.legal_name, 'cnpj', c.cnpj)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.jvm_validar_treinamento(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jvm_validar_treinamento(TEXT) TO anon, authenticated;

-- -------------------------------------------------------------------------
-- CERTIFICADO DIGITAL (A1 .pfx/.p12) DOS INSTRUTORES E DO RT
-- O arquivo e a senha ficam criptografados (pgcrypto) numa tabela que o app
-- NÃO lê diretamente; só as funções abaixo os entregam, conferindo empresa,
-- perfil e acesso ao módulo. Cada uso fica registrado (último uso e por quem).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jvm_private_secrets (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
ALTER TABLE public.jvm_private_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jvm_private_secrets FROM PUBLIC, anon, authenticated;
INSERT INTO public.jvm_private_secrets (name, value)
VALUES ('training_signing_key', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.training_signing_certs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('instructor', 'rt')),
  owner_id TEXT NOT NULL,
  holder_name TEXT,
  holder_doc TEXT,
  issuer TEXT,
  serial TEXT,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  pfx_enc BYTEA NOT NULL,
  password_enc BYTEA NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  last_used_at TIMESTAMPTZ,
  last_used_by UUID
);
-- Dados do certificado ligados à assinatura (titular, ND, emissor, cadeia, política, usos...)
ALTER TABLE public.training_signing_certs ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE public.training_signing_certs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_signing_certs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.jvm_training_signing_key()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.jvm_private_secrets WHERE name = 'training_signing_key'
$$;
REVOKE ALL ON FUNCTION public.jvm_training_signing_key() FROM PUBLIC, anon, authenticated;

-- Cadastrar/trocar: administrador ou Responsável Técnico da empresa
-- (versão anterior, sem os dados do certificado, é substituída)
DROP FUNCTION IF EXISTS public.jvm_training_save_signing_cert(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.jvm_training_save_signing_cert(
  p_owner_type TEXT, p_owner_id TEXT, p_pfx_base64 TEXT, p_password TEXT,
  p_holder_name TEXT, p_holder_doc TEXT, p_issuer TEXT, p_serial TEXT,
  p_valid_from TIMESTAMPTZ, p_valid_to TIMESTAMPTZ, p_details JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company TEXT := public.jvm_my_company();
  v_owner TEXT := CASE WHEN p_owner_type = 'rt' THEN 'rt' ELSE p_owner_id END;
  v_key TEXT := public.jvm_training_signing_key();
BEGIN
  IF v_company IS NULL OR NOT (public.jvm_is_admin() OR public.jvm_my_role() = 'responsavel_tecnico')
     OR NOT public.jvm_can_use_module('treinamentos') THEN
    RAISE EXCEPTION 'Somente o administrador ou o Responsável Técnico cadastra certificados digitais.' USING ERRCODE = '42501';
  END IF;
  IF p_owner_type NOT IN ('instructor', 'rt') THEN
    RAISE EXCEPTION 'Tipo inválido: %', p_owner_type USING ERRCODE = '22023';
  END IF;
  IF p_owner_type = 'instructor' AND NOT EXISTS (
       SELECT 1 FROM public.training_instructors WHERE id = p_owner_id AND company_id = v_company AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Instrutor não encontrado nesta empresa (sincronize e tente de novo).' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_pfx_base64, '') = '' OR length(p_pfx_base64) > 200000 THEN
    RAISE EXCEPTION 'Arquivo do certificado inválido.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_password, '') = '' THEN
    RAISE EXCEPTION 'Informe a senha do certificado.' USING ERRCODE = '22023';
  END IF;
  IF p_details IS NOT NULL AND (jsonb_typeof(p_details) <> 'object' OR length(p_details::text) > 20000) THEN
    RAISE EXCEPTION 'Dados do certificado inválidos.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.training_signing_certs AS t (id, company_id, owner_type, owner_id, holder_name, holder_doc, issuer, serial,
                                                   valid_from, valid_to, details, pfx_enc, password_enc, updated_at, updated_by)
  VALUES (v_company || ':' || p_owner_type || ':' || v_owner, v_company, p_owner_type, v_owner, p_holder_name, p_holder_doc, p_issuer,
          p_serial, p_valid_from, p_valid_to, p_details, extensions.pgp_sym_encrypt(p_pfx_base64, v_key),
          extensions.pgp_sym_encrypt(p_password, v_key), NOW(), auth.uid())
  ON CONFLICT (id) DO UPDATE SET
    holder_name = EXCLUDED.holder_name, holder_doc = EXCLUDED.holder_doc, issuer = EXCLUDED.issuer, serial = EXCLUDED.serial,
    valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, details = EXCLUDED.details, pfx_enc = EXCLUDED.pfx_enc,
    password_enc = EXCLUDED.password_enc, updated_at = NOW(), updated_by = auth.uid();
  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.jvm_training_delete_signing_cert(p_owner_type TEXT, p_owner_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company TEXT := public.jvm_my_company();
BEGIN
  IF v_company IS NULL OR NOT (public.jvm_is_admin() OR public.jvm_my_role() = 'responsavel_tecnico') THEN
    RAISE EXCEPTION 'Somente o administrador ou o Responsável Técnico remove certificados digitais.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.training_signing_certs
   WHERE company_id = v_company AND owner_type = p_owner_type
     AND owner_id = CASE WHEN p_owner_type = 'rt' THEN 'rt' ELSE p_owner_id END;
  RETURN json_build_object('ok', true);
END;
$$;

-- Lista (sem arquivo nem senha): quem tem certificado e a validade
CREATE OR REPLACE FUNCTION public.jvm_training_signing_certs()
RETURNS JSON
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company TEXT := public.jvm_my_company();
BEGIN
  IF v_company IS NULL OR NOT public.jvm_can_use_module('treinamentos') THEN
    RETURN '[]'::json;
  END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'ownerType', owner_type, 'ownerId', owner_id, 'holderName', holder_name, 'holderDoc', holder_doc,
      'issuer', issuer, 'serial', serial, 'validFrom', valid_from, 'validTo', valid_to,
      'updatedAt', updated_at, 'lastUsedAt', last_used_at, 'details', details) ORDER BY owner_type, holder_name)
      FROM public.training_signing_certs WHERE company_id = v_company), '[]'::json);
END;
$$;

-- Arquivo + senha para assinar o PDF: quem emite certificados de treinamento
CREATE OR REPLACE FUNCTION public.jvm_training_signing_material(p_owner_type TEXT, p_owner_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company TEXT := public.jvm_my_company();
  v_key TEXT := public.jvm_training_signing_key();
  r public.training_signing_certs%ROWTYPE;
BEGIN
  IF v_company IS NULL OR NOT public.jvm_can_write() OR NOT public.jvm_can_use_module('treinamentos') THEN
    RAISE EXCEPTION 'Sem permissão para assinar certificados.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.training_signing_certs
   WHERE company_id = v_company AND owner_type = p_owner_type
     AND owner_id = CASE WHEN p_owner_type = 'rt' THEN 'rt' ELSE p_owner_id END;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  UPDATE public.training_signing_certs SET last_used_at = NOW(), last_used_by = auth.uid() WHERE id = r.id;
  RETURN json_build_object(
    'pfx', extensions.pgp_sym_decrypt(r.pfx_enc, v_key),
    'password', extensions.pgp_sym_decrypt(r.password_enc, v_key),
    'holderName', r.holder_name, 'validTo', r.valid_to);
END;
$$;

REVOKE ALL ON FUNCTION public.jvm_training_save_signing_cert(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.jvm_training_delete_signing_cert(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.jvm_training_signing_certs() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.jvm_training_signing_material(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.jvm_training_save_signing_cert(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.jvm_training_delete_signing_cert(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.jvm_training_signing_certs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.jvm_training_signing_material(TEXT, TEXT) TO authenticated;

-- =========================================================================
-- FIM DO MÓDULO TREINAMENTOS
-- =========================================================================
