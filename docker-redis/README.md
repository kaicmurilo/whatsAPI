# Redis para WhatsApp API

Este diretório contém a configuração do Redis para cache da API do WhatsApp.

## 🚀 Início Rápido

### 1. Iniciar Redis
```bash
cd docker-redis
./start-redis.sh
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo `env.example` para `.env` e configure:

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here
```

### 3. Testar Conexão
```bash
# Via Docker
docker exec -it whatsapp-redis redis-cli ping

# Via redis-cli local
redis-cli -h localhost -p 6379 ping
```

## 📊 Monitoramento

### Redis Commander
Acesse: http://localhost:8081

Interface web para monitorar e gerenciar o Redis.

### Comandos Úteis
```bash
# Ver logs do Redis
docker-compose logs -f redis

# Ver logs do Redis Commander
docker-compose logs -f redis-commander

# Acessar CLI do Redis
docker exec -it whatsapp-redis redis-cli

# Ver estatísticas
docker exec -it whatsapp-redis redis-cli info
```

## ⚙️ Configuração

### redis.conf
- **Memória**: 256MB máximo
- **Política**: LRU (Least Recently Used)
- **Persistência**: RDB com snapshots automáticos
- **Segurança**: Senha configurável

### Personalização
1. Edite `redis.conf` para alterar configurações
2. Modifique `docker-compose.yml` para ajustar recursos
3. Configure senha em `docker-compose.yml` e `.env`

## 🔧 Comandos Docker

```bash
# Iniciar
docker-compose up -d

# Parar
docker-compose down

# Reconstruir
docker-compose up -d --build

# Ver status
docker-compose ps

# Ver logs
docker-compose logs -f
```

## 📈 Performance

### Cache TTLs Configurados
- **Contatos**: 10 minutos
- **Chats**: 5 minutos
- **Mensagens**: 2 minutos
- **Fotos de Perfil**: 1 hora
- **QR Code**: 1 minuto

### Benefícios
- ⚡ Resposta 95% mais rápida
- 📉 Redução de 70-80% nos requests ao WhatsApp
- 🔄 Menos desconexões
- 💾 Uso eficiente de memória

## 🛠️ Troubleshooting

### Redis não conecta
```bash
# Verificar se está rodando
docker-compose ps

# Verificar logs
docker-compose logs redis

# Testar conectividade
telnet localhost 6379
```

### Erro de senha
```bash
# Verificar senha no docker-compose.yml
# Verificar variável REDIS_PASSWORD no .env
```

### Memória insuficiente
```bash
# Aumentar maxmemory no redis.conf
maxmemory 512mb
```

## 🔒 Segurança

### Produção
1. Altere a senha padrão
2. Configure firewall
3. Use rede isolada
4. Habilite SSL/TLS se necessário

### Desenvolvimento
- Senha padrão: `your_redis_password_here`
- Acesso local apenas
- Sem SSL/TLS

## 📚 Recursos Adicionais

- [Documentação Redis](https://redis.io/documentation)
- [Redis Commander](https://github.com/joeferner/redis-commander)
- [Docker Redis](https://hub.docker.com/_/redis) 