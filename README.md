<div align="center">

# whatsAPI

**API REST e painel web para operar várias contas de WhatsApp: conversas, agenda, modelos e transmissão com relatório de entrega.**

[![Release](https://img.shields.io/github/v/release/kaicmurilo/whatsAPI?color=25D366&label=release)](https://github.com/kaicmurilo/whatsAPI/releases)
[![Node](https://img.shields.io/badge/node-22-339933?logo=node.js&logoColor=white)](Dockerfile)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)](docker-compose.local.yml)
[![whatsapp-web.js](https://img.shields.io/badge/whatsapp--web.js-1.34.7-128C7E)](https://github.com/pedroslopez/whatsapp-web.js)
[![License: MIT](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE.md)

[Início rápido](#-início-rápido) · [Painel](#-painel-web) · [Transmissão](#-transmissão) · [API REST](#-api-rest) · [Documentação](#-documentação)

</div>

---

> [!WARNING]
> O WhatsApp não permite clientes não oficiais. Este projeto reduz o risco de bloqueio, mas **não o elimina**. O que mais pesa é quem recebe: contatos que não pediram a mensagem denunciam e bloqueiam.

## ✨ Destaques

| | |
|---|---|
| 📱 **Várias contas** | Cada número é uma sessão com QR próprio. Sessões voltam sozinhas depois de um reinício, sem pedir QR de novo. |
| 💬 **Conversas** | Histórico salvo no Postgres, busca e envio de texto e anexos em tempo real (SSE). |
| 📣 **Transmissão** | Listas de até 5.000 contatos, importação de `.xlsx`, várias listas e instâncias ao mesmo tempo, envio agora ou programado. |
| ✈️ **Telegram** | A mesma lista sai pelo WhatsApp **ou** pelo Telegram: bots (Bot API, para quem abriu o bot) e contas de usuário (envio pelo telefone), como instâncias. |
| ⚖️ **Carga equilibrada** | Cada contato sai pela instância com **menos envios no dia**. Uma fila única manda uma mensagem por vez no processo inteiro. |
| 🛡️ **Proteção de número** | Intervalo sorteado, ordem embaralhada, teto diário, janela de horário, supressão e pausa automática ao sinal de bloqueio. |
| 📊 **Relatórios** | Enviado, entregue, lido e reproduzido por contato, exportação CSV e painel com taxas por período e por instância. |
| 🔌 **API REST + webhooks** | 90+ endpoints no estilo do whatsapp-web.js, com Swagger em inglês e português. |

## 🚀 Início rápido

Requer Docker. Sobe Postgres, Redis e a API com o painel:

```bash
git clone https://github.com/kaicmurilo/whatsAPI.git
cd whatsAPI
cp env.example .env              # preencha os segredos (nunca commite o .env)
npm run local:up                 # sobe tudo
```

Abra **http://localhost:47321/app** e entre com o `user_id` + `user_secret` de um usuário criado em `POST /auth/users`.

| Comando | O que faz |
|---|---|
| `npm run local:up` | Sobe ou atualiza a stack (rebuild da imagem) |
| `npm run local:logs` | Logs da API |
| `npm run local:down` | Para tudo, mantendo dados e o login do WhatsApp |

As portas são altas para não conflitar com outros projetos: painel/API em **47321** e Postgres em **47322** (sobrescreva com `WHATSAPI_LOCAL_PORT` / `WHATSAPI_LOCAL_DB_PORT`). Os containers não sobem sozinhos com o Docker; use `local:up`.

<details>
<summary><b>Rodar sem Docker</b></summary>

```bash
npm install
cp .env.example .env
npm run postgres:start && npm run redis:start && npm run db:init
npm run start                    # API em http://localhost:3000
```

Front em desenvolvimento: `npm run dev:web` (Vite em `http://localhost:47320/app`, com proxy para a API em 47321). `npm run build:web` gera `web/dist`; o Dockerfile já faz isso no build.

</details>

## 🖥️ Painel web

Interface React + Vite servida pela própria API em `/app`.

| Tela | O que faz |
|---|---|
| **Painel** | Envios, entregas, leituras e respostas por período e por instância. No topo, a fila de envio ao vivo: contagem até a próxima mensagem, quantas listas estão na fila e quantos contatos faltam |
| **Instâncias** | WhatsApp (QR), **TG bot** (token do @BotFather) e **TG conta** (login por código) com status ao vivo; **Remover instância** desconecta e apaga |
| **Conversas** | Histórico recebido e enviado, busca, envio de texto e anexos |
| **Contatos** | Agenda do painel; o nome aparece nas conversas. **Sincronizar com WhatsApp** salva os contatos (todos ou marcados na tabela) na conta de uma ou mais instâncias, e opcionalmente na agenda do celular |
| **Mensagens** | Modelos com texto, variações ilimitadas e até 10 anexos em ordem; áudio como mensagem de voz |
| **Arquivos** | Biblioteca reutilizável (até 50 MB); vídeo e imagem com preview |
| **Transmissão** | Listas, importação de planilha, disparo por WhatsApp ou Telegram, histórico com pausar, retomar, abortar, reprocessar e **Retomar todas** |
| **Fila** | Contatos que ainda vão receber, de todos os disparos abertos; **Remover da fila** vale na hora, mesmo com o disparo rodando |
| **Relatório** | Tiques por contato, **Atualizar tiques** e exportação CSV para Excel |
| **Configurações** | Supressão, parar quem respondeu, primeiro nome no texto, teto diário e horário de envio |

## 📣 Transmissão

O WhatsApp Web não cria listas de transmissão nativas, então **cada contato recebe uma mensagem individual**.

**Como o envio anda**

1. Os contatos saem **um por vez**, em **ordem aleatória**, com um intervalo **sorteado** na faixa escolhida (padrão 20–45 s, limites 3–600 s).
2. Cada contato sai pela instância marcada com **menos envios no dia**. Se houver empate, sai a que enviou há mais tempo. A contagem soma todos os disparos da conta.
3. Antes de enviar, o contato é **salvo no WhatsApp** da instância que vai mandar (nome da lista). Se salvar falhar, o envio segue.
4. Uma **fila única** atende o processo inteiro: com várias listas e várias instâncias, nunca saem duas mensagens juntas. Depois de cada envio, o próximo espera o intervalo de quem acabou de enviar.
5. Instância desconectada pode ficar marcada: ela só entra quando volta. Se nenhuma marcada estiver conectada, o disparo pausa.

**Status e ações no histórico**

| Status | Ações | O que acontece |
|---|---|---|
| **Programado** | Cancelar programação · Editar intervalo · Editar instâncias | Espera o horário e só começa com todas as marcadas conectadas |
| **Enviando** | Pausar · Abortar · Editar intervalo · Editar instâncias | Para antes do próximo contato; um envio em curso termina |
| **Pausado** | Retomar (N) · Cancelar · Editar | Mostra o motivo da pausa |
| **Interrompido** | Retomar (N) · Cancelar · Editar | O servidor reiniciou no meio do envio |
| **Falhou / Cancelado / Concluído com falhas** | Reprocessar (N) · Editar | — |

- **Retomar todas** reabre de uma vez os interrompidos e os pausados à mão (pelo usuário, por instância caída ou por falhas seguidas). Pausa por horário ou teto diário continua retomando sozinha.
- **Retomar** e **Reprocessar** enviam só para quem **não recebeu**. Quem já recebeu nunca recebe de novo (garantido no banco).
- **Pausa automática**: a instância desconecta, ou dá **3 falhas seguidas** ("Número sem WhatsApp" não conta).
- **Excluir lista** apaga a lista, os contatos e o histórico dela. Se algum disparo estiver enviando, ele para antes do próximo contato.
- **Programar**: de 1 min a 90 dias à frente. O agendador roda na API a cada 30 s e nunca dispara duas vezes. **Só dispara com a API no ar.**

<details>
<summary><b>Modelos de mensagem</b></summary>

- Nome, texto opcional, quantas variações quiser e até 10 anexos da biblioteca, enviados na ordem.
- Cada contato recebe uma versão em rodízio pela posição na lista: texto principal, variação 1, variação 2… Um retry manda a mesma versão para o mesmo contato.
- O texto vai como **legenda do primeiro vídeo, imagem ou documento**. Áudio não aceita legenda: modelo só com áudios envia o texto antes.
- Entre as partes de um contato há uma pausa curta (1,5–4 s); abortar nunca corta um contato no meio.
- O disparo guarda uma cópia das partes: editar o modelo depois não muda o histórico.

</details>

<details>
<summary><b>Importar lista de planilha (.xlsx)</b></summary>

O nome do arquivo vira o nome da lista (`INTERIOR.xlsx` → **INTERIOR**). Formatos aceitos:

- **Lista simples**: colunas de nome e telefone detectadas pelo conteúdo, com ou sem cabeçalho. Telefone nacional recebe o **55**; `/` ou vírgula na célula geram dois contatos.
- **Exportação de contatos** (`country_code`, `phone_number`, `saved_name`, `public_name`): nome salvo, ou nome público, ou **Sem nome**.
- **Exportação de pacientes** (`Nome Completo` + `Celulares` ou `Telefones`): celular e fixo entram os dois.

Números repetidos entram uma vez; contato que já está na agenda é reaproveitado (inclusive com ou sem o 9º dígito). A planilha é lida no navegador e o servidor valida tudo numa transação.

</details>

<details>
<summary><b>Relatório: entregue, lido e reproduzido</b></summary>

- Os tiques são casados pela chave estável da mensagem (o WhatsApp alterna entre id por telefone e por LID).
- Tiques que chegam com a instância desligada são recuperados ao reconectar (disparos dos últimos 7 dias) ou em **Atualizar tiques**.
- "Lido" só aparece para quem mantém a confirmação de leitura ligada; "reproduzido" vem principalmente de áudio de voz.

</details>

**Telegram.** Em "Enviar por", escolha WhatsApp ou Telegram (um canal por disparo). Um **bot** só fala com quem o abriu e compartilhou o telefone (link `t.me/<bot>`). Uma **conta** envia pelo número, mas o Telegram limita buscas de desconhecidos: quando isso acontece, a conta descansa e o disparo retoma sozinho. Por contato, quem abriu um bot marcado recebe pelo bot. Envio em massa por conta vai contra os termos do Telegram.

Regras completas em [docs/BROADCAST_SEND.md](docs/BROADCAST_SEND.md).

## 🔌 API REST

A API pública segue a [whatsapp-web.js](https://docs.wwebjs.dev/): sessões, mensagens (texto, mídia, contato, localização), grupos, perfil e status.

```bash
# Inicia a sessão e pega o QR em PNG
curl -H "x-api-key: $API_KEY" http://localhost:3000/session/start/DEMO
curl -H "x-api-key: $API_KEY" http://localhost:3000/session/qr/DEMO/image -o qr.png

# Envia uma mensagem
curl -X POST http://localhost:3000/client/sendMessage/DEMO \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{ "chatId": "5511999999999@c.us", "contentType": "string", "content": "Olá!" }'
```

- **Swagger**: `http://localhost:3000/api-docs` (desligue com `ENABLE_SWAGGER_ENDPOINT=false`), em [inglês](swagger.json) e [português](swagger-pt.json).
- **Autenticação**: chave global `x-api-key` e JWT por cliente, com escopo e dono da sessão ([docs/AUTH_SYSTEM.md](docs/AUTH_SYSTEM.md)).
- **Webhooks**: eventos (`qr`, `ready`, `message`, `message_ack`, `status`, `media`) vão para `BASE_WEBHOOK_URL`. Para trocar o destino de uma sessão, use `<SESSIONID>_WEBHOOK_URL`; `DISABLED_CALLBACKS` desliga eventos ([docs/WEBHOOKS.md](docs/WEBHOOKS.md)).
- **Cache Redis** para contatos, chats e fotos ([docs/CACHE_SYSTEM.md](docs/CACHE_SYSTEM.md)).

## ⚙️ Configuração

Todas as variáveis estão em [`env.example`](env.example). As principais:

| Variável | Padrão | Descrição |
|---|---|---|
| `API_KEY` | — | Protege os endpoints REST (obrigatória em produção) |
| `JWT_SECRET` | — | Assina os tokens do painel e dos clientes |
| `BASE_WEBHOOK_URL` | — | Destino dos webhooks |
| `REPORT_TIMEZONE` | `America/Sao_Paulo` | Fuso do dia no painel, no teto diário e no CSV |
| `PANEL_MAX_FILE_SIZE` | `50000000` | Limite de upload da biblioteca, em bytes |
| `RECOVER_SESSIONS` | `false` | Reabre o navegador se a página do WhatsApp fechar |
| `ENABLE_SWAGGER_ENDPOINT` | `true` | Publica `/api-docs` (desligue em produção se não usar) |

## 🔧 Estabilidade das sessões

- **Reinício sem QR**: o desligamento fecha os navegadores com calma (o puppeteer não mata mais o Chrome no SIGTERM) e as travas órfãs do Chromium são limpas ao abrir.
- **Nova tentativa ao abrir**: sessão que falha tenta de novo com espera crescente (10 s até 10 min, 8 tentativas, ~25 min no total).
- **Presa em "autenticando"**: a causa era um bug do whatsapp-web.js (a troca de alvo da página logo depois de autenticar matava a inicialização em silêncio), corrigido no patch da lib. Como rede de proteção, se o `ready` não chegar em 3 min, o navegador é fechado e reaberto, e o pareamento é mantido.
- **Navegador que morre sozinho** (falta de memória, crash) é detectado e reaberto; antes a sessão ficava presa e o Iniciar dava 422.
- **`ready` falso depois de LOGOUT** é ignorado: o painel não marca como conectada uma conta que voltou para o QR.
- **Motivo da queda no log**: `[session] desconectada sessão=… motivo=LOGOUT` (aparelho desvinculado) ou `CONFLICT` (aberta em outro lugar).
- **Erros internos não derrubam a API**: falhas assíncronas do puppeteer são logadas com `[process]`.
- `patches/whatsapp-web.js+1.34.7.patch` corrige o envio de mídia ([PR upstream #201923](https://github.com/wwebjs/whatsapp-web.js/pull/201923)) e a sessão presa em "autenticando" depois da troca de alvo da página ([docs/SESSIONS.md](docs/SESSIONS.md)); remova quando sair versão oficial com as correções.

Detalhes em [docs/SESSIONS.md](docs/SESSIONS.md).

## 🧪 Testes

```bash
npm test
```

Os testes de integração do painel rodam contra um **Postgres real e descartável**:

```bash
docker run --rm -d --name wa-it-pg -p 55432:5432 -e POSTGRES_DB=whatsapp_auth -e POSTGRES_USER=whatsapp_user \
  -e POSTGRES_PASSWORD=x -v "$PWD/docker-postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro" postgres:16-alpine
PANEL_DB_TEST=1 POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=55432 POSTGRES_PASSWORD=x JWT_SECRET=x \
  npx jest --testPathIgnorePatterns api.test
docker rm -f wa-it-pg
```

`tests/api.test.js` abre sessões reais do WhatsApp e fica fora dessa execução. Nunca teste rotas de envio contra listas reais: use uma lista só com um número impossível (ex.: `551100000000`).

## 📚 Documentação

| Tema | Documento |
|---|---|
| Rotas internas do painel (`/panel`) | [PANEL_API.md](docs/PANEL_API.md) |
| Regras de disparo e fila de envio | [BROADCAST_SEND.md](docs/BROADCAST_SEND.md) |
| Métricas do painel | [DASHBOARD.md](docs/DASHBOARD.md) |
| Sessões e recuperação | [SESSIONS.md](docs/SESSIONS.md) |
| Autenticação e clientes | [AUTH_SYSTEM.md](docs/AUTH_SYSTEM.md) · [ADMIN_API.md](docs/ADMIN_API.md) |
| Webhooks | [WEBHOOKS.md](docs/WEBHOOKS.md) |
| Cache | [CACHE_SYSTEM.md](docs/CACHE_SYSTEM.md) |
| Arquitetura e código | [ARCHITECTURE.md](docs/ARCHITECTURE.md) · [CODE_STRUCTURE.md](docs/CODE_STRUCTURE.md) |
| Diagnóstico de QR | [QR_TROUBLESHOOTING.md](docs/QR_TROUBLESHOOTING.md) |

O histórico de versões está em [Releases](https://github.com/kaicmurilo/whatsAPI/releases).

## 🏭 Produção

- `docker-compose.yml` da raiz é o deploy de produção (Swarm + Traefik); o local é `docker-compose.local.yml`.
- Defina `API_KEY` e `JWT_SECRET` fortes e desligue `ENABLE_LOCAL_CALLBACK_EXAMPLE`.
- Sem controle das sessões, chame `GET /session/terminateInactive` periodicamente para liberar recursos.

---

<sub>Baseado em [pedroherpeto/whatsapp-api](https://github.com/pedroherpeto/whatsapp-api). Não é afiliado, autorizado nem endossado pelo WhatsApp; "WhatsApp" e marcas relacionadas pertencem aos respectivos donos. Licença [MIT](LICENSE.md).</sub>
