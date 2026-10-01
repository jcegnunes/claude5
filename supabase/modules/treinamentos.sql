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

-- =========================================================================
-- FIM DO MÓDULO TREINAMENTOS
-- =========================================================================
