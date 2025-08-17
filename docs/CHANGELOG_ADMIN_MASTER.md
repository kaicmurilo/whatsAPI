# Changelog - Admin Master API Key

## 🎉 Nova Funcionalidade: Admin Master com API Key

### 📅 Data: Janeiro 2024

### 🚀 O que foi implementado

#### 1. Admin Master com API Key
- **Acesso total**: API key que permite acesso a qualquer funcionalidade
- **Sem autenticação JWT**: Não precisa de tokens JWT
- **Privilégios completos**: Pode acessar sessões de qualquer cliente
- **Operações administrativas**: Gerenciamento total de clientes e tokens

#### 2. Integração com Sistema Existente
- **Compatibilidade**: Funciona com sistema de autenticação JWT
- **Fallback**: Se API key não fornecida, usa autenticação normal
- **Segurança**: Mantém isolamento entre clientes normais
- **Flexibilidade**: Pode ser habilitado/desabilitado

#### 3. Middleware Atualizado
- **Verificação de API key**: Prioridade sobre autenticação JWT
- **Privilégios especiais**: Admin master tem todos os escopos
- **Acesso a sessões**: Pode acessar qualquer sessão
- **Operações administrativas**: Acesso total sem restrições

### 📁 Arquivos Modificados

#### Middleware
```
src/middleware/authMiddleware.js
- Adicionado suporte a API key master
- Verificação de privilégios especiais
- Acesso total a sessões para admin master
- Bypass de verificações de escopo

src/middleware.js
- Integração com sistema de API key
```

#### Configuração
```
env.example
- Atualizado para indicar API key do admin master
- Documentação clara sobre uso

package.json
- Novo script: test:admin-master
```

#### Scripts
```
scripts/test-admin-master.js
- Teste completo da funcionalidade admin master
- Verificação de privilégios especiais
- Teste de isolamento de segurança
```

#### Documentação
```
docs/AUTH_SYSTEM.md
- Seção sobre admin master
- Exemplos de uso
- Documentação de privilégios

CHANGELOG_ADMIN_MASTER.md
- Este arquivo
```

### 🔒 Como Funciona

#### 1. Verificação de API Key Master
```javascript
// Middleware verifica API key primeiro
if (globalApiKey) {
  const apiKey = req.headers['x-api-key']
  if (apiKey && apiKey === globalApiKey) {
    // Admin master - criar contexto especial
    req.client = {
      client_id: 'admin_master',
      client_name: 'Administrador Master',
      is_active: true
    }
    req.token = { scope: 'read write admin' }
    req.isMasterAdmin = true
  }
}
```

#### 2. Privilégios Especiais
```javascript
// Admin master tem acesso total
if (req.isMasterAdmin) {
  // Pular todas as verificações
  next()
  return
}

// Clientes normais seguem fluxo padrão
// Verificação de token, escopo, propriedade de sessão
```

#### 3. Acesso a Sessões
```javascript
// Admin master pode acessar qualquer sessão
if (req.isMasterAdmin) {
  // Buscar sessão sem verificar propriedade
  const result = await query(
    'SELECT * FROM whatsapp_sessions WHERE session_id = $1',
    [sessionId]
  )
  
  // Se sessão não existe, criar contexto especial
  if (result.rows.length === 0) {
    req.session = {
      session_id: sessionId,
      client_id: 'admin_master',
      status: 'admin_access'
    }
  }
}
```

### 🔌 Como Usar

#### 1. Configuração
```env
# Configurar API key do admin master
API_KEY=your_super_secure_admin_master_key_here
```

#### 2. Uso com API Key
```bash
# Acessar qualquer endpoint
curl -X GET http://localhost:3000/session/start/minha-sessao \
  -H "x-api-key: YOUR_ADMIN_MASTER_API_KEY"

# Listar todos os clientes
curl -X GET http://localhost:3000/auth/clients \
  -H "x-api-key: YOUR_ADMIN_MASTER_API_KEY"

# Acessar sessão de outro cliente
curl -X GET http://localhost:3000/session/status/sessao-de-outro-cliente \
  -H "x-api-key: YOUR_ADMIN_MASTER_API_KEY"
```

