# Disparo de transmissão

O formulário “Disparar” usa a instância já aberta no painel (`?session=`). Se nenhuma estiver selecionada, usa a primeira conectada. A escolha manual no select passa a valer até o usuário trocar de novo.

Os selects ficam dentro da coluna do formulário (máx. 22rem). O texto longo de uma mensagem salva não alarga a coluna nem cobre a tabela de listas.

Arquivos: `web/src/components/BroadcastSendForm.tsx`, `web/src/styles/library.css`.

O trilho de instâncias fica na altura da janela. O formulário “Nova instância” não alarga a coluna nem cobre o conteúdo ao lado (`web/src/styles/app.css`).
