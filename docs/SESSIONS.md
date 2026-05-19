# Gerenciamento de Sessões

Cada sessão representa uma instância única do WhatsApp Web conectada a um número de telefone.

## Ciclo de Vida

1. **Início (`/session/start/:sessionId`)**: Inicializa o Puppeteer e aguarda o QR Code.
2. **Autenticação**: O usuário escaneia o QR Code via webhook ou endpoint `/session/qr/:sessionId`.
3. **Ready**: A sessão está ativa e pronta para enviar/receber dados.
4. **Interrupção (`/session/terminate/:sessionId`)**: Fecha o browser e limpa dados temporários (se configurado).

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
