const { validateDatabaseConnection } = require('../database')
const { initRedis } = require('../utils/cache')
const { restoreSessions } = require('../sessions')

class AppInitializer {
  constructor() {
    this.dbValidation = null
  }

  /**
   * Exibe dicas de resolução baseadas no código de erro
   */
  showResolutionTips(errorCode) {
    console.error('❌ Falha na validação do banco de dados. Aplicação não pode ser inicializada.')
    console.error('💡 Dicas para resolver:')
    
    const tips = {
      'MISSING_TABLES': [
        '1. Execute: npm run db:init',
        '2. Ou execute: npm run db:reset'
      ],
      'INVALID_TABLE_STRUCTURE': [
        '1. Execute: npm run db:reset (recreará as tabelas)',
        '2. Verifique se o script init.sql está atualizado'
      ],
      'NO_ACTIVE_CLIENTS': [
        '1. Execute: npm run db:init (criará cliente padrão)',
        '2. Ou crie um cliente via API de autenticação'
      ]
    }
    
    const defaultTips = [
      '1. Verifique se o PostgreSQL está rodando',
      '2. Confirme as credenciais no arquivo .env',
      '3. Certifique-se de que o banco de dados existe',
      '4. Verifique as permissões do usuário'
    ]
    
    const errorTips = tips[errorCode] || defaultTips
    errorTips.forEach(tip => console.error(`   ${tip}`))
  }

  /**
   * Valida o banco de dados
   */
  async validateDatabase() {
    console.log('🔍 Iniciando validação do banco de dados...')
    
    this.dbValidation = await validateDatabaseConnection()
    
    if (!this.dbValidation.success) {
      this.showResolutionTips(this.dbValidation.code)
      throw new Error(`Validação do banco falhou: ${this.dbValidation.error}`)
    }
    
    console.log('✅ Validação do banco de dados concluída com sucesso')
    return this.dbValidation
  }

  /**
   * Inicializa o Redis
   */
  async initializeRedis() {
    await initRedis()
    console.log('✅ Redis inicializado com sucesso')
  }

  /**
   * Restaura as sessões
   */
  restoreSessions() {
    restoreSessions()
    console.log('✅ Sessões restauradas com sucesso')
  }

  /**
   * Exibe o status final dos serviços
   */
  showServicesStatus() {
    console.log('🚀 Aplicação inicializada com sucesso')
    console.log('📊 Status dos serviços:')
    console.log(`   🗄️  Banco de dados: Conectado (${this.dbValidation.database})`)
    console.log(`   👤 Usuário: ${this.dbValidation.user}`)
    console.log(`   📋 PostgreSQL: ${this.dbValidation.version}`)
    console.log(`   📊 Tabelas: ${this.dbValidation.tables.join(', ')}`)
    console.log(`   👥 Clientes ativos: ${this.dbValidation.activeClients}`)
    console.log('   🔴 Redis: Conectado')
    console.log('   💬 WhatsApp: Pronto para sessões')
  }

  /**
   * Inicializa todos os serviços da aplicação
   */
  async initialize() {
    try {
      await this.validateDatabase()
      await this.initializeRedis()
      this.restoreSessions()
      this.showServicesStatus()
    } catch (error) {
      console.error('❌ Erro ao inicializar aplicação:', error.message)
      throw error
    }
  }
}

module.exports = AppInitializer 