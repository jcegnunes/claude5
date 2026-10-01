# JVM Dielectric Lab — Ensaios & Certificação EPI/EPC (v7.2)

Plataforma de ensaios dielétricos, laudos e certificados de EPI/EPC com
**Supabase como banco de dados único**.

> **Atualizando da v6.x?** Siga os passos de `MUDANCAS_V7.md` (executar o novo
> `supabase/schema.sql` e desativar o cadastro público no Supabase Auth).

## Executar localmente

1. `npm install`
2. (Opcional) configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em `.env.local`
3. `npm run dev`

Verificações (as mesmas da CI): `npm run lint`, `npm test` (normas e avaliação dos
ensaios), `npm run test:db` (regras de segurança do banco) e `npm run build`.

## Banco de dados (Supabase)

Antes de usar esta versão, execute **uma vez** o arquivo `supabase/schema.sql`
no *SQL Editor* do projeto Supabase. O script é idempotente (pode ser
executado novamente sem apagar dados) e:

- cria/atualiza as tabelas `companies`, `users`, `clients`, `equipment`,
  `service_orders`, `test_records`, `lab_instruments`, `norms`,
  `consolidated_reports` e `audit_logs`;
- adiciona as colunas `payload` (registro completo), `deleted_at`
  (exclusão lógica) e `device_id`;
- faz o `updated_at` ser sempre definido pelo servidor (cursor do pull);
- habilita o Realtime nas tabelas;
- cria o bucket público `jvm-evidencias` para as fotos dos ensaios;
- cria as contas de login (Supabase Auth) e as regras de acesso por empresa.

Depois de executar, no painel do Supabase desative o cadastro público:
**Authentication → Sign In / Providers → "Allow new users to sign up" = OFF**.

O script fica somente no projeto (pasta `supabase/`): o app não exibe nem contém as configurações do banco.

### Módulos (`supabase/modules/`)

Cada módulo da plataforma tem o próprio script, executado **depois** do `schema.sql`
(também idempotente). Hoje: `supabase/modules/treinamentos.sql` (certificados de
treinamento). O `recriar_banco.sql` já inclui todos os módulos.

## Módulos do sistema (`src/modules/`)

Partes independentes da plataforma: cada módulo tem pasta própria (telas, regras, PDF,
sincronização, testes) e script SQL próprio, e se liga ao app só pelo registro
`src/modules/registry.ts` (menu e telas) e por `src/modules/storageKeys.ts` (dados no
aparelho). Pode ser alterado sem mexer nos ensaios e ligado/desligado por empresa em
**Configurações & Backup → Módulos do sistema**.

| Módulo | Pasta | Banco |
|---|---|---|
| Treinamentos (certificados NR-10, NR-35...) | `src/modules/treinamentos` | `supabase/modules/treinamentos.sql` |

## Como funciona a sincronização

- Todo registro salvo entra numa **fila local** e é enviado ao Supabase
  segundos depois (em lote, na ordem empresas → usuários → clientes →
  equipamentos → OS → instrumentos → normas → ensaios).
- Sem internet, os ensaios ficam no aparelho e são enviados automaticamente
  quando a conexão volta. Itens com erro **nunca são descartados**: ficam na
  fila com nova tentativa progressiva e o erro aparece na Central de Sincronização.
- O download é **incremental e paginado** e as alterações de outros aparelhos
  chegam em tempo real (Supabase Realtime) ou, no máximo, a cada 2 minutos.
- Fotos em base64 são enviadas ao Supabase Storage e substituídas pela URL
  pública, liberando espaço no aparelho.
- O portal público `/validar/CODIGO` consulta o Supabase, então funciona no
  celular de qualquer cliente que ler o QR Code.

Veja `MUDANCAS_V6.1.md` para a lista completa de correções.

## Publicar no GitHub (Windows) — `publicar.bat`

