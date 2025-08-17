# Validação de Banco de Dados

Este documento descreve a funcionalidade de validação de banco de dados implementada na API WhatsApp.

## Visão Geral

A validação de banco de dados verifica automaticamente:
- ✅ Conexão com o servidor PostgreSQL
- ✅ Autenticação de credenciais
- ✅ Existência do banco de dados
- ✅ Permissões do usuário
- ✅ Capacidade de executar operações básicas
- ✅ **Existência das tabelas necessárias**
- ✅ **Estrutura correta das tabelas**
- ✅ **Presença de pelo menos um cliente ativo**

## Tabelas Necessárias

A aplicação requer as seguintes tabelas:

### 1. `clients`
Tabela para gerenciamento de clientes da API.

**Colunas obrigatórias:**
- `id` (integer, PRIMARY KEY)
- `client_id` (varchar, UNIQUE)
- `client_name` (varchar)
- `client_secret` (varchar)
- `is_active` (boolean)

### 2. `tokens`
Tabela para armazenamento de tokens JWT.

**Colunas obrigatórias:**
- `id` (integer, PRIMARY KEY)
- `client_id` (varchar, FOREIGN KEY)
- `access_token` (varchar, UNIQUE)
- `refresh_token` (varchar, UNIQUE)
- `expires_at` (timestamp)

### 3. `whatsapp_sessions`
Tabela para controle de sessões do WhatsApp.

**Colunas obrigatórias:**
- `id` (integer, PRIMARY KEY)
- `session_id` (varchar, UNIQUE)
- `client_id` (varchar, FOREIGN KEY)
- `status` (varchar)

## Funcionalidades

### 1. Validação Automática na Inicialização

A aplicação agora valida automaticamente o banco de dados durante a inicialização. Se a validação falhar, a aplicação não será iniciada.

**Logs de exemplo:**
```
🔍 Iniciando validação do banco de dados...
✅ Conexão com banco de dados estabelecida com sucesso
📊 Informações do banco:
   👤 Usuário: whatsapp_user
   🗄️  Banco: whatsapp_auth
   📋 Versão PostgreSQL: PostgreSQL 15.4
✅ Permissões de banco de dados verificadas com sucesso
🔍 Validando tabelas necessárias...
✅ Todas as tabelas necessárias encontradas: clients, tokens, whatsapp_sessions
✅ 1 cliente(s) ativo(s) encontrado(s)
✅ Validação de tabelas concluída com sucesso
```

### 2. Endpoint de Status do Banco

**GET** `/database/status`

Verifica o status atual do banco de dados via API.

**Resposta de sucesso (200):**
```json
{
  "success": true,
  "database": {
    "connected": true,
    "user": "whatsapp_user",
    "database": "whatsapp_auth",
    "version": "PostgreSQL 15.4",
    "permissions": true,
    "tables": ["clients", "tokens", "whatsapp_sessions"],
    "activeClients": 1
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Resposta de erro (503):**
```json
{
  "success": false,
  "database": {
    "connected": false,
    "error": "Tabelas necessárias não encontradas: clients, tokens",
    "code": "MISSING_TABLES",
    "details": {
      "missingTables": ["clients", "tokens"]
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3. Script de Teste

Execute o script de teste para verificar a funcionalidade:

```bash
npm run test:database
```

Ou diretamente:
```bash
node scripts/test-database-validation.js
```

## Códigos de Erro

A validação identifica e reporta erros específicos:

| Código | Descrição | Solução |
|--------|-----------|---------|
| `ECONNREFUSED` | Servidor PostgreSQL não acessível | Verificar se o PostgreSQL está rodando |
| `28P01` | Credenciais inválidas | Verificar usuário/senha no `.env` |
| `3D000` | Banco de dados não existe | Criar o banco especificado |
| `42501` | Permissões insuficientes | Conceder permissões adequadas ao usuário |
| `MISSING_TABLES` | Tabelas necessárias não encontradas | Executar `npm run db:init` |
| `INVALID_TABLE_STRUCTURE` | Estrutura das tabelas inválida | Executar `npm run db:reset` |
| `NO_ACTIVE_CLIENTS` | Nenhum cliente ativo encontrado | Executar `npm run db:init` |

## Configuração

As configurações do banco são definidas no arquivo `.env`:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=whatsapp_auth
POSTGRES_USER=whatsapp_user
POSTGRES_PASSWORD=sua_senha_aqui
```

## Testes de Permissões

A validação testa as seguintes permissões:
- ✅ SELECT (consulta básica)
- ✅ CREATE TEMP TABLE (criação de tabelas temporárias)
- ✅ INSERT (inserção de dados)
- ✅ DROP (remoção de tabelas)

## Validação de Tabelas

A validação verifica:

### 1. Existência das Tabelas
- Verifica se todas as 3 tabelas necessárias existem
- Lista tabelas ausentes se houver problemas

### 2. Estrutura das Tabelas
- Valida se todas as colunas obrigatórias estão presentes
- Verifica tipos de dados corretos
- Identifica colunas ausentes por tabela

### 3. Dados Mínimos
- Verifica se existe pelo menos um cliente ativo
- Garante que a aplicação pode funcionar corretamente

## Integração com Docker

Se estiver usando Docker, certifique-se de que:

1. O container PostgreSQL está rodando:
```bash
npm run postgres:start
```

2. O banco foi inicializado:
```bash
npm run db:init
```

3. As variáveis de ambiente estão corretas no `.env`

## Monitoramento

Para monitorar o status do banco em produção:

1. **Health Check**: Use o endpoint `/database/status`
2. **Logs**: Monitore os logs da aplicação para erros de validação
3. **Alertas**: Configure alertas para códigos de erro específicos

## Troubleshooting

### Problema: "connection refused"
```bash
# Verificar se o PostgreSQL está rodando
sudo systemctl status postgresql

# Ou se estiver usando Docker
docker ps | grep postgres
```

### Problema: "authentication failed"
```bash
# Verificar credenciais
psql -h localhost -U whatsapp_user -d whatsapp_auth
```

### Problema: "database does not exist"
```bash
# Criar o banco
createdb -h localhost -U postgres whatsapp_auth
```

### Problema: "permission denied"
```bash
# Conceder permissões
psql -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE whatsapp_auth TO whatsapp_user;"
```

### Problema: "missing tables"
```bash
# Inicializar banco de dados
npm run db:init

# Ou resetar completamente
npm run db:reset
```

### Problema: "invalid table structure"
```bash
# Resetar banco de dados (recreará as tabelas)
npm run db:reset
```

### Problema: "no active clients"
```bash
# Inicializar banco (criará cliente padrão)
npm run db:init
``` 