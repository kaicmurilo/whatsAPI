const { Pool } = require('pg')
const config = require('./config')

// Configuração do pool de conexões
const pool = new Pool({
  host: config.postgresConfig.host,
  port: config.postgresConfig.port,
  database: config.postgresConfig.database,
  user: config.postgresConfig.user,
  password: config.postgresConfig.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Testar conexão
pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL')
})

pool.on('error', (err) => {
  console.error('❌ Erro no pool do PostgreSQL:', err)
})

// Função para validar tabelas necessárias
const validateRequiredTables = async (client) => {
  const requiredTables = [
    'users',
    'tokens', 
    'whatsapp_sessions'
  ]
  
  try {
    // Verificar se as tabelas existem
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY($1)
    `, [requiredTables])
    
    const existingTables = tablesResult.rows.map(row => row.table_name)
    const missingTables = requiredTables.filter(table => !existingTables.includes(table))
    
    if (missingTables.length > 0) {
      return {
        success: false,
        error: `Tabelas necessárias não encontradas: ${missingTables.join(', ')}`,
        code: 'MISSING_TABLES',
        missingTables
      }
    }
    
    console.log('✅ Todas as tabelas necessárias encontradas:', existingTables)
    
    // Verificar estrutura das tabelas
    const tableValidations = []
    
    // Validar tabela users
    const usersStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `)
    
    const requiredUserColumns = [
      { name: 'id', type: 'integer' },
      { name: 'user_id', type: 'character varying' },
      { name: 'user_name', type: 'character varying' },
      { name: 'user_secret', type: 'character varying' },
      { name: 'user_documento_identificacao', type: 'character varying' },
      { name: 'is_active', type: 'boolean' }
    ]
    
    const userColumns = usersStructure.rows.map(col => ({
      name: col.column_name,
      type: col.data_type
    }))
    
    const missingUserColumns = requiredUserColumns.filter(required => 
      !userColumns.some(col => col.name === required.name)
    )
    
    if (missingUserColumns.length > 0) {
      tableValidations.push({
        table: 'users',
        error: `Colunas ausentes: ${missingUserColumns.map(c => c.name).join(', ')}`
      })
    }
    
    // Validar tabela tokens
    const tokensStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'tokens' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `)
    
    const requiredTokenColumns = [
      { name: 'id', type: 'integer' },
      { name: 'user_id', type: 'character varying' },
      { name: 'access_token', type: 'character varying' },
      { name: 'refresh_token', type: 'character varying' },
      { name: 'expires_at', type: 'timestamp' }
    ]
    
    const tokenColumns = tokensStructure.rows.map(col => ({
      name: col.column_name,
      type: col.data_type
    }))
    
    const missingTokenColumns = requiredTokenColumns.filter(required => 
      !tokenColumns.some(col => col.name === required.name)
    )
    
    if (missingTokenColumns.length > 0) {
      tableValidations.push({
        table: 'tokens',
        error: `Colunas ausentes: ${missingTokenColumns.map(c => c.name).join(', ')}`
      })
    }
    
    // Validar tabela whatsapp_sessions
    const sessionsStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'whatsapp_sessions' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `)
    
    const requiredSessionColumns = [
      { name: 'id', type: 'integer' },
      { name: 'session_id', type: 'character varying' },
      { name: 'user_id', type: 'character varying' },
      { name: 'status', type: 'character varying' }
    ]
    
    const sessionColumns = sessionsStructure.rows.map(col => ({
      name: col.column_name,
      type: col.data_type
    }))
    
    const missingSessionColumns = requiredSessionColumns.filter(required => 
      !sessionColumns.some(col => col.name === required.name)
    )
    
    if (missingSessionColumns.length > 0) {
      tableValidations.push({
        table: 'whatsapp_sessions',
        error: `Colunas ausentes: ${missingSessionColumns.map(c => c.name).join(', ')}`
      })
    }
    
    if (tableValidations.length > 0) {
      return {
        success: false,
        error: 'Estrutura das tabelas inválida',
        code: 'INVALID_TABLE_STRUCTURE',
        tableValidations
      }
    }
    
    // Verificar se existe pelo menos um usuário
    const userCount = await client.query('SELECT COUNT(*) as count FROM users WHERE is_active = true')
    
    if (parseInt(userCount.rows[0].count) === 0) {
      console.log('⚠️  Nenhum usuário ativo encontrado')
      return {
        success: false,
        error: 'Nenhum usuário ativo encontrado no banco de dados',
        code: 'NO_ACTIVE_USERS'
      }
    }
    
    console.log(`✅ ${userCount.rows[0].count} usuário(s) ativo(s) encontrado(s)`)
    
    return {
      success: true,
      tables: existingTables,
      activeUsers: parseInt(userCount.rows[0].count)
    }
    
  } catch (error) {
    return {
      success: false,
      error: `Erro ao validar tabelas: ${error.message}`,
      code: 'TABLE_VALIDATION_ERROR'
    }
  }
}

// Função para validar conexão com banco de dados
const validateDatabaseConnection = async () => {
  try {
    const client = await pool.connect()
    
    // Testar conexão básica
    const result = await client.query('SELECT NOW() as current_time, version() as version')
    console.log('✅ Conexão com banco de dados estabelecida com sucesso')
    console.log('📊 Informações do banco:')
    console.log(`   👤 Usuário: ${config.postgresConfig.user}`)
    console.log(`   🗄️  Banco: ${config.postgresConfig.database}`)
    console.log(`   📋 Versão PostgreSQL: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`)
    
    // Testar permissões
    await client.query('SELECT 1')
    console.log('✅ Permissões de banco de dados verificadas com sucesso')
    
    // Validar tabelas
    console.log('🔍 Validando tabelas necessárias...')
    const tableValidation = await validateRequiredTables(client)
    
    if (!tableValidation.success) {
      client.release()
      return {
        success: false,
        error: tableValidation.error,
        code: tableValidation.code,
        details: tableValidation
      }
    }
    
    console.log('✅ Validação de tabelas concluída com sucesso')
    console.log(`   📋 Tabelas: ${tableValidation.tables.join(', ')}`)
    console.log(`   👥 Usuários ativos: ${tableValidation.activeUsers}`)
    
    client.release()
    
    return {
      success: true,
      database: {
        host: config.postgresConfig.host,
        port: config.postgresConfig.port,
        database: config.postgresConfig.database,
        user: config.postgresConfig.user,
        version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1],
        tables: tableValidation.tables,
        activeUsers: tableValidation.activeUsers
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: `Erro ao conectar com banco de dados: ${error.message}`,
      code: 'DATABASE_CONNECTION_ERROR'
    }
  }
}

// Função para executar queries
const query = (text, params) => pool.query(text, params)

module.exports = {
  query,
  validateDatabaseConnection,
  validateRequiredTables
} 