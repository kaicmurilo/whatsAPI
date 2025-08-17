#!/usr/bin/env node

const { query } = require('../src/database')
const AuthService = require('../src/auth/authService')

async function initializeDatabase() {
  console.log('🔧 Inicializando banco de dados...')
  
  try {
    // Testar conexão
    const result = await query('SELECT NOW() as current_time')
    console.log('✅ Conexão com PostgreSQL estabelecida:', result.rows[0].current_time)
    
    // Verificar se as tabelas existem
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('clients', 'tokens', 'whatsapp_sessions')
    `)
    
    console.log('📋 Tabelas encontradas:', tablesResult.rows.map(row => row.table_name))
    
    // Verificar se existe cliente padrão
    const defaultClient = await AuthService.getClientById('default_client')
    
    if (!defaultClient) {
      console.log('👤 Criando cliente padrão...')
      const newClient = await AuthService.createClient('Cliente Padrão', 'Cliente padrão para testes')
      console.log('✅ Cliente padrão criado:', newClient.client_id)
    } else {
      console.log('✅ Cliente padrão já existe')
    }
    
    // Limpar tokens expirados
    const cleanedTokens = await AuthService.cleanupExpiredTokens()
    console.log(`🧹 ${cleanedTokens} tokens expirados removidos`)
    
    console.log('🎉 Banco de dados inicializado com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error)
    process.exit(1)
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('✅ Script concluído')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Erro no script:', error)
      process.exit(1)
    })
}

module.exports = { initializeDatabase } 