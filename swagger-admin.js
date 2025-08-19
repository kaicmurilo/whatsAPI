const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0', autoBody: false })

const outputFile = './swagger-admin.json'
const endpointsFiles = ['./src/routes/adminRoutes.js']

const doc = {
  info: {
    title: 'WhatsApp API - Administração',
    description: 'API Wrapper for WhatsAppWebJS - Rotas Administrativas (API Key)'
  },
  servers: [
    {
      url: '/admin',
      description: 'Rotas administrativas'
    }
  ],
  securityDefinitions: {
    apiKeyAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'x-api-key'
    }
  },
  produces: ['application/json'],
  tags: [
    {
      name: 'Admin',
      description: 'Rotas administrativas para gerenciamento de usuários'
    }
  ],
  definitions: {
    UserResponse: {
      success: true,
      data: {
        id: 1,
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        user_name: "Admin User",
        user_documento_identificacao: "123.456.789-00",
        description: "Usuário administrativo",
        is_active: true,
        created_at: "2024-01-01T00:00:00.000Z"
      }
    },
    UsersListResponse: {
      success: true,
      data: [
        {
          id: 1,
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          user_name: "Admin User",
          user_documento_identificacao: "123.456.789-00",
          description: "Usuário administrativo",
          is_active: true,
          created_at: "2024-01-01T00:00:00.000Z"
        }
      ]
    },
    TokenResponse: {
      success: true,
      data: [
        {
          id: 1,
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          refresh_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          expires_at: "2024-01-01T00:00:00.000Z",
          scope: "read write"
        }
      ]
    },
    SessionResponse: {
      success: true,
      data: [
        {
          id: 1,
          session_id: "f8377d8d-a589-4242-9ba6-9486a04ef80c",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          status: "CONNECTED",
          created_at: "2024-01-01T00:00:00.000Z"
        }
      ]
    },
    ErrorResponse: {
      success: false,
      error: 'Some server error'
    },
    ForbiddenResponse: {
      success: false,
      error: 'Invalid API key'
    }
  }
}

swaggerAutogen(outputFile, endpointsFiles, doc) 