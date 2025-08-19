const axios = require('axios')

// Configurações
const BASE_URL = 'http://localhost:3000'
const API_KEY = 'test_api_key' // Use a API key configurada no seu .env

async function testUsersSwagger() {
  console.log('🧪 Testando documentação de gerenciamento administrativo de usuários...\n')
  
  try {
    // 1. Testar endpoint de listagem de idiomas
    console.log('1️⃣ Testando listagem de idiomas...')
    try {
      const languagesResponse = await axios.get(`${BASE_URL}/api-docs/languages`)
      console.log('✅ Idiomas disponíveis:', languagesResponse.data)
      
      // Verificar se 'clients' está na lista
      const usersDoc = languagesResponse.data.data.find(lang => lang.code === 'clients')
      if (usersDoc) {
        console.log('✅ Documentação de usuários encontrada:', usersDoc)
      } else {
        console.log('❌ Documentação de usuários não encontrada')
      }
    } catch (error) {
      console.log('❌ Erro ao listar idiomas:', error.response?.status, error.response?.data)
    }
    
    // 2. Testar acesso à documentação de usuários
    console.log('\n2️⃣ Testando acesso à documentação de usuários...')
    try {
      const usersResponse = await axios.get(`${BASE_URL}/api-docs/clients`)
      console.log('✅ Documentação de usuários acessível')
      console.log(`📊 Status: ${usersResponse.status}`)
      console.log(`📋 Content-Type: ${usersResponse.headers['content-type']}`)
    } catch (error) {
      console.log('❌ Erro ao acessar documentação de usuários:', error.response?.status, error.response?.data)
    }
    
    // 3. Testar JSON da documentação de usuários
    console.log('\n3️⃣ Testando JSON da documentação de usuários...')
    try {
      const usersJsonResponse = await axios.get(`${BASE_URL}/api-docs/json/clients`)
      console.log('✅ JSON da documentação de usuários acessível')
      console.log(`📊 Título: ${usersJsonResponse.data.info.title}`)
      console.log(`📋 Descrição: ${usersJsonResponse.data.info.description}`)
      console.log(`🔗 Endpoints: ${Object.keys(usersJsonResponse.data.paths).length}`)
      
      // Verificar se contém APENAS os endpoints de gerenciamento administrativo
      const expectedEndpoints = [
        '/auth/users',
        '/auth/users/{userId}',
        '/auth/users/{userId}/tokens',
        '/auth/users/{userId}/sessions'
      ]
      
      // Endpoints que NÃO devem estar na documentação de usuários
      const forbiddenEndpoints = [
        '/auth/authenticate',
        '/auth/refresh',
        '/auth/revoke',
        '/auth/verify',
        '/session/start',
        '/session/status',
        '/session/qr',
        '/client/sendMessage'
      ]
      
      const foundEndpoints = Object.keys(usersJsonResponse.data.paths)
      console.log('📋 Endpoints encontrados:', foundEndpoints)
      
      // Verificar endpoints esperados
      console.log('\n✅ Verificando endpoints de gerenciamento administrativo:')
      expectedEndpoints.forEach(endpoint => {
        if (foundEndpoints.includes(endpoint)) {
          console.log(`   ✅ ${endpoint} - OK`)
        } else {
          console.log(`   ❌ ${endpoint} - FALTANDO`)
        }
      })
      
      // Verificar endpoints que NÃO devem estar
      console.log('\n❌ Verificando endpoints que NÃO devem estar na documentação de usuários:')
      forbiddenEndpoints.forEach(endpoint => {
        if (foundEndpoints.includes(endpoint)) {
          console.log(`   ❌ ${endpoint} - NÃO DEVERIA ESTAR AQUI`)
        } else {
          console.log(`   ✅ ${endpoint} - CORRETO (não está aqui)`)
        }
      })
      
      // Verificar se a documentação é específica para admin
      const description = usersJsonResponse.data.info.description
      if (description.includes('administrativo') || description.includes('admin')) {
        console.log('✅ Descrição indica que é documentação administrativa')
      } else {
        console.log('❌ Descrição não indica que é documentação administrativa')
      }
      
      // Verificar se usa nomenclatura correta (usuários)
      if (description.includes('usuários') || description.includes('users')) {
        console.log('✅ Descrição usa nomenclatura correta (usuários)')
      } else {
        console.log('❌ Descrição não usa nomenclatura correta')
      }
      
    } catch (error) {
      console.log('❌ Erro ao acessar JSON de usuários:', error.response?.status, error.response?.data)
    }
    
    // 4. Testar página principal de seleção
    console.log('\n4️⃣ Testando página principal de seleção...')
    try {
      const mainResponse = await axios.get(`${BASE_URL}/api-docs`)
      console.log('✅ Página principal acessível')
      console.log(`📊 Status: ${mainResponse.status}`)
      console.log(`📋 Content-Type: ${mainResponse.headers['content-type']}`)
      
      // Verificar se contém link para usuários
      if (mainResponse.data.includes('/api-docs/clients')) {
        console.log('✅ Link para documentação de usuários encontrado na página principal')
      } else {
        console.log('❌ Link para documentação de usuários não encontrado')
      }
      
      // Verificar se contém descrição correta
      if (mainResponse.data.includes('Gerenciamento Administrativo')) {
        console.log('✅ Título correto encontrado na página principal')
      } else {
        console.log('❌ Título incorreto na página principal')
      }
      
      if (mainResponse.data.includes('usuários')) {
        console.log('✅ Descrição correta encontrada na página principal')
      } else {
        console.log('❌ Descrição incorreta na página principal')
      }
    } catch (error) {
      console.log('❌ Erro ao acessar página principal:', error.response?.status, error.response?.data)
    }
    
    // 5. Testar endpoint de criação de usuário (público)
    console.log('\n5️⃣ Testando endpoint de criação de usuário...')
    try {
      const createUserResponse = await axios.post(`${BASE_URL}/auth/users`, {
        user_name: 'Usuário Teste Admin',
        user_documento_identificacao: '123.456.789-00',
        description: 'Usuário criado para teste da documentação administrativa'
      })
      console.log('✅ Endpoint de criação de usuário funcionando')
      console.log(`📊 Usuário criado: ${createUserResponse.data.data.user_id}`)
      console.log(`📋 Documento: ${createUserResponse.data.data.user_documento_identificacao}`)
      
      // Salvar user_id para testes posteriores
      const testUserId = createUserResponse.data.data.user_id
      
      // 6. Testar endpoint de listagem de usuários (requer admin)
      console.log('\n6️⃣ Testando endpoint de listagem de usuários...')
      try {
        const listUsersResponse = await axios.get(`${BASE_URL}/auth/users`, {
          headers: { 'x-api-key': API_KEY }
        })
        console.log('✅ Endpoint de listagem de usuários funcionando')
        console.log(`📊 Total de usuários: ${listUsersResponse.data.data.length}`)
      } catch (error) {
        console.log('❌ Erro ao listar usuários:', error.response?.status, error.response?.data)
      }
      
      // 7. Testar endpoint de tokens do usuário
      console.log('\n7️⃣ Testando endpoint de tokens do usuário...')
      try {
        const tokensResponse = await axios.get(`${BASE_URL}/auth/users/${testUserId}/tokens`, {
          headers: { 'x-api-key': API_KEY }
        })
        console.log('✅ Endpoint de tokens do usuário funcionando')
        console.log(`📊 Tokens encontrados: ${tokensResponse.data.data.length}`)
      } catch (error) {
        console.log('❌ Erro ao listar tokens:', error.response?.status, error.response?.data)
      }
      
      // 8. Testar endpoint de sessões do usuário
      console.log('\n8️⃣ Testando endpoint de sessões do usuário...')
      try {
        const sessionsResponse = await axios.get(`${BASE_URL}/auth/users/${testUserId}/sessions`, {
          headers: { 'x-api-key': API_KEY }
        })
        console.log('✅ Endpoint de sessões do usuário funcionando')
        console.log(`📊 Sessões encontradas: ${sessionsResponse.data.data.length}`)
      } catch (error) {
        console.log('❌ Erro ao listar sessões:', error.response?.status, error.response?.data)
      }
      
    } catch (error) {
      console.log('❌ Erro ao criar usuário:', error.response?.status, error.response?.data)
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message)
  }
  
  console.log('\n🏁 Teste concluído!')
  console.log('\n📝 Resumo:')
  console.log('   - Documentação deve conter APENAS endpoints de gerenciamento administrativo')
  console.log('   - NÃO deve conter endpoints de autenticação ou WhatsApp')
  console.log('   - Deve ser específica para administradores')
  console.log('   - Deve usar nomenclatura correta (usuários, não clientes)')
  console.log('   - Deve incluir campo user_documento_identificacao')
  console.log('   - Endpoints devem funcionar com API key master')
  console.log('   - Interface deve indicar claramente que é para admin')
}

// Executar teste
if (require.main === module) {
  testUsersSwagger()
}

module.exports = { testUsersSwagger } 