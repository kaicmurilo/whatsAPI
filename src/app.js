const { routes } = require('./routes')
const app = require('express')()
const bodyParser = require('body-parser')
const { maxAttachmentSize } = require('./config')
const cors = require('cors')
const helmet = require('helmet')

// Importar serviços
const AppInitializer = require('./services/appInitializer')
const AppCleanup = require('./services/appCleanup')

// Initialize Express app
app.disable('x-powered-by')

// Middleware de segurança
app.use(helmet())
app.use(cors())

// Middleware para parsing de JSON
app.use(bodyParser.json({ limit: maxAttachmentSize + 1000000 }))
app.use(bodyParser.urlencoded({ limit: maxAttachmentSize + 1000000, extended: true }))

// Rotas
app.use('/', routes)

// Configurar cleanup handlers
AppCleanup.setupCleanupHandlers()

// Inicializar aplicação
const initializeApp = async () => {
  try {
    const initializer = new AppInitializer()
    await initializer.initialize()
  } catch (error) {
    console.error('❌ Falha na inicialização da aplicação:', error.message)
    process.exit(1)
  }
}

// Iniciar aplicação
initializeApp()

module.exports = app
