const Redis = require('ioredis')

// Configuração do Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryDelayOnClusterDown: 300,
  enableOfflineQueue: false
}

// Cache em memória como fallback
class MemoryCache {
  constructor() {
    this.cache = new Map()
    this.timers = new Map()
  }
  
  set(key, value, ttl = 300000) {
    this.cache.set(key, value)
    
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key))
    }
    
    const timer = setTimeout(() => {
      this.cache.delete(key)
      this.timers.delete(key)
    }, ttl)
    
    this.timers.set(key, timer)
  }
  
  get(key) {
    return this.cache.get(key) || null
  }
  
  del(key) {
    this.cache.delete(key)
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key))
      this.timers.delete(key)
    }
  }
  
  clear() {
    this.cache.clear()
    this.timers.forEach(timer => clearTimeout(timer))
    this.timers.clear()
  }
  
  async flush() {
    this.clear()
  }
}

// Instância do cache em memória
const memoryCache = new MemoryCache()

// Cliente Redis
let redisClient = null
let useRedis = false

// Inicializar Redis
const initRedis = async () => {
  try {
    redisClient = new Redis(redisConfig)
    
    redisClient.on('connect', () => {
      console.log('✅ Redis conectado com sucesso')
      useRedis = true
    })
    
    redisClient.on('error', (error) => {
      console.warn('⚠️ Erro no Redis, usando cache em memória:', error.message)
      useRedis = false
    })
    
    redisClient.on('close', () => {
      console.warn('⚠️ Conexão Redis fechada, usando cache em memória')
      useRedis = false
    })
    
    // Testar conexão
    await redisClient.ping()
    useRedis = true
    
  } catch (error) {
    console.warn('⚠️ Redis não disponível, usando cache em memória:', error.message)
    useRedis = false
  }
}

// Interface unificada de cache
const cache = {
  async get(key) {
    try {
      if (useRedis && redisClient) {
        const value = await redisClient.get(key)
        return value ? JSON.parse(value) : null
      } else {
        return memoryCache.get(key)
      }
    } catch (error) {
      console.error('❌ Erro ao buscar cache:', error.message)
      return memoryCache.get(key)
    }
  },
  
  async set(key, value, ttl = 300) {
    try {
      if (useRedis && redisClient) {
        await redisClient.setex(key, ttl, JSON.stringify(value))
      } else {
        memoryCache.set(key, value, ttl * 1000)
      }
    } catch (error) {
      console.error('❌ Erro ao salvar cache:', error.message)
      memoryCache.set(key, value, ttl * 1000)
    }
  },
  
  async del(key) {
    try {
      if (useRedis && redisClient) {
        await redisClient.del(key)
      } else {
        memoryCache.del(key)
      }
    } catch (error) {
      console.error('❌ Erro ao deletar cache:', error.message)
      memoryCache.del(key)
    }
  },
  
  async flush() {
    try {
      if (useRedis && redisClient) {
        await redisClient.flushall()
      } else {
        memoryCache.clear()
      }
    } catch (error) {
      console.error('❌ Erro ao limpar cache:', error.message)
      memoryCache.clear()
    }
  },
  
  async delPattern(pattern) {
    try {
      if (useRedis && redisClient) {
        const keys = await redisClient.keys(pattern)
        if (keys.length > 0) {
          await redisClient.del(...keys)
        }
      } else {
        // Para cache em memória, implementar lógica de pattern matching
        const regex = new RegExp(pattern.replace('*', '.*'))
        for (const key of memoryCache.cache.keys()) {
          if (regex.test(key)) {
            memoryCache.del(key)
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao deletar cache por padrão:', error.message)
    }
  },
  
  // Método para verificar status do cache
  getStatus() {
    return {
      useRedis,
      redisConnected: useRedis && redisClient?.status === 'ready',
      memoryCacheSize: memoryCache.cache.size
    }
  }
}

// TTLs padrão para diferentes tipos de dados
const CACHE_TTL = {
  CONTACTS: 600,        // 10 minutos
  CHATS: 300,           // 5 minutos
  MESSAGES: 120,        // 2 minutos
  PROFILE_PIC: 3600,    // 1 hora
  STATUS: 300,          // 5 minutos
  QR_CODE: 60,          // 1 minuto
  SESSION_INFO: 30      // 30 segundos
}

// Funções auxiliares para cache específico
const cacheHelpers = {
  // Cache de contatos
  async getContacts(sessionId) {
    const key = `contacts:${sessionId}`
    return await cache.get(key)
  },
  
  async setContacts(sessionId, contacts) {
    const key = `contacts:${sessionId}`
    await cache.set(key, contacts, CACHE_TTL.CONTACTS)
  },
  
  // Cache de chats
  async getChats(sessionId) {
    const key = `chats:${sessionId}`
    return await cache.get(key)
  },
  
  async setChats(sessionId, chats) {
    const key = `chats:${sessionId}`
    await cache.set(key, chats, CACHE_TTL.CHATS)
  },
  
  // Cache de mensagens
  async getMessages(sessionId, chatId, limit = 50) {
    const key = `messages:${sessionId}:${chatId}:${limit}`
    return await cache.get(key)
  },
  
  async setMessages(sessionId, chatId, messages, limit = 50) {
    const key = `messages:${sessionId}:${chatId}:${limit}`
    await cache.set(key, messages, CACHE_TTL.MESSAGES)
  },
  
  // Invalidar cache de mensagens quando nova mensagem chegar
  async invalidateMessageCache(sessionId, chatId) {
    const pattern = `messages:${sessionId}:${chatId}:*`
    await cache.delPattern(pattern)
  },
  
  // Cache de foto de perfil
  async getProfilePic(sessionId, contactId) {
    const key = `profile_pic:${sessionId}:${contactId}`
    return await cache.get(key)
  },
  
  async setProfilePic(sessionId, contactId, profilePic) {
    const key = `profile_pic:${sessionId}:${contactId}`
    await cache.set(key, profilePic, CACHE_TTL.PROFILE_PIC)
  },
  
  // Cache de QR code
  async getQRCode(sessionId) {
    const key = `qr:${sessionId}`
    return await cache.get(key)
  },
  
  async setQRCode(sessionId, qrCode) {
    const key = `qr:${sessionId}`
    await cache.set(key, qrCode, CACHE_TTL.QR_CODE)
  },
  
  // Limpar cache de uma sessão específica
  async clearSessionCache(sessionId) {
    const patterns = [
      `contacts:${sessionId}`,
      `chats:${sessionId}`,
      `messages:${sessionId}:*`,
      `profile_pic:${sessionId}:*`,
      `qr:${sessionId}`
    ]
    
    for (const pattern of patterns) {
      await cache.delPattern(pattern)
    }
  }
}

module.exports = {
  cache,
  cacheHelpers,
  CACHE_TTL,
  initRedis,
  memoryCache
} 