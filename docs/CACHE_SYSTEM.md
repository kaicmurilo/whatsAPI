# Sistema de Cache (Redis)

A aplicação utiliza Redis para otimizar o tempo de resposta e reduzir a carga de processamento do WhatsApp Web.

## Benefícios
- **Velocidade**: Respostas de contatos e chats em milissegundos.
- **Resiliência**: Menor risco de bloqueio por excesso de requisições.

## Configuração de TTL (Time To Live)

| Tipo de Dado | TTL Padrão | Invalidação Automática |
|--------------|------------|------------------------|
| Contatos     | 10 minutos | Não                    |
| Chats        | 5 minutos  | Sim (Nova mensagem)    |
| Mensagens    | 2 minutos  | Não                    |
| Profile Pics | 1 hora     | Não                    |
| QR Code      | 1 minuto   | Sim (Scaneado/Expira)  |

## Gerenciamento via API

### Status do Cache
Retorna informações de conexão e estatísticas do Redis.
- **Endpoint**: `GET /cache/status`
- **Auth**: Nenhuma

### Limpeza de Cache
Remove todas as chaves do cache globalmente.
- **Endpoint**: `POST /cache/clear`
- **Auth**: Requer `x-api-key` global.

## Invalidação
O sistema implementa invalidação proativa. Quando o webhook de `message` é acionado pelo WhatsApp, o cache de chats daquela sessão é automaticamente limpo para garantir que a lista de chats reflita o estado mais recente.
