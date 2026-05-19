# API Administrativa

A API Administrativa fornece controle total sobre os usuários (clientes) e sessões globais da aplicação.

## Autenticação
Todas as rotas sob o prefixo `/admin` e `/auth` (administrativas) exigem a chave de API global definida no `.env` como `API_KEY`.
- **Header**: `x-api-key: SUA_CHAVE`

## Endpoints de Usuários (`/admin/users`)

- **GET /admin/users**: Lista todos os clientes cadastrados no banco.
- **GET /admin/users/:userId**: Detalhes de um cliente específico.
- **PUT /admin/users/:userId**: Atualiza dados do cliente.
- **DELETE /admin/users/:userId**: Remove o cliente e revoga todos os seus tokens.
- **GET /admin/users/:userId/tokens**: Lista tokens JWT ativos do cliente.

## Endpoints de Sessão (`/session`)

Alguns endpoints administrativos de sessão exigem escopo de `admin`:

- **GET /session/terminateInactive**: Encerra sessões que não tiveram atividade recente, liberando memória.
- **GET /session/terminateAll**: Encerra TODAS as sessões do servidor (use com cautela).

## Gestão de Tokens (`/auth`)
As rotas de `/auth` gerenciam o ciclo de vida dos tokens JWT usados pelos clientes finais para acessar os endpoints de WhatsApp (`/client`, `/chat`, etc).
- **POST /auth/authenticate**: Gera token JWT.
- **POST /auth/refresh**: Renova token expirado.
- **POST /auth/revoke**: Invalida um token manualmente.
