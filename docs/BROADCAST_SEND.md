# Disparo de transmissão

## Instâncias

O formulário “Disparar” começa com a instância já aberta no painel (`?session=`), se ela estiver conectada. Senão, com a primeira conectada. Dá para marcar uma, algumas ou todas.

Cada contato sai pela próxima instância marcada, em rodízio. Só entram no rodízio instâncias com status `connected` (sessão em QR ou desconectada é ignorada). Se nenhuma estiver conectada, o disparo pausa.

No histórico, “Editar instâncias” troca o rodízio do que ainda falta enviar (inclusive um disparo em andamento, a partir do próximo contato, e um programado). Programado começa quando todas as marcadas estão conectadas, mesmo que outra lista já esteja enviando por elas.

Fila única de envio (`broadcastLane.js`): um contato por vez em todo o processo, mesmo com várias listas e várias instâncias. Depois de cada envio, o próximo — outra instância ou outra lista — espera o intervalo sorteado de quem acabou de enviar. Instâncias diferentes não disparam juntas. Cada número ainda só volta a enviar depois desse mesmo intervalo. O disparo demora mais de propósito, para reduzir risco de bloqueio.

Envio imediato exige que todas as marcadas estejam conectadas. Programar não: a conexão é conferida no horário.

`PUT /panel/broadcasts/:runId/sessions` com `{ sessionIds: string[] }` (1 a 20, dono de cada uma). O `POST` de disparo continua em `/panel/sessions/:sessionId/broadcasts` e o `sessionId` da URL precisa estar em `sessionIds`.

A coluna `broadcast_runs.session_ids` é criada no boot (`ensurePanelSchema`). `session_id` continua sendo a primeira da lista.

## Conteúdo

A mensagem da campanha (modelo ou texto/arquivo) é enviada direto — sem saudação prévia.

Se o modelo tem variações de texto, cada contato recebe uma versão em rodízio (texto principal e as variações, nesta ordem), pela posição na lista. A escolha fica gravada nas partes do disparo, então editar o modelo depois não muda um envio já iniciado, e um retry manda a mesma versão para o mesmo contato. Sem variações, o texto é único.

Arquivos: `web/src/components/BroadcastSendForm.tsx`, `web/src/components/InstancePicker.tsx`, `web/src/components/RunInstancesEditor.tsx`, `src/panel/broadcastRunner.js`, `src/panel/broadcastService.js`, `web/src/styles/library.css`.

O trilho de instâncias fica na altura da janela. O formulário “Nova instância” não alarga a coluna nem cobre o conteúdo ao lado (`web/src/styles/app.css`).

## Configurações da conta

Tela **Configurações**. A linha nasce na primeira leitura (`panel_user_settings`).

| Opção | Padrão | Efeito |
|---|---|---|
| Supressão | Ligada, palavras `SAIR`, `PARAR`, `REMOVER`, `STOP` | Mensagem recebida que é só a palavra (sem acento, sem maiúscula) entra em `suppressed_numbers`. Nenhum disparo da conta envia para esse telefone, com ou sem o 9º dígito. No relatório: suprimido, com a palavra e o horário. Remover da lista não apaga o contato. |
| Parar quem respondeu | Desligada | Se a pessoa mandar qualquer mensagem depois que o disparo começou, aquele contato sai da fila (`replied`). A campanha continua. |
| Primeiro nome | Desligada | Com a opção ligada, o primeiro nome entra no início da primeira parte de texto (`Maria, …`). Se o texto já começa com esse nome, não duplica. Sem nome útil (vazio ou “Sem nome”), `{nome}` é removido e nada é prefixado. Modelo só de arquivo não ganha uma bolha só com o nome. |
| Teto diário | Desligado, valor 80 | Conta envios `sent` da instância no dia local. Entre 20 e 400. Ao estourar, o disparo pausa (`pause_code = cap`) e o agendador retoma quando houver cota e a instância estiver conectada. |
| Horário de envio | Desligado, 08:00–20:00 | Fora da janela, pausa (`pause_code = quiet`) e retoma sozinho dentro dela. 08:00 entra; 20:00 não. Se o início for maior que o fim, a janela cruza a meia-noite. |

Dedup não tem interruptor: duas listas abertas da mesma conta não mandam duas vezes para o mesmo telefone. A segunda fica `duplicate` no relatório. Um disparo de outro dia pode mandar de novo.

Pausa do usuário, por instância caída ou por falhas seguidas **não** retoma sozinha. Só `quiet` e `cap`.

Quem já foi suprimido, duplicado ou respondeu não volta para a fila no Reprocessar. Falha e pendente voltam.

Arquivos: `src/panel/sendPolicy.js`, `src/panel/broadcastGate.js`, `src/panel/suppressionRepository.js`, `web/src/components/SettingsPane.tsx`.
