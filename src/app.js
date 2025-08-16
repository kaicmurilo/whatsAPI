const { restoreSessions } = require('./sessions')
const { routes } = require('./routes')
const { initRedis } = require('./utils/cache')
const app = require('express')()
const bodyParser = require('body-parser')
const { maxAttachmentSize } = require('./config')

// Initialize Express app
app.disable('x-powered-by')
app.use(bodyParser.json({ limit: maxAttachmentSize + 1000000 }))
app.use(bodyParser.urlencoded({ limit: maxAttachmentSize + 1000000, extended: true }))
app.use('/', routes)

// Initialize cache and sessions
const initializeApp = async () => {
  try {
    await initRedis()
    restoreSessions()
    console.log('🚀 Aplicação inicializada com sucesso')
  } catch (error) {
    console.error('❌ Erro ao inicializar aplicação:', error)
  }
}

initializeApp()

module.exports = app
