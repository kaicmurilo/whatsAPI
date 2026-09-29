# Painel de métricas

Tela **Painel** no menu do painel (`?view=dashboard`). Serve para conferir volume e resultado da transmissão: dia, ontem, 7 dias, mês corrente, 30 dias e tudo.

`GET /panel/metrics` exige o token do painel e só lê dados da própria conta. Limite de 20 consultas por minuto por usuário, além do rate limit global.

## O que cada número conta

Fuso: `REPORT_TIMEZONE` (padrão `America/Sao_Paulo`). O dia começa à meia-noite local.

| Métrica | Regra |
|---|---|
| Enviadas | Destinatário de disparo com status `sent` e `sent_at` dentro do período. Conversa manual do chat não entra. |
| Entregues, lidas, reproduzidas | Desses enviados, quem já tem o tique correspondente (`delivered_at`, `read_at`, `played_at`), mesmo que o tique chegue depois. |
| Taxa de entrega | Entregues ÷ enviadas. |
| Taxa de leitura | Lidas ÷ enviadas. A tela também mostra lidas ÷ entregues. |
| Taxa de resposta | Quem mandou mensagem pessoal depois do envio, em até 7 dias, em qualquer instância da conta. Casa o telefone com e sem o 9º dígito. |
| Números únicos | Telefones distintos entre as enviadas do período. |
| Falhas e suprimidos | Destinatários `failed` ou `suppressed` de disparos **criados** no período (não há horário próprio da falha). |
| Saídas | Números que mandaram a palavra de supressão no período (`suppressed_numbers.requested_at`). |
| Campanhas | Disparos criados no período. Em andamento, pausados e programados são o estado agora, não do período. |
| Por instância | `sender_session_id` de quem enviou; se estiver vazio, a instância principal do disparo. A coluna mostra o `sessionId` configurado; nome e telefone do WhatsApp ficam na linha de baixo. Instância sem envio aparece com zero. |

O gráfico é sempre os últimos 30 dias locais, independente do período escolhido nos cartões.

## Arquivos

`src/panel/metricsRanges.js`, `src/panel/metricsRepository.js`, `src/panel/metricsController.js`, `src/panel/panelRoutes.js`, `web/src/components/DashboardPane.tsx`, `web/src/styles/app.css`.

Sem migration: usa `broadcast_run_recipients`, `broadcast_runs`, `whatsapp_messages` e `suppressed_numbers`.
