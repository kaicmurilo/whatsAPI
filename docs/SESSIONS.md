# Gerenciamento de Sessões

Cada sessão representa uma instância única do WhatsApp Web conectada a um número de telefone.

## Ciclo de Vida

1. **Início (`/session/start/:sessionId`)**: Inicializa o Puppeteer e aguarda o QR Code.
2. **Autenticação**: O usuário escaneia o QR Code via webhook ou endpoint `/session/qr/:sessionId`.
3. **Ready**: A sessão está ativa e pronta para enviar/receber dados.
4. **Interrupção (`/session/terminate/:sessionId`)**: Fecha o browser e limpa dados temporários (se configurado).

## Recuperação e diagnóstico

- **Queda do processo**: erros assíncronos internos do whatsapp-web.js/puppeteer (ex.: a página do WhatsApp Web recarrega no meio da reinjeção) são capturados em `server.js` (`unhandledRejection`) e logados com `[process]`. O processo continua; antes, o Node 22 encerrava a API e todas as sessões caíam.
- **Nova tentativa ao abrir**: se `initialize()` falhar (ex.: "Execution context was destroyed"), a sessão tenta de novo com espera crescente: 10 s, 30 s, 1 min, 2 min, 2 min, 5 min, 5 min e 10 min (~25 min). Antes de reabrir, espera o navegador antigo fechar (e o encerra à força se travar): dois Chromium no mesmo perfil podem corromper o pareamento. Não recria sessão excluída nem duplica sessão já reaberta. Depois das 8 tentativas, use Iniciar no painel.
- **Presa em "autenticando"**: o whatsapp-web.js emite `authenticated` e `ready` no mesmo callback; se algo falha no meio, o erro é engolido e a sessão nunca fica pronta. Se o `ready` não chega em 3 min após `authenticated`, o navegador é fechado (o pareamento fica) e reaberto pelo mesmo ciclo de nova tentativa. Log: `[session] falha ao inicializar sessão=<id>: ready não chegou 180s após autenticar`. Nessa janela, erros da página vão para o log como `[session] erro na página entre authenticated e ready`.
  - Diagnóstico (2026-09-30): a lib para no meio do `attachEventListeners` (8 de 17 `exposeFunction` registradas), com a página conectada, sincronizada e respondendo. Sem erro no Node nem na página: aparenta ser o puppeteer esperando um contexto de execução que não chega. As PRs upstream #201853 e #201893 tratam sintomas parecidos, mas não esse ponto. Reabrir costuma resolver em 1 a 3 tentativas.
- **Navegador que morre sozinho**: se o Chromium cai (falta de memória, crash), o evento `disconnected` do navegador descarta o client e reabre pelo mesmo ciclo. Antes o client ficava no Map sem navegador: status parado e Iniciar respondendo 422. Fechamentos intencionais (encerrar, excluir, desligar) removem esse listener antes.
- **`ready` falso**: depois de um LOGOUT a página volta ao QR e a lib emite `ready` de novo (ela reage a qualquer mudança de `hasSynced`). O painel só marca conectada se `Socket.hasSynced` for `true`; o resto é logado como `ready ignorado`.
- O status do painel vai para `disconnected` quando um client é descartado, em vez de ficar parado em "autenticando".
- **Motivo da desconexão**: logado como `[session] desconectada sessão=<id> motivo=<reason>`. `LOGOUT` = o WhatsApp desvinculou o aparelho (precisa de novo QR); `CONFLICT` = sessão aberta em outro lugar.
- **Causa do "autenticando" (2026-09-30)**: logo depois de autenticar, o Chrome troca o alvo da página (o WhatsApp Web recarrega/troca de processo). Os comandos em andamento da inicialização da lib morrem com `TargetCloseError: Target closed`; a exceção fica dentro de uma função exposta à página e some. Na reinjeção, a lib re-registra o listener `change:hasSynced`, mas o WhatsApp já sincronizou: o evento não volta e o `ready` nunca chega. Às vezes o `ready` chegava com os listeners pela metade (o `WWebJS` sobrevive à troca, mas as funções expostas não) e as mensagens daquela conta não eram registradas.
  - Correção em `patches/whatsapp-web.js+1.34.7.patch`: (1) no fim do `inject()`, se `Socket.hasSynced` já for `true`, roda o handler na hora; (2) o handler roda uma vez por vez e, se morrer no meio, tenta de novo em 2 s (até 5); (3) só pula a inicialização quando o `attachEventListeners` terminou de verdade; (4) `exposeFunction` que o puppeteer recusa com `already exists` é removido e registrado de novo no alvo atual; (5) o refresh de QR ocioso rodava `window` no Node (`window is not defined`).
  - Resultado: as contas pareadas ficam prontas em ~10 s depois do boot, com os 17 listeners registrados, mesmo com `Target closed` no meio (antes: 3+ min ou nunca).
  - `[puppeteer] função exposta … lançou` / `exposeFunction … falhou` no log vêm de `src/utils/puppeteerErrorLogger.js`: é o que mostrou o erro engolido. `Target closed` ali é esperado na troca de alvo; o que importa é o `pronto para sessão` logo depois.
- **Desligamento**: o puppeteer liga `handleSIGTERM/SIGINT/SIGHUP` por padrão e dá SIGKILL no Chrome ao receber o sinal, antes do `closeAllSessions`. Agora vem desligado (`handleSIG*: false`) e o desligamento fecha os navegadores com calma (log: `N navegador(es) fechado(s) no desligamento`).
- **Reinício do container**: travas órfãs do perfil do Chromium são removidas e o desligamento fecha os navegadores, para não pedir QR de novo.

## Segurança e Propriedade (Ownership)

O sistema garante que um usuário (autenticado via JWT) só possa interagir com sessões que ele mesmo criou:
- Ao iniciar uma sessão, o `userId` do token é vinculado ao `sessionId` no banco.
- Todas as chamadas subsequentes verificam se o `userId` do token atual é o dono daquela sessão.

## Endpoints de Status

- **GET /session/status/:sessionId**: Retorna o estado atual (CONNECTED, DISCONNECTED, INITIALIZING).
- **GET /session/qr/:sessionId**: Retorna a string do QR Code.
- **GET /session/qr/:sessionId/image**: Retorna o QR Code renderizado em PNG.

## Validação de Nomes
O `sessionId` deve ser alfanumérico e não conter caracteres especiais para garantir compatibilidade com o sistema de arquivos onde os dados são salvos (`./sessions/[sessionId]`).
