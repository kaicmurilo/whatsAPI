#!/bin/bash

# Script para iniciar Redis para desenvolvimento local
# Uso: ./start-redis.sh

set -e

echo "🚀 Iniciando Redis para desenvolvimento local..."

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando. Por favor, inicie o Docker primeiro."
    exit 1
fi

# Verificar se os arquivos necessários existem
if [ ! -f "Dockerfile" ] || [ ! -f "redis.conf" ] || [ ! -f "docker-compose.yml" ]; then
    echo "❌ Arquivos necessários não encontrados. Certifique-se de estar no diretório correto."
    exit 1
fi

# Parar containers existentes se estiverem rodando
echo "🛑 Parando containers existentes..."
docker-compose down 2>/dev/null || true

# Construir e iniciar containers
echo "🔨 Construindo e iniciando containers..."
docker-compose up -d --build

# Aguardar Redis estar pronto
echo "⏳ Aguardando Redis estar pronto..."
for i in {1..30}; do
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis está pronto!"
        break
    fi
    echo "   Aguardando... ($i/30)"
    sleep 2
done

# Verificar status
echo "📊 Status dos containers:"
docker-compose ps

echo ""
echo "🎉 Redis iniciado com sucesso!"
echo ""
echo "📋 Informações:"
echo "   Redis: localhost:6379"
echo "   Redis Commander: http://localhost:8081"
echo ""
echo "🔧 Para parar: docker-compose down"
echo "📝 Para ver logs: docker-compose logs -f"
echo ""
echo "⚠️  Lembre-se de configurar as variáveis de ambiente:"
echo "   REDIS_HOST=localhost"
echo "   REDIS_PORT=6379"
echo "   REDIS_PASSWORD=your_redis_password_here" 