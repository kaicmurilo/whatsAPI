# Build do painel web (Vite exige Node 20+; a imagem final só recebe os estáticos)
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# whatsapp-web.js exige Node >= 18
FROM node:22-alpine

# Set the working directory
WORKDIR /usr/src/app

# Install Chromium
ENV CHROME_BIN="/usr/bin/chromium-browser" \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true" \
    NODE_ENV="production"
RUN set -x \
    && apk update \
    && apk upgrade \
    && apk add --no-cache \
    udev \
    ttf-freefont \
    chromium

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the dependencies
RUN npm ci --only=production --ignore-scripts

# Correções em dependências (patches/): aplicadas à mão porque --ignore-scripts pula o postinstall.
# whatsapp-web.js 1.34.7: envio de mídia quebrado no WhatsApp Web atual (upstream PR #201923, ainda não publicado)
COPY patches ./patches
RUN npx patch-package

# Copy the rest of the source code to the working directory
COPY . .
COPY --from=web /web/dist ./web/dist

# Expose the port the API will run on
EXPOSE 3000

# Start the API — node direto (sem npm no meio) para o SIGTERM chegar e os navegadores fecharem limpos
CMD ["node", "server.js"]