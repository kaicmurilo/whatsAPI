# Arquitetura do Sistema

O **whatsAPI** é um wrapper REST robusto para a biblioteca `whatsapp-web.js`, projetado para ser escalável e seguro.

## Stack Tecnológica

- **Runtime**: Node.js (>= 14.17.0)
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

### 4. Camada de Cache
O Redis atua entre a API e o `whatsapp-web.js`, evitando chamadas repetitivas e lentas ao cliente do WhatsApp para dados que não mudam com frequência.

## Fluxo de Inicialização
1. Carregamento de variáveis de ambiente (`.env`).
2. Validação da conexão com PostgreSQL.
3. Validação da conexão com Redis.
4. Inicialização do servidor Express.
5. Carregamento automático de sessões previamente ativas.
