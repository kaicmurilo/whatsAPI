const app = require('./src/app')
const { baseWebhookURL } = require('./src/config')
require('dotenv').config()

// whatsapp-web.js/puppeteer rejeitam promessas dentro de listeners internos (ex.: a página do WhatsApp recarrega no
// meio da reinjeção → "Execution context was destroyed"). No Node 22 isso derruba o processo: todas as instâncias
// e disparos em andamento caíam juntos. Loga e segue; a sessão afetada se recupera pelo fluxo de reinício dela.
process.on('unhandledRejection', (reason) => {
  console.error('[process] erro assíncrono sem tratamento (processo mantido):', reason)
})

// Start the server
const port = process.env.PORT || 3000

// Webhook é opcional: o painel não depende dele (registra mensagens e status por listeners próprios)
if (!baseWebhookURL) {
  console.warn('BASE_WEBHOOK_URL vazio: webhooks desligados (defina <SESSIONID>_WEBHOOK_URL para ligar só numa sessão)')
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
