# JVM Dielectric Lab — Ensaios & Certificação EPI/EPC (v6.1)

Plataforma de ensaios dielétricos, laudos e certificados de EPI/EPC com
**Supabase como banco de dados único**.

## Executar localmente

1. `npm install`
2. (Opcional) configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em `.env.local`
3. `npm run dev`

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
- cria o bucket público `jvm-evidencias` para as fotos dos ensaios.

O mesmo script pode ser copiado pela tela **Supabase Cloud → Script SQL**.

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

## Login com usuário e senha do banco de dados

O acesso ao app exige **e-mail ou nome de usuário + senha cadastrados na tabela
`public.users` do Supabase**. As senhas ficam criptografadas (bcrypt), o app não
consegue lê-las e a conferência é feita no servidor pela função `jvm_login`.

No **SQL Editor** do Supabase:

```sql
-- Criar um usuário
INSERT INTO public.users (id, company_id, name, email, username, role, password_hash)
VALUES ('usr-maria', 'comp-jvm', 'Maria Souza', 'maria@empresa.com.br', 'maria', 'tecnico', 'Senha@2026');

-- Trocar a senha (é criptografada automaticamente ao salvar)
UPDATE public.users SET password_hash = 'NovaSenha@2026' WHERE email = 'maria@empresa.com.br';

-- Definir/alterar o nome de usuário
UPDATE public.users SET username = 'maria' WHERE email = 'maria@empresa.com.br';

-- Bloquear / desbloquear o acesso
UPDATE public.users SET active = false WHERE email = 'maria@empresa.com.br';
```

Papéis (`role`): `admin`, `responsavel_tecnico`, `tecnico`, `administrativo`.

- Usuários criados pela tela "Novo Usuário" do app recebem a senha inicial digitada
  (aceita só uma vez, nos primeiros 15 minutos). Depois, a senha só muda pelo banco.
- Sem internet, entra apenas quem já fez login com internet naquele aparelho nos
  últimos 30 dias.
- Após a atualização, todos precisam entrar de novo uma vez (não há mais login automático).
