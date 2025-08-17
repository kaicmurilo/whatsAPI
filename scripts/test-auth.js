#!/usr/bin/env node

const axios = require('axios')

const API_BASE_URL = 'http://localhost:3000'

async function testAuthSystem() {
  console.log('🧪 Testando sistema de autenticação...\n')

  try {
    // 1. Testar criação de cliente
    console.log('1️⃣ Criando cliente de teste...')
    const createClientResponse = await axios.post(`${API_BASE_URL}/auth/clients`, {
      client_name: 'Cliente de Teste',
      description: 'Cliente criado para testes automatizados'
    })

    const client = createClientResponse.data.data
    console.log('✅ Cliente criado:', client.client_id)

    // 2. Testar autenticação
    console.log('\n2️⃣ Testando autenticação...')
    const authResponse = await axios.post(`${API_BASE_URL}/auth/authenticate`, {
      client_id: client.client_id,
      client_secret: client.client_secret,
      scope: 'read write admin'
    })

    const tokens = authResponse.data.data
    console.log('✅ Autenticação bem-sucedida')
    console.log('   Access Token:', tokens.access_token.substring(0, 20) + '...')
    console.log('   Refresh Token:', tokens.refresh_token.substring(0, 20) + '...')

    // 3. Testar verificação de token
    console.log('\n3️⃣ Testando verificação de token...')
    const verifyResponse = await axios.post(`${API_BASE_URL}/auth/verify`, {
      access_token: tokens.access_token
    })

    console.log('✅ Token verificado com sucesso')
    console.log('   Cliente:', verifyResponse.data.data.client.client_name)

    // 4. Testar uso da API com token
    console.log('\n4️⃣ Testando uso da API com token...')
    const apiResponse = await axios.get(`${API_BASE_URL}/ping`, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    })

    console.log('✅ API acessada com token:', apiResponse.data)

    // 5. Testar renovação de token
    console.log('\n5️⃣ Testando renovação de token...')
    const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: tokens.refresh_token
    })

    console.log('✅ Token renovado com sucesso')
    console.log('   Novo Access Token:', refreshResponse.data.data.access_token.substring(0, 20) + '...')

    // 6. Testar listagem de clientes (requer admin)
    console.log('\n6️⃣ Testando listagem de clientes...')
    const clientsResponse = await axios.get(`${API_BASE_URL}/auth/clients`, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    })

    console.log('✅ Clientes listados:', clientsResponse.data.data.length, 'clientes encontrados')

    // 7. Testar revogação de token
    console.log('\n7️⃣ Testando revogação de token...')
    const revokeResponse = await axios.post(`${API_BASE_URL}/auth/revoke`, {
      access_token: tokens.access_token
    })

    console.log('✅ Token revogado com sucesso')

    console.log('\n🎉 Todos os testes passaram! Sistema de autenticação funcionando corretamente.')

  } catch (error) {
    console.error('\n❌ Erro nos testes:', error.response?.data || error.message)
    
    if (error.response?.status === 500) {
      console.log('\n💡 Dica: Verifique se o PostgreSQL está rodando:')
      console.log('   npm run postgres:start')
      console.log('   npm run db:init')
    }
    
    process.exit(1)
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testAuthSystem()
    .then(() => {
      console.log('\n✅ Teste concluído com sucesso')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Erro no teste:', error)
      process.exit(1)
    })
}

module.exports = { testAuthSystem } 