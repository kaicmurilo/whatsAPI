const { closePool } = require('../database')

class AppCleanup {
  /**
   * Executa o cleanup da aplicação
   */
  static async cleanup() {
    try {
      await closePool()
      console.log('🔌 Conexões do banco fechadas')
      process.exit(0)
    } catch (error) {
      console.error('❌ Erro ao fechar conexões:', error)
      process.exit(1)
    }
  }

  /**
   * Configura os handlers de cleanup
   */
  static setupCleanupHandlers() {
    process.on('SIGINT', this.cleanup)
    process.on('SIGTERM', this.cleanup)
  }
}

module.exports = AppCleanup 