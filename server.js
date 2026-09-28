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

// Check if BASE_WEBHOOK_URL environment variable is available
if (!baseWebhookURL) {
  console.error('BASE_WEBHOOK_URL environment variable is not available. Exiting...')
  process.exit(1) // Terminate the application with an error code
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
