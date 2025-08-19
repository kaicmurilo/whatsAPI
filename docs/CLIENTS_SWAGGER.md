# Documentação de Gerenciamento Administrativo de Clientes - Swagger

Este documento explica a funcionalidade de documentação Swagger específica para **gerenciamento administrativo de clientes** no sistema.

## 📋 Visão Geral

A documentação de gerenciamento administrativo de clientes é uma interface Swagger separada que contém **apenas** os endpoints administrativos para gerenciar clientes, tokens e sessões no banco de dados. Esta documentação é específica para **administradores** que precisam gerenciar o sistema.

### 🎯 Objetivo

- **Separação de responsabilidades**: Documentação específica para administradores
- **Gerenciamento de clientes**: Criar, listar, editar e deletar clientes no banco
- **Monitoramento**: Visualizar tokens e sessões dos clientes
- **Administração**: Interface dedicada para operações administrativas
- **Segurança**: Controle claro de acesso administrativo

## 🔗 Acesso

### URL Principal
```
http://localhost:3000/api-docs/clients
```

### Página de Seleção
```
http://localhost:3000/api-docs
```
Na página principal, clique no card "**Gerenciamento Administrativo**" com ícone 🔐.

## 📚 Endpoints Documentados

### 1. Gerenciamento de Clientes

#### POST `/auth/clients`
- **Descrição**: Criar novo cliente no banco de dados
- **Autenticação**: Pública (não requer autenticação)
- **Uso**: Registrar novos clientes no sistema
- **Admin**: Usado por administradores para criar clientes

#### GET `/auth/clients`
- **Descrição**: Listar todos os clientes cadastrados
- **Autenticação**: Requer escopo 'admin' ou API key master
- **Uso**: Visualizar todos os clientes do sistema
- **Admin**: Monitoramento e administração de clientes

#### GET `/auth/clients/{clientId}`
- **Descrição**: Obter informações de um cliente específico
- **Autenticação**: Requer escopo 'admin' ou API key master
- **Uso**: Visualizar detalhes de um cliente
- **Admin**: Consulta de informações específicas

#### PUT `/auth/clients/{clientId}`
- **Descrição**: Atualizar dados de um cliente
- **Autenticação**: Requer escopo 'admin' ou API key master
- **Uso**: Modificar informações de um cliente
- **Admin**: Manutenção de dados de clientes

#### DELETE `/auth/clients/{clientId}`
- **Descrição**: Remover cliente do sistema
- **Autenticação**: Requer escopo 'admin' ou API key master
- **Uso**: Deletar clientes inativos ou problemáticos
- **Admin**: Limpeza e manutenção do sistema

### 2. Gerenciamento de Tokens

#### GET `/auth/clients/{clientId}/tokens`
- **Descrição**: Listar tokens ativos de um cliente
- **Autenticação**: Requer escopo 'admin' ou API key master
- **Uso**: Visualizar tokens de um cliente específico
- **Admin**: Auditoria e monitoramento de tokens

### 3. Gerenciamento de Sessões

#### GET `/auth/clients/{clientId}/sessions`
- **Descrição**: Listar sessões WhatsApp de um cliente
- **Autenticação**: Requer escopo 'admin' ou API key master
- **Uso**: Visualizar sessões de um cliente específico
- **Admin**: Troubleshooting e monitoramento de sessões

## 🔐 Autenticação

### Métodos Suportados

1. **API Key Master** (Recomendado para admin)
   ```bash
   curl -H "x-api-key: YOUR_ADMIN_MASTER_API_KEY" \
        http://localhost:3000/auth/clients
   ```

2. **Token JWT com Escopo Admin**
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        http://localhost:3000/auth/clients
   ```

### Configuração da API Key Master

```bash
# No arquivo .env
API_KEY=your_super_secure_admin_master_key_here
```

## 🎨 Interface Visual

### Card na Página Principal
- **Ícone**: 🔐 (cadeado)
- **Título**: "Gerenciamento Administrativo"
- **Descrição**: "API para administradores gerenciarem clientes no banco de dados"
- **Cor**: Laranja/vermelho (destaque administrativo)
- **Efeito**: Escala no hover
- **Ícone de redirecionamento**: `fa-external-link-alt`

### Estilos Específicos
```css
.language-card.clients {
    border: 2px solid var(--accent-color);
    background: linear-gradient(135deg, rgba(255, 107, 53, 0.02) 0%, rgba(255, 107, 53, 0.05) 100%);
}

.language-card.clients:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-heavy);
}
```

## 🧪 Testes

### Script de Teste Automatizado
```bash
npm run test:clients-swagger
```

**O que o teste verifica:**
1. ✅ Acesso à documentação administrativa
2. ✅ JSON da documentação
3. ✅ **APENAS** endpoints de gerenciamento administrativo
4. ✅ **NÃO** contém endpoints de autenticação ou WhatsApp
5. ✅ Funcionamento dos endpoints administrativos
6. ✅ Autenticação com API key master
7. ✅ Interface visual correta na página principal

### Teste Manual
```bash
# 1. Acessar documentação administrativa
curl http://localhost:3000/api-docs/clients

