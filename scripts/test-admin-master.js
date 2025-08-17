#!/usr/bin/env node

const axios = require('axios')

const API_BASE_URL = 'http://localhost:3000'

async function testAdminMaster() {
  console.log('🧪 Testando funcionalidade do Admin Master...\n')

  try {
    // 1. Testar acesso com API key master (sem token JWT)
    console.log('1️⃣ Testando acesso com API key master...')
    
    // Simular API key master (deve ser configurada no .env)
    const masterApiKey = process.env.API_KEY || 'your_admin_master_api_key_here'
    
    if (masterApiKey === 'your_admin_master_api_key_here') {
      console.log('⚠️  API key master não configurada. Configure API_KEY no .env')
      console.log('   Exemplo: API_KEY=master_key_123456')
      return
    }

    // Testar acesso a endpoint protegido com API key master
    const masterResponse = await axios.get(`${API_BASE_URL}/session/start/test-master-session`, {
      headers: {
        'x-api-key': masterApiKey
      }
    })
    console.log('✅ Admin master pode criar sessão:', masterResponse.data)

    // 2. Testar acesso a sessão de outro cliente
    console.log('\n2️⃣ Testando acesso a sessão de outro cliente...')
    
    // Primeiro, criar um cliente normal
    const clientResponse = await axios.post(`${API_BASE_URL}/auth/clients`, {
      client_name: 'Cliente Normal',
      description: 'Cliente para teste de admin master'
    })
    const client = clientResponse.data.data
    console.log('✅ Cliente normal criado:', client.client_id)

    // Autenticar o cliente normal
    const authResponse = await axios.post(`${API_BASE_URL}/auth/authenticate`, {
      client_id: client.client_id,
      client_secret: client.client_secret,
      scope: 'read write'
    })
    const token = authResponse.data.data.access_token
    console.log('✅ Cliente normal autenticado')

    // Cliente normal cria uma sessão
    const sessionId = 'test-client-session'
    await axios.get(`${API_BASE_URL}/session/start/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    console.log('✅ Cliente normal criou sessão')

    // Admin master acessa a sessão do cliente normal
    const masterSessionResponse = await axios.get(`${API_BASE_URL}/session/status/${sessionId}`, {
      headers: {
        'x-api-key': masterApiKey
      }
    })
    console.log('✅ Admin master pode acessar sessão de outro cliente:', masterSessionResponse.data)

    // 3. Testar operações administrativas
    console.log('\n3️⃣ Testando operações administrativas...')
    
    // Listar todos os clientes
    const clientsResponse = await axios.get(`${API_BASE_URL}/auth/clients`, {
      headers: {
        'x-api-key': masterApiKey
      }
    })
    console.log('✅ Admin master pode listar clientes:', clientsResponse.data.data.length, 'clientes')

    // Listar sessões de um cliente
    const sessionsResponse = await axios.get(`${API_BASE_URL}/auth/clients/${client.client_id}/sessions`, {
      headers: {
        'x-api-key': masterApiKey
      }
    })
    console.log('✅ Admin master pode listar sessões do cliente:', sessionsResponse.data.data.length, 'sessões')

    // 4. Testar operações WhatsApp com admin master
    console.log('\n4️⃣ Testando operações WhatsApp com admin master...')
    
    const stateResponse = await axios.get(`${API_BASE_URL}/client/getState/${sessionId}`, {
      headers: {
        'x-api-key': masterApiKey
      }
    })
    console.log('✅ Admin master pode usar operações WhatsApp:', stateResponse.data)

    // 5. Testar que cliente normal NÃO pode acessar sessão do admin master
    console.log('\n5️⃣ Testando isolamento de sessões...')
    
    try {
      await axios.get(`${API_BASE_URL}/session/status/test-master-session`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      console.log('❌ ERRO: Cliente normal conseguiu acessar sessão do admin master (não deveria)')
      return
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ Cliente normal corretamente bloqueado de acessar sessão do admin master')
      } else {
        console.log('❌ Erro inesperado:', error.response?.data || error.message)
        return
      }
    }

    // 6. Testar operações administrativas sem API key
    console.log('\n6️⃣ Testando que operações administrativas requerem API key...')
    
    try {
      await axios.get(`${API_BASE_URL}/auth/clients`)
      console.log('❌ ERRO: Operação administrativa funcionou sem autenticação (não deveria)')
      return
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('✅ Operações administrativas corretamente protegidas')
      } else {
        console.log('❌ Erro inesperado:', error.response?.data || error.message)
        return
      }
    }

    console.log('\n🎉 Todos os testes do Admin Master passaram!')
    console.log('✅ Sistema de admin master funcionando corretamente.')

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
  testAdminMaster()
    .then(() => {
      console.log('\n✅ Teste do Admin Master concluído com sucesso')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Erro no teste:', error)
      process.exit(1)
    })
}

module.exports = { testAdminMaster } 