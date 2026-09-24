const { closePool } = require('../database')
const { closeAllSessions } = require('../sessions')

let isShuttingDown = false

class AppCleanup {
  /**
   * Executa o cleanup da aplicação.
   * Navegadores antes do pool: fechar o Chromium grava o pareamento do WhatsApp no disco
   * e dispara os últimos message_create que ainda precisam do banco.
   */
  static async cleanup (signal) {
    if (isShuttingDown) return // SIGINT + SIGTERM juntos não podem rodar o cleanup duas vezes
    isShuttingDown = true
    console.log(`🛑 ${signal} recebido, encerrando...`)
    try {
      await closeAllSessions()
      await closePool()
      console.log('🔌 Conexões do banco fechadas')
      process.exit(0)
    } catch (error) {
      console.error('❌ Erro ao encerrar:', error)
      process.exit(1)
    }
  }

  /**
   * Configura os handlers de cleanup
   */
  static setupCleanupHandlers () {
    process.on('SIGINT', AppCleanup.cleanup)
    process.on('SIGTERM', AppCleanup.cleanup)
  }
}

module.exports = AppCleanup
