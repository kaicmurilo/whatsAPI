# Disparo de transmissão

## Instâncias

O formulário “Disparar” começa com a instância já aberta no painel (`?session=`), se ela estiver conectada. Senão, com a primeira conectada. Dá para marcar uma, algumas ou todas. O rótulo é o nome configurado na criação (`sessionId`); nome e número do WhatsApp vêm depois, como detalhe.

Cada contato sai pela instância marcada com menos envios no dia (fuso do painel, o mesmo do dashboard). Se duas ou mais empatam, sai pela que enviou há mais tempo; quem nunca enviou vem na frente. A conta é de todos os disparos da conta, não só da lista atual. Instância desconectada (ou em QR) pode ser marcada: fica na lista e só entra quando o status volta a `connected`. Enquanto estiver fora, a escolha pula para a próxima elegível. Se nenhuma marcada estiver conectada, o disparo pausa.

No histórico, “Editar instâncias” troca o rodízio do que ainda falta enviar (inclusive um disparo em andamento, a partir do próximo contato, e um programado). Programado começa quando todas as marcadas estão conectadas, mesmo que outra lista já esteja enviando por elas.

**Excluir** na lista tira a lista, os contatos dela e os disparos desse histórico. Se algum ainda está enviando, para antes do próximo contato. O painel do dia deixa de contar esses envios.

**Retomar todas**, no histórico, reabre os disparos interrompidos e os pausados à mão (usuário, instância caída ou falhas seguidas). Pausa por horário ou teto diário segue retomando sozinha. **Cancelar** num interrompido encerra sem apagar a lista.

**Salvar o contato antes de enviar**: depois de confirmar que o número tem WhatsApp e antes da primeira parte da mensagem, o contato é salvo na conta da instância que vai enviar (`saveOrEditAddressbookContact`, o mesmo "Salvar contato" do WhatsApp Web; só na conta, não na agenda do celular). Usa o número que o WhatsApp devolveu (resolve o 9º dígito) e o nome da lista, dividido em nome e sobrenome no primeiro espaço; sem nome, usa o telefone. Nunca bloqueia: erro ou mais de 10 s sem resposta vira um aviso no log (`não salvou o contato antes do envio telefone=****1234`) e o envio segue.

Fila única de envio (`broadcastLane.js`): um contato por vez em todo o processo, mesmo com várias listas e várias instâncias. Depois de cada envio, o próximo — outra instância ou outra lista — espera o intervalo sorteado de quem acabou de enviar. Instâncias diferentes não disparam juntas. Cada número ainda só volta a enviar depois desse mesmo intervalo. O disparo demora mais de propósito, para reduzir risco de bloqueio. Se o banco falha no meio da vez (timeout), a fila é liberada e a tentativa se repete; um erro ali não deixa as outras listas esperando para sempre.

Envio imediato exige que pelo menos uma marcada esteja conectada. As desconectadas marcadas entram no rodízio quando voltarem. Programar não exige conexão agora: o horário só dispara quando todas as marcadas estiverem conectadas.

`PUT /panel/broadcasts/:runId/sessions` com `{ sessionIds: string[] }` (1 a 20, dono de cada uma). O `POST` de disparo continua em `/panel/sessions/:sessionId/broadcasts` e o `sessionId` da URL precisa estar em `sessionIds`.

A coluna `broadcast_runs.session_ids` é criada no boot (`ensurePanelSchema`). `session_id` continua sendo a primeira da lista.

## Telegram

Cada bot do Telegram é uma **instância**, na barra lateral junto dos números do WhatsApp. Para criar: **Nova instância → Telegram**, e cole o token do @BotFather (`/newbot`). Dá para ter vários bots. O id da instância é `telegram:<id do bot>`, o número antes do `:` no token. O `:` nunca aparece em id de sessão do WhatsApp, então os dois não colidem.

O painel do bot mostra o link `https://t.me/<bot>`, quantos contatos o abriram e o botão de remover.

O Telegram usa a **Bot API oficial**. Um bot não envia por número de telefone, só para quem deu `/start` nele. No `/start`, o bot pede o telefone pelo botão “Compartilhar meu telefone”, e só vale o próprio contato. O telefone é casado com a agenda (número exato ou variante do 9º dígito): o chat fica em `panel_contacts.telegram_chat_id` e o vínculo bot↔contato em `telegram_bot_contacts`. Quem não está na agenda entra com o nome do Telegram.

### Conta do Telegram (envio por telefone)

Bot só fala com quem o abriu. Para mandar a quem nunca falou com você, existe a instância **TG conta**: uma conta de usuário via MTProto (lib `telegram`/gramjs). Em **Nova instância → TG conta**, informe o telefone, o `api_id` e o `api_hash` (criados em my.telegram.org → API development tools) e depois o código que o Telegram manda. Se a conta tiver verificação em duas etapas, informe também a senha. A sessão (StringSession) fica em `telegram_accounts.session` e dá acesso total à conta: nunca vai para o navegador nem para o log. Remover a instância encerra a sessão no Telegram.

