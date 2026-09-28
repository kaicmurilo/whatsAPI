# API do painel (`/panel`)

Rotas internas usadas pelo painel web (`/app`). Não entram no Swagger público. Todas exigem `Authorization: Bearer <access_token>`
e só enxergam dados do próprio usuário; rotas com `:sessionId` exigem que a instância seja dele.

Resposta padrão: `{ "success": true, "data": … }` ou `{ "success": false, "error": "mensagem" }`.
Listagens paginadas aceitam `page` e `perPage` e devolvem `{ items, total }`.

## Instâncias e conversas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/panel/sessions` | Instâncias do usuário com status |
| GET | `/panel/sessions/:sessionId/chats` | Conversas salvas |
| GET | `/panel/sessions/:sessionId/chats/:chatId/messages` | Mensagens de uma conversa |
| POST | `/panel/sessions/:sessionId/chats/:chatId/messages` | Envia texto/anexo (instância conectada; rate limit) |
| GET | `/panel/sessions/:sessionId/numbers/:phone` | Resolve se o número tem WhatsApp |
| GET | `/panel/stream` | Eventos em tempo real (SSE): mensagens, status, progresso de disparo |

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

A planilha é lida no navegador. Dois formatos:

- Lista simples: colunas de nome e telefone detectadas pelo conteúdo (`Nome | Cidade | (67) 99999-9999`), com ou sem cabeçalho. Telefone nacional brasileiro ganha o `55`.
- Exportação de contatos: cabeçalho com `country_code` e `phone_number` (e `saved_name` / `public_name`). O telefone já vem com DDI e é guardado assim. O nome é o `saved_name`, ou o `public_name` quando o salvo está vazio.

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
- `sessionIds`: uma, algumas ou todas as instâncias. O `sessionId` da URL precisa estar na lista. Cada contato sai pela próxima instância conectada.
- Várias listas podem usar as mesmas instâncias ao mesmo tempo. Cada instância envia um contato por vez e alterna a lista, respeitando o intervalo de quem acabou de enviar.
- Se o modelo tem variações, cada contato recebe uma versão em rodízio (texto principal, depois as variações), pela posição na lista. Sem variações, o texto é o mesmo para todos.
- `pacing` opcional (padrão 20–45 s, ordem aleatória); limites de 3 a 600 s.
- `scheduledAt` opcional: de 1 min a 90 dias à frente. Outro disparo na mesma instância não impede o início: os envios alternam.

### Status de um disparo

`scheduled` → `running` → `done` | `failed` | `canceled` | `paused` | `interrupted`

- `paused`: pelo usuário, instância desconectada ou 3 falhas de envio seguidas (motivo em `error`).
- `interrupted`: a API reiniciou durante o envio.
- `retry` aceita qualquer status exceto `running` e `scheduled`; quem tem status `sent` nunca é reaberto.
