const { Pool } = require('pg')
const { postgresConfig } = require('./config')

// Pool de conexões PostgreSQL
const pool = new Pool(postgresConfig)

// Testar conexão
pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL')
})

pool.on('error', (err) => {
  console.error('❌ Erro na conexão PostgreSQL:', err)
})

// Função para validar tabelas necessárias
const validateRequiredTables = async (client) => {
  const requiredTables = [
    'clients',
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
    
    // Validar tabela clients
    const clientsStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'clients' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `)
    
    const requiredClientColumns = [
      { name: 'id', type: 'integer' },
      { name: 'client_id', type: 'character varying' },
      { name: 'client_name', type: 'character varying' },
      { name: 'client_secret', type: 'character varying' },
      { name: 'is_active', type: 'boolean' }
    ]
    
    const clientColumns = clientsStructure.rows.map(col => ({
      name: col.column_name,
      type: col.data_type
    }))
    
    const missingClientColumns = requiredClientColumns.filter(required => 
      !clientColumns.some(col => col.name === required.name)
    )
    
    if (missingClientColumns.length > 0) {
      tableValidations.push({
        table: 'clients',
        error: `Colunas ausentes: ${missingClientColumns.map(c => c.name).join(', ')}`
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
      { name: 'client_id', type: 'character varying' },
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
      { name: 'client_id', type: 'character varying' },
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
    
    // Verificar se existe pelo menos um cliente
    const clientCount = await client.query('SELECT COUNT(*) as count FROM clients WHERE is_active = true')
    
    if (parseInt(clientCount.rows[0].count) === 0) {
      console.log('⚠️  Nenhum cliente ativo encontrado')
      return {
        success: false,
        error: 'Nenhum cliente ativo encontrado no banco de dados',
        code: 'NO_ACTIVE_CLIENTS'
      }
    }
    
    console.log(`✅ ${clientCount.rows[0].count} cliente(s) ativo(s) encontrado(s)`)
    
    return {
      success: true,
      tables: existingTables,
      activeClients: parseInt(clientCount.rows[0].count)
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
  const client = await pool.connect()
  try {
    // Teste básico de conexão
    await client.query('SELECT NOW()')
    console.log('✅ Conexão com banco de dados estabelecida com sucesso')
    
    // Teste de credenciais - verificar se o usuário tem permissões básicas
    const result = await client.query(`
      SELECT 
        current_user as usuario,
        current_database() as banco,
        version() as versao_postgres
    `)
    
    console.log('📊 Informações do banco:')
    console.log(`   👤 Usuário: ${result.rows[0].usuario}`)
    console.log(`   🗄️  Banco: ${result.rows[0].banco}`)
    console.log(`   📋 Versão PostgreSQL: ${result.rows[0].versao_postgres.split(' ')[0]}`)
    
    // Teste de permissões - tentar criar uma tabela temporária
    await client.query('CREATE TEMP TABLE test_permissions (id serial PRIMARY KEY, name text)')
    await client.query('INSERT INTO test_permissions (name) VALUES ($1)', ['test'])
    await client.query('SELECT * FROM test_permissions')
    await client.query('DROP TABLE test_permissions')
    
    console.log('✅ Permissões de banco de dados verificadas com sucesso')
    
    // Validar tabelas necessárias
    console.log('🔍 Validando tabelas necessárias...')
    const tableValidation = await validateRequiredTables(client)
    
    if (!tableValidation.success) {
      return {
        success: false,
        error: tableValidation.error,
        code: tableValidation.code,
        details: tableValidation
      }
    }
    
    console.log('✅ Validação de tabelas concluída com sucesso')
    
    return {
      success: true,
      user: result.rows[0].usuario,
      database: result.rows[0].banco,
      version: result.rows[0].versao_postgres.split(' ')[0],
      tables: tableValidation.tables,
      activeClients: tableValidation.activeClients
    }
    
  } catch (error) {
    console.error('❌ Erro na validação do banco de dados:', error.message)
    
    // Análise específica do erro
    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Erro: Não foi possível conectar ao servidor PostgreSQL')
      console.error('   Verifique se o PostgreSQL está rodando e se as configurações de host/porta estão corretas')
    } else if (error.code === '28P01') {
      console.error('🔑 Erro: Autenticação falhou - credenciais inválidas')
      console.error('   Verifique o usuário e senha no arquivo .env')
    } else if (error.code === '3D000') {
      console.error('🗄️  Erro: Banco de dados não existe')
      console.error('   Verifique se o banco especificado existe ou crie-o primeiro')
    } else if (error.code === '42501') {
      console.error('🚫 Erro: Permissões insuficientes')
      console.error('   O usuário não tem permissões adequadas para operações no banco')
    }
    
    return {
      success: false,
      error: error.message,
      code: error.code
    }
  } finally {
    client.release()
  }
}

// Função para executar queries
const query = async (text, params) => {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log(`📊 Query executada em ${duration}ms:`, text.substring(0, 50) + '...')
    return res
  } catch (error) {
    console.error('❌ Erro na query:', error)
    throw error
  }
}

// Função para obter uma conexão do pool
const getClient = () => {
  return pool.connect()
}

// Função para fechar o pool
const closePool = async () => {
  await pool.end()
  console.log('🔌 Pool PostgreSQL fechado')
}

module.exports = {
  query,
  getClient,
  closePool,
  pool,
  validateDatabaseConnection,
  validateRequiredTables
} 