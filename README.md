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
