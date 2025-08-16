// Configuração do Swagger para múltiplos idiomas
const fs = require('fs');
const path = require('path');

// Configurações disponíveis
const SWAGGER_CONFIGS = {
  'en': {
    file: 'swagger.json',
    title: 'WhatsApp API',
    description: 'API Wrapper for WhatsAppWebJS'
  },
  'pt': {
    file: 'swagger-pt.json',
    title: 'WhatsApp API',
    description: 'API Wrapper para WhatsAppWebJS - Interface REST para interagir com o WhatsApp Web'
  }
};

// Função para obter configuração do Swagger baseada no idioma
function getSwaggerConfig(language = 'en') {
  const config = SWAGGER_CONFIGS[language] || SWAGGER_CONFIGS['en'];
  
  try {
    const swaggerPath = path.join(__dirname, config.file);
    const swaggerContent = fs.readFileSync(swaggerPath, 'utf8');
    return JSON.parse(swaggerContent);
  } catch (error) {
    console.error(`Erro ao carregar Swagger ${language}:`, error.message);
    // Fallback para inglês
    const fallbackPath = path.join(__dirname, 'swagger.json');
    const fallbackContent = fs.readFileSync(fallbackPath, 'utf8');
    return JSON.parse(fallbackContent);
  }
}

// Função para listar idiomas disponíveis
function getAvailableLanguages() {
  return Object.keys(SWAGGER_CONFIGS).map(lang => ({
    code: lang,
    name: lang === 'en' ? 'English' : 'Português',
    file: SWAGGER_CONFIGS[lang].file
  }));
}

// Função para verificar se um idioma está disponível
function isLanguageAvailable(language) {
  return Object.keys(SWAGGER_CONFIGS).includes(language);
}

module.exports = {
  getSwaggerConfig,
  getAvailableLanguages,
  isLanguageAvailable,
  SWAGGER_CONFIGS
}; 