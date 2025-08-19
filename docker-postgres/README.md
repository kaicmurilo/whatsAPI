# Sistema de Banco de Dados PostgreSQL para WhatsApp API

Este diretório contém a configuração do banco de dados PostgreSQL para gerenciar tokens e usuários da WhatsApp API.

## Estrutura do Banco

### Tabelas Principais

1. **users** - Armazena informações dos usuários
   - `id` - ID único do usuário
   - `user_id` - Identificador único do usuário
   - `user_name` - Nome do usuário
   - `user_secret` - Chave secreta do usuário
   - `user_documento_identificacao` - Documento de identificação (CPF, CNPJ, etc.)
   - `description` - Descrição do usuário
   - `is_active` - Status ativo/inativo
   - `created_at` - Data de criação
   - `updated_at` - Data de atualização

2. **tokens** - Armazena tokens de acesso
   - `id` - ID único do token
   - `user_id` - Referência ao usuário
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
   - `user_id` - Referência ao usuário
   - `status` - Status da sessão
   - `created_at` - Data de criação
   - `updated_at` - Data de atualização

## Como Usar

### 1. Iniciar o Banco de Dados

```bash
cd docker-postgres
docker-compose up -d
```

### 2. Conectar ao Banco

- Host: localhost
- Port: 5432
- Database: whatsapp_auth
- Username: whatsapp_user
- Password: your_postgres_password_here

### 3. Usar um Cliente PostgreSQL

Você pode usar qualquer cliente PostgreSQL de sua preferência:
- **psql** (linha de comando)
- **pgAdmin** (interface gráfica)
- **DBeaver** (interface gráfica multiplataforma)
- **TablePlus** (interface gráfica)

## Configurações de Segurança

⚠️ **IMPORTANTE**: Altere as senhas padrão antes de usar em produção:

1. No arquivo `docker-compose.yml`:
   - `POSTGRES_PASSWORD`

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
docker exec my-postgres pg_dump -U whatsapp_user whatsapp_auth > backup.sql

# Restaurar backup
docker exec -i my-postgres psql -U whatsapp_user whatsapp_auth < backup.sql

# Conectar via psql
docker exec -it my-postgres psql -U whatsapp_user -d whatsapp_auth
```

## Exemplos de Queries

```sql
-- Listar todos os usuários
SELECT * FROM users;

-- Listar usuários ativos
SELECT * FROM users WHERE is_active = true;

-- Listar tokens de um usuário
SELECT * FROM tokens WHERE user_id = 'user_id_here';

-- Listar sessões de um usuário
SELECT * FROM whatsapp_sessions WHERE user_id = 'user_id_here';
``` 