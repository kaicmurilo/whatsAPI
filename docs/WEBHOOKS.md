# Webhooks e Callbacks

Webhooks são a forma principal de receber eventos assíncronos do WhatsApp.

## Configuração

### URLs de Destino
1. **Global**: Definida via `BASE_WEBHOOK_URL`.
2. **Por Sessão**: Definida via `[SESSIONID]_WEBHOOK_URL` (ex: `DEMO_WEBHOOK_URL`).

### Desabilitação de Callbacks
Use a variável `DISABLED_CALLBACKS` com valores separados por vírgula (ex: `qr,message_ack`) para não receber eventos específicos.

## Eventos Suportados

### `qr`
Enviado quando um novo código QR é gerado para pareamento.
- **Payload**: `{ "event": "qr", "sessionId": "ID", "data": "BASE64_OU_STRING" }`

### `ready`
Enviado quando a sessão está totalmente conectada e pronta para uso.
- **Payload**: `{ "event": "ready", "sessionId": "ID" }`

### `message`
Acionado ao receber qualquer nova mensagem.
- **Payload**: Contém o objeto completo da mensagem do `whatsapp-web.js`.

### `status`
Mudanças de estado da conexão (conectando, desconectado, etc).

### `media`
Acionado quando uma mensagem com anexo é processada.

## Exemplos de Implementação

### Node.js
```javascript
app.post('/webhook', (req, res) => {
  const { event, sessionId, data } = req.body;
  if (event === 'message') {
    console.log(`Mensagem de ${data.from}: ${data.body}`);
  }
  res.sendStatus(200);
});
```

### Python
```python
@app.route('/webhook', methods=['POST'])
def webhook():
    data = request.json
    if data['event'] == 'ready':
        print(f"Sessão {data['sessionId']} pronta!")
    return '', 200
```
