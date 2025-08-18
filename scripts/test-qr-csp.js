const axios = require('axios')

// Configurações
const BASE_URL = 'http://localhost:3000'
const API_KEY = 'test_api_key' // Use a API key configurada no seu .env

async function testQREndpoints() {
  console.log('🧪 Testando endpoints de QR para identificar problemas...\n')
  
  try {
    // 1. Testar endpoint de saúde
    console.log('1️⃣ Testando endpoint de saúde...')
    try {
      const healthResponse = await axios.get(`${BASE_URL}/ping`)
      console.log('✅ Endpoint de saúde OK:', healthResponse.data)
    } catch (error) {
      console.log('❌ Erro no endpoint de saúde:', error.response?.status, error.response?.data)
    }
    
    // 2. Testar QR sem autenticação
    console.log('\n2️⃣ Testando QR sem autenticação...')
    try {
      const qrResponse = await axios.get(`${BASE_URL}/test-qr`, {
        responseType: 'arraybuffer'
      })
      console.log('✅ QR sem auth OK')
      console.log(`📊 Tamanho: ${qrResponse.data.length} bytes`)
      console.log(`📋 Content-Type: ${qrResponse.headers['content-type']}`)
    } catch (error) {
      console.log('❌ Erro no QR sem auth:', error.response?.status, error.response?.data)
    }
    
    // 3. Testar QR com autenticação
    console.log('\n3️⃣ Testando QR com autenticação...')
    try {
      const qrAuthResponse = await axios.get(`${BASE_URL}/test-qr-auth`, {
        headers: { 'x-api-key': API_KEY },
        responseType: 'arraybuffer'
      })
      console.log('✅ QR com auth OK')
      console.log(`📊 Tamanho: ${qrAuthResponse.data.length} bytes`)
      console.log(`📋 Content-Type: ${qrAuthResponse.headers['content-type']}`)
    } catch (error) {
      console.log('❌ Erro no QR com auth:', error.response?.status, error.response?.data)
      if (error.response?.status === 403) {
        console.log('🔐 Problema de autenticação detectado!')
        console.log('💡 Verifique se a API_KEY está configurada corretamente no .env')
      }
    }
    
    // 4. Testar endpoint real de QR (requer sessão)
    console.log('\n4️⃣ Testando endpoint real de QR...')
    try {
      const realQrResponse = await axios.get(`${BASE_URL}/session/qr/test-session/image`, {
        headers: { 'x-api-key': API_KEY },
        responseType: 'arraybuffer'
      })
      console.log('✅ Endpoint real de QR OK')
      console.log(`📊 Tamanho: ${realQrResponse.data.length} bytes`)
    } catch (error) {
      console.log('❌ Erro no endpoint real de QR:', error.response?.status, error.response?.data)
      if (error.response?.status === 403) {
        console.log('🔐 Problema de autenticação no endpoint real!')
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message)
  }
  
  console.log('\n🏁 Teste concluído!')
  console.log('\n📝 Resumo dos problemas possíveis:')
  console.log('   1. Erro 403: Problema de autenticação/autorização')
  console.log('   2. Erro CSP: Problema de Content Security Policy')
  console.log('   3. Erro 404: Endpoint não encontrado')
  console.log('   4. Erro 500: Erro interno do servidor')
}

// Executar teste
if (require.main === module) {
  testQREndpoints()
}

module.exports = { testQREndpoints } 