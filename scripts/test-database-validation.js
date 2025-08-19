#!/usr/bin/env node

/**
 * Script para testar a validação do banco de dados
 * 
 * Este script testa:
 * 1. Conexão com o banco de dados
 * 2. Validação de credenciais
 * 3. Verificação de permissões
 * 4. Validação das tabelas necessárias
 * 5. Teste via API endpoint
 */

const { validateDatabaseConnection } = require('../src/database')
const axios = require('axios')

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

async function testDatabaseValidation() {
  console.log('🧪 Iniciando testes de validação do banco de dados...\n')
  
  try {
    // Teste 1: Validação direta da função de banco de dados
    console.log('📋 Teste 1: Validação direta da função de banco de dados')
    console.log('=' .repeat(50))
    
    const dbValidation = await validateDatabaseConnection()
    
    if (dbValidation.success) {
      console.log('✅ Teste 1 PASSOU')
      console.log(`   👤 Usuário: ${dbValidation.user}`)
      console.log(`   🗄️  Banco: ${dbValidation.database}`)
      console.log(`   📋 Versão: ${dbValidation.version}`)
      console.log(`   📊 Tabelas: ${dbValidation.tables.join(', ')}`)
      console.log(`   👥 Usuários ativos: ${dbValidation.activeUsers}`)
    } else {
      console.log('❌ Teste 1 FALHOU')
      console.log(`   Erro: ${dbValidation.error}`)
      console.log(`   Código: ${dbValidation.code}`)
      
      if (dbValidation.details) {
        if (dbValidation.details.missingTables) {
          console.log(`   📋 Tabelas ausentes: ${dbValidation.details.missingTables.join(', ')}`)
        }
        if (dbValidation.details.tableValidations) {
          console.log('   🔧 Problemas de estrutura:')
          dbValidation.details.tableValidations.forEach(validation => {
            console.log(`      - ${validation.table}: ${validation.error}`)
          })
        }
      }
    }
    
    console.log()
    
    // Teste 2: Validação via API endpoint
    console.log('📋 Teste 2: Validação via API endpoint')
    console.log('=' .repeat(50))
    
    try {
      const response = await axios.get(`${API_BASE_URL}/database/status`, {
        timeout: 10000
      })
      
      if (response.status === 200 && response.data.success) {
        console.log('✅ Teste 2 PASSOU')
        console.log(`   👤 Usuário: ${response.data.database.user}`)
        console.log(`   🗄️  Banco: ${response.data.database.database}`)
        console.log(`   📋 Versão: ${response.data.database.version}`)
        console.log(`   🔐 Permissões: ${response.data.database.permissions ? 'OK' : 'FALHOU'}`)
        console.log(`   📊 Tabelas: ${response.data.database.tables ? response.data.database.tables.join(', ') : 'N/A'}`)
        console.log(`   👥 Usuários ativos: ${response.data.database.activeUsers || 'N/A'}`)
      } else {
        console.log('❌ Teste 2 FALHOU')
        console.log(`   Status: ${response.status}`)
        console.log(`   Resposta: ${JSON.stringify(response.data, null, 2)}`)
      }
    } catch (apiError) {
      console.log('❌ Teste 2 FALHOU')
      if (apiError.code === 'ECONNREFUSED') {
        console.log('   Erro: Não foi possível conectar à API')
        console.log('   Verifique se o servidor está rodando em:', API_BASE_URL)
      } else {
        console.log(`   Erro: ${apiError.message}`)
      }
    }
    
    console.log()
    
    // Resumo dos testes
    console.log('📊 Resumo dos testes:')
    console.log('=' .repeat(50))
    
    if (dbValidation.success) {
      console.log('✅ Validação do banco de dados: SUCESSO')
      console.log('   O banco de dados está funcionando corretamente')
      console.log('   Credenciais e permissões estão válidas')
      console.log(`   Todas as ${dbValidation.tables.length} tabelas necessárias estão presentes`)
              console.log(`   ${dbValidation.activeUsers} usuário(s) ativo(s) encontrado(s)`)
    } else {
      console.log('❌ Validação do banco de dados: FALHA')
      console.log('   Verifique as configurações do banco de dados')
      console.log('   Consulte os logs acima para mais detalhes')
      
      // Sugestões específicas baseadas no código de erro
      if (dbValidation.code === 'MISSING_TABLES') {
        console.log('\n💡 SUGESTÕES:')
        console.log('   1. Execute: npm run db:init')
        console.log('   2. Ou execute: npm run db:reset')
      } else if (dbValidation.code === 'INVALID_TABLE_STRUCTURE') {
        console.log('\n💡 SUGESTÕES:')
        console.log('   1. Execute: npm run db:reset (recreará as tabelas)')
        console.log('   2. Verifique se o script init.sql está atualizado')
      } else if (dbValidation.code === 'NO_ACTIVE_USERS') {
        console.log('\n💡 SUGESTÕES:')
        console.log('   1. Execute: npm run db:init (criará cliente padrão)')
        console.log('   2. Ou crie um cliente via API de autenticação')
      }
    }
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message)
    process.exit(1)
  }
}

// Executar os testes se o script for chamado diretamente
if (require.main === module) {
  testDatabaseValidation()
    .then(() => {
      console.log('\n🎉 Testes concluídos!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Erro fatal:', error)
      process.exit(1)
    })
}

module.exports = { testDatabaseValidation } 