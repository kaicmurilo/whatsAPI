# Solução de Problemas - Endpoints de QR Code

Este documento explica como resolver problemas comuns nos endpoints de QR code da API WhatsApp.

## Problemas Identificados

### 1. Erro 403 (Forbidden)

**Sintomas:**
- Resposta HTTP 403 ao acessar `/session/qr/{sessionId}/image`
- Mensagem "Forbidden" no Swagger UI

**Causas Possíveis:**
- API Key não configurada ou incorreta
- Autenticação desabilitada mas middleware ainda ativo
- Cliente inativo no banco de dados
- Sessão não pertence ao cliente autenticado

**Soluções:**

#### A. Configurar API Key
```bash
# No arquivo .env
API_KEY=sua_api_key_aqui
```

#### B. Desabilitar Autenticação (apenas para desenvolvimento)
```bash
# No arquivo .env
ENABLE_AUTH=false
```

#### C. Verificar Cliente no Banco
```sql
SELECT * FROM clients WHERE client_id = 'seu_client_id';
```

### 2. Erro de Content Security Policy (CSP)

**Sintomas:**
- Erro no console do navegador: "Refused to load the image because it violates the following Content Security Policy directive"
- Imagem QR não carrega no Swagger UI

**Causa:**
- Política de segurança bloqueia blob URLs

**Solução:**
A política CSP já foi atualizada para permitir blob URLs. Se o problema persistir, verifique se o servidor foi reiniciado.

### 3. QR Code Não Disponível

**Sintomas:**
- Resposta: `{"success": false, "message": "qr code not ready or already scanned"}`
- QR code não aparece mesmo após iniciar a sessão

**Causas:**
- Sessão ainda não gerou QR code
- QR code já foi escaneado
- Sessão expirou

**Soluções:**

#### A. Aguardar Geração do QR
```bash
# Aguarde alguns segundos após iniciar a sessão
curl -X POST "http://localhost:3000/session/start/test-session" \
  -H "x-api-key: sua_api_key"
```

#### B. Verificar Status da Sessão
```bash
curl -X GET "http://localhost:3000/session/status/test-session" \
  -H "x-api-key: sua_api_key"
```

## Scripts de Teste

### Teste de CSP e Autenticação
```bash
npm run test:qr-csp
```

### Teste de Logs de QR
```bash
npm run test:qr-logs
```

## Endpoints de Teste

### QR Code Sem Autenticação
```
GET /test-qr
```
Retorna um QR code de teste sem necessidade de autenticação.

### QR Code Com Autenticação
```
GET /test-qr-auth
```
Retorna um QR code de teste com autenticação para debug.

## Logs Detalhados

Os endpoints de QR agora incluem logs detalhados:

```
📱 Requisição de imagem QR para sessão: test-session
✅ QR code disponível para sessão: test-session
📊 Tamanho do QR code: 1234 caracteres
🖼️ Gerando imagem PNG do QR code para sessão: test-session
📤 Enviando imagem QR para sessão: test-session
```

## Configuração Recomendada para Desenvolvimento

```bash
# .env
API_KEY=test_api_key
ENABLE_AUTH=true
ENABLE_SWAGGER_ENDPOINT=true
```

## Configuração para Produção

```bash
# .env
API_KEY=sua_api_key_segura_aqui
ENABLE_AUTH=true
ENABLE_SWAGGER_ENDPOINT=false
```

## Verificação de Status

Para verificar se tudo está funcionando:

1. **Servidor rodando:**
   ```bash
   curl http://localhost:3000/ping
   ```

2. **QR de teste sem auth:**
   ```bash
   curl http://localhost:3000/test-qr -o test-qr.png
   ```

3. **QR de teste com auth:**
   ```bash
   curl -H "x-api-key: sua_api_key" http://localhost:3000/test-qr-auth -o test-qr-auth.png
   ```

## Suporte

Se os problemas persistirem:

1. Verifique os logs do servidor
2. Execute os scripts de teste
3. Verifique a configuração do banco de dados
4. Confirme se todas as dependências estão instaladas 