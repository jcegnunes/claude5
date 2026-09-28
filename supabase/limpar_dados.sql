-- =========================================================================
-- LIMPAR TODOS OS DADOS DO BANCO  (IRREVERSÍVEL)
--
-- Apaga empresas, usuários, clientes, equipamentos, ordens de serviço,
-- ensaios, instrumentos, relatórios e auditoria. As TABELAS, funções e
-- regras de segurança continuam (não é preciso rodar o schema.sql de novo).
-- As normas técnicas são mantidas (referência do sistema). Para apagá-las
-- também, remova os dois traços do comando "DELETE FROM public.norms".
--
-- ANTES: faça um backup (Database > Backups, ou exporte as tabelas).
-- DEPOIS: apague as fotos em Storage > jvm-evidencias (selecionar tudo > Delete).
-- =========================================================================

BEGIN;

DELETE FROM public.audit_logs;
DELETE FROM public.consolidated_reports;
DELETE FROM public.test_records;
DELETE FROM public.service_orders;
DELETE FROM public.equipment;
DELETE FROM public.lab_instruments;
DELETE FROM public.clients;
DELETE FROM public.users;
DELETE FROM public.companies;
-- DELETE FROM public.norms;

COMMIT;

-- Conferência (todas as contagens devem ser 0):
SELECT 'companies' AS tabela, count(*) FROM public.companies
UNION ALL SELECT 'users', count(*) FROM public.users
UNION ALL SELECT 'clients', count(*) FROM public.clients
UNION ALL SELECT 'equipment', count(*) FROM public.equipment
UNION ALL SELECT 'service_orders', count(*) FROM public.service_orders
UNION ALL SELECT 'test_records', count(*) FROM public.test_records
UNION ALL SELECT 'lab_instruments', count(*) FROM public.lab_instruments
UNION ALL SELECT 'consolidated_reports', count(*) FROM public.consolidated_reports
UNION ALL SELECT 'audit_logs', count(*) FROM public.audit_logs;
