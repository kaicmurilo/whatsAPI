# 📚 Documentação Swagger Multilíngue

Esta API agora suporta documentação Swagger em múltiplos idiomas!

## 🌍 Idiomas Disponíveis

- **🇺🇸 Inglês** (`en`) - Documentação padrão
- **🇧🇷 Português** (`pt`) - Documentação traduzida

## 🔗 URLs de Acesso

### 🎯 Página de Seleção de Idioma (Recomendado)
```
http://localhost:3000/api-docs
```
**✨ Nova interface!** Página elegante com botões para escolher entre português e inglês.

### Documentação em Português
```
http://localhost:3000/api-docs/pt
```

### Documentação em Inglês
```
http://localhost:3000/api-docs/en
```

### Listar Idiomas Disponíveis
```
http://localhost:3000/api-docs/languages
```

## 📋 Exemplos de Uso

### 1. 🎯 Usar Página de Seleção (Recomendado)
1. Acesse `http://localhost:3000/api-docs`
2. Clique no botão **🇧🇷 Português** ou **🇺🇸 English**
3. Você será redirecionado para a documentação no idioma escolhido

### 2. Acesso Direto
```bash
# Documentação em português
curl http://localhost:3000/api-docs/pt

# Documentação em inglês
curl http://localhost:3000/api-docs/en
```

### 3. Ver Idiomas Disponíveis
```bash
curl http://localhost:3000/api-docs/languages
```

**Resposta:**
```json
{
  "success": true,
  "message": "Idiomas disponíveis para documentação",
  "data": [
    {
      "code": "en",
      "name": "English",
      "file": "swagger.json"
    },
    {
      "code": "pt",
      "name": "Português",
      "file": "swagger-pt.json"
    }
  ]
}
```

### 3. Acesso Programático (JSON)
```bash
# Obter documentação em inglês como JSON
curl http://localhost:3000/api-docs/en

# Obter documentação em português como JSON
curl http://localhost:3000/api-docs/pt

# Idioma inexistente
curl http://localhost:3000/api-docs/es
```

## ⚙️ Configuração

### Habilitar Endpoint do Swagger
```bash
# No arquivo .env
ENABLE_SWAGGER_ENDPOINT=true
```

### Estrutura de Arquivos
```
whatsapp-api/
├── swagger.json          # Documentação em inglês
├── swagger-pt.json       # Documentação em português
├── swagger-config.js     # Configuração de idiomas
└── src/
    └── routes.js         # Rotas do Swagger
```

## 🔧 Adicionando Novos Idiomas

Para adicionar um novo idioma:

1. **Criar arquivo Swagger**:
   ```bash
   # Exemplo: swagger-es.json para espanhol
   cp swagger.json swagger-es.json
   ```

2. **Editar o arquivo** `swagger-config.js`:
   ```javascript
   const SWAGGER_CONFIGS = {
     'en': {
       file: 'swagger.json',
       title: 'WhatsApp API',
       description: 'API Wrapper for WhatsAppWebJS'
     },
     'pt': {
       file: 'swagger-pt.json',
       title: 'WhatsApp API',
       description: 'API Wrapper para WhatsAppWebJS'
     },
     'es': {  // Novo idioma
       file: 'swagger-es.json',
       title: 'WhatsApp API',
       description: 'API Wrapper para WhatsAppWebJS'
     }
   };
   ```

3. **Traduzir o conteúdo** do arquivo `swagger-es.json`

## 📖 Principais Traduções

### Tags Principais
- **Session** → **Sessão**
- **Client** → **Cliente**
- **Message** → **Mensagem**
- **Chat** → **Chat**
- **Group** → **Grupo**
- **Contact** → **Contato**
- **Various** → **Diversos**

### Endpoints Principais
- **Start new session** → **Iniciar Nova Sessão**
- **Get session status** → **Obter Status da Sessão**
- **Send message** → **Enviar Mensagem**
- **Get contacts** → **Obter Contatos**

### Respostas
- **Success** → **Sucesso**
- **Error** → **Erro**
- **Forbidden** → **Acesso Negado**
- **Server Failure** → **Erro do Servidor**

## 🚀 Benefícios

1. **🎯 Interface Elegante**: Página de seleção com design moderno e profissional
2. **🔗 URLs Simples**: Cada idioma tem sua própria URL dedicada
3. **⚡ Carregamento Rápido**: Redirecionamento direto para a documentação
4. **📱 Responsivo**: Interface adaptada para todos os dispositivos
5. **🎨 Design Atraente**: Gradientes, animações e efeitos visuais
6. **🔄 Fallback Seguro**: Se algo der errado, volta para inglês automaticamente

## 🔍 Detalhes Técnicos

- **🔄 Fallback Automático**: Se um arquivo de idioma não for encontrado, usa inglês
- **✅ Validação**: Verifica se o idioma existe antes de tentar carregar
- **⚡ Performance**: Carrega arquivos sob demanda com cache inteligente
- **🔧 Compatibilidade**: Mantém total compatibilidade com Swagger UI
- **🌐 Detecção de Idioma**: Detecta automaticamente o idioma do navegador
- **📱 Responsividade**: Interface adaptada para todos os dispositivos
- **🎨 CSS Customizado**: Design moderno e profissional

## 📝 Notas

- A documentação em português inclui traduções dos principais endpoints
- Novos endpoints podem ser adicionados facilmente
- O sistema é extensível para outros idiomas
- Mantém a estrutura original do Swagger 