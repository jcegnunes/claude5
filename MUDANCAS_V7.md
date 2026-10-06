# JVM Dielectric Lab — Mudanças da versão 7.0 (segurança do banco)

## ⚠️ Passos obrigatórios (nesta ordem)

1. **Backup**: Supabase → Database → Backups (ou exporte as tabelas).
2. **SQL**: execute o novo `supabase/schema.sql` no SQL Editor. Ele não apaga dados e:
   - cria as contas de login (Supabase Auth) para todos os usuários que já têm senha,
     **com a mesma senha de antes**;
   - troca as regras de acesso abertas pelas regras por empresa.

   Em seguida execute `supabase/modules/treinamentos.sql` (módulo Treinamentos).
3. **Desative o cadastro público**: Authentication → Sign In / Providers →
   *Allow new users to sign up* = **OFF**.
4. **Publique o app novo** (`publicar.bat` → AI Studio → Pull, ou o site na Hostinger).
5. Todos entram de novo uma vez com usuário e senha.

> Depois do passo 2, versões antigas do app **deixam de acessar o banco**. Os dados
> que estiverem só na fila de um aparelho antigo continuam guardados nele e são enviados
> quando o aparelho abrir a versão nova e o usuário entrar.

## Endereços da plataforma

| Uso | Endereço |
|---|---|
| Sistema (login, ensaios, laudos, cadastros) | **https://jvmlab.com.br** |
| Validação no site da JVM (QR Code) | **https://www.jvmengenharia.com.br/validar?codigo=CÓDIGO** |
| Validador (exibido dentro da página do Wix) | **https://validador.jvmlab.com.br** |

- Os QR Codes de certificados, laudos e etiquetas apontam para a página **/validar** do site
  da JVM no Wix, que mostra o validador (`validador.jvmlab.com.br`) dentro dela.
- O leitor de QR Code do app entende os dois formatos (`?codigo=` e `/validar/CÓDIGO`).
- No `validador`, qualquer endereço abre **somente** a consulta de certificados: a tela de
  login do sistema não aparece ali.
- Endereços antigos salvos (Hostinger ou `jvmlab.com.br`) são convertidos automaticamente.
- O endereço pode ser trocado em **Configurações & Backup → Portal Público de Validação**
  (vale para os documentos emitidos depois da troca).

1. **Hostinger → Domínios:** aponte `jvmlab.com.br` (e `www`) para a hospedagem do site.
2. **Hostinger → Subdomínios:** crie `validador.jvmlab.com.br` usando a **mesma pasta** do
   site (ou envie para ele os mesmos arquivos do build, com o `.htaccess`).
3. Ative o **SSL** nos dois endereços (HTTPS é obrigatório para instalar o app e usar a câmera).
4. **Supabase → Authentication → URL Configuration:** *Site URL* = `https://jvmlab.com.br`.
5. O endereço antigo da Hostinger (`mediumvioletred-bison-595566.hostingersite.com`) será
   desativado: documentos já impressos com o QR Code antigo são validados digitando o código
   em `https://validador.jvmlab.com.br`. Reemita etiquetas ainda em uso, se preferir.
6. Confira: `https://jvmlab.com.br` mostra o login com "Versão 7.2.0";
   `https://validador.jvmlab.com.br` mostra só o "Portal de Validação de Autenticidade".

### Página do validador no site Wix (www.jvmengenharia.com.br)

1. No editor do Wix: **Páginas → Adicionar página** em branco, com o endereço (slug) **validar**.
2. **Adicionar → Incorporar código → Incorporar um site** (elemento HTML). Em
   "Configurações", escolha **Endereço do site** e informe `https://validador.jvmlab.com.br`.
   Deixe-o com a largura total da página e cerca de 1000 px de altura.
3. Ative o **Modo Dev (Velo)**, troque o ID do elemento para `validador` e cole no código da página:

```js
import wixLocationFrontend from 'wix-location-frontend';

$w.onReady(function () {
  const codigo = (wixLocationFrontend.query.codigo || '').trim();
  const base = 'https://validador.jvmlab.com.br';
  $w('#validador').src = codigo ? `${base}/validar/${encodeURIComponent(codigo)}` : base;
});
```

   (Em sites antigos, use `import wixLocation from 'wix-location';` e `wixLocation.query`.)
