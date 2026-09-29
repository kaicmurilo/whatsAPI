# API do painel (`/panel`)

Rotas internas usadas pelo painel web (`/app`). Não entram no Swagger público. Todas exigem `Authorization: Bearer <access_token>`
e só enxergam dados do próprio usuário; rotas com `:sessionId` exigem que a instância seja dele.

Resposta padrão: `{ "success": true, "data": … }` ou `{ "success": false, "error": "mensagem" }`.
Listagens paginadas aceitam `page` e `perPage` e devolvem `{ items, total }`.

## Instâncias e conversas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/panel/sessions` | Instâncias do usuário com status. O nome no painel é o `sessionId` definido na criação; `pushName` e `phone` aparecem só como detalhe, cada um na sua linha, sem reticências |
| GET | `/panel/sessions/:sessionId/chats` | Conversas salvas. O nome do grupo é o título do WhatsApp, não o do último participante. |
| GET | `/panel/sessions/:sessionId/chats/:chatId/messages` | Mensagens de uma conversa. `chatName` é o último título real do chat (vazio se só havia o JID). |
| POST | `/panel/sessions/:sessionId/chats/:chatId/messages` | Envia texto/anexo (instância conectada; rate limit) |
| GET | `/panel/sessions/:sessionId/numbers/:phone` | Resolve se o número tem WhatsApp |
| GET | `/panel/stream` | Eventos em tempo real (SSE): mensagens, status, progresso de disparo |

O nome do grupo não vem de `message.getChat()`: no WhatsApp Web atual esse caminho quebra ao serializar o grupo e gravava vazio (a lista então mostrava o JID, ou o nome de um participante). O título é lido do Store (`formattedTitle`, ou o assunto em `groupMetadata.subject` quando o título é só o id). A lista usa o último título real do chat, não o `chat_name` da última mensagem. Conversa 1:1 sem título continua caindo no último remetente. Na reconexão, mensagens que já existiam e estavam sem nome (ou só com o JID) recebem o título; isso não republica a mensagem.

## Agenda, arquivos e modelos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET · POST | `/panel/contacts` | Lista / cria ou atualiza contato |
| DELETE | `/panel/contacts/:contactId` | Remove contato |
| GET · POST | `/panel/files` | Lista / envia arquivo (corpo binário, até `PANEL_MAX_FILE_SIZE`) |
| DELETE | `/panel/files/:fileId` | Remove arquivo (409 se usado em modelo) |
| GET · POST | `/panel/templates` | Lista / cria modelo (texto, variações e até 10 anexos) |
| GET · PUT · DELETE | `/panel/templates/:templateId` | Detalhe / edita / remove modelo |

Corpo de criar/editar modelo:

```json
{
  "name": "Oferta",
  "text": "Olá, tudo bem?",
  "variations": ["Oi, como vai?", "E aí, tudo certo?"],
  "audioAsVoice": true,
  "fileIds": []
}
```

`variations` é opcional (padrão `[]`). Cada item é texto até 4096 caracteres; linhas em branco são ignoradas. Não há limite de quantidade. A coluna `message_templates.text_variations` (JSONB) é criada no boot.

## Listas de transmissão

| Método | Rota | Descrição |
|--------|------|-----------|
| GET · POST | `/panel/broadcast-lists` | Lista / cria lista (até 5.000 contatos) |
| POST | `/panel/broadcast-lists/import` | Importa linhas de planilha (`{ fileName, rows }`; o nome do arquivo vira o nome da lista) |
| GET · PUT · DELETE | `/panel/broadcast-lists/:listId` | Detalhe / edita / remove lista |

A planilha é lida no navegador. A interface mostra o nome e o tamanho do arquivo, quantas linhas saíram da leitura e o resultado (ou o erro do servidor). Se a leitura passar de 30 segundos, ela é cancelada e o botão volta a aceitar outro arquivo.

Abas cuja XML descompactada passa de 512 KB são descompactadas num Web Worker (`blob:`). O CSP do painel precisa de `worker-src 'self' blob:`. Sem isso o worker não devolve a planilha, o botão permanece em “Lendo planilha…” e a importação seguinte não começa. Planilhas menores descompactam na thread principal e não dependem do worker.

Três formatos:

- Lista simples: colunas de nome e telefone detectadas pelo conteúdo (`Nome | Cidade | (67) 99999-9999`), com ou sem cabeçalho. Telefone nacional brasileiro ganha o `55`.
- Exportação de contatos: cabeçalho com `country_code` e `phone_number` (e `saved_name` / `public_name`). O telefone já vem com DDI e é guardado assim. O nome é o `saved_name`, ou o `public_name` quando o salvo está vazio.
- Exportação de pacientes: cabeçalho com `Nome Completo` e `Celulares` ou `Telefones`, mesmo com linhas de título antes. O nome é o completo, ou o social, ou o apelido. Celular e telefone fixo entram; vários números na mesma célula viram contatos separados. Telefone nacional ganha o `55`.

