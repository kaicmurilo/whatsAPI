# Disparo de transmissão

## Instâncias

O formulário “Disparar” começa com a instância já aberta no painel (`?session=`), se ela estiver conectada. Senão, com a primeira conectada. Dá para marcar uma, algumas ou todas.

Cada contato sai pela próxima instância marcada, em rodízio. Só entram no rodízio instâncias com status `connected` (sessão em QR ou desconectada é ignorada). Se nenhuma estiver conectada, o disparo pausa.

No histórico, “Editar instâncias” troca o rodízio do que ainda falta enviar (inclusive um disparo em andamento, a partir do próximo contato, e um programado). Programado começa quando todas as marcadas estão conectadas, mesmo que outra lista já esteja enviando por elas.

Duas ou mais listas podem disparar ao mesmo tempo nas mesmas instâncias. Cada instância manda um contato por vez e alterna a lista: um da primeira, espera o intervalo dela, um da segunda, e assim por diante. O intervalo configurado continua valendo para a instância, não dobra porque há duas listas.

Envio imediato exige que todas as marcadas estejam conectadas. Programar não: a conexão é conferida no horário.

`PUT /panel/broadcasts/:runId/sessions` com `{ sessionIds: string[] }` (1 a 20, dono de cada uma). O `POST` de disparo continua em `/panel/sessions/:sessionId/broadcasts` e o `sessionId` da URL precisa estar em `sessionIds`.

A coluna `broadcast_runs.session_ids` é criada no boot (`ensurePanelSchema`). `session_id` continua sendo a primeira da lista.

## Conteúdo

A mensagem da campanha (modelo ou texto/arquivo) é enviada direto — sem saudação prévia.

Se o modelo tem variações de texto, cada contato recebe uma versão em rodízio (texto principal e as variações, nesta ordem), pela posição na lista. A escolha fica gravada nas partes do disparo, então editar o modelo depois não muda um envio já iniciado, e um retry manda a mesma versão para o mesmo contato. Sem variações, o texto é único.

Arquivos: `web/src/components/BroadcastSendForm.tsx`, `web/src/components/InstancePicker.tsx`, `web/src/components/RunInstancesEditor.tsx`, `src/panel/broadcastRunner.js`, `src/panel/broadcastService.js`, `web/src/styles/library.css`.

O trilho de instâncias fica na altura da janela. O formulário “Nova instância” não alarga a coluna nem cobre o conteúdo ao lado (`web/src/styles/app.css`).
