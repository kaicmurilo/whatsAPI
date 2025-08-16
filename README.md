# WhatsApp REST API

> Este código é uma melhoria baseada no projeto original disponível em [https://github.com/pedroherpeto/whatsapp-api](https://github.com/pedroherpeto/whatsapp-api).


API REST wrapper para a biblioteca [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), fornecendo uma interface fácil de usar para interagir com a plataforma WhatsApp Web.
Foi projetada para ser usada como um container Docker, escalável, segura e fácil de integrar com outros projetos não-NodeJs.

Este projeto está em desenvolvimento: dê uma estrela, crie issues, funcionalidades.

**OBSERVAÇÃO**: Não posso garantir que você não será bloqueado ao usar este método, embora tenha funcionado para mim. O WhatsApp não permite bots ou clientes não oficiais em sua plataforma, então isso não deve ser considerado totalmente seguro.

## Índice

[1. Funcionalidades](#funcionalidades)

[2. Executar Localmente](#executar-localmente)

[3. Sistema de Cache](#sistema-de-cache)

[4. Testes](#testes)

[5. Documentação](#documentação)

[6. Webhooks](#webhooks)

[7. Deploy em Produção](#deploy-em-produção)

[8. Contribuindo](#contribuindo)

[9. Licença](#licença)

[10. Histórico de Estrelas](#histórico-de-estrelas)

## Funcionalidades

1. API e Callbacks

| Ações                        | Status | Sessões                                | Status | Callbacks                                      | Status |
| ----------------------------| ------| ----------------------------------------| ------| ----------------------------------------------| ------|
| Enviar Mensagem de Imagem   | ✅     | Iniciar sessão                         | ✅    | Callback código QR                             | ✅     |
| Enviar Mensagem de Vídeo    | ✅     | Encerrar sessão                        | ✅    | Callback nova mensagem                         | ✅     |
| Enviar Mensagem de Áudio    | ✅     | Encerrar sessões inativas              | ✅    | Callback mudança de status                     | ✅     |
| Enviar Mensagem de Documento| ✅     | Encerrar todas as sessões              | ✅    | Callback anexo de mídia da mensagem            | ✅     |
| Enviar URL de Arquivo       | ✅     | Healthcheck                            | ✅    |                                                |        |
| Enviar Mensagem com Botão   | ✅     | Callback de teste local                |        |                                                |        |
| Enviar Mensagem de Contato  | ✅     |                                        |        |                                                |        |
| Enviar Mensagem de Lista    | ✅     |                                        |        |                                                |        |
| Definir Status              | ✅     |                                        |        |                                                |        |
| Enviar Botão com Mídia      | ✅     |                                        |        |                                                |        |
| Está no WhatsApp?           | ✅     |                                        |        |                                                |        |
| Baixar Foto do Perfil       | ✅     |                                        |        |                                                |        |
| Status do Usuário           | ✅     |                                        |        |                                                |        |
| Bloquear/Desbloquear Usuário| ✅     |                                        |        |                                                |        |
| Atualizar Foto do Perfil    | ✅     |                                        |        |                                                |        |
| Criar Grupo                  | ✅     |                                        |        |                                                |        |
| Sair do Grupo               | ✅     |                                        |        |                                                |        |
| Todos os Grupos             | ✅     |                                        |        |                                                |        |
| Convidar Usuário            | ✅     |                                        |        |                                                |        |
| Tornar Admin                | ✅     |                                        |        |                                                |        |
| Remover Admin               | ✅     |                                        |        |                                                |        |
| Código de Convite do Grupo  | ✅     |                                        |        |                                                |        |
| Atualizar Participantes     | ✅     |                                        |        |                                                |        |
| Atualizar Configuração      | ✅     |                                        |        |                                                |        |
| Atualizar Assunto do Grupo  | ✅     |                                        |        |                                                |        |
| Atualizar Descrição         | ✅     |                                        |        |                                                |        |

2. Gerencia múltiplas sessões de cliente (dados da sessão salvos localmente), identificadas por ID único

3. Todos os endpoints podem ser protegidos por uma chave de API global

4. Na inicialização do servidor, todas as sessões existentes são restauradas

5. Define mensagens automaticamente como lidas

6. Desabilita qualquer um dos callbacks

7. **Sistema de Cache Inteligente** - Cache Redis para melhorar performance e reduzir requests ao WhatsApp

## Executar Localmente

1. Clone o repositório:

```bash
git clone https://github.com/kaicmurilo/whatsAPI.git
cd whatsapp-api
```

2. Instale as dependências:

```bash
npm install
```

3. Copie o arquivo `.env.example` para `.env` e atualize as variáveis de ambiente necessárias:

```bash
cp .env.example .env
```

4. Execute a aplicação:

```bash
npm run start
```

5. Acesse a API em `http://localhost:3000`

## Sistema de Cache

A API agora inclui um sistema de cache inteligente usando Redis para melhorar significativamente a performance e reduzir a carga no WhatsApp.

### 🚀 Benefícios do Cache

- **⚡ Performance**: Respostas até 95% mais rápidas
- **📉 Redução de Requests**: 70-80% menos requests ao WhatsApp
- **🔄 Estabilidade**: Menos desconexões e timeouts
- **💾 Eficiência**: Uso otimizado de memória

### 📊 TTLs Configurados

| Tipo de Dado | TTL | Descrição |
|--------------|-----|-----------|
| Contatos | 10 min | Lista de contatos |
| Chats | 5 min | Lista de conversas |
| Mensagens | 2 min | Mensagens de chat |
| Fotos de Perfil | 1 hora | Imagens de perfil |
| QR Code | 1 min | Códigos QR temporários |

### 🛠️ Configuração do Redis

#### 1. Iniciar Redis
```bash
# Usando script automatizado
npm run redis:start

# Ou manualmente
cd docker-redis
./start-redis.sh
```

#### 2. Configurar Variáveis de Ambiente
```bash
# Copie env.example para .env
cp env.example .env

# Configure as variáveis do Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here
```

#### 3. Verificar Status
```bash
# Status do cache
curl http://localhost:3000/cache/status

# Health check com info do cache
curl http://localhost:3000/ping
```

### 📈 Endpoints de Cache

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/cache/status` | GET | Status do sistema de cache |
| `/cache/clear` | POST | Limpar todo o cache |

### 🧪 Testando o Cache

```bash
# Executar testes de performance
npm run test:cache

# Ver logs do Redis
npm run redis:logs

# Parar Redis
npm run redis:stop
```

### 🔄 Invalidação Automática

O cache é automaticamente invalidado quando:
- **Nova mensagem** chega
- **Mensagem é criada** pelo usuário
- **Sessão é terminada**
- **TTL expira**

### 📚 Documentação Completa

Para informações detalhadas sobre configuração, troubleshooting e otimização, consulte:
- [📖 Documentação do Redis](docker-redis/README.md)
- [🔧 Scripts de Teste](scripts/test-cache.js)
- [⚙️ Configurações](docker-redis/redis.conf)

### 🎯 Exemplo de Uso

```javascript
// Primeira requisição (lenta - busca do WhatsApp)
const contacts1 = await fetch('/client/getContacts/session1')
// Tempo: ~2000ms

// Segunda requisição (rápida - busca do cache)
const contacts2 = await fetch('/client/getContacts/session1')
// Tempo: ~50ms (95% mais rápido!)
```

## Testes

Execute a suíte de testes com o seguinte comando:

```bash
npm run test
```

## Documentação

A documentação da API pode ser encontrada no arquivo [`swagger.json`](https://raw.githubusercontent.com/kaicmurilo/whatsAPI/master/swagger.json). Veja este arquivo diretamente no [Swagger Editor](https://editor.swagger.io/?url=https://raw.githubusercontent.com/kaicmurilo/whatsAPI/master/swagger.json) ou em qualquer outra ferramenta compatível com OpenAPI para visualizar e interagir com a documentação da API.

Esta documentação é direta se você estiver familiarizado com a biblioteca whatsapp-web.js (https://docs.wwebjs.dev/)
Se você ainda estiver confuso - abra uma issue e eu vou melhorá-la.

Além disso, há uma opção para executar o endpoint de documentação localmente definindo a variável de ambiente `ENABLE_SWAGGER_ENDPOINT`. Reinicie o serviço e vá para o endpoint `/api-docs` para vê-lo.

Por padrão, todos os eventos de callback são entregues ao webhook definido com a variável de ambiente `BASE_WEBHOOK_URL`.
Isso pode ser substituído definindo a variável de ambiente `*_WEBHOOK_URL`, onde `*` é seu sessionId.
Por exemplo, se você tiver o sessionId definido como `DEMO`, a variável de ambiente deve ser `DEMO_WEBHOOK_URL`.

Definindo a variável de ambiente `DISABLED_CALLBACKS` você pode especificar quais eventos você **não** está disposto a receber no seu webhook.

### Escaneando código QR

Para validar uma nova instância do WhatsApp Web, você precisa escanear o código QR usando seu telefone celular. A documentação oficial pode ser encontrada na página (https://faq.whatsapp.com/1079327266110265/?cms_platform=android). O próprio serviço entrega o conteúdo do código QR como um evento de webhook ou você pode usar os endpoints REST (`/session/qr/:sessionId` ou `/session/qr/:sessionId/image` para obter o código QR como uma imagem png).

## Webhooks

Os webhooks permitem que você receba notificações em tempo real sobre eventos do WhatsApp, como novas mensagens, mudanças de status e códigos QR. Esta funcionalidade é essencial para criar aplicações reativas que respondem automaticamente aos eventos do WhatsApp.

### Configuração de Webhooks

#### Variáveis de Ambiente

- `BASE_WEBHOOK_URL`: URL base para todos os webhooks (ex: `https://seu-dominio.com/webhook`)
- `SESSIONID_WEBHOOK_URL`: URL específica para uma sessão (ex: `DEMO_WEBHOOK_URL=https://seu-dominio.com/webhook/demo`)
- `DISABLED_CALLBACKS`: Lista de callbacks desabilitados (ex: `qr,status`)

#### Tipos de Eventos Disponíveis

| Evento | Descrição | Payload |
|--------|-----------|---------|
| `qr` | Código QR para autenticação | `{ "event": "qr", "sessionId": "session", "data": "qr_code_data" }` |
| `ready` | Cliente pronto | `{ "event": "ready", "sessionId": "session" }` |
| `message` | Nova mensagem recebida | `{ "event": "message", "sessionId": "session", "data": { ... } }` |
| `message_ack` | Confirmação de entrega | `{ "event": "message_ack", "sessionId": "session", "data": { ... } }` |
| `status` | Mudança de status | `{ "event": "status", "sessionId": "session", "data": { ... } }` |
| `media` | Mídia anexada | `{ "event": "media", "sessionId": "session", "data": { ... } }` |

### Exemplos de Implementação

#### Python (Flask)

```python
from flask import Flask, request, jsonify
import requests
import json

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    """Endpoint para receber webhooks do WhatsApp API"""
    try:
        data = request.get_json()
        event = data.get('event')
        session_id = data.get('sessionId')
        
        print(f"Evento recebido: {event} da sessão: {session_id}")
        
        if event == 'message':
            # Processar nova mensagem
            message_data = data.get('data', {})
            from_number = message_data.get('from')
            message_text = message_data.get('body', '')
            
            print(f"Mensagem de {from_number}: {message_text}")
            
            # Exemplo: responder automaticamente
            if message_text.lower() == 'oi':
                send_message(session_id, from_number, "Olá! Como posso ajudar?")
        
        elif event == 'qr':
            # Código QR disponível para escaneamento
            qr_data = data.get('data')
            print(f"Código QR para sessão {session_id}: {qr_data}")
        
        elif event == 'ready':
            print(f"Cliente {session_id} está pronto!")
        
        return jsonify({"status": "success"}), 200
    
    except Exception as e:
        print(f"Erro ao processar webhook: {e}")
        return jsonify({"error": str(e)}), 500

def send_message(session_id, to_number, message):
    """Enviar mensagem via WhatsApp API"""
    api_url = f"http://localhost:3000/client/sendText/{session_id}"
    payload = {
        "number": to_number,
        "text": message
    }
    
    try:
        response = requests.post(api_url, json=payload)
        return response.json()
    except Exception as e:
        print(f"Erro ao enviar mensagem: {e}")
        return None

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

#### Node.js (Express)

```javascript
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Endpoint para receber webhooks
app.post('/webhook', async (req, res) => {
    try {
        const { event, sessionId, data } = req.body;
        
        console.log(`Evento recebido: ${event} da sessão: ${sessionId}`);
        
        switch (event) {
            case 'message':
                // Processar nova mensagem
                const fromNumber = data?.from;
                const messageText = data?.body || '';
                
                console.log(`Mensagem de ${fromNumber}: ${messageText}`);
                
                // Exemplo: responder automaticamente
                if (messageText.toLowerCase() === 'oi') {
                    await sendMessage(sessionId, fromNumber, 'Olá! Como posso ajudar?');
                }
                break;
                
            case 'qr':
                // Código QR disponível para escaneamento
                const qrData = data;
                console.log(`Código QR para sessão ${sessionId}: ${qrData}`);
                break;
                
            case 'ready':
                console.log(`Cliente ${sessionId} está pronto!`);
                break;
                
            case 'message_ack':
                console.log(`Mensagem confirmada: ${data?.id}`);
                break;
                
            case 'status':
                console.log(`Status alterado: ${data?.status}`);
                break;
                
            default:
                console.log(`Evento não tratado: ${event}`);
        }
        
        res.json({ status: 'success' });
        
    } catch (error) {
        console.error('Erro ao processar webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

// Função para enviar mensagem
async function sendMessage(sessionId, toNumber, message) {
    try {
        const response = await axios.post(
            `http://localhost:3000/client/sendText/${sessionId}`,
            {
                number: toNumber,
                text: message
            }
        );
        return response.data;
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        return null;
    }
}

// Função para iniciar sessão
async function startSession(sessionId) {
    try {
        const response = await axios.post(
            `http://localhost:3000/session/start/${sessionId}`
        );
        console.log(`Sessão ${sessionId} iniciada`);
        return response.data;
    } catch (error) {
        console.error('Erro ao iniciar sessão:', error);
        return null;
    }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor webhook rodando na porta ${PORT}`);
    
    // Iniciar sessão automaticamente
    startSession('DEMO');
});
```

#### Python (FastAPI)

```python
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import httpx
import asyncio
from typing import Dict, Any

app = FastAPI()

@app.post("/webhook")
async def webhook_handler(request: Request):
    """Endpoint para receber webhooks do WhatsApp API"""
    try:
        data = await request.json()
        event = data.get('event')
        session_id = data.get('sessionId')
        
        print(f"Evento recebido: {event} da sessão: {session_id}")
        
        if event == 'message':
            # Processar nova mensagem
            message_data = data.get('data', {})
            from_number = message_data.get('from')
            message_text = message_data.get('body', '')
            
            print(f"Mensagem de {from_number}: {message_text}")
            
            # Exemplo: responder automaticamente
            if message_text.lower() == 'oi':
                await send_message_async(session_id, from_number, "Olá! Como posso ajudar?")
        
        elif event == 'qr':
            qr_data = data.get('data')
            print(f"Código QR para sessão {session_id}: {qr_data}")
        
        elif event == 'ready':
            print(f"Cliente {session_id} está pronto!")
        
        return JSONResponse(content={"status": "success"})
    
    except Exception as e:
        print(f"Erro ao processar webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def send_message_async(session_id: str, to_number: str, message: str):
    """Enviar mensagem via WhatsApp API (assíncrono)"""
    api_url = f"http://localhost:3000/client/sendText/{session_id}"
    payload = {
        "number": to_number,
        "text": message
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(api_url, json=payload)
            return response.json()
        except Exception as e:
            print(f"Erro ao enviar mensagem: {e}")
            return None

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
```

### Configuração do Docker Compose

Para testar webhooks localmente, você pode usar o seguinte `docker-compose.yml`:

```yaml
version: '3.8'

services:
  whatsapp-api:
    image: chrishubert/whatsapp-web-api
    ports:
      - "3000:3000"
    environment:
      - BASE_WEBHOOK_URL=http://webhook-server:5000/webhook
      - ENABLE_SWAGGER_ENDPOINT=true
    volumes:
      - ./sessions:/app/sessions

  webhook-server:
    build: ./webhook-server  # Seu servidor webhook
    ports:
      - "5000:5000"
    environment:
      - WHATSAPP_API_URL=http://whatsapp-api:3000
```

### Testando Webhooks

1. **Inicie o servidor webhook** (Python ou Node.js)
2. **Configure a variável de ambiente** `BASE_WEBHOOK_URL` apontando para seu servidor
3. **Inicie uma sessão** do WhatsApp
4. **Envie uma mensagem** para o número conectado
5. **Verifique os logs** do seu servidor webhook

### Dicas de Produção

- **Use HTTPS** para webhooks em produção
- **Implemente retry logic** para falhas de entrega
- **Valide assinaturas** se implementado pela API
- **Monitore logs** para debugging
- **Use filas** para processamento assíncrono de mensagens

## Deploy em Produção

- Carregue a imagem docker no docker-compose, ou seu ambiente Kubernetes
- Desabilite a variável de ambiente `ENABLE_LOCAL_CALLBACK_EXAMPLE`
- Defina a variável de ambiente `API_KEY` para proteger os endpoints REST
- Execute periodicamente o endpoint `/api/terminateInactiveSessions` para evitar que sessões inúteis ocupem espaço e recursos (apenas no caso de você não ter controle das sessões)

## Contribuindo

Contribuições são bem-vindas! Por favor, leia o arquivo [CONTRIBUTING.md](./CONTRIBUTING.md) para detalhes sobre como contribuir para este projeto.

## Aviso Legal

Este projeto não é afiliado, associado, autorizado, endossado por, ou de qualquer forma oficialmente conectado com o WhatsApp ou qualquer uma de suas subsidiárias ou afiliadas. O site oficial do WhatsApp pode ser encontrado em https://whatsapp.com. "WhatsApp" bem como nomes relacionados, marcas, emblemas e imagens são marcas registradas de seus respectivos proprietários.

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE.md](./LICENSE.md) para detalhes.
