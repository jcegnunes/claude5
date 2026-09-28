# JVM Dielectric Lab — Mudanças da versão 7.0 (segurança do banco)

## ⚠️ Passos obrigatórios (nesta ordem)

1. **Backup**: Supabase → Database → Backups (ou exporte as tabelas).
2. **SQL**: execute o novo `supabase/schema.sql` no SQL Editor. Ele não apaga dados e:
   - cria as contas de login (Supabase Auth) para todos os usuários que já têm senha,
     **com a mesma senha de antes**;
   - troca as regras de acesso abertas pelas regras por empresa.
3. **Desative o cadastro público**: Authentication → Sign In / Providers →
   *Allow new users to sign up* = **OFF**.
4. **Publique o app novo** (`publicar.bat` → AI Studio → Pull, ou o site na Hostinger).
5. Todos entram de novo uma vez com usuário e senha.

> Depois do passo 2, versões antigas do app **deixam de acessar o banco**. Os dados
> que estiverem só na fila de um aparelho antigo continuam guardados nele e são enviados
> quando o aparelho abrir a versão nova e o usuário entrar.

## Por que mudou

Até a v6.5, as regras do banco eram `USING (true)`: a chave pública, que vai dentro do
site, lia e gravava **tudo, de todas as empresas**. Na prática, qualquer pessoa com o
endereço do site podia:

- baixar clientes, EPIs, ensaios e laudos de todas as empresas;
- alterar o resultado de um ensaio (o portal do QR Code mostraria o dado falso);
- criar para si um usuário `admin`/`is_master_admin` e definir a senha pela função
  `jvm_set_initial_password`.

## O que mudou no banco (`supabase/schema.sql`)

| Antes | Agora |
|---|---|
| Senha conferida por `jvm_login` com a chave pública | Login pelo **Supabase Auth**; `jvm_login` removida |
| Chave pública lê e grava todas as tabelas | Chave pública **não acessa nenhuma tabela** |
| Isolamento entre empresas só dentro do app | Isolamento **no banco** (RLS): cada usuário vê só a própria empresa |
| Qualquer um altera `role`, `is_master_admin`, `company_id` | Só admin altera perfil/ativo/e-mail; só master concede master |
| Portal lia a tabela `test_records` inteira | Função `jvm_validar_certificado`: um ensaio por **código de validação** |
| Bucket de fotos: qualquer um lista e sobrescreve | Envio só na pasta da própria empresa; câmera remota só **envia imagens** para `camera-remota/`; limite de 10 MB |
| Perfil `cliente` podia gravar | `cliente` só consulta |
| Norma editada por uma empresa mudava para todas | **Normas por empresa**: edição, cadastro ou exclusão vale só para a empresa que fez; as demais continuam com a versão oficial. Só admin/RT editam |
| Auditoria podia ser alterada | Auditoria só recebe novos registros |

Continua igual para o administrador:

```sql
-- criar usuário (a conta de login é criada automaticamente)
INSERT INTO public.users (id, company_id, name, email, username, role, password_hash)
VALUES ('usr-maria', '<id da empresa>', 'Maria Souza', 'maria@empresa.com.br', 'maria', 'tecnico', 'Senha@2026');

-- trocar a senha
UPDATE public.users SET password_hash = 'NovaSenha@2026' WHERE email = 'maria@empresa.com.br';

-- bloquear (também encerra as sessões abertas)
UPDATE public.users SET active = false WHERE email = 'maria@empresa.com.br';
```

## O que mudou no app

- Login pelo Supabase Auth; a sessão fica no aparelho e renova sozinha.
  O acesso offline (quem já entrou nos últimos 30 dias) continua igual.
- Com internet e sem sessão válida, o app pede login novamente.
- A senha digitada no cadastro de usuário **não é mais guardada em texto puro** no
  aparelho; restos de versões anteriores são apagados no login.
- Código de validação do QR Code: gerador criptográfico com 8 caracteres
  (os códigos antigos continuam válidos).
- Portal de validação: aceita só o código de validação (números de laudo/certificado
  são sequenciais e permitiriam listar os documentos de todos os clientes). O PDF
  baixado pelo cliente usa os dados do laboratório que emitiu o documento.
- "Voltar ao Sistema" no portal não abre mais o app sem login.
- Tela de Normas: selo **"Versão da empresa"** nas normas alteradas pela empresa e aviso
  no formulário de que a alteração vale só para ela.
- Telas carregadas sob demanda: arquivo principal de **2,7 MB → 440 kB**
  (abre bem mais rápido no celular). Continua funcionando offline.

## Projeto

- `package.json`: nome/versão corrigidos (7.0.0, mostrada na tela de login);
  removidas dependências sem uso (`@google/genai`, `dotenv`, `motion`,
  `html2canvas`, `docx`, `eslint`); ferramentas de build em `devDependencies`.