4. Publique o site e teste: `https://www.jvmengenharia.com.br/validar?codigo=VAL-JVM-...`.

- O `.htaccess` permite que **só o validador** seja exibido dentro do site da JVM (e dos
  domínios do Wix); o sistema continua proibido de aparecer dentro de outros sites.
- Dentro do Wix, o botão **"Abrir em tela cheia"** abre o validador direto, caso o navegador
  bloqueie algo dentro do quadro.
- Se a hospedagem trocar do Apache (Hostinger) para Cloudflare/Netlify, o `_headers` não
  diferencia domínios: o validador precisará de um site separado com `frame-ancestors` liberado.

## Módulo Treinamentos — certificados de treinamento

Módulo independente (`src/modules/treinamentos` + `supabase/modules/treinamentos.sql`):
não altera ensaios, laudos nem a sincronização deles.

**Instalar no banco:** depois do `schema.sql`, execute `supabase/modules/treinamentos.sql`
no SQL Editor (não apaga dados; pode repetir). Sem isso o módulo funciona só no aparelho
e mostra o aviso para executar o script.

**Menu Treinamentos** (perfis administrador, RT, técnico e administrativo):
- **Cursos**: já vêm NR-10 Básico (40 h), NR-10 SEP (40 h), NR-35 (8 h) e Uso de EPI/EPC
  isolantes (4 h), com conteúdo programático, validade (24 meses) e regra de aprovação
  (presença e nota mínimas). Tudo editável; dá para cadastrar outros cursos, duplicar e
  recolocar os padrão. A divisão das horas por tópico é sugestão: confira com o plano de
  curso do laboratório.
- **Instrutores**: nome, qualificação, registro e assinatura (desenhada ou imagem);
  podem ser importados dos usuários e técnicos.
- **Turmas**: curso, datas, local, cliente, instrutores e alunos (digitados ou colados
  da planilha: Nome; CPF; Função; Empresa), presença e nota. "Emitir" gera os
  certificados de todos os aprovados de uma vez; "Lista de presença" gera o PDF com uma
  coluna de assinatura por dia.
- **Alunos da turma** podem ser editados e excluídos mesmo depois da emissão: ao salvar,
  as correções (nome, CPF, função, empresa, presença, nota) vão para o certificado, que
  mantém número e QR Code; aluno excluído tem o certificado **cancelado**; aluno que deixa
  de atingir o mínimo do curso tem o certificado cancelado (com confirmação) e pode
  receber um novo se for corrigido. Nota de 0 a 10 e presença de 0 a 100% são conferidas.
- **Tela da turma sem Função e Nota** (Nova turma / Editar turma): cada aluno tem só Nome,
  CPF, Empresa e Presença %. Na turma a aprovação é pela presença mínima do curso; a nota
  só conta quando veio de uma planilha importada, e quem a importação reprovou continua
  reprovado.
- **Excluir turma** (administrador): a turma é excluída e **todos os certificados dela
  são cancelados** com um motivo (padrão "Turma TUR-… excluída"). Antes de excluir aparece
  a lista dos certificados que serão cancelados. Os certificados continuam na aba
  Certificados e o QR Code passa a mostrar CANCELADO.
- **Excluir curso** (administrador) mesmo com turmas ativas ou certificados emitidos: a
  confirmação lista as turmas e os certificados do curso. **Todos os certificados do curso
  são cancelados** com um motivo (padrão "Curso … excluído"); o QR Code passa a mostrar
  CANCELADO. As turmas continuam e mostram "Curso excluído": para emitir novos
  certificados, edite a turma e escolha outro curso.
- **Validador**: a tela de validação do certificado de treinamento não mostra mais o botão
  "Baixar certificado (PDF)"; o PDF é baixado só pelo módulo Treinamentos.
- **Modelo do certificado** (aba em Treinamentos; administrador ou RT altera):
  logo (da empresa, próprio do certificado ou nenhum; posição esquerda/centro/direita e
  tamanho, sem distorcer), dados da empresa no cabeçalho, título, subtítulo, frase antes do
  nome, **texto padrão** com campos ({curso}, {norma}, {periodo}, {local}, {carga_horaria},
  {nome}, {cpf}, {empresa}, {validade}, {turma}…), texto complementar, linha de CPF/empresa,
  "Válido até", **assinaturas** (quantos instrutores, RT, participante e os cargos), cores,
  moldura e verso (título e aproveitamento). Pré-visualização do PDF ao lado. Fica nos dados
  da empresa: sincroniza entre aparelhos e entra no backup. A assinatura digital ICP-Brasil é
  aplicada só para quem aparece no certificado. O padrão reproduz o certificado anterior.
