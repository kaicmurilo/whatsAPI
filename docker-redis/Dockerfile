FROM redis:7-alpine

# Configurações de segurança
# Usuário redis já existe na imagem base

# Configurações de performance
COPY redis.conf /usr/local/etc/redis/redis.conf

# Criar diretório de dados
RUN mkdir -p /data && chown redis:redis /data

# Expor porta
EXPOSE 6379

# Comando para iniciar Redis
CMD ["redis-server", "/usr/local/etc/redis/redis.conf"] 