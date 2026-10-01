// Testa as regras de segurança de supabase/schema.sql num Postgres em memória
// (PGlite), com versões mínimas dos esquemas auth/storage do Supabase.
// Uso: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = fs.readFileSync(path.join(HERE, '..', 'schema.sql'), 'utf8');
// Banco criado pela versão 6.5 (políticas liberadas + login jvm_login): testa a migração
const OLD_SCHEMA = fs.readFileSync(path.join(HERE, 'fixtures', 'schema_v6.5.sql'), 'utf8');
// Módulos independentes (executados depois do schema.sql)
const MODULES = fs.readdirSync(path.join(HERE, '..', 'modules')).filter(f => f.endsWith('.sql')).sort()
  .map(f => fs.readFileSync(path.join(HERE, '..', 'modules', f), 'utf8')).join('\n');

const STUBS = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA auth, storage, extensions TO anon, authenticated;
CREATE TABLE auth.users (
  instance_id uuid, id uuid PRIMARY KEY, aud text, role text, email text UNIQUE,
  encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb,
  raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
  confirmation_token text, recovery_token text, email_change_token_new text,
  email_change text, banned_until timestamptz);
CREATE TABLE auth.identities (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, provider_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, identity_data jsonb, provider text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
CREATE TABLE auth.sessions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.objects TO anon, authenticated;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
  $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO anon, authenticated;
`;

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

async function newDb() {
  const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });
  await db.exec(STUBS);
  return db;
}

/** Executa como o PostgREST: papel + claims do JWT, numa transação. */
async function as(db, who, sql, params = []) {
  await db.exec('BEGIN');
  try {
    if (who) {
      await db.query(`SELECT set_config('request.jwt.claim.role', $1, true), set_config('request.jwt.claim.sub', $2, true)`,
        [who.role, who.uid || '']);
      await db.exec(`SET LOCAL ROLE ${who.role}`);
    }
    const res = await db.query(sql, params);
    await db.exec('COMMIT');
    return { rows: res.rows, count: res.affectedRows ?? 0 };
  } catch (e) {
    await db.exec('ROLLBACK');
    return { error: e.message };
  }
}
const anon = { role: 'anon' };
const user = uid => ({ role: 'authenticated', uid });
const uidOf = async (db, id) => (await db.query(`SELECT auth_user_id FROM public.users WHERE id = $1`, [id])).rows[0]?.auth_user_id;

async function main() {
  // ---------------------------------------------------------------- banco novo
  const db = await newDb();
  await db.exec(SCHEMA);
  await db.exec(SCHEMA); // idempotente
  ok(true, 'schema.sql executa 2x em banco novo sem erro');
  await db.exec(MODULES);
  await db.exec(MODULES);
  await db.exec(SCHEMA); // o schema da plataforma não desfaz os módulos
  ok(true, 'módulos (supabase/modules) executam 2x sem erro');

  // primeiro usuário (SQL Editor) sem empresa
  await db.exec(`INSERT INTO public.users (id, name, email, username, role, password_hash)
                 VALUES ('usr-a', 'Ana', 'Ana@Empresa1.com', 'ana', 'admin', 'Senha@A1')`);
  const a = await uidOf(db, 'usr-a');
  ok(!!a, 'INSERT com senha cria conta de login e vincula auth_user_id');
  const au = (await db.query(`SELECT email, encrypted_password, (encrypted_password = extensions.crypt('Senha@A1', encrypted_password)) AS pw_ok FROM auth.users WHERE id = $1`, [a])).rows[0];
  ok(au?.email === 'ana@empresa1.com' && au?.pw_ok, 'conta de login: e-mail minúsculo + senha bcrypt igual');
  ok((await db.query(`SELECT count(*)::int n FROM auth.identities WHERE user_id = $1`, [a])).rows[0].n === 1, 'identidade "email" criada');

  // usuário sem senha (técnico só para assinatura) não ganha conta
  await db.exec(`INSERT INTO public.users (id, name, email, role) VALUES ('usr-sem', 'Sem Senha', 'x@sem-email.local', 'tecnico')`);
  ok(!(await uidOf(db, 'usr-sem')), 'usuário sem senha não ganha conta de login');

  // ---------------------------------------------------------- primeiro acesso
  let r = await as(db, user(a), `INSERT INTO public.companies (id, name, cnpj, created_by) VALUES ('comp-1', 'Empresa 1', '1', gen_random_uuid())`);
  ok(!r.error, `usuário sem empresa cadastra a empresa ${r.error || ''}`);
  ok((await db.query(`SELECT created_by FROM public.companies WHERE id='comp-1'`)).rows[0].created_by === a, 'created_by forçado para quem cadastrou');
  r = await as(db, user(a), `UPDATE public.companies SET lab_info = '{"x":1}' WHERE id = 'comp-1'`);
  ok(!r.error && r.count === 1, 'criador altera dados da empresa antes de se vincular');
  await db.exec(`INSERT INTO public.companies (id, name, cnpj) VALUES ('comp-2', 'Empresa 2', '2')`);
  r = await as(db, user(a), `UPDATE public.users SET company_id = 'comp-2' WHERE id = 'usr-a'`);
  ok((await db.query(`SELECT company_id FROM public.users WHERE id='usr-a'`)).rows[0].company_id === null, 'NÃO consegue se vincular a empresa de outra pessoa');
  r = await as(db, user(a), `UPDATE public.users SET company_id = 'comp-1', company_name = 'Empresa 1' WHERE id = 'usr-a'`);
  ok((await db.query(`SELECT company_id FROM public.users WHERE id='usr-a'`)).rows[0].company_id === 'comp-1', 'vincula-se à empresa que cadastrou');
  r = await as(db, user(a), `INSERT INTO public.companies (id, name, cnpj) VALUES ('comp-x', 'Outra', '9')`);
  ok(!!r.error, 'usuário já com empresa NÃO cadastra outra empresa');

  // ------------------------------------------------------- segunda empresa (B)
  await db.exec(`INSERT INTO public.users (id, company_id, name, email, username, role, password_hash)
                 VALUES ('usr-b', 'comp-2', 'Bruno', 'bruno@empresa2.com', 'bruno', 'tecnico', 'Senha@B1')`);
  const b = await uidOf(db, 'usr-b');
  await as(db, user(a), `INSERT INTO public.clients (id, company_id, razao_social, cnpj) VALUES ('cli-1', 'comp-1', 'Cliente da 1', '11')`);
  r = await as(db, user(b), `INSERT INTO public.clients (id, company_id, razao_social, cnpj) VALUES ('cli-2', 'comp-2', 'Cliente da 2', '22')`);
  ok(!r.error, 'técnico grava cliente da própria empresa');
  r = await as(db, user(b), `SELECT id FROM public.clients`);
  ok(r.rows.length === 1 && r.rows[0].id === 'cli-2', 'técnico só enxerga clientes da própria empresa');
  r = await as(db, user(b), `INSERT INTO public.clients (id, company_id, razao_social, cnpj) VALUES ('cli-3', 'comp-1', 'Invasão', '33')`);
  ok(!!r.error, 'técnico NÃO grava dados em outra empresa');
  r = await as(db, user(b), `INSERT INTO public.clients (id, company_id, razao_social, cnpj) VALUES ('cli-1', 'comp-2', 'Sequestro', '33')
                             ON CONFLICT (id) DO UPDATE SET razao_social = EXCLUDED.razao_social, company_id = EXCLUDED.company_id`);
  ok(!!r.error || (await db.query(`SELECT razao_social FROM public.clients WHERE id='cli-1'`)).rows[0].razao_social === 'Cliente da 1',
    'upsert com ID de outra empresa NÃO sobrescreve o registro');
  r = await as(db, user(b), `UPDATE public.clients SET razao_social = 'x' WHERE id = 'cli-1'`);
  ok(!r.error && r.count === 0, 'UPDATE em registro de outra empresa não afeta nada');
  r = await as(db, user(b), `SELECT id FROM public.users`);
  ok(r.rows.every(x => x.id === 'usr-b'), 'técnico só enxerga usuários da própria empresa');
  r = await as(db, user(b), `SELECT password_hash FROM public.users`);
  ok(!!r.error, 'coluna password_hash não pode ser lida');
  r = await as(db, user(b), `UPDATE public.users SET password_hash = 'x' WHERE id = 'usr-b'`);
  ok(!!r.error, 'coluna password_hash não pode ser gravada');

  // escalada de privilégio
  await as(db, user(b), `UPDATE public.users SET role = 'admin', is_master_admin = true, active = true, email = 'hack@x.com' WHERE id = 'usr-b'`);
  const bRow = (await db.query(`SELECT role, is_master_admin, email FROM public.users WHERE id='usr-b'`)).rows[0];
  ok(bRow.role === 'tecnico' && bRow.is_master_admin === false && bRow.email === 'bruno@empresa2.com', 'técnico NÃO se promove a admin/master nem troca e-mail');
  await as(db, user(b), `INSERT INTO public.users (id, company_id, name, email, role, is_master_admin) VALUES ('usr-fake', 'comp-2', 'Fake', 'fake@x.com', 'admin', true)`);
  const fake = (await db.query(`SELECT role, is_master_admin, auth_user_id FROM public.users WHERE id='usr-fake'`)).rows[0];
  ok(fake && fake.role === 'tecnico' && !fake.is_master_admin && !fake.auth_user_id, 'técnico cria colega, mas sem admin/master e sem conta de login');
  r = await as(db, user(b), `UPDATE public.users SET signature_url = 'data:assinatura' WHERE id = 'usr-fake'`);
  ok(!r.error && r.count === 1, 'técnico atualiza assinatura de colega da mesma empresa');
  r = await as(db, user(b), `UPDATE public.users SET name = 'x' WHERE id = 'usr-a'`);
  ok(!r.error && r.count === 0, 'técnico NÃO altera usuário de outra empresa');

  // ------------------------------------------------------- chave pública (anon)
  for (const t of ['companies', 'users', 'clients', 'test_records', 'norms', 'audit_logs']) {
    r = await as(db, anon, `SELECT * FROM public.${t} LIMIT 1`);
    ok(!!r.error, `anon NÃO lê ${t}`);
  }
  r = await as(db, anon, `INSERT INTO public.users (id, name, email, role, is_master_admin) VALUES ('usr-h', 'H', 'h@h.com', 'admin', true)`);
  ok(!!r.error, 'anon NÃO cria usuário (ataque do admin falso)');
  r = await as(db, anon, `SELECT public.jvm_login_email('bruno') AS e`);
  ok(r.rows?.[0]?.e === 'bruno@empresa2.com', 'login por nome de usuário devolve o e-mail');
  r = await as(db, anon, `SELECT public.jvm_login_email('ninguem@x.com') AS e`);
  ok(r.rows?.[0]?.e === 'ninguem@x.com', 'login por e-mail não revela se a conta existe');
  r = await as(db, anon, `SELECT public.jvm_me()`);
  ok(!!r.error, 'anon não chama jvm_me');
  r = await as(db, anon, `SELECT public.jvm_my_company()`);
  ok(!!r.error, 'anon não chama funções auxiliares');

  // perfil do logado
  r = await as(db, user(b), `SELECT public.jvm_me() AS me`);
  const me = typeof r.rows[0].me === 'string' ? JSON.parse(r.rows[0].me) : r.rows[0].me;
  ok(me.ok && me.user.id === 'usr-b' && !('password_hash' in me.user), 'jvm_me devolve o perfil sem a senha');

  // ------------------------------------------------------ portal de validação
  r = await as(db, user(b), `INSERT INTO public.test_records (id, company_id, uuid, test_number, report_number, validation_code, document_hash, client_name, equipment_tag, equipment_type, equipment_class, test_date, norm_code, applied_class, applied_voltage_kv, application_duration_seconds, measured_leakage_current_ma, leakage_current_limit_ma, result, payload)
                         VALUES ('t-1', 'comp-2', 'u-1', 'ENS-0001', 'LAU-0001', 'VAL-JVM-2609-ABCD2345', 'h', 'Cliente', 'TAG1', 'luva', '0', '2026-09-28', 'NBR 10622', '0', 5, 60, 1, 8, 'APROVADO', '{}')`);
  if (r.error) console.log('   erro ao gravar ensaio:', r.error);
  r = await as(db, anon, `SELECT public.jvm_validar_certificado('val-jvm-2609-abcd2345') AS v`);
  const v = typeof r.rows?.[0]?.v === 'string' ? JSON.parse(r.rows[0].v) : r.rows?.[0]?.v;
  ok(v?.test?.id === 't-1' && v?.company?.id === 'comp-2', 'portal encontra o certificado pelo código (anon)');
  r = await as(db, anon, `SELECT public.jvm_validar_certificado('ENS-0001') AS v`);
  ok(r.rows?.[0]?.v === null, 'portal NÃO aceita número sequencial de ensaio');

  // Portal devolve só os dados do certificado (LGPD)
  const payloadCompleto = {
    id: 't-2', reportNumber: 'LAU-PORTAL', certificateNumber: 'CERT-PORTAL', validationCode: 'VAL-JVM-2609-SENS1234',
    clientName: 'Cliente', equipmentTag: 'TAG2', result: 'APROVADO', techResponsibleName: 'Eng. RT',
    collaboratorName: 'José da Silva', collaboratorRegistration: 'MAT-555', technicalNotes: 'observação interna',
    photos: [{ id: 'f', url: 'data:image/jpeg;base64,AAAA' }], clientSignature: { signatureImage: 'data:x' },
    measuredLeakageCurrent_mA: 3.2, instrumentsUsed: [{ id: 'hipot' }]
  };
  r = await as(db, user(b), `INSERT INTO public.test_records (id, company_id, uuid, test_number, report_number, certificate_number, validation_code, document_hash, client_name, equipment_tag, equipment_type, equipment_class, test_date, norm_code, applied_class, applied_voltage_kv, application_duration_seconds, measured_leakage_current_ma, leakage_current_limit_ma, result, collaborator_name, technical_notes, photos, client_signature, tech_responsible_signature, payload)
    VALUES ('t-2', 'comp-2', 'u-2', 'ENS-PORTAL', 'LAU-PORTAL', 'CERT-PORTAL', 'VAL-JVM-2609-SENS1234', 'h', 'Cliente', 'TAG2', 'luva', '0', '2026-09-28', 'NBR 16295', '0', 5, 60, 3.2, 24, 'APROVADO',
            'José da Silva', 'observação interna', '[{"url":"data:image/jpeg;base64,AAAA"}]', '{"signatureImage":"data:x"}', '{"signatureImage":"data:rt"}', $1)`, [JSON.stringify(payloadCompleto)]);
  if (r.error) console.log('   erro ao gravar ensaio 2:', r.error);
  r = await as(db, anon, `SELECT public.jvm_validar_certificado('VAL-JVM-2609-SENS1234') AS v`);
  const pub = typeof r.rows?.[0]?.v === 'string' ? JSON.parse(r.rows[0].v) : r.rows?.[0]?.v;
  const pubText = JSON.stringify(pub || {});
  ok(pub?.test?.payload?.certificateNumber === 'CERT-PORTAL' && pub?.test?.payload?.result === 'APROVADO' && pub?.test?.payload?.techResponsibleName === 'Eng. RT',
    'portal devolve os dados do certificado');
  ok(!!pub?.test?.tech_responsible_signature, 'portal devolve a assinatura do RT (impressa no certificado)');
  ok(!/José da Silva|MAT-555|observação interna|signatureImage":"data:x|base64,AAAA|hipot/.test(pubText),
    'portal NÃO devolve colaborador, fotos, assinatura do cliente, instrumentos nem observações internas');
  ok(pub?.test?.payload?.measuredLeakageCurrent_mA === undefined, 'portal NÃO devolve as medições detalhadas');

  // ------------------------------------------------- módulo treinamentos
  r = await as(db, user(b), `INSERT INTO public.training_courses (id, company_id, name, workload_hours, validity_months, payload)
                            VALUES ('crs-1', 'comp-2', 'NR-10 Básico', 40, 24, '{}')`);
  ok(!r.error, `treinamentos: técnico cadastra curso da própria empresa ${r.error || ''}`);
  r = await as(db, user(b), `INSERT INTO public.training_courses (id, company_id, name) VALUES ('crs-x', 'comp-1', 'Invasão')`);
  ok(!!r.error, 'treinamentos: NÃO grava curso em outra empresa');
  r = await as(db, user(a), `SELECT id FROM public.training_courses`);
  ok(r.rows.length === 0, 'treinamentos: outra empresa não enxerga os cursos');
  for (const t of ['training_courses', 'training_instructors', 'training_classes', 'training_certificates']) {
    r = await as(db, anon, `SELECT * FROM public.${t} LIMIT 1`);
    ok(!!r.error, `anon NÃO lê ${t}`);
  }
  const certPayload = { normReference: 'NR-10', workloadHours: 40, startDate: '2026-10-01', endDate: '2026-10-05',
    instructorNames: ['Instrutor Um'], participantPhone: '(11) 99999-0000', grade: 9.5, attendance: 100 };
  r = await as(db, user(b), `INSERT INTO public.training_certificates (id, company_id, certificate_number, validation_code, course_name, participant_name, participant_cpf, participant_company, issue_date, expiry_date, status, payload)
    VALUES ('tc-1', 'comp-2', 'TRE-2610-0001', 'VAL-TRE-2610-ABCD2345', 'NR-10 Básico', 'Maria Souza', '123.456.789-01', 'Cliente X', '2026-10-05', '2028-10-05', 'valido', $1)`, [JSON.stringify(certPayload)]);
  ok(!r.error, `treinamentos: técnico emite certificado ${r.error || ''}`);
  r = await as(db, user(b), `INSERT INTO public.training_certificates (id, company_id, validation_code, participant_name) VALUES ('tc-2', 'comp-2', 'VAL-TRE-2610-ABCD2345', 'Outro')`);
  ok(!!r.error, 'treinamentos: código de validação não se repete');
  r = await as(db, anon, `SELECT public.jvm_validar_treinamento('val-tre-2610-abcd2345') AS v`);
  const tv = typeof r.rows?.[0]?.v === 'string' ? JSON.parse(r.rows[0].v) : r.rows?.[0]?.v;
  const tvText = JSON.stringify(tv || {});
  ok(tv?.certificate?.participantName === 'Maria Souza' && tv?.certificate?.courseName === 'NR-10 Básico' && tv?.company?.name === 'Empresa 2',
    'portal valida o certificado de treinamento (anon)');
  ok(tv?.certificate?.participantCpfMasked === '***.456.789-**' && !tvText.includes('123.456') && !tvText.includes('12345678901'),
    'portal mostra o CPF mascarado (LGPD)');
  ok(!/99999-0000|"grade"|"attendance"/.test(tvText), 'portal NÃO devolve telefone, nota nem presença');
  r = await as(db, anon, `SELECT public.jvm_validar_treinamento('TRE-2610-0001') AS v`);
  ok(r.rows?.[0]?.v === null, 'portal NÃO aceita o número sequencial do certificado');
  r = await as(db, user(b), `SELECT public.jvm_training_reserve_numbers('certificate', '2610', 10, 0) AS v`);
  const rn = typeof r.rows?.[0]?.v === 'string' ? JSON.parse(r.rows[0].v) : r.rows?.[0]?.v;
  ok(rn?.start === 2 && rn?.end === 11, `numeração de certificados continua após os já emitidos ${JSON.stringify(rn || r.error)}`);
  r = await as(db, user(b), `SELECT public.jvm_training_reserve_numbers('certificate', '2610', 5, 0) AS v`);
  const rn2 = typeof r.rows?.[0]?.v === 'string' ? JSON.parse(r.rows[0].v) : r.rows?.[0]?.v;
  ok(rn2?.start === 12, 'segunda reserva não repete números');
  r = await as(db, anon, `SELECT public.jvm_training_reserve_numbers('certificate', '2610', 5, 0) AS v`);
  ok(!!r.error, 'anon NÃO reserva numeração de treinamentos');
  r = await as(db, user(b), `DELETE FROM public.training_certificates WHERE id = 'tc-1'`);
  ok(!r.error && r.count === 0, 'técnico NÃO apaga certificado (só administrador)');

  // ------------------------------------------------- acesso por módulo
  r = await as(db, user(b), `UPDATE public.users SET allowed_modules = '{ensaios,treinamentos}' WHERE id = 'usr-b'`);
  await as(db, user(b), `UPDATE public.users SET allowed_modules = '{treinamentos}' WHERE id = 'usr-b'`);
  ok((await db.query(`SELECT allowed_modules FROM public.users WHERE id='usr-b'`)).rows[0].allowed_modules === null,
    'técnico NÃO altera os próprios módulos liberados');
  await db.exec(`UPDATE public.users SET allowed_modules = '{treinamentos}' WHERE id = 'usr-b'`);
  r = await as(db, user(b), `SELECT id FROM public.test_records`);
  ok(!r.error && r.rows.length === 0, 'usuário só de Treinamentos NÃO enxerga os ensaios');
  r = await as(db, user(b), `INSERT INTO public.equipment (id, company_id, uuid, type, tag) VALUES ('eq-mod', 'comp-2', 'u-mod', 'luva', 'T-MOD')`);
  ok(!!r.error, 'usuário só de Treinamentos NÃO grava equipamentos');
  r = await as(db, user(b), `SELECT public.jvm_reserve_numbers('test', '2610', 5, 0) AS v`);
  ok(!!r.error, 'usuário só de Treinamentos NÃO reserva numeração de ensaios');
  r = await as(db, user(b), `SELECT id FROM public.clients`);
  ok(!r.error && r.rows.some(x => x.id === 'cli-2'), 'clientes continuam visíveis (comuns aos módulos)');
  r = await as(db, user(b), `SELECT id FROM public.training_courses`);
  ok(!r.error && r.rows.some(x => x.id === 'crs-1'), 'usuário só de Treinamentos enxerga os cursos');
  await db.exec(`UPDATE public.users SET allowed_modules = '{ensaios}' WHERE id = 'usr-b'`);
  r = await as(db, user(b), `SELECT id FROM public.training_courses`);
  ok(!r.error && r.rows.length === 0, 'usuário só de Ensaios NÃO enxerga os treinamentos');
  r = await as(db, user(b), `INSERT INTO public.training_courses (id, company_id, name) VALUES ('crs-mod', 'comp-2', 'X')`);
  ok(!!r.error, 'usuário só de Ensaios NÃO grava cursos');
  r = await as(db, user(b), `SELECT public.jvm_training_reserve_numbers('certificate', '2610', 5, 0) AS v`);
  ok(!!r.error, 'usuário só de Ensaios NÃO reserva numeração de certificados de treinamento');
  r = await as(db, user(b), `SELECT id FROM public.test_records`);
  ok(!r.error && r.rows.length > 0, 'usuário só de Ensaios enxerga os ensaios');
  r = await as(db, user(b), `INSERT INTO public.equipment (id, company_id, uuid, type, tag) VALUES ('eq-mod', 'comp-2', 'u-mod', 'luva', 'T-MOD')`);
  ok(!r.error, `usuário de Ensaios grava equipamentos ${r.error || ''}`);
  r = await as(db, user(b), `SELECT allowed_modules FROM public.users WHERE id = 'usr-b'`);
  ok(!r.error && JSON.stringify(r.rows[0].allowed_modules) === '["ensaios"]', 'o app lê os módulos liberados do usuário');
  await db.exec(`UPDATE public.users SET allowed_modules = NULL WHERE id = 'usr-b'`);

  // ------------------------------------------ certificado digital (A1)
  await db.exec(`INSERT INTO public.training_instructors (id, company_id, name) VALUES ('ins-dig', 'comp-2', 'Instrutor Digital')`);
  const saveSql = `SELECT public.jvm_training_save_signing_cert('instructor', 'ins-dig', 'UEZYLUJBU0U2NA==', 'SenhaPFX123', 'INSTRUTOR DIGITAL', '22222222222', 'AC TESTE', '01', now(), now() + interval '1 year') AS v`;
  r = await as(db, user(b), saveSql);
  ok(!!r.error, 'técnico NÃO cadastra certificado digital');
  await db.exec(`UPDATE public.users SET role = 'responsavel_tecnico' WHERE id = 'usr-b'`);
  r = await as(db, user(b), saveSql);
  ok(!r.error, `Responsável Técnico cadastra o certificado digital do instrutor ${r.error || ''}`);
  r = await as(db, user(b), `SELECT public.jvm_training_save_signing_cert('instructor', 'ins-outra', 'QQ==', 'x', 'X', '', '', '', now(), now()) AS v`);
  ok(!!r.error, 'NÃO cadastra certificado para instrutor de outra empresa/inexistente');
  const enc = (await db.query(`SELECT encode(pfx_enc, 'escape') AS f, encode(password_enc, 'escape') AS s FROM public.training_signing_certs WHERE owner_id = 'ins-dig'`)).rows[0];
  ok(enc && !enc.s.includes('SenhaPFX123') && !enc.f.includes('UEZYLUJBU0U2NA'), 'arquivo e senha ficam criptografados no banco');
  r = await as(db, user(b), `SELECT * FROM public.training_signing_certs`);
  ok(!!r.error, 'a tabela de certificados digitais NÃO é lida diretamente');
  r = await as(db, user(b), `SELECT * FROM public.jvm_private_secrets`);
  ok(!!r.error, 'a chave de criptografia NÃO é lida');
  r = await as(db, user(b), `SELECT public.jvm_training_signing_key() AS k`);
  ok(!!r.error, 'a função da chave NÃO pode ser chamada pelo app');
  r = await as(db, user(b), `SELECT public.jvm_training_signing_certs() AS v`);
  const list = typeof r.rows?.[0]?.v === 'string' ? JSON.parse(r.rows[0].v) : r.rows?.[0]?.v;
  ok(Array.isArray(list) && list.length === 1 && list[0].holderName === 'INSTRUTOR DIGITAL' && !JSON.stringify(list).includes('SenhaPFX123') && !('pfx' in list[0]),
    'lista mostra titular e validade, sem arquivo nem senha');
  await db.exec(`UPDATE public.users SET role = 'tecnico' WHERE id = 'usr-b'`);
  r = await as(db, user(b), `SELECT public.jvm_training_signing_material('instructor', 'ins-dig') AS v`);
  const mat = typeof r.rows?.[0]?.v === 'string' ? JSON.parse(r.rows[0].v) : r.rows?.[0]?.v;
  ok(mat?.pfx === 'UEZYLUJBU0U2NA==' && mat?.password === 'SenhaPFX123', 'quem emite certificados recebe arquivo e senha para assinar');
  ok(!!(await db.query(`SELECT last_used_at FROM public.training_signing_certs WHERE owner_id = 'ins-dig'`)).rows[0].last_used_at, 'uso do certificado fica registrado');
  r = await as(db, user(a), `SELECT public.jvm_training_signing_material('instructor', 'ins-dig') AS v`);
  ok(!r.error && r.rows[0].v === null, 'outra empresa NÃO obtém o certificado digital');
  r = await as(db, anon, `SELECT public.jvm_training_signing_material('instructor', 'ins-dig') AS v`);
  ok(!!r.error, 'anon NÃO obtém o certificado digital');
  await db.exec(`UPDATE public.users SET allowed_modules = '{ensaios}' WHERE id = 'usr-b'`);
  r = await as(db, user(b), `SELECT public.jvm_training_signing_material('instructor', 'ins-dig') AS v`);
  ok(!!r.error, 'usuário sem o módulo Treinamentos NÃO obtém o certificado digital');
  await db.exec(`UPDATE public.users SET allowed_modules = NULL WHERE id = 'usr-b'`);
  r = await as(db, user(b), `SELECT public.jvm_training_delete_signing_cert('instructor', 'ins-dig') AS v`);
  ok(!!r.error, 'técnico NÃO remove certificado digital');

  // ---------------------------------------------------------------- perfis
  await db.exec(`INSERT INTO public.users (id, company_id, name, email, role, password_hash) VALUES ('usr-c', 'comp-2', 'Cli', 'cli@x.com', 'cliente', 'Senha@C1')`);
  const c = await uidOf(db, 'usr-c');
  r = await as(db, user(c), `SELECT id FROM public.clients`);
  ok(r.rows?.length === 1, 'perfil cliente consulta dados da empresa');
  r = await as(db, user(c), `INSERT INTO public.clients (id, company_id, razao_social, cnpj) VALUES ('cli-9', 'comp-2', 'x', '9')`);
  ok(!!r.error, 'perfil cliente NÃO grava');
  // ------------------------------------------------------ normas por empresa
  await db.exec(`INSERT INTO public.norms (id, norm_id, norm_code, payload) VALUES ('norm-luva-0', 'norm-luva-0', 'NBR 16295', '{"limite": 12}')`);
  r = await as(db, user(b), `SELECT id FROM public.norms`);
  ok(r.rows?.some(x => x.id === 'norm-luva-0'), 'norma oficial visível para todas as empresas');
  r = await as(db, user(b), `INSERT INTO public.norms (id, norm_id, company_id, payload) VALUES ('comp-2::norm-luva-0', 'norm-luva-0', 'comp-2', '{}')`);
  ok(!!r.error, 'técnico NÃO altera normas');
  r = await as(db, user(a), `UPDATE public.norms SET payload = '{"limite": 99}' WHERE id = 'norm-luva-0'`);
  ok(!r.error && r.count === 0, 'admin NÃO altera a norma oficial (vale para todas)');
  r = await as(db, user(a), `INSERT INTO public.norms (id, norm_id, company_id, payload) VALUES ('norm-luva-0', 'norm-luva-0', 'comp-1', '{"limite": 99}')
                             ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, company_id = EXCLUDED.company_id`);
  ok((await db.query(`SELECT payload->>'limite' AS l, company_id FROM public.norms WHERE id = 'norm-luva-0'`)).rows[0].l === '12',
    'upsert com o id da oficial NÃO altera a norma oficial');
  r = await as(db, user(a), `INSERT INTO public.norms (id, norm_id, company_id, payload) VALUES ('comp-1::norm-luva-0', 'norm-luva-0', 'comp-1', '{"limite": 20}')`);
  ok(!r.error, 'admin grava a versão da própria empresa');
  r = await as(db, user(a), `UPDATE public.norms SET payload = '{"limite": 22}' WHERE id = 'comp-1::norm-luva-0'`);
  ok(!r.error && r.count === 1, 'admin edita de novo a versão da própria empresa');
  r = await as(db, user(a), `INSERT INTO public.norms (id, norm_id, company_id, payload) VALUES ('comp-2::norm-luva-0', 'norm-luva-0', 'comp-2', '{}')`);
  ok(!!r.error, 'admin NÃO grava versão de norma para outra empresa');
  r = await as(db, user(b), `SELECT id FROM public.norms WHERE norm_id = 'norm-luva-0'`);
  ok(r.rows?.length === 1 && r.rows[0].id === 'norm-luva-0', 'outra empresa NÃO vê a versão editada (continua com a oficial)');
  r = await as(db, user(a), `SELECT id FROM public.norms WHERE norm_id = 'norm-luva-0' ORDER BY id`);
  ok(r.rows?.length === 2, 'empresa que editou vê a oficial e a sua versão');
  ok((await db.query(`SELECT payload->>'limite' AS l FROM public.norms WHERE id = 'norm-luva-0'`)).rows[0].l === '12', 'norma oficial permanece inalterada');
  r = await as(db, user(b), `INSERT INTO public.audit_logs (id, company_id, payload) VALUES ('a-1', 'comp-2', '{}')`);
  ok(!r.error, 'auditoria gravada pela empresa');
  r = await as(db, user(b), `UPDATE public.audit_logs SET description = 'x'`);
  ok(!!r.error, 'auditoria não pode ser alterada');
  r = await as(db, user(b), `DELETE FROM public.clients WHERE id = 'cli-2'`);
  ok(!r.error && r.count === 0, 'técnico não apaga fisicamente registros');

  // --------------------------------------------------------------- Storage
  r = await as(db, user(b), `INSERT INTO storage.objects (bucket_id, name) VALUES ('jvm-evidencias', 'comp-2/t-1/foto.jpg')`);
  ok(!r.error, 'foto na pasta da própria empresa');
  r = await as(db, user(b), `INSERT INTO storage.objects (bucket_id, name) VALUES ('jvm-evidencias', 'comp-1/t-1/foto.jpg')`);
  ok(!!r.error, 'foto NÃO vai para pasta de outra empresa');
  // câmera remota: o computador logado abre a sessão; o celular (anon) só envia para ela
  r = await as(db, user(b), `SELECT public.jvm_open_camera_session('JVM-CAM-ABCDEFGH2345') AS e`);
  ok(!r.error && !!r.rows[0].e, `usuário logado abre sessão de câmera (${r.error || 'ok'})`);
  r = await as(db, anon, `INSERT INTO storage.objects (bucket_id, name) VALUES ('jvm-evidencias', 'camera-remota/JVM-CAM-ABCDEFGH2345/f.jpg')`);
  ok(!r.error, 'câmera remota (anon) envia para a sessão aberta');
  r = await as(db, anon, `INSERT INTO storage.objects (bucket_id, name) VALUES ('jvm-evidencias', 'camera-remota/JVM-CAM-QQQQQQQQQQQQ/f.jpg')`);
  ok(!!r.error, 'câmera remota (anon) NÃO envia para sessão que não foi aberta');
  r = await as(db, anon, `SELECT public.jvm_open_camera_session('JVM-CAM-ZZZZZZZZZZZZ')`);
  ok(!!r.error, 'anon NÃO abre sessão de câmera');
  r = await as(db, user(b), `SELECT public.jvm_open_camera_session('JVM-CAM-1')`);
  ok(!!r.error, 'código de sessão fraco é recusado');
  await db.exec(`UPDATE public.camera_sessions SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = 'JVM-CAM-ABCDEFGH2345'`);
  r = await as(db, anon, `INSERT INTO storage.objects (bucket_id, name) VALUES ('jvm-evidencias', 'camera-remota/JVM-CAM-ABCDEFGH2345/g.jpg')`);
  ok(!!r.error, 'câmera remota NÃO envia depois que a sessão vence');
  r = await as(db, anon, `SELECT * FROM public.camera_sessions`);
  ok(!!r.error, 'tabela de sessões não é lida pela chave pública');
  r = await as(db, anon, `INSERT INTO storage.objects (bucket_id, name) VALUES ('jvm-evidencias', 'comp-2/x.jpg')`);
  ok(!!r.error, 'anon NÃO envia fora de camera-remota/');
  r = await as(db, anon, `SELECT name FROM storage.objects`);
  ok(!r.error && r.rows.length === 0, 'anon NÃO lista as fotos');
  ok((await db.query(`SELECT file_size_limit, allowed_mime_types FROM storage.buckets WHERE id='jvm-evidencias'`)).rows[0].file_size_limit === 10485760, 'bucket com limite de tamanho');

  // ------------------------------------------------------ administração no SQL
  await db.exec(`UPDATE public.users SET password_hash = 'NovaSenha@B2' WHERE id = 'usr-b'`);
  ok((await db.query(`SELECT encrypted_password = extensions.crypt('NovaSenha@B2', encrypted_password) AS ok FROM auth.users WHERE id = $1`, [b])).rows[0].ok, 'troca de senha no SQL atualiza a conta de login');
  await db.exec(`INSERT INTO auth.sessions (user_id) VALUES ('${b}')`);
  await db.exec(`UPDATE public.users SET active = false WHERE id = 'usr-b'`);
  const ban = (await db.query(`SELECT banned_until, (SELECT count(*)::int FROM auth.sessions WHERE user_id = $1) AS s FROM auth.users WHERE id = $1`, [b])).rows[0];
  ok(ban.banned_until !== null && ban.s === 0, 'bloquear usuário bane a conta e encerra sessões');
  r = await as(db, user(b), `SELECT id FROM public.clients`);
  ok(r.rows?.length === 0, 'usuário bloqueado deixa de ver os dados imediatamente');
  await db.exec(`UPDATE public.users SET active = true WHERE id = 'usr-b'`);
  ok((await db.query(`SELECT banned_until FROM auth.users WHERE id = $1`, [b])).rows[0].banned_until === null, 'desbloquear libera a conta');

  // admin da empresa bloqueia técnico pelo app
  await db.exec(`INSERT INTO public.users (id, company_id, name, email, role, password_hash) VALUES ('usr-a2', 'comp-2', 'Adm2', 'adm2@x.com', 'admin', 'Senha@D1')`);
  const a2 = await uidOf(db, 'usr-a2');
  r = await as(db, user(a2), `UPDATE public.users SET active = false WHERE id = 'usr-b'`);
  ok(!r.error && (await db.query(`SELECT banned_until FROM auth.users WHERE id = $1`, [b])).rows[0].banned_until !== null, 'admin da empresa bloqueia técnico pelo app');
  r = await as(db, user(a2), `UPDATE public.norms SET payload = '{"limite": 1}' WHERE id = 'comp-1::norm-luva-0'`);
  ok(!r.error && r.count === 0, 'admin de outra empresa NÃO altera a versão da empresa 1');
  r = await as(db, user(a2), `INSERT INTO public.norms (id, norm_id, company_id, payload, deleted_at) VALUES ('comp-2::norm-luva-0', 'norm-luva-0', 'comp-2', '{}', NOW())`);
  ok(!r.error, 'empresa 2 exclui a norma só para ela (versão com deleted_at)');
  ok((await db.query(`SELECT deleted_at FROM public.norms WHERE id = 'norm-luva-0'`)).rows[0].deleted_at === null, 'exclusão da empresa 2 NÃO apaga a oficial');
  r = await as(db, user(a2), `UPDATE public.users SET is_master_admin = true WHERE id = 'usr-a2'`);
  ok(!(await db.query(`SELECT is_master_admin FROM public.users WHERE id='usr-a2'`)).rows[0].is_master_admin, 'admin da empresa NÃO vira master');

  // ------------------------------------------------------ numeração (faixas)
  const reserve = async (who, kind, qty, localMax = 0) => {
    const res = await as(db, who, `SELECT public.jvm_reserve_numbers($1, '2609', $2, $3) AS r`, [kind, qty, localMax]);
    if (res.error) return { error: res.error };
    const v = res.rows[0].r;
    return typeof v === 'string' ? JSON.parse(v) : v;
  };
  // comp-2 já tem o ensaio 'ENS-0001' / 'LAU-0001' (sequência 1)
  let f1 = await reserve(user(a2), 'test', 30);
  ok(f1.start === 2 && f1.end === 31, `reserva começa após o maior número já gravado (${JSON.stringify(f1)})`);
  let f2 = await reserve(user(a2), 'test', 30);
  ok(f2.start === 32 && f2.end === 61, 'segunda reserva não se sobrepõe à primeira');
  let f3 = await reserve(user(a2), 'test', 10, 100);
  ok(f3.start === 101, 'considera o maior número já usado no aparelho');
  let f4 = await reserve(user(a), 'test', 5);
  ok(f4.start === 1 && f4.end === 5, 'cada empresa tem a própria sequência');
  let f5 = await reserve(user(a2), 'report', 5);
  ok(f5.start === 2, 'cada tipo (laudo, ensaio...) tem a própria sequência');
  await as(db, user(a2), `INSERT INTO public.service_orders (id, company_id, os_number, client_name) VALUES ('os-1', 'comp-2', 'OS-2608-0045', 'x')`);
  let f6 = await reserve(user(a2), 'os', 3);
  ok(f6.start === 46, 'sequência contínua entre meses (OS-2608-0045 -> 46)');
  ok(!!(await reserve(user(c), 'test', 5)).error, 'perfil cliente NÃO reserva numeração');
  ok(!!(await reserve(anon, 'test', 5)).error, 'anon NÃO reserva numeração');
  ok(!!(await reserve(user(a2), 'xyz', 5)).error, 'tipo de numeração inválido é recusado');
  ok(!!(await reserve(user(a2), 'test', 5000)).error, 'quantidade exagerada é recusada');
  r = await as(db, user(a2), `SELECT * FROM public.number_sequences`);
  ok(!!r.error, 'tabela de sequências não é acessada diretamente');

  // ------------------------------------------------ conflito de edição (JV409)
  const version = async id => (await db.query(`SELECT updated_at::text AS v FROM public.clients WHERE id = $1`, [id])).rows[0].v;
  const push = (device, base, name) => as(db, user(a2),
    `INSERT INTO public.clients (id, company_id, razao_social, cnpj, device_id, base_updated_at)
     VALUES ('cli-2', 'comp-2', $1, '22', $2, $3::timestamptz)
     ON CONFLICT (id) DO UPDATE SET razao_social = EXCLUDED.razao_social, device_id = EXCLUDED.device_id,
       base_updated_at = EXCLUDED.base_updated_at`, [name, device, base]);
  r = await push('DEV-A', null, 'Versão A1');
  ok(!r.error, 'envio sem versão de base (registro antigo) é aceito');
  const t1 = await version('cli-2');
  r = await push('DEV-B', t1, 'Versão B1');
  ok(!r.error, 'edição baseada na versão atual do servidor é aceita');
  r = await push('DEV-A', t1, 'Versão A2 (desatualizada)');
  ok(!!r.error && /JV409|Conflito/.test(r.error), `edição baseada em versão antiga, vinda de OUTRO aparelho, é recusada (${r.error || 'sem erro'})`);
  ok((await db.query(`SELECT razao_social FROM public.clients WHERE id = 'cli-2'`)).rows[0].razao_social === 'Versão B1', 'versão do outro aparelho é preservada');
  r = await push('DEV-B', t1, 'Versão B2');
  ok(!r.error, 'o mesmo aparelho que gravou por último pode continuar editando');
  const t3 = await version('cli-2');
  r = await push('DEV-A', t3, 'Versão A3 (escolhida no conflito)');
  ok(!r.error, 'após resolver o conflito (base = versão atual), a gravação é aceita');
  ok((await db.query(`SELECT base_updated_at FROM public.clients WHERE id = 'cli-2'`)).rows[0].base_updated_at === null, 'base_updated_at não fica gravado');

  // ------------------------------------------- cadastro de usuários pelo app
  const createUser = (who, args) => as(db, who,
    `SELECT public.jvm_admin_create_user($1, $2, $3, $4, $5, $6, $7, $8) AS r`,
    [args.name, args.email, args.username ?? null, args.role, args.password, args.cargo ?? null, args.reg ?? null, null]);
  const setPassword = (who, id, pwd, email = null, username = null) => as(db, who,
    `SELECT public.jvm_admin_set_password($1, $2, $3, $4) AS r`, [id, pwd, email, username]);
  const parse = r => (typeof r.rows[0].r === 'string' ? JSON.parse(r.rows[0].r) : r.rows[0].r);

  r = await createUser(user(a2), { name: 'Carla Técnica', email: 'Carla@Empresa2.com', username: 'carla', role: 'tecnico', password: 'Senha1234', cargo: 'Técnica', reg: 'CFT 123' });
  ok(!r.error, `admin cadastra usuário com acesso (${r.error || 'ok'})`);
  const carla = r.error ? null : parse(r).user;
  ok(carla && carla.company_id === 'comp-2' && carla.has_login === true && !('password_hash' in carla), 'usuário criado na empresa do admin, com acesso e sem expor a senha');
  const carlaAuth = carla && (await db.query(`SELECT a.email, a.encrypted_password = extensions.crypt('Senha1234', a.encrypted_password) AS ok
      FROM public.users u JOIN auth.users a ON a.id = u.auth_user_id WHERE u.id = $1`, [carla.id])).rows[0];
  ok(carlaAuth?.ok && carlaAuth.email === 'carla@empresa2.com', 'conta de login criada com a senha informada');
  ok(!!(await createUser(user(a2), { name: 'Outra', email: 'carla@empresa2.com', role: 'tecnico', password: 'Senha1234' })).error, 'e-mail repetido é recusado');
  ok(!!(await createUser(user(a2), { name: 'Outra', email: 'outra@x.com', username: 'CARLA', role: 'tecnico', password: 'Senha1234' })).error, 'nome de usuário repetido é recusado');
  ok(!!(await createUser(user(a2), { name: 'Fraca', email: 'fraca@x.com', role: 'tecnico', password: '123' })).error, 'senha fraca é recusada');
  ok(!!(await createUser(user(a2), { name: 'X', email: 'x@y.com', role: 'master', password: 'Senha1234' })).error, 'perfil inválido é recusado');
  ok(!!(await createUser(user(a2), { name: 'X', email: 'semmail', role: 'tecnico', password: 'Senha1234' })).error, 'e-mail inválido é recusado');
  const carlaUid = await uidOf(db, carla.id);
  ok(!!(await createUser(user(carlaUid), { name: 'X', email: 'y@y.com', role: 'admin', password: 'Senha1234' })).error, 'técnico NÃO cadastra usuários com acesso');
  ok(!!(await createUser(anon, { name: 'X', email: 'z@y.com', role: 'admin', password: 'Senha1234' })).error, 'anon NÃO cadastra usuários');
  ok(!!(await setPassword(user(carlaUid), 'usr-a2', 'Senha9999')).error, 'técnico NÃO troca senha de ninguém');

  // técnico cadastrado sem acesso (usr-fake, comp-2) recebe acesso depois
  r = await setPassword(user(a2), 'usr-fake', 'Acesso2026', 'fake.tecnico@empresa2.com', 'fake.tec');
  ok(!r.error && parse(r).user.has_login === true, `admin dá acesso a técnico já cadastrado (${r.error || 'ok'})`);
  r = await setPassword(user(a2), 'usr-a', 'Senha9999');
  ok(!!r.error, 'admin NÃO troca senha de usuário de outra empresa');
  r = await setPassword(user(a2), 'usr-a2', 'NovaSenha2026');
  ok(!r.error, 'admin troca a própria senha');
  ok((await db.query(`SELECT a.encrypted_password = extensions.crypt('NovaSenha2026', a.encrypted_password) AS ok FROM auth.users a WHERE a.id = $1`, [a2])).rows[0].ok,
    'nova senha vale para o login');
  r = await as(db, user(a2), `SELECT has_login FROM public.users WHERE id = 'usr-sem'`);
  ok(!r.error, 'app consegue ler se o usuário tem acesso (has_login)');

  // master enxerga tudo
  await db.exec(`INSERT INTO public.users (id, name, email, role, is_master_admin, password_hash) VALUES ('usr-m', 'Master', 'm@x.com', 'admin', true, 'Senha@M1')`);
  const m = await uidOf(db, 'usr-m');
  r = await as(db, user(m), `SELECT count(*)::int n FROM public.clients`);
  ok(r.rows[0].n === 2, 'master enxerga todas as empresas');

  // conta de login "solta" (cadastro público) não acessa nada
  const stranger = '11111111-1111-1111-1111-111111111111';
  await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${stranger}', 'x@sem-email.local')`);
  r = await as(db, user(stranger), `SELECT count(*)::int n FROM public.clients`);
  ok(r.rows[0].n === 0, 'conta sem vínculo não enxerga dados');
  r = await as(db, user(stranger), `INSERT INTO public.companies (id, name) VALUES ('comp-s', 's')`);
  ok(!!r.error, 'conta sem vínculo não cria empresa');
  ok(!(await uidOf(db, 'usr-sem')), 'conta com mesmo e-mail NÃO é vinculada automaticamente');

  // ---------------------------------------------------- migração de banco antigo
  if (OLD_SCHEMA) {
    const old = await newDb();
    await old.exec(OLD_SCHEMA);
    await old.exec(`INSERT INTO public.companies (id, name) VALUES ('comp-old', 'Antiga')`);
    await old.exec(`INSERT INTO public.users (id, company_id, name, email, role, password_hash) VALUES ('usr-old', 'comp-old', 'Old', 'Old@X.com', 'tecnico', 'SenhaAntiga1')`);
    await old.exec(SCHEMA);
    await old.exec(MODULES);
    const ou = (await old.query(`SELECT u.auth_user_id, (a.encrypted_password = extensions.crypt('SenhaAntiga1', a.encrypted_password)) AS ok
                                   FROM public.users u JOIN auth.users a ON a.id = u.auth_user_id WHERE u.id = 'usr-old'`)).rows[0];
    ok(ou?.ok, 'banco antigo: usuário existente ganha conta de login com a MESMA senha');
    ok((await old.query(`SELECT count(*)::int n FROM pg_policies WHERE policyname LIKE 'Permitir acesso completo%'`)).rows[0].n === 0, 'banco antigo: políticas liberadas removidas');
    ok((await old.query(`SELECT count(*)::int n FROM pg_proc WHERE proname IN ('jvm_login','jvm_set_initial_password')`)).rows[0].n === 0, 'banco antigo: funções antigas de login removidas');
    await old.exec(`INSERT INTO public.norms (id, payload) VALUES ('norm-antiga', '{}')`);
    await old.exec(`INSERT INTO public.norms (id, payload) VALUES
      ('norm-tapete-antiga', '{"applicableEquipmentTypes": ["tapete_isolante"], "maxLeakageCurrent": 10, "currentUnit": "uA"}'),
      ('norm-tapete-texto', '{"applicableEquipmentTypes": ["tapete_isolante"], "maxLeakageCurrent": "dez"}'),
      ('norm-luva-antiga', '{"applicableEquipmentTypes": ["luva_isolante"], "maxLeakageCurrent": 24, "currentUnit": "mA"}')`);
    await old.exec(SCHEMA);
    const tapetes = (await old.query(`SELECT id, payload->>'maxLeakageCurrent' AS l, payload->>'currentUnit' AS u FROM public.norms WHERE id LIKE 'norm-%-antiga' OR id = 'norm-tapete-texto' ORDER BY id`)).rows;
    const byId = Object.fromEntries(tapetes.map(t => [t.id, t]));
    ok(byId['norm-tapete-antiga'].l === '100' && byId['norm-tapete-antiga'].u === 'mA', 'banco antigo: norma de tapete corrigida para 100 mA');
    ok(byId['norm-tapete-texto'].l === '100', 'banco antigo: norma de tapete com valor inválido corrigida para 100 mA');
    ok(byId['norm-luva-antiga'].l === '24', 'banco antigo: normas de luva não são alteradas');
    const oldNorm = (await old.query(`SELECT norm_id, company_id FROM public.norms WHERE id = 'norm-antiga'`)).rows[0];
    ok(oldNorm.norm_id === 'norm-antiga' && oldNorm.company_id === null, 'banco antigo: normas existentes viram oficiais (norm_id preenchido)');
  }

  console.log(failures ? `\n${failures} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