- **Importar modelo do certificado** (Treinamentos → aba Modelo do certificado → Importar modelo): arte em **PDF, JPG ou
  PNG** usada como fundo da página; o sistema escreve por cima nome, texto, assinaturas e QR
  Code. PDF com 2 páginas: 1ª = frente, 2ª = verso (dá para trocar cada uma). Ajustes de
  posição dos textos e das assinaturas para encaixar na arte. Ao importar, oferece desligar a
  moldura, o logo e os dados da empresa do sistema. Use A4 deitado (paisagem). A imagem é
  reduzida (~150 dpi, JPEG) e fica no layout da empresa. Nova dependência: `pdfjs-dist`.
- **Molduras** (aba Modelo do certificado → Moldura): 6 modelos — Clássica, Arredondada,
  Tracejada, Cantoneiras, Faixa larga e Geométrica — além de "Sem moldura"; uma ou duas
  linhas, com cor e espessura de cada linha (na Faixa larga a espessura é a largura da faixa).
  Layouts já salvos continuam com a moldura dupla de antes.
- **Logo e dados da empresa por página** (aba Modelo do certificado → Logo e cabeçalho):
  caixas de seleção para mostrar o logo e os dados da empresa na **frente** e/ou no **verso**,
  e escolha de **quais dados** aparecem (razão social, nome fantasia, CNPJ, CREA, endereço,
  telefone, e-mail, site, Instagram). O padrão mostra o mesmo de antes (razão social, CNPJ,
  telefone, e-mail e site) nos dois lados.
- **Segundo logo** (Logo e cabeçalho → Segundo logo): imagem própria (parceiro, cliente,
  acreditação…), posição, tamanho e frente/verso independentes do logo principal. Logos na
  mesma posição ficam lado a lado; com logos nos dois lados, os dados da empresa vão para o
  meio do cabeçalho.
- **Certificados**: emissão individual (sem turma), busca por nome/CPF/número, PDF,
  link de validação, cancelamento com motivo (o validador mostra CANCELADO).
- **Painel**: emitidos no ano, turmas abertas, vencendo em 60 dias e vencidos sem
  reciclagem.
- **Importar planilha** (Certificados): emissão de vários certificados a partir de Excel
  (.xlsx/.xls, CSV ou ODS, até 1000 linhas). A planilha tem 3 colunas: **Nome, CPF e
  Colaborador da Empresa** ("Baixar modelo" gera o arquivo, com a lista de cursos e as
  instruções). Curso, datas, local, instrutor, presença e nota são escolhidos na tela e
  valem para todos. Colunas extras opcionais (Função, Curso, Início, Término, Carga
  horária, Local, Presença (%), Nota, Instrutor) valem só para a linha. A prévia
  mostra, linha a linha, quem será emitido, quem foi reprovado (presença/nota abaixo do
  mínimo do curso) e os erros (CPF inválido, curso ou instrutor não cadastrado, datas,
  pessoa repetida ou certificado já emitido — conferido pelo CPF ou, sem CPF, pelo nome).
  Por padrão cria uma turma por curso + período + local + instrutor (com lista de
  presença); no fim, um único PDF com todos os certificados emitidos.
- **Turma → Importar planilha**: a mesma planilha (Nome, CPF, Colaborador da Empresa)
  inclui os alunos na turma; CPF inválido e alunos já presentes ficam de fora (com aviso).
  "Colar lista" segue a mesma ordem: Nome; CPF; Colaborador da Empresa (Função opcional).

**Certificado (PDF A4 paisagem):** frente com participante, CPF, curso, norma, período,
carga horária, validade, assinaturas do instrutor, do Responsável Técnico (cadastro da
empresa) e linha do participante, QR Code; verso com o conteúdo programático e o
aproveitamento. Número `TRE-AAMM-0001` (turma `TUR-AAMM-0001`), com a mesma reserva de
faixas dos ensaios (sem número repetido entre aparelhos).

**Validação:** o QR Code usa o mesmo link do site Wix
(`www.jvmengenharia.com.br/validar?codigo=VAL-TRE-...`). O validador reconhece o código
`VAL-TRE-` e mostra os dados do certificado com o **CPF mascarado** (***.456.789-**).

