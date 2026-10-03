const { query } = require('../database')

const ensureMessagesTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id BIGSERIAL PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL REFERENCES whatsapp_sessions(session_id) ON DELETE CASCADE,
      message_id VARCHAR(255) NOT NULL,
      chat_id VARCHAR(255) NOT NULL,
      chat_name VARCHAR(255),
      from_me BOOLEAN NOT NULL,
      author VARCHAR(255),
      sender_name VARCHAR(255),
      type VARCHAR(50) NOT NULL,
      body TEXT,
      has_media BOOLEAN NOT NULL DEFAULT false,
      media_mimetype VARCHAR(255),
      media_filename VARCHAR(500),
      sent_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (session_id, message_id)
    )
  `)
  await query('DROP INDEX IF EXISTS idx_whatsapp_messages_chat')
  await query('CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_sent ON whatsapp_messages(session_id, chat_id, sent_at DESC, id DESC)')
  await query('CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session_sent ON whatsapp_messages(session_id, sent_at DESC)')
}

// Agenda interna: por usuário do painel, não sincroniza com o WhatsApp
const ensureContactsTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS panel_contacts (
      id BIGSERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(15) NOT NULL,
      phone_alt VARCHAR(15),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, phone)
    )
  `)
  await query('CREATE INDEX IF NOT EXISTS idx_panel_contacts_user_phone_alt ON panel_contacts(user_id, phone_alt)')
}

// Biblioteca de arquivos reutilizáveis; bytes ficam em disco (storage_key = UUID)
const ensureFilesTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS panel_files (
      id BIGSERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      original_name VARCHAR(255) NOT NULL,
      mimetype VARCHAR(255) NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_key UUID NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('CREATE INDEX IF NOT EXISTS idx_panel_files_user ON panel_files(user_id, created_at DESC)')
}

const ensureBroadcastTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS broadcast_lists (
      id BIGSERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, name)
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS broadcast_list_members (
      list_id BIGINT NOT NULL REFERENCES broadcast_lists(id) ON DELETE CASCADE,
      contact_id BIGINT NOT NULL REFERENCES panel_contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (list_id, contact_id)
    )
  `)
  // Disparo guarda cópia de nome/telefone por destinatário: histórico não muda se a agenda mudar
  await query(`
    CREATE TABLE IF NOT EXISTS broadcast_runs (
      id BIGSERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      session_id VARCHAR(255) NOT NULL,
      list_id BIGINT REFERENCES broadcast_lists(id) ON DELETE SET NULL,
      list_name VARCHAR(100) NOT NULL,
      text TEXT,
      file_id BIGINT REFERENCES panel_files(id) ON DELETE SET NULL,
      file_name VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'running',
      total INTEGER NOT NULL,
      sent INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMPTZ
    )
  `)
  // Motivo da falha do disparo como um todo (tabela já existente em quem instalou antes)
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS error VARCHAR(255)')
  // Ritmo do disparo (intervalo aleatório + ordem embaralhada); reprocessar reutiliza o mesmo
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS delay_min_seconds INTEGER NOT NULL DEFAULT 5')
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS delay_max_seconds INTEGER NOT NULL DEFAULT 10')
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS random_order BOOLEAN NOT NULL DEFAULT false')
  await query('CREATE INDEX IF NOT EXISTS idx_broadcast_runs_user ON broadcast_runs(user_id, created_at DESC)')
  await query(`
    CREATE TABLE IF NOT EXISTS broadcast_run_recipients (
      run_id BIGINT NOT NULL REFERENCES broadcast_runs(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(15) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      error VARCHAR(255),
      sent_at TIMESTAMPTZ,
      PRIMARY KEY (run_id, position)
    )
  `)
  // Rastreio de entrega (tiques do WhatsApp) — colunas adicionadas depois, por isso ALTER idempotente
  for (const column of [
    'message_id VARCHAR(255)',
    'delivered_at TIMESTAMPTZ',
    'read_at TIMESTAMPTZ',
    'played_at TIMESTAMPTZ'
  ]) {
    await query(`ALTER TABLE broadcast_run_recipients ADD COLUMN IF NOT EXISTS ${column}`)
  }
  await query('CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_message ON broadcast_run_recipients(message_id) WHERE message_id IS NOT NULL')
  // Chave estável da mensagem (igual com remote LID ou telefone): é por ela que os tiques casam
  await query('ALTER TABLE broadcast_run_recipients ADD COLUMN IF NOT EXISTS message_key VARCHAR(64)')
  await query("UPDATE broadcast_run_recipients SET message_key = NULLIF(split_part(message_id, '_', 3), '') WHERE message_key IS NULL AND message_id IS NOT NULL")
  await query('CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_key ON broadcast_run_recipients(message_key) WHERE message_key IS NOT NULL')
  // Vínculo tardio do ack: destinatários enviados ainda sem id, por telefone
  await query("CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_unlinked ON broadcast_run_recipients(phone, sent_at DESC) WHERE message_id IS NULL AND status = 'sent'")
  // Instâncias do rodízio. session_id continua sendo a primeira (relatório e eventos).
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS session_ids TEXT[]')
  await query(`UPDATE broadcast_runs SET session_ids = ARRAY[session_id] WHERE session_ids IS NULL OR session_ids = '{}'`)
  await query(`ALTER TABLE broadcast_runs ALTER COLUMN session_ids SET DEFAULT ARRAY[]::TEXT[]`)
  await query('ALTER TABLE broadcast_runs ALTER COLUMN session_ids SET NOT NULL')
  // Saudação a frios: espera resposta (ou 24h) antes da campanha
  await query('ALTER TABLE broadcast_run_recipients ADD COLUMN IF NOT EXISTS greeting_sent_at TIMESTAMPTZ')
  await query('ALTER TABLE broadcast_run_recipients ADD COLUMN IF NOT EXISTS greeting_session_id VARCHAR(255)')
  await query(`CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_awaiting
    ON broadcast_run_recipients(greeting_sent_at) WHERE status = 'awaiting_reply'`)
}

// Modelos de mensagem: texto + anexos da biblioteca, reutilizados na transmissão.
// Arquivo em uso não pode ser apagado — evita modelo quebrado em silêncio. A checagem é adiada para o fim da
// transação: excluir o usuário apaga arquivos e modelos em cascata, e RESTRICT barraria antes do modelo sair.
const ensureTemplateTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS message_templates (
      id BIGSERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      text TEXT,
      audio_as_voice BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, name)
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS message_template_files (
      template_id BIGINT NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      file_id BIGINT NOT NULL REFERENCES panel_files(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
      PRIMARY KEY (template_id, position)
    )
  `)
  // Bancos criados antes (RESTRICT): troca uma vez
  await query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_template_files_file_id_fkey' AND NOT condeferrable) THEN
        ALTER TABLE message_template_files DROP CONSTRAINT message_template_files_file_id_fkey,
          ADD CONSTRAINT message_template_files_file_id_fkey FOREIGN KEY (file_id) REFERENCES panel_files(id)
          ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
      END IF;
    END $$
  `)
  await query('CREATE INDEX IF NOT EXISTS idx_template_files_file ON message_template_files(file_id)')
  // Versões alternativas do texto. No disparo, cada contato recebe uma (texto principal + estas), em rodízio.
  await query(`ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS text_variations JSONB NOT NULL DEFAULT '[]'::jsonb`)
  // Disparo guarda cópia das partes: editar/excluir o modelo depois não muda histórico nem reprocessamento
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS template_id BIGINT REFERENCES message_templates(id) ON DELETE SET NULL')
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS template_name VARCHAR(100)')
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS parts JSONB')
  // Envio programado (status 'scheduled' até o horário; lista e mensagem são lidas no momento do envio)
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ')
  await query("CREATE INDEX IF NOT EXISTS idx_broadcast_runs_scheduled ON broadcast_runs(scheduled_at) WHERE status = 'scheduled'")
  // Pausa automática (horário / teto) é retomada pelo agendador; pausa do usuário não
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS pause_code VARCHAR(20)')
  await query("CREATE INDEX IF NOT EXISTS idx_broadcast_runs_policy_pause ON broadcast_runs(pause_code) WHERE status = 'paused'")
  // Qual instância enviou: o teto diário é por número, não por disparo
  await query('ALTER TABLE broadcast_run_recipients ADD COLUMN IF NOT EXISTS sender_session_id VARCHAR(255)')
  await query(`CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_sender_day
    ON broadcast_run_recipients(sender_session_id, sent_at) WHERE status = 'sent'`)
}

// Configuração do painel por usuário e números que pediram para não receber
const ensureSettingsTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS panel_user_settings (
      user_id VARCHAR(255) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
      suppression_enabled BOOLEAN NOT NULL DEFAULT true,
      suppression_keywords TEXT[] NOT NULL DEFAULT ARRAY['SAIR', 'PARAR', 'REMOVER', 'STOP'],
      stop_on_reply BOOLEAN NOT NULL DEFAULT false,
      prepend_first_name BOOLEAN NOT NULL DEFAULT false,
      daily_cap_enabled BOOLEAN NOT NULL DEFAULT false,
      daily_cap INTEGER NOT NULL DEFAULT 80,
      quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
      quiet_start VARCHAR(5) NOT NULL DEFAULT '08:00',
      quiet_end VARCHAR(5) NOT NULL DEFAULT '20:00',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS suppressed_numbers (
      id BIGSERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      phone VARCHAR(15) NOT NULL,
      phone_alt VARCHAR(15),
      keyword VARCHAR(32) NOT NULL,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, phone)
    )
  `)
  await query('CREATE INDEX IF NOT EXISTS idx_suppressed_numbers_alt ON suppressed_numbers(user_id, phone_alt)')
}