O envio pela conta faz `contacts.ImportContacts` com o telefone (salva o contato na conta, como o WhatsApp faz) e depois `sendMessage`/`sendFile`. Se o número não tem Telegram, ou a privacidade do contato não deixa achá-lo pelo telefone, o contato fica como falha sem pausar a campanha. Limite do Telegram (busca por telefone esgotada em `retryContacts`, `PEER_FLOOD` ou `FLOOD_WAIT`) põe a **conta inteira em pausa** (`telegram_accounts.cooldown_until`: 6 h para busca, 24 h para PEER_FLOOD, o tempo pedido no FLOOD_WAIT), para todos os disparos. O contato daquele momento volta a pendente. Disparo sem outra instância disponível pausa com `pause_code = cooldown`, e o agendador retoma sozinho quando a pausa acaba, igual a horário e teto diário. Disparo em massa por conta é contra os termos do Telegram e arrisca banimento. Use intervalos longos e listas pequenas.

No disparo, **Enviar por: Telegram** troca o seletor pelas instâncias do Telegram (bots e contas). Por contato: bot sorteado que ele abriu → outro bot marcado que ele abriu → conta sorteada → outra conta marcada. Quem abriu um bot recebe pelo bot, o que poupa a conta.

Um disparo usa um canal só. O rodízio entre os bots marcados é o mesmo do WhatsApp (menos envios no dia). Se o bot sorteado não foi aberto pelo contato, sai por outro bot marcado que ele abriu, e o envio conta para quem enviou de fato. Quem não abriu nenhum dos bots falha com “Contato sem Telegram vinculado”, assim como quem bloqueou o bot. Nenhum dos dois casos conta como falha seguida nem pausa a campanha.

Fila, intervalo, horário, teto diário (por bot), supressão, dedup, pausar, retomar, editar instâncias, programar e relatório funcionam igual. O Telegram não informa entrega nem leitura para bots: o relatório para em “enviado” e não há “Atualizar tiques”.

Mídia: imagem → `sendPhoto`, vídeo → `sendVideo`, áudio → `sendVoice` (se “como voz” e OGG/MP3/M4A) ou `sendAudio`, o resto → `sendDocument`. Legenda acima de 1024 caracteres sai como texto logo depois da mídia. O Bot API aceita upload de até 50 MB.

Limites: bots e polling ficam em memória (uma réplica, igual ao runner). O token fica só em `telegram_bots.token`. A primeira versão (um bot nas Configurações) é migrada no boot.

Arquivos: `src/panel/telegram*.js`, `src/panel/broadcastChannels.js`, `web/src/components/NewTelegramBotForm.tsx`, `TelegramRailItem.tsx`, `TelegramBotPane.tsx`, `ChannelPicker.tsx`.

## Fila

O menu **Fila** lista os contatos pendentes de todos os disparos abertos (rodando, pausados, interrompidos), na ordem de envio, com busca e paginação. **Remover da fila** grava `removed`: o gate confere antes de cada envio, então vale mesmo com o disparo rodando. Retomar ou reprocessar não traz o contato de volta. No relatório, a situação é "Removido da fila".

## Conteúdo

A mensagem da campanha (modelo ou texto/arquivo) é enviada direto — sem saudação prévia.

Se o modelo tem variações de texto, cada contato recebe uma versão em rodízio (texto principal e as variações, nesta ordem), pela posição na lista. A escolha fica gravada nas partes do disparo, então editar o modelo depois não muda um envio já iniciado, e um retry manda a mesma versão para o mesmo contato. Sem variações, o texto é único.

Arquivos: `web/src/components/BroadcastSendForm.tsx`, `web/src/components/InstancePicker.tsx`, `web/src/components/RunInstancesEditor.tsx`, `src/panel/broadcastRunner.js`, `src/panel/broadcastService.js`, `web/src/styles/library.css`.

O trilho de instâncias fica na altura da janela. O formulário “Nova instância” não alarga a coluna nem cobre o conteúdo ao lado (`web/src/styles/app.css`).

## Configurações da conta

Tela **Configurações**, na área principal inteira (não na coluna estreita do chat), centralizada com a mesma margem dos dois lados. Opções em cartões: supressão e disparo lado a lado, ritmo na largura toda, lista de números suprimidos abaixo. A linha nasce na primeira leitura (`panel_user_settings`).

Agenda, arquivos, mensagens e transmissão usam a mesma coluna central. No histórico, Relatório, Retomar e Cancelar ficam na mesma linha.

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