**Certificado digital ICP-Brasil (A1) — assinatura digital dos PDFs:**
- Em Treinamentos → Instrutores: no cadastro de cada instrutor (quadro "Certificado
  digital") e no cartão do **Responsável Técnico**, envie o arquivo `.pfx`/`.p12` e a senha.
  Ao informar arquivo e senha, o sistema lê e mostra (antes de salvar) todos os dados do
  certificado ligados à assinatura: titular (CN), tipo (e-CPF/e-CNPJ, A1, ICP-Brasil), CPF ou
  CNPJ, responsável (e-CNPJ) e e-mail, ND do titular e do emissor, cadeia até a AC Raiz,
  número de série, validade, política ICP-Brasil (OID), usos da chave, algoritmo, tamanho da
  chave e impressão digital SHA-256. Esses dados ficam gravados (coluna `details`) e podem
  ser vistos em "Ver todos os dados do certificado". Dados pessoais sem relação com a
  assinatura (nascimento, RG, NIS, título de eleitor) não são lidos. Certificado vencido ou
  senha errada são recusados. Só administrador ou RT cadastram/trocam/removem (exige internet).
  Certificados cadastrados antes desta versão: envie o arquivo de novo para gravar os dados.
- O arquivo e a senha ficam **criptografados no banco** (tabela `training_signing_certs`,
  chave em `jvm_private_secrets`), que o app não lê diretamente. Funções do banco entregam o
  material só para quem emite certificados de treinamento na própria empresa, e registram o
  último uso. Como a senha fica salva (escolha do laboratório), **quem emite certificados
  assina em nome do titular** — cadastre apenas com autorização dele.
- Ao baixar certificados (com internet), cada PDF é assinado digitalmente pelo RT e pelos
  instrutores que têm certificado (uma assinatura por pessoa, sem invalidar a anterior).
  Vários certificados saem num `.zip` com um PDF assinado por aluno. O certificado impresso
  traz, acima do nome de quem assinou, o carimbo da assinatura digital com os dados lidos do
  certificado (nome do titular, ND, razão, localização e data), no padrão dos leitores de PDF. Confira no Adobe
  Reader ou em https://validar.iti.gov.br. Sem internet ou com certificado vencido, o PDF
  sai sem assinatura digital (com aviso).
- **Padrão ICP-Brasil (DOC-ICP-15.03):** assinatura PAdES `ETSI.CAdES.detached` com a
  Política de Assinatura **PA_PAdES_AD_RB v1.3** (OID 2.16.76.1.7.1.11.1.3, vigente até
  22/10/2037). Atributos assinados exigidos pela política: content-type, message-digest,
  signing-certificate-v2 e identificador da política (OID, resumo e URI em
  politicas.icpbrasil.gov.br); SHA-256 com RSA; sem signing-time (a data fica no /M do
  PDF). O resumo da política é o **signPolicyHash gravado dentro do documento da política**
  (v1.3: `23e4be4b…fc60`) — não o SHA-256 do arquivo .der (valor da LPA, `23da544a…54dd`),
  que o Verificador de Conformidade do ITI recusa ("O resumo criptográfico da política está
  incorreto"). Conferido com o OpenSSL e com o relatório do ITI (estrutura, caminho de
  certificação, cifra, resumo e demais atributos aprovados).
- **Validação no sistema:** no Validador (portal), "Verificar assinatura digital do PDF":
  envie o PDF e o sistema confere, para cada assinatura, integridade (documento não
  alterado), assinatura criptográfica, validade do certificado na data, signing-certificate-v2,
  política ICP-Brasil (OID e hash da LPA) e a cadeia até as ACs Raiz Brasileiras v5/v12
  (âncoras extraídas do documento oficial da política). Mostra signatário, ND, emissor,
  cadeia e data, e o botão para consultar o código VAL-TRE impresso no PDF. O arquivo é
  conferido só no navegador. A revogação (LCR) não é consultada — para o laudo oficial use
  validar.iti.gov.br. Certificado A3 (token/cartão) não é suportado no navegador.
- **Correção (01/10/2026):** a biblioteca que reserva o espaço da assinatura gravava o
  `startxref` da atualização 1 byte antes da tabela. Leitores (Adobe/Foxit) tratavam o PDF
  como danificado, "reparavam" e pediam para salvar — a cópia salva perdia a assinatura. O
  ponteiro agora é corrigido antes de assinar (testado: todas as tabelas apontam certo). O
  validador do sistema também passou a avisar claramente quando o arquivo foi regravado por
  outro programa. Oriente: guardar e enviar o PDF exatamente como baixado do sistema.
- **Correção (02/10/2026) — validador do ITI "sem assinatura reconhecível":** no navegador, a
  biblioteca do espaço da assinatura usava `lastIndexOf('>>', 'utf8')`, que o Buffer do navegador
  interpreta como posição 0; com isso o catálogo e a página eram regravados com o dicionário
  fechado antes de `/AcroForm` e `/Annots` (sintaxe inválida), e leitores rígidos não
  encontravam o campo de assinatura. O Buffer foi ajustado para se comportar como o do Node
  (teste que simula o navegador garante). Também: textos do dicionário da assinatura (Razão,
  Nome, Localização) em ASCII e cabeçalho `%PDF-1.7`. PDFs gerados antes desta correção
  precisam ser gerados de novo.
- **Depois de publicar uma versão nova** com a página aberta, partes carregadas sob demanda
  (ex.: assinatura digital) não existem mais no servidor ("Failed to fetch dynamically imported
  module"). O sistema agora avisa e recarrega a página uma vez sozinho; e não entrega mais PDF
  sem assinatura nesse caso (pede para recarregar e baixar de novo).
- Certificados cuja cadeia não chega à AC Raiz v5 ou v12 (ex.: certificado de teste) aparecem
  como "assinatura íntegra, mas não confirmada como ICP-Brasil".
- Requer executar de novo `supabase/modules/treinamentos.sql`.

**Backup completo:** o backup de Configurações & Backup (ZIP ou JSON) inclui a seção
`modules.treinamentos` com cursos, instrutores, turmas e certificados; a restauração junta
por id e envia ao servidor. Os certificados digitais (A1) não entram no backup (ficam só no
servidor, criptografados). Backups antigos continuam sendo aceitos.

**Ligar/desligar:** Configurações & Backup → Módulos do sistema (por empresa; os dados
ficam guardados).

**Escolha do módulo no login:** depois de entrar, o usuário escolhe **Ensaios de EPI** ou
**Treinamentos**. O menu mostra só os blocos do módulo escolhido, mais os comuns:
- Ensaios de EPI: Dashboard, Clientes & OS, Ensaios de EPI, Validação de QR Code e
  Configuração do Sistema;
- Treinamentos: Treinamentos, Clientes, Validação de QR Code e Configuração do Sistema.

O botão **Trocar** (topo do menu) volta para a escolha. Reabrindo o app com a sessão
ativa, entra direto no último módulo usado; a cada novo login a escolha aparece de novo.
Quem só tem um módulo disponível (ex.: perfil cliente, ou Treinamentos desligado) entra
direto, sem a tela de escolha.

**Módulos por usuário (7.2):** em Usuários & Técnicos, ao cadastrar ou editar um usuário
com acesso, marque os **Módulos com acesso** (Ensaios de EPI, Treinamentos). A regra vale
no banco (coluna `users.allowed_modules`, função `jvm_can_use_module`): quem não tem o
módulo não lê nem grava aqueles dados, nem reserva numeração. Clientes são comuns a todos
os módulos. Administradores acessam sempre todos os módulos. Todos marcados = acesso a
todos, incluindo módulos novos. Usuários já cadastrados continuam com acesso a todos.
A mudança vale no próximo login do usuário. Requer executar de novo `supabase/schema.sql`
e `supabase/modules/treinamentos.sql`.

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

- **Troca de usuário exige a senha** (menu do usuário e botão "Trocar" do Modo Android): a senha do usuário escolhido é conferida como no login (Supabase Auth; sem internet, só quem já entrou no aparelho nos últimos 30 dias) e a sessão do banco passa a ser a dele. Só aparecem usuários da mesma empresa, ativos e com acesso ao sistema. A troca fica na auditoria e o novo usuário escolhe o módulo, como num login.

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

## Fotos guardadas à parte no aparelho

- As fotos dos ensaios (evidências e inspeção visual) saem de dentro dos registros e ficam
  guardadas como **arquivos binários** num armazenamento próprio do aparelho (área privada
  do app no disco). O ensaio guarda só a referência `jvm-foto:<id>`.
- A foto só é lida quando é exibida, impressa (PDF/Word), copiada para backup ou enviada.
  O limite passa a ser o **espaço livre em disco**, não a memória do aparelho.
- Cada foto ocupa ~25% menos (binário em vez de texto base64); fotos repetidas são
  guardadas uma única vez.
- Fotos antigas são movidas automaticamente na abertura do app. A foto é gravada primeiro
  e só depois o ensaio passa a apontar para ela: uma falha no meio nunca perde a foto.
- Ao sincronizar, a foto sobe para a nuvem e a cópia local é apagada na abertura seguinte.
  Uma referência local nunca vai para o banco: se o envio da foto falhar, ela segue
  embutida no registro, como antes.
- **Central de Sincronização → Armazenamento deste aparelho**: espaço usado e disponível,
  fotos guardadas e aguardando envio, tipo de banco local e se o armazenamento está
  protegido contra limpeza automática (com botões "Organizar fotos" e "Pedir proteção").
- **Pasta visível no celular (Galeria / Meus arquivos) não é possível** para app web
  instalado (Android e iPhone); exigiria converter o app em aplicativo nativo. Para ter as
  fotos em pasta, use o **Backup com Fotos (.ZIP)**.

## Editor de fotos do laudo

- No assistente de ensaio, cada foto tem o botão **Editar** (lápis na miniatura e no
  detalhe da foto).
- **Girar** 90° para a esquerda ou direita; **marcar** com seta, círculo, retângulo e texto;
  6 cores; espessura fina/média/grossa (proporcional ao tamanho da foto); desfazer,
  refazer e limpar marcações.
- As marcações acompanham a foto ao girar. Funciona com toque (celular/tablet) e mouse.
- Ao salvar, a foto editada substitui a anterior no ensaio (JPEG) e segue o fluxo normal:
  guardada à parte no aparelho e enviada à nuvem na sincronização. A foto original não é
  mantida.
- O botão de download do detalhe da foto passou a funcionar com as fotos guardadas no
  aparelho.

## Correções após a análise da versão 7.0 (30/09/2026)

- **Portal público (QR Code):** devolve só os dados do certificado. Fotos, colaborador,
  assinatura do cliente, medições detalhadas e observações internas ficam restritos a
  quem tem login. Sem login, o portal não exporta o laudo completo.
- **Cabeçalhos de segurança do site** (`public/.htaccess` e `public/_headers`): política de
  conteúdo (CSP), nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy e HSTS.
  Testados contra o build real (login, portal, telas, laudo e certificado em PDF).
- **Carregamento:** gerador de PDF, leitor de QR e instalação só são baixados quando a
  janela é aberta.
- **Defeito corrigido:** laudo de ensaio sem temperatura/umidade derrubava o app (tela branca).
  Agora mostra "N/I", e qualquer janela com erro mostra a mensagem com "Fechar".
- **Defeito corrigido:** campo vazio impedia gerar o PDF (sem aviso). Os 5 geradores de PDF
  aceitam campos vazios, e o usuário é avisado se um PDF falhar.
- **Câmera remota:** o celular sem login só envia fotos para uma sessão aberta pelo
  computador logado (válida por 4 h); código da sessão com 12 caracteres aleatórios.
- **Vínculo do ensaio:** se o cliente/equipamento existe no aparelho e ainda não subiu, o
  ensaio espera na fila em vez de subir sem o vínculo.
- **Editor de fotos:** a foto original é preservada na primeira edição (sobe para a nuvem e
  vai no backup) e pode ser restaurada.
- **Celular:** botão **Menu** na barra inferior com todas as telas (antes várias telas não
  tinham acesso pelo celular). Novo item **Usuários & Técnicos** no menu (admin e RT).
- Dependência `dompurify` atualizada (3.4.16).

Não alterados (projetos à parte): divisão dos arquivos muito grandes, testes automáticos
de tela (Playwright) e o alerta do `xlsx` (só afeta leitura de planilhas, que o app não faz).
A consulta de CNPJ usa, como última alternativa, o proxy público `api.allorigins.win`.

## Pendências recomendadas (não alteradas)

- **Arquivos muito grandes** (`TestWizardView`, `ReportEmissionView`, `syncEngine`...):
  dividir em módulos menores facilita a manutenção.