// Telegram (Bot API): cada bot é uma instância (id = número antes do ":" no token, o mesmo do getMe).
// Chat privado tem o id do usuário, igual em todos os bots — mas um bot só fala com quem deu /start nele (telegram_bot_contacts).
const ensureTelegramTables = async () => {
  await query('ALTER TABLE panel_contacts ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT')
  await query("ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp'")
  await query(`
    CREATE TABLE IF NOT EXISTS telegram_bots (
      id BIGINT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      username VARCHAR(64) NOT NULL,
      token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('CREATE INDEX IF NOT EXISTS idx_telegram_bots_user ON telegram_bots(user_id)')
  await query(`
    CREATE TABLE IF NOT EXISTS telegram_bot_contacts (
      bot_id BIGINT NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
      contact_id BIGINT NOT NULL REFERENCES panel_contacts(id) ON DELETE CASCADE,
      PRIMARY KEY (bot_id, contact_id)
    )
  `)
  // Conta de usuário do Telegram (MTProto): envia por telefone. session = StringSession — acesso total à conta, nunca sai do servidor
  await query(`
    CREATE TABLE IF NOT EXISTS telegram_accounts (
      id BIGINT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      phone VARCHAR(20) NOT NULL,
      label VARCHAR(100) NOT NULL,
      api_id INTEGER NOT NULL,
      api_hash VARCHAR(64) NOT NULL,
      session TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query('CREATE INDEX IF NOT EXISTS idx_telegram_accounts_user ON telegram_accounts(user_id)')
  // Limite do Telegram (busca por telefone, PEER_FLOOD, FLOOD_WAIT) vale para a conta inteira: ela descansa até aqui
  await query('ALTER TABLE telegram_accounts ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ')
  // Primeira versão guardava um bot só por usuário nas configurações: migra uma vez e tira as colunas
  await query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'panel_user_settings' AND column_name = 'telegram_bot_token') THEN
        INSERT INTO telegram_bots (id, user_id, username, token)
          SELECT split_part(telegram_bot_token, ':', 1)::bigint, user_id, COALESCE(telegram_bot_username, 'bot'), telegram_bot_token
          FROM panel_user_settings WHERE telegram_bot_token IS NOT NULL
          ON CONFLICT (id) DO NOTHING;
        INSERT INTO telegram_bot_contacts (bot_id, contact_id)
          SELECT b.id, c.id FROM panel_contacts c JOIN telegram_bots b ON b.user_id = c.user_id
          WHERE c.telegram_chat_id IS NOT NULL
          ON CONFLICT DO NOTHING;
        ALTER TABLE panel_user_settings DROP COLUMN telegram_bot_token, DROP COLUMN IF EXISTS telegram_bot_username;
      END IF;
    END $$
  `)
}

// Idempotente: roda a cada boot porque o init.sql só executa em volume novo do Postgres
const ensurePanelSchema = async () => {
  await ensureMessagesTable()
  await ensureContactsTable()
  await ensureFilesTable()
  await ensureBroadcastTables()
  await ensureTemplateTables()
  await ensureSettingsTables()
  await ensureTelegramTables()
}

module.exports = { ensurePanelSchema }