# 2. Verificar JSON da documentação
curl http://localhost:3000/api-docs/json/clients

# 3. Testar criação de cliente (público)
curl -X POST http://localhost:3000/auth/clients \
  -H "Content-Type: application/json" \
  -d '{"client_name": "Cliente Admin", "description": "Cliente criado por admin"}'

# 4. Testar listagem (com API key master)
curl -H "x-api-key: YOUR_API_KEY" \
     http://localhost:3000/auth/clients
```

## 📊 Estrutura de Dados

### Cliente
```json
{
  "id": 1,
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "client_name": "App de Vendas",
  "client_secret": "550e8400-e29b-41d4-a716-446655440001",
  "description": "Aplicação para vendas via WhatsApp",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Token
```json
{
  "id": 1,
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "token_type": "access",
  "scope": "read write",
  "expires_at": "2024-01-02T00:00:00.000Z",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

### Sessão
```json
{
  "id": 1,
  "session_id": "minha-sessao",
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "connected",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## 🔄 Fluxo de Uso Administrativo

### 1. Acesso à Documentação
```
Admin -> /api-docs -> Card "Gerenciamento Administrativo" -> /api-docs/clients
```

### 2. Operação Administrativa
```
Admin -> API Key Master -> Endpoint Administrativo -> Operação -> Resultado
```

### 3. Monitoramento
```
Admin -> Listar Clientes -> Selecionar Cliente -> Ver Tokens/Sessões -> Ações
```

## 🛡️ Segurança

### Controles de Acesso
- **Endpoints públicos**: Apenas criação de clientes
- **Endpoints protegidos**: Todos os outros requerem admin
- **Escopo necessário**: 'admin' para operações administrativas
- **API Key Master**: Acesso total sem verificações adicionais

### Boas Práticas
1. **Use API Key Master** para operações administrativas
2. **Monitore logs** de acesso administrativo
3. **Rotacione chaves** periodicamente
4. **Use HTTPS** em produção
5. **Limite acesso** à documentação administrativa
6. **Audite operações** regularmente

## 📝 Exemplos de Uso Administrativo

### Criar Cliente (Público)
```bash
curl -X POST http://localhost:3000/auth/clients \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "App de Vendas",
    "description": "Aplicação para vendas via WhatsApp"
  }'
```

### Listar Todos os Clientes (Admin)
```bash
curl -H "x-api-key: master_key_123456" \
     http://localhost:3000/auth/clients
```

### Ver Detalhes de um Cliente (Admin)
```bash
curl -H "x-api-key: master_key_123456" \
     http://localhost:3000/auth/clients/550e8400-e29b-41d4-a716-446655440000
```

### Atualizar Cliente (Admin)
```bash
curl -X PUT http://localhost:3000/auth/clients/550e8400-e29b-41d4-a716-446655440000 \
  -H "x-api-key: master_key_123456" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "App de Vendas Atualizado",
    "is_active": false
  }'
```

### Ver Tokens de um Cliente (Admin)
```bash
curl -H "x-api-key: master_key_123456" \
     http://localhost:3000/auth/clients/550e8400-e29b-41d4-a716-446655440000/tokens
```

### Ver Sessões de um Cliente (Admin)
```bash
curl -H "x-api-key: master_key_123456" \
     http://localhost:3000/auth/clients/550e8400-e29b-41d4-a716-446655440000/sessions
```

### Deletar Cliente (Admin)
```bash
curl -X DELETE http://localhost:3000/auth/clients/550e8400-e29b-41d4-a716-446655440000 \
  -H "x-api-key: master_key_123456"
```

## 🎯 Benefícios

1. **Organização**: Documentação separada por função administrativa
2. **Facilidade**: Interface dedicada para administradores
3. **Segurança**: Controle claro de acesso administrativo
4. **Manutenibilidade**: Estrutura modular
5. **Usabilidade**: Navegação intuitiva para admins
6. **Monitoramento**: Ferramentas específicas para administração

## 🔧 Configuração

### Habilitar/Desabilitar
```env
# Habilitar documentação administrativa
ENABLE_SWAGGER_ENDPOINT=true

# Configurar API key master
API_KEY=your_secure_admin_key
```

### Personalização
- **Cores**: Modificar variáveis CSS em `swagger-language-selector.html`
- **Endpoints**: Adicionar novos endpoints administrativos em `swagger-clients.json`
- **Autenticação**: Configurar novos métodos em `authMiddleware.js`

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do servidor
2. Execute o script de teste: `npm run test:clients-swagger`
3. Confirme a configuração da API key
4. Verifique a conectividade com o banco de dados
5. Consulte a documentação de autenticação: `docs/AUTH_SYSTEM.md` 