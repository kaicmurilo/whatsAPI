# Sistema de Banco de Dados PostgreSQL para WhatsApp API

Este diretório contém a configuração do banco de dados PostgreSQL para gerenciar tokens e clientes da WhatsApp API.

## Estrutura do Banco

### Tabelas Principais

1. **clients** - Armazena informações dos clientes
   - `id` - ID único do cliente
   - `client_id` - Identificador único do cliente
   - `client_name` - Nome do cliente
   - `client_secret` - Chave secreta do cliente
   - `description` - Descrição do cliente
   - `is_active` - Status ativo/inativo
   - `created_at` - Data de criação
   - `updated_at` - Data de atualização

2. **tokens** - Armazena tokens de acesso
   - `id` - ID único do token
   - `client_id` - Referência ao cliente
   - `access_token` - Token de acesso
   - `refresh_token` - Token de renovação
   - `token_type` - Tipo do token (Bearer)
   - `expires_at` - Data de expiração
   - `scope` - Escopo do token
   - `is_revoked` - Status de revogação
   - `created_at` - Data de criação
   - `updated_at` - Data de atualização

3. **whatsapp_sessions** - Armazena sessões do WhatsApp
   - `id` - ID único da sessão
   - `session_id` - Identificador da sessão WhatsApp
   - `client_id` - Referência ao cliente
   - `status` - Status da sessão
   - `created_at` - Data de criação
   - `updated_at` - Data de atualização

## Como Usar

### 1. Iniciar o Banco de Dados

```bash
cd docker-postgres
docker-compose up -d
```

### 2. Acessar o pgAdmin

- URL: http://localhost:8082
- Email: admin@whatsapp.com
- Senha: admin123

### 3. Conectar ao Banco

- Host: localhost
- Port: 5432
- Database: whatsapp_auth
- Username: whatsapp_user
- Password: your_postgres_password_here

## Configurações de Segurança

⚠️ **IMPORTANTE**: Altere as senhas padrão antes de usar em produção:

1. No arquivo `docker-compose.yml`:
   - `POSTGRES_PASSWORD`
   - `PGADMIN_DEFAULT_PASSWORD`

2. No arquivo `pg_hba.conf` (se necessário)

## Variáveis de Ambiente

Adicione estas variáveis ao seu arquivo `.env`:

```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=whatsapp_auth
POSTGRES_USER=whatsapp_user
POSTGRES_PASSWORD=your_postgres_password_here

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
```

## Comandos Úteis

```bash
# Iniciar serviços
docker-compose up -d

# Parar serviços
docker-compose down

# Ver logs
docker-compose logs -f postgres

# Backup do banco
docker exec whatsapp-postgres pg_dump -U whatsapp_user whatsapp_auth > backup.sql

# Restaurar backup
docker exec -i whatsapp-postgres psql -U whatsapp_user whatsapp_auth < backup.sql
``` 