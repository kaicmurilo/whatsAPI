#!/usr/bin/env node

const axios = require('axios')

const API_BASE_URL = 'http://localhost:3000'

async function testSessionOwnership() {
  console.log('🧪 Testando associação de sessões aos clientes...\n')

  let client1, client2, token1, token2

  try {
    // 1. Criar dois clientes
    console.log('1️⃣ Criando dois clientes...')
    
    const client1Response = await axios.post(`${API_BASE_URL}/auth/clients`, {
      client_name: 'Cliente 1',
      description: 'Cliente para teste de propriedade de sessão'
    })
    client1 = client1Response.data.data
    console.log('✅ Cliente 1 criado:', client1.client_id)

    const client2Response = await axios.post(`${API_BASE_URL}/auth/clients`, {
      client_name: 'Cliente 2',
      description: 'Cliente para teste de propriedade de sessão'
    })
    client2 = client2Response.data.data
    console.log('✅ Cliente 2 criado:', client2.client_id)

    // 2. Autenticar os clientes
    console.log('\n2️⃣ Autenticando clientes...')
    
    const auth1Response = await axios.post(`${API_BASE_URL}/auth/authenticate`, {
      client_id: client1.client_id,
      client_secret: client1.client_secret,
      scope: 'read write'
    })
    token1 = auth1Response.data.data.access_token
    console.log('✅ Cliente 1 autenticado')

    const auth2Response = await axios.post(`${API_BASE_URL}/auth/authenticate`, {
      client_id: client2.client_id,
      client_secret: client2.client_secret,
      scope: 'read write'
    })
    token2 = auth2Response.data.data.access_token
    console.log('✅ Cliente 2 autenticado')

    // 3. Cliente 1 cria uma sessão
    console.log('\n3️⃣ Cliente 1 criando sessão...')
    const sessionId = 'test-session-ownership'
    
    const startSessionResponse = await axios.get(`${API_BASE_URL}/session/start/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token1}`
      }
    })
    console.log('✅ Sessão criada pelo Cliente 1:', startSessionResponse.data)

    // 4. Verificar se Cliente 1 pode acessar a sessão
    console.log('\n4️⃣ Verificando acesso do Cliente 1 à sessão...')
    const statusResponse1 = await axios.get(`${API_BASE_URL}/session/status/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token1}`
      }
    })
    console.log('✅ Cliente 1 pode acessar a sessão:', statusResponse1.data)

    // 5. Verificar se Cliente 2 NÃO pode acessar a sessão
    console.log('\n5️⃣ Verificando que Cliente 2 NÃO pode acessar a sessão...')
    try {
      await axios.get(`${API_BASE_URL}/session/status/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token2}`
        }
      })
      console.log('❌ ERRO: Cliente 2 conseguiu acessar a sessão (não deveria)')
      return
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ Cliente 2 corretamente bloqueado de acessar a sessão')
      } else {
        console.log('❌ Erro inesperado:', error.response?.data || error.message)
        return
      }
    }

    // 6. Verificar se Cliente 2 pode criar uma sessão diferente
    console.log('\n6️⃣ Cliente 2 criando sessão diferente...')
    const sessionId2 = 'test-session-ownership-2'
    
    const startSession2Response = await axios.get(`${API_BASE_URL}/session/start/${sessionId2}`, {
      headers: {
        'Authorization': `Bearer ${token2}`
      }
    })
    console.log('✅ Sessão 2 criada pelo Cliente 2:', startSession2Response.data)

    // 7. Verificar se Cliente 1 NÃO pode acessar a sessão do Cliente 2
    console.log('\n7️⃣ Verificando que Cliente 1 NÃO pode acessar a sessão do Cliente 2...')
    try {
      await axios.get(`${API_BASE_URL}/session/status/${sessionId2}`, {
        headers: {
          'Authorization': `Bearer ${token1}`
        }
      })
      console.log('❌ ERRO: Cliente 1 conseguiu acessar a sessão do Cliente 2 (não deveria)')
      return
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ Cliente 1 corretamente bloqueado de acessar a sessão do Cliente 2')
      } else {
        console.log('❌ Erro inesperado:', error.response?.data || error.message)
        return
      }
    }

    // 8. Listar sessões dos clientes
    console.log('\n8️⃣ Listando sessões dos clientes...')
    
    // Obter token admin para listar sessões
    const adminAuthResponse = await axios.post(`${API_BASE_URL}/auth/authenticate`, {
      client_id: client1.client_id,
      client_secret: client1.client_secret,
      scope: 'read write admin'
    })
    const adminToken = adminAuthResponse.data.data.access_token

    const sessions1Response = await axios.get(`${API_BASE_URL}/auth/clients/${client1.client_id}/sessions`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    })
    console.log('✅ Sessões do Cliente 1:', sessions1Response.data.data.length, 'sessões')

    const sessions2Response = await axios.get(`${API_BASE_URL}/auth/clients/${client2.client_id}/sessions`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    })
    console.log('✅ Sessões do Cliente 2:', sessions2Response.data.data.length, 'sessões')

    // 9. Testar uso da API com sessão
    console.log('\n9️⃣ Testando uso da API com sessão...')
    const stateResponse = await axios.get(`${API_BASE_URL}/client/getState/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token1}`
      }
    })
    console.log('✅ API funcionando com sessão do Cliente 1:', stateResponse.data)

    console.log('\n🎉 Todos os testes de propriedade de sessão passaram!')
    console.log('✅ Sistema de associação de sessões funcionando corretamente.')

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
  testSessionOwnership()
    .then(() => {
      console.log('\n✅ Teste de propriedade de sessão concluído com sucesso')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Erro no teste:', error)
      process.exit(1)
    })
}

module.exports = { testSessionOwnership } 