1. Instale o Git para Windows (https://git-scm.com/download/win) com as opções padrão.
2. Extraia a nova versão do projeto numa pasta e dê **duplo clique em `publicar.bat`**.
3. Na primeira vez, cole a URL do repositório e informe o branch ligado ao AI Studio
   (normalmente `main`). O login no GitHub abre no navegador — **nenhum token é digitado
   ou salvo em arquivo**.
4. Nas próximas versões, extraia o novo zip **na mesma pasta** (substituindo os arquivos)
   e execute `publicar.bat` de novo.
5. No Google AI Studio: ⚙️ → aba **GitHub** → **Pull**.

O script nunca usa push forçado: o histórico do GitHub é preservado, arquivos
removidos na nova versão são apagados do repositório e, se o GitHub tiver
alterações mais novas (ex.: feitas no AI Studio), ele avisa e pede confirmação.

## Visualizar no computador (Windows) — `executar.bat`

1. Instale o Node.js LTS (https://nodejs.org) com as opções padrão.
2. Dê duplo clique em `executar.bat` dentro da pasta do projeto.
3. Na primeira vez ele instala as dependências (alguns minutos) e depois abre
   `http://localhost:3000` no navegador. Para encerrar, feche a janela preta.

## Login e segurança (Supabase Auth)

O acesso ao app exige **e-mail ou nome de usuário + senha cadastrados na tabela
`public.users`**. Cada usuário com senha ganha automaticamente uma conta de login no
**Supabase Auth** (mesma senha, criptografada com bcrypt). A sessão aberta no login é
o que o banco usa para decidir o que cada um pode ver e gravar:

- cada usuário só lê e grava dados da **própria empresa**;
- `is_master_admin = true` enxerga todas as empresas (use só para o administrador da plataforma);
- perfil `cliente` só consulta; normas técnicas só são alteradas por `admin` ou `responsavel_tecnico`,
  e a alteração vale **somente para a empresa** que a fez (as demais continuam com a versão oficial);
- a chave pública do app, sozinha, não acessa nenhuma tabela. Sem login, só funcionam o
  portal `/validar/CODIGO` (um certificado por código) e o envio de fotos da câmera remota.

No **SQL Editor** do Supabase:

```sql
-- Criar um usuário (a conta de login é criada automaticamente)
INSERT INTO public.users (id, company_id, name, email, username, role, password_hash)
VALUES ('usr-maria', '<id da empresa>', 'Maria Souza', 'maria@empresa.com.br', 'maria', 'tecnico', 'Senha@2026');

-- Trocar a senha (é criptografada automaticamente ao salvar)
UPDATE public.users SET password_hash = 'NovaSenha@2026' WHERE email = 'maria@empresa.com.br';

-- Definir/alterar o nome de usuário
UPDATE public.users SET username = 'maria' WHERE email = 'maria@empresa.com.br';

-- Bloquear / desbloquear o acesso (bloquear também encerra as sessões abertas)
UPDATE public.users SET active = false WHERE email = 'maria@empresa.com.br';
```

Papéis (`role`): `admin`, `responsavel_tecnico`, `tecnico`, `administrativo`, `cliente`.

- Senhas só são cadastradas ou trocadas pelo banco (SQL Editor). Técnicos criados pelo
  app (ex.: "Cadastrar Analista Executor") servem para assinatura e não têm login.
- Um técnico não consegue se promover: `role`, `active`, e-mail e nome de usuário só
  mudam por um `admin` da empresa; `is_master_admin` só por outro master.
- Sem internet, entra apenas quem já fez login com internet naquele aparelho nos
  últimos 30 dias. Ao voltar a internet sem sessão válida, a sincronização pede novo login.

## Versão sem dados (instalação limpa)

O sistema é entregue **sem nenhum dado**: nada de empresas, usuários, clientes, EPIs,
ordens de serviço, ensaios ou instrumentos pré-carregados. Só as normas técnicas
(referência normativa) acompanham o sistema.

1. **Banco novo ou zerado** — execute `supabase/schema.sql`. Para apagar dados que já
   existam no banco, execute `supabase/limpar_dados.sql` (irreversível; faça backup antes
   e apague as fotos em Storage → `jvm-evidencias`).
2. **Primeiro usuário** — no SQL Editor:
   ```sql
   INSERT INTO public.users (id, name, email, username, role, is_master_admin, password_hash)
   VALUES ('usr-admin', 'Seu Nome', 'voce@suaempresa.com.br', 'admin', 'admin', true, 'SuaSenhaForte');
   ```
3. **Primeiro acesso** — entre no app com esse usuário e senha. O sistema abre a tela
   **"Cadastre sua empresa"** (CNPJ com busca automática na Receita, endereço, contato e
   responsável técnico). Esses dados vão para o banco e aparecem nos laudos e certificados.
4. **Outros usuários da mesma empresa** — crie o usuário já vinculado à empresa:
   ```sql
   -- descubra o id da empresa
   SELECT id, name, cnpj FROM public.companies;
   INSERT INTO public.users (id, company_id, name, email, username, role, password_hash)
   VALUES ('usr-joao', '<id da empresa>', 'João Lima', 'joao@suaempresa.com.br', 'joao', 'tecnico', 'Senha@2026');
   ```
   Usuário criado **sem** `company_id` cadastra uma empresa nova no primeiro acesso.

Aparelhos que já tinham a versão anterior apagam os dados de demonstração guardados
localmente na primeira abertura desta versão e passam a mostrar apenas o que está no banco.

## Isolamento entre empresas (v6.3)

- Cada aparelho baixa e guarda **somente** os dados da empresa do usuário logado.
  Nada é baixado antes do login.
- Ao entrar, dados de outras empresas que estivessem no aparelho são removidos.
- O banco **recusa** as empresas/usuários de demonstração (`comp-jvm`, `comp-voltsafe`,
  `comp-altatensao`, `usr-1`…), que só versões antigas do app ainda enviam.
- A tela de login mostra a versão no rodapé (ex.: **"Versão 7.2.0"**): use para conferir se o site publicado
  está atualizado.

Descobrir quem está gravando no banco (aparelho e horário):
```sql
SELECT 'companies' AS tabela, id, name AS descricao, device_id, updated_at FROM public.companies
UNION ALL SELECT 'users', id, email, device_id, updated_at FROM public.users
UNION ALL SELECT 'clients', id, razao_social, device_id, updated_at FROM public.clients
ORDER BY updated_at DESC LIMIT 50;
```
`device_id` vazio indica gravação feita por uma versão antiga do app.

## Padronizar tabelas criadas por outros sistemas — `supabase/padronizar_tabelas.sql`

Se o projeto Supabase já tinha tabelas com colunas de outros sistemas (ex.: `numero_os`,
`cliente_nome`), este script deixa **somente as colunas do padrão deste projeto**:

1. Faça backup (Database → Backups).
2. Execute `supabase/schema.sql` e depois `supabase/padronizar_tabelas.sql`.
3. As mensagens mostram cada coluna removida. Número da OS e nome do cliente são copiados
   antes para as colunas padrão; os demais dados das colunas extras são perdidos.

Tabelas de outros sistemas são apenas listadas. Para apagá-las, troque
`apagar_tabelas_extras := false` por `true` no bloco 4 do script.

## Recriar o banco do zero — `supabase/recriar_banco.sql`  (recomendado)

Apaga **todas** as tabelas do schema `public` (do app e de outros sistemas), com os dados,
e cria tudo novo no padrão deste projeto. Depois, crie o primeiro usuário (seção
"PRIMEIRO USUÁRIO" no final do script) e, no primeiro acesso ao app, cadastre a empresa.

## Instalar no celular e usar offline (PWA) — v6.4

O sistema pode ser **instalado pelo navegador** e **abre sem internet**.

**Android (Chrome):** abra o endereço do sistema → menu **⋮** → **Instalar app**
(ou use o botão "Instalar Aplicativo Neste Dispositivo" no Modo Android).
**iPhone/iPad (Safari):** botão **Compartilhar** → **Adicionar à Tela de Início**.

Como funciona:
1. O **primeiro acesso precisa de internet** (login e download do app e dos dados da empresa).
2. Depois, sem internet: o app abre, o login funciona para quem já entrou naquele aparelho
   (até 30 dias) e ensaios, EPIs, clientes, OS e fotos são salvos no aparelho, numa fila.
3. Quando a internet volta, a fila é enviada ao Supabase automaticamente (ao abrir o app,
   ao reconectar ou pelo botão Sincronizar). As atualizações de outros aparelhos são baixadas.
4. Novas versões do sistema são instaladas automaticamente na próxima abertura com internet.

Importante: envie os dados (abra o app com internet) antes de desinstalar o app ou limpar
os dados do navegador — itens ainda na fila ficam só no aparelho.
