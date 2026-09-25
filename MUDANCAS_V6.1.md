# JVM Dielectric Lab — Mudanças da versão 6.1 (Supabase como banco único)

## ⚠️ Passo obrigatório
Execute `supabase/schema.sql` no SQL Editor do Supabase **antes** de abrir o app atualizado.
Sem isso o app continua funcionando (envia no formato antigo), mas perde:
cópia completa dos ensaios, exclusões entre aparelhos, Realtime e fotos no Storage.

Na primeira abertura após a atualização, cada aparelho faz uma migração única:
baixa tudo do Supabase, preserva edições locais mais recentes, recupera dados
que só existiam no antigo IndexedDB e reenvia a base completa.

## Bancos de dados removidos
| Removido | Substituído por |
|---|---|
| Firebase / Firestore (`src/firebase.ts`, regras, config, dependência `firebase`) | Supabase (tabelas + Realtime) |
| Hostinger MySQL/PHP (`hostingerSyncService`, `hostingerDatabaseService`, `HostingerDatabaseModal`) | Supabase. O domínio continua apenas como **endereço do portal de validação** (hospedagem do app) |
| IndexedDB (`indexedDbService`) | Cache offline + fila de envio; fotos no Supabase Storage; PDFs salvos no aparelho via Cache Storage |
| Normas, relatórios consolidados e dados do laboratório (antes só no Firebase) | Novas tabelas `norms`, `consolidated_reports` e coluna `companies.lab_info` |
| Câmera remota via Firestore | Supabase Realtime (Broadcast) + foto no Storage |

## Erros corrigidos
**Perda de dados**
- Varredura de sincronização regravava o armazenamento só com a empresa ativa → apagava ensaios/EPIs/OS/clientes das demais empresas.
- Itens da fila eram descartados após 5 falhas → agora nunca são descartados (nova tentativa progressiva, erro visível).
- Pull sem paginação parava em 1000 linhas → paginado.
- Pull descartava campos sem coluna própria (escadas, detectores, mantas etc.) → coluna `payload` com o registro completo.
- Restauração de backup substituía a lista inteira (apagava outras empresas) e não ia para a nuvem → mescla por ID e envia ao Supabase.
- Excluir instrumento gravava direto no armazenamento (apagava instrumentos das outras empresas, sem sincronizar) → exclusão lógica sincronizada.
- Atualizar o RT nas configurações sobrescrevia a lista de usuários de outras empresas.

**Sincronização**
- Exclusões não se propagavam e itens "ressuscitavam" → exclusão lógica com `deleted_at`.
- Lote marcado como sincronizado mesmo com falhas individuais → marcação por item.
- Edição feita durante o envio era marcada como sincronizada sem ter sido enviada → corrigido.
- Erro de chave estrangeira trocava o `company_id` para `comp-jvm` (misturava empresas) → empresa nunca é alterada.
- Instrumentos entravam na fila como `norm`.
- `UNIQUE` em nº de ensaio/laudo/OS rejeitava ensaios de outro tablet com a mesma numeração offline.
- Toda abertura reenviava a base inteira (com fotos base64) → envio incremental.
- `updated_at` vinha do relógio do tablet → definido pelo servidor.
- Fila duplicava o registro inteiro (fotos inclusive) no armazenamento → guarda só a referência.

**Segurança / funcionais**
- Senhas universais (`123456`, `admin`, `Jvm@141519`) entravam em qualquer conta → removidas.
- Portal `/validar/CODIGO` só procurava no aparelho local (cliente sempre via "não encontrado") → consulta o Supabase.
- Câmera remota podia disparar capturas repetidas (comando "shutter" ficava ativo) → comando entregue uma única vez.

## Telas
Layout mantido. Mudanças apenas de texto/ação:
- **Central de Sincronização**: "Hostinger" → "Supabase"; removido o botão "Criar Banco Hostinger"; card da direita mostra o portal público de validação; fila mostra o erro de cada item.
- **Configurações**: seção Hostinger virou "Portal Público de Validação & Sincronização" (sem campo de API key; o toggle de sincronização automática agora controla o Supabase).

## Recomendações pendentes (não alteradas para não mudar o funcionamento)
- As políticas RLS permitem leitura/escrita total com a chave pública. Para produção, migrar o login para **Supabase Auth** e restringir por `company_id`.
- Senhas ficam em texto puro na tabela `users` e a tela de login preenche a senha ao escolher um usuário rápido.
