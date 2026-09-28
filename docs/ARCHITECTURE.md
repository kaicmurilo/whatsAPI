# Arquitetura do Sistema

O **whatsAPI** é um wrapper REST robusto para a biblioteca `whatsapp-web.js`, projetado para ser escalável e seguro.

## Stack Tecnológica

- **Runtime**: Node.js 22 no Docker (mínimo declarado no `package.json`: 14.17)
- **Framework Web**: Express.js
- **Banco de Dados**: PostgreSQL (Gestão de clientes e autenticação)
- **Cache**: Redis (Otimização de performance e redução de requests ao WhatsApp)
- **WhatsApp**: whatsapp-web.js (Puppeteer/Chromium)

## Componentes Principais

### 1. Servidor Express (`src/app.js`)
Configura middlewares de segurança (Helmet, CORS, Rate Limiting) e gerencia o roteamento modular.

### 2. Gerenciamento de Ciclo de Vida
- **AppInitializer**: Responsável por orquestrar a inicialização do banco de dados, conexão com Redis e restauração de sessões salvas.
- **AppCleanup**: Garante que conexões e sessões sejam encerradas corretamente em caso de shutdown do processo.

### 3. Camada de Persistência
- **PostgreSQL**: Armazena dados de clientes (auth), credenciais e metadados de sessões.
- **Sistema de Arquivos**: Armazena as sessões locais do Chromium para persistência de login do WhatsApp.

### 4. Painel web (`src/panel/`, `web/`)
- Front React + Vite servido em `/app`; API interna em `/panel` ([PANEL_API.md](PANEL_API.md)).
- Controllers finos → services (regras) → repositórios (Postgres). Eventos ao vivo via SSE (`/panel/stream`).
- Disparos de transmissão: ver [BROADCAST_SEND.md](BROADCAST_SEND.md).

### 5. Camada de Cache
O Redis atua entre a API e o `whatsapp-web.js`, evitando chamadas repetitivas e lentas ao cliente do WhatsApp para dados que não mudam com frequência.

## Fluxo de Inicialização
1. Carregamento de variáveis de ambiente (`.env`).
2. Validação da conexão com PostgreSQL.
3. Validação da conexão com Redis.
4. Inicialização do servidor Express.
5. Carregamento automático de sessões previamente ativas (com nova tentativa se a abertura falhar).
6. Disparos que estavam `running` viram `interrupted` (podem ser retomados) e o agendador de programados é iniciado.

## Resiliência
- `unhandledRejection` global em `server.js`: erro interno da biblioteca do WhatsApp não derruba o processo.
- Detalhes de recuperação de sessão em [SESSIONS.md](SESSIONS.md).