#### 3. JavaScript/Node.js
```javascript
const axios = require('axios');

const adminMaster = axios.create({
  baseURL: 'http://localhost:3000',
  headers: { 'x-api-key': 'YOUR_ADMIN_MASTER_API_KEY' }
});

// Acessar qualquer funcionalidade
await adminMaster.get('/session/status/qualquer-sessao');
await adminMaster.get('/auth/clients');
await adminMaster.post('/client/sendMessage/sessao', { chatId: '123', message: 'Olá' });
```

### 🧪 Testes

#### Script de Teste Automatizado
```bash
npm run test:admin-master
```

**O que o teste verifica:**
1. ✅ Acesso com API key master
2. ✅ Acesso a sessões de outros clientes
3. ✅ Operações administrativas
4. ✅ Operações WhatsApp
5. ✅ Isolamento de segurança
6. ✅ Proteção de endpoints

### 🔄 Fluxo de Autenticação

#### Cliente Normal
```
Cliente -> Token JWT -> Verificação de escopo -> Verificação de propriedade -> Acesso
```

#### Admin Master
```
Admin Master -> API Key -> Acesso total (sem verificações)
```

### 📊 Privilégios Comparativos

| Funcionalidade | Cliente Normal | Admin Master |
|----------------|----------------|--------------|
| Criar sessão | ✅ Própria | ✅ Qualquer |
| Acessar sessão | ✅ Própria | ✅ Qualquer |
| Listar clientes | ❌ (requer admin) | ✅ |
| Gerenciar tokens | ❌ (requer admin) | ✅ |
| Operações WhatsApp | ✅ Próprias sessões | ✅ Qualquer sessão |
| Acesso sem token | ❌ | ✅ |

### 🎯 Benefícios

1. **Administração Simplificada**: Acesso total sem complexidade de tokens
2. **Monitoramento**: Pode acessar qualquer sessão para monitoramento
3. **Suporte**: Facilita troubleshooting e suporte técnico
4. **Desenvolvimento**: Útil para desenvolvimento e testes
5. **Emergências**: Acesso de emergência quando necessário

### 🔧 Configuração

#### Habilitar/Desabilitar
```env
# Habilitar admin master
API_KEY=your_secure_key_here

# Desabilitar admin master
API_KEY=
```

#### Segurança
- **Chave forte**: Use uma chave longa e complexa
- **HTTPS**: Sempre use HTTPS em produção
- **Rotação**: Considere rotacionar a chave periodicamente
- **Logs**: Monitore logs de acesso do admin master

### 📝 Exemplo de Uso Completo

#### 1. Configuração Inicial
```bash
# Configurar API key no .env
echo "API_KEY=master_key_123456789" >> .env

# Iniciar serviços
npm run postgres:start
npm run db:init
```

#### 2. Uso do Admin Master
```bash
# Criar sessão
curl -X GET http://localhost:3000/session/start/admin-session \
  -H "x-api-key: master_key_123456789"

# Listar todos os clientes
curl -X GET http://localhost:3000/auth/clients \
  -H "x-api-key: master_key_123456789"

# Acessar sessão de cliente específico
curl -X GET http://localhost:3000/session/status/cliente-session \
  -H "x-api-key: master_key_123456789"
```

#### 3. Operações WhatsApp
```bash
# Enviar mensagem usando sessão de qualquer cliente
curl -X POST http://localhost:3000/client/sendMessage/cliente-session \
  -H "x-api-key: master_key_123456789" \
  -H "Content-Type: application/json" \
  -d '{"chatId": "5511999999999@c.us", "message": "Mensagem do admin"}'
```

### 🚀 Comandos de Teste

```bash
# Testar admin master
npm run test:admin-master

# Testar sistema completo
npm run test:auth
npm run test:session-ownership

# Verificar logs
npm run postgres:logs
```

### 📚 Documentação

- [Documentação Completa](docs/AUTH_SYSTEM.md)
- [Exemplos de Uso](docs/AUTH_SYSTEM.md#admin-master-api-key)
- [Testes](docs/AUTH_SYSTEM.md#testes)

---

**Nota**: O Admin Master é uma funcionalidade poderosa que deve ser usada com responsabilidade. Mantenha a API key segura e monitore seu uso. 