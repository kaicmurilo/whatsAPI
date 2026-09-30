# Gerenciamento de Sessões

Cada sessão representa uma instância única do WhatsApp Web conectada a um número de telefone.

## Ciclo de Vida

1. **Início (`/session/start/:sessionId`)**: Inicializa o Puppeteer e aguarda o QR Code.
2. **Autenticação**: O usuário escaneia o QR Code via webhook ou endpoint `/session/qr/:sessionId`.
3. **Ready**: A sessão está ativa e pronta para enviar/receber dados.
4. **Interrupção (`/session/terminate/:sessionId`)**: Fecha o browser e limpa dados temporários (se configurado).

## Recuperação e diagnóstico

- **Queda do processo**: erros assíncronos internos do whatsapp-web.js/puppeteer (ex.: a página do WhatsApp Web recarrega no meio da reinjeção) são capturados em `server.js` (`unhandledRejection`) e logados com `[process]`. O processo continua; antes, o Node 22 encerrava a API e todas as sessões caíam.
- **Nova tentativa ao abrir**: se `initialize()` falhar (ex.: "Execution context was destroyed"), a sessão tenta de novo em 10 s, 30 s e 60 s. Não recria sessão excluída nem duplica sessão já reaberta. Depois de 3 tentativas, use Iniciar no painel.
- **Presa em "autenticando"**: o whatsapp-web.js emite `authenticated` e `ready` no mesmo callback; se algo falha no meio, o erro é engolido e a sessão nunca fica pronta. Se o `ready` não chega em 3 min após `authenticated`, o navegador é fechado (o pareamento fica) e reaberto pelo mesmo ciclo de nova tentativa. Log: `[session] falha ao inicializar sessão=<id>: ready não chegou 180s após autenticar`.
- **Motivo da desconexão**: logado como `[session] desconectada sessão=<id> motivo=<reason>`. `LOGOUT` = o WhatsApp desvinculou o aparelho (precisa de novo QR); `CONFLICT` = sessão aberta em outro lugar.
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