## Configurações e supressão

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/panel/settings` | Configuração da conta (cria o padrão na primeira leitura) |
| PUT | `/panel/settings` | Substitui a configuração. Rate limit: 30/min por usuário |
| GET | `/panel/suppression` | Números que pediram para sair (`page`, `perPage`, `search`) |
| DELETE | `/panel/suppression/:suppressionId` | Tira o número da supressão. Não apaga o contato da agenda |

Padrão ao criar a linha: supressão **ligada** com `SAIR`, `PARAR`, `REMOVER`, `STOP`. Parar quem respondeu, nome no início, teto diário e horário de envio começam **desligados**. Teto padrão 80 (mínimo 20, máximo 400). Janela padrão `08:00`–`20:00` (fuso `REPORT_TIMEZONE`, padrão `America/Sao_Paulo`).

```json
{
  "suppressionEnabled": true,
  "suppressionKeywords": ["SAIR", "PARAR"],
  "stopOnReply": false,
  "prependFirstName": false,
  "dailyCapEnabled": false,
  "dailyCap": 80,
  "quietHoursEnabled": false,
  "quietStart": "08:00",
  "quietEnd": "20:00"
}
```

Cada palavra é um termo só, sem espaço, até 32 caracteres, no máximo 10. Com a supressão ligada, a lista não pode ficar vazia. Horário inicial e final não podem ser iguais.

No relatório, destinatário também pode ficar `suppressed`, `duplicate` ou `replied` (não entra em enviado nem em falha).

## Painel de métricas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/panel/metrics` | Totais de transmissão por período e por instância. Rate limit: 20/min por usuário, além do limite global |

O comportamento (o que entra em enviada, entrega, leitura e resposta) está em `docs/DASHBOARD.md`.

## Disparos

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/panel/sessions/:sessionId/broadcasts` | Dispara agora (202) ou programa com `scheduledAt` (201) |
| GET | `/panel/broadcasts` | Histórico paginado |
| GET | `/panel/broadcasts/:runId` | Detalhe com destinatários |
| POST | `/panel/broadcasts/:runId/pause` | Pausa um disparo em andamento (202; para antes do próximo contato) |
| POST | `/panel/broadcasts/:runId/retry` | Retomar/Reprocessar: envia só para quem não recebeu (202) |
| POST | `/panel/broadcasts/:runId/cancel` | Cancela programado ou pausado; aborta em andamento (202) |
| PUT | `/panel/broadcasts/:runId/pacing` | Altera o intervalo (`{ pacing }`); em andamento vale a partir da próxima espera |
| PUT | `/panel/broadcasts/:runId/sessions` | Troca o rodízio (`{ sessionIds }`, 1 a 20); em andamento vale a partir do próximo contato |
| GET | `/panel/broadcasts/:runId/report` | Resumo: enviado, entregue, lido, reproduzido |
| GET | `/panel/broadcasts/:runId/report/recipients` | Destinatários do relatório (filtro `situation`) |
| GET | `/panel/broadcasts/:runId/report.csv` | Exporta CSV |
| POST | `/panel/broadcasts/:runId/report/refresh` | Atualiza tiques consultando o WhatsApp (só leitura) |

### Corpo do disparo

```json
{
  "listId": "12",
  "templateId": "3",
  "sessionIds": ["loja-centro-01", "loja-centro-02"],
  "pacing": { "minSeconds": 20, "maxSeconds": 45, "randomOrder": true },
  "scheduledAt": "2026-10-01T13:00:00.000Z"
}
```

- Conteúdo: `templateId` **ou** `text` e/ou `fileId` (nunca os dois; `templateId` vazio é recusado com 422).
- `sessionIds`: uma, algumas ou todas as instâncias, inclusive desconectadas. O `sessionId` da URL precisa estar na lista. Cada contato sai pela próxima instância conectada; desconectada fica no rodízio e só envia quando voltar. Envio imediato exige ao menos uma conectada. Programado só começa quando todas as marcadas estão conectadas.
- Várias listas podem usar as mesmas instâncias ao mesmo tempo. Cada instância envia um contato por vez e alterna a lista, respeitando o intervalo de quem acabou de enviar.
- Se o modelo tem variações, cada contato recebe uma versão em rodízio (texto principal, depois as variações), pela posição na lista. Sem variações, o texto é o mesmo para todos.
- `pacing` opcional (padrão 20–45 s, ordem aleatória); limites de 3 a 600 s.
- `scheduledAt` opcional: de 1 min a 90 dias à frente. Outro disparo na mesma instância não impede o início: os envios alternam.

### Status de um disparo

`scheduled` → `running` → `done` | `failed` | `canceled` | `paused` | `interrupted`

- `paused`: pelo usuário, instância desconectada ou 3 falhas de envio seguidas (motivo em `error`).
- `interrupted`: a API reiniciou durante o envio.
- `retry` aceita qualquer status exceto `running` e `scheduled`; quem tem status `sent` nunca é reaberto.

## Login do painel

A tela de login (`/app`) tem a opção **Salvar user id e secret neste navegador**. Marcada, grava `user_id` e `user_secret` no `localStorage` ao enviar o formulário e preenche os campos na próxima visita. Desmarcada, apaga o que estava salvo. O access token continua só na aba (`sessionStorage`) e some ao fechar.
