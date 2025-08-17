FROM postgres:15-alpine

# Instalar extensões adicionais se necessário
RUN apk add --no-cache \
    postgresql-contrib

# Copiar configurações personalizadas
COPY postgresql.conf /etc/postgresql/postgresql.conf

# Expor porta
EXPOSE 5432

# Comando padrão
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"] 