- `package-lock.json` sincronizado; CI usa `npm ci` e roda os testes.
- Testes: `npm test` (avaliação de luvas NBR 16295, certificados, critérios, numeração,
  conflitos, armazenamento) e `npm run test:db` (regras do banco num Postgres local:
  segurança, normas por empresa, numeração e conflitos).
- `recriar_banco.sql` é gerado a partir do `schema.sql` (`npm run build:sql`); a CI confere.
- `xlsx`: o alerta do `npm audit` trata da **leitura** de planilhas maliciosas; o app só
  **gera** planilhas. A biblioteca agora é carregada apenas ao exportar.

## Normas por empresa — como funciona

- No banco, a **versão oficial** tem `company_id` vazio. Quando uma empresa salva ou exclui
  uma norma, é gravada uma linha própria (`id = <empresa>::<norma>`, `company_id` da
  empresa) que substitui a oficial **somente para ela**.
- O identificador da norma usado nos ensaios não muda, então laudos e ensaios antigos
  continuam ligados à norma certa.
- As normas que já estão no banco viram as **versões oficiais**. Se alguma delas foi
  alterada por uma empresa em versões anteriores, revise no SQL Editor:
  `SELECT id, norm_code, norm_name, device_id, updated_at FROM public.norms ORDER BY updated_at DESC;`
- A versão oficial só é alterada pelo SQL Editor ou pelo administrador master.

## Numeração sem duplicidade entre aparelhos

- Com internet, cada aparelho **reserva no banco** uma faixa de números (30 ensaios,
  30 laudos, 30 certificados e 10 OS) e a repõe a cada sincronização. Offline, usa os
  números reservados: dois tablets nunca geram o mesmo número.
- O formato não muda (`ENS-2609-0046`, `LAU-2609-0012`...) e a sequência continua de onde
  estava, sem reiniciar a cada mês — como nas versões anteriores.
- Se a faixa acabar **sem internet**, o número recebe o final do código do aparelho
  (ex.: `LAU-2609-0031-9XA`), que também nunca se repete.
- Números reservados e não usados ficam sem uso (a sequência pode ter lacunas e, com
  vários aparelhos, os números não seguem a ordem cronológica exata).

## Conflito de edição entre aparelhos

- Antes, se dois aparelhos editassem o mesmo registro, o último envio apagava o outro
  sem aviso. Agora o banco **recusa** a gravação baseada numa versão antiga
  (ensaios, EPIs, OS, clientes, instrumentos e relatórios).
- As duas versões ficam guardadas e aparecem em **Sincronização & Conflitos → Conflitos de
  edição**, com os campos diferentes lado a lado. O usuário escolhe qual fica valendo.
  O contador do menu inclui os conflitos pendentes.
- Registros criados antes desta versão entram na verificação a partir do primeiro
  download completo feito pela versão 7.

## Armazenamento no aparelho (IndexedDB)

- Os dados (ensaios com fotos e assinaturas, EPIs, clientes, OS, fila de envio...) saíram
  do `localStorage` (limite de ~5 MB) para o **IndexedDB** (centenas de MB).
- A migração é automática na primeira abertura: os dados são copiados e só depois
  apagados do armazenamento antigo; nada é perdido.
- Com várias abas abertas, uma aba avisa as outras quando grava.
- Se o navegador não permitir IndexedDB (ex.: janela anônima), o app continua usando o
  armazenamento antigo.
- As gravações vão para o IndexedDB imediatamente. Ainda assim, não feche o app no
  mesmo instante em que toca em "Salvar".

## Regras técnicas confirmadas pelo laboratório

- **Limite de corrente de fuga das luvas (NBR 16295, Tabela 4)** — confirmado em 28/09/2026:
  o par de luvas é ensaiado simultaneamente na cuba e a corrente registrada é a do par;
  por isso o limite aplicado é o **dobro** do valor unitário da Tabela 4 (mais 2 mA por
  luva com condicionamento de umidade). O laudo informa essa regra ao cliente. Coberto
  pelos testes em `src/services/__tests__/nbr16295.test.ts`.
- **Limite de corrente de fuga dos tapetes isolantes (ASTM D178-22)** — definido em
  28/09/2026: **100 mA para todas as classes** (a norma não estipula valor). O valor é fixo
  na avaliação, travado na tela de Normas e aplicado às normas de tapete já gravadas no
  banco pelo `schema.sql`. Ensaios e laudos já emitidos mantêm o limite registrado na
  época. Coberto pelos testes em `src/services/__tests__/tapete.test.ts`.

## Pendências recomendadas (não alteradas)

- **Vínculo de ensaio sem cliente/equipamento no banco**: quando o cliente ou o
  equipamento ainda não chegou ao banco, o ensaio é enviado sem o vínculo técnico
  (nome e tag continuam gravados). Pode ser trocado por nova tentativa.
- **Arquivos muito grandes** (`TestWizardView`, `ReportEmissionView`, `syncEngine`...):
  dividir em módulos menores facilita a manutenção.
