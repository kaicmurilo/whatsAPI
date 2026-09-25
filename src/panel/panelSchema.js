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
}

// Modelos de mensagem: texto + anexos da biblioteca, reutilizados na transmissão.
// Arquivo em uso não pode ser apagado (RESTRICT) — evita modelo quebrado em silêncio.
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
      file_id BIGINT NOT NULL REFERENCES panel_files(id) ON DELETE RESTRICT,
      PRIMARY KEY (template_id, position)
    )
  `)
  await query('CREATE INDEX IF NOT EXISTS idx_template_files_file ON message_template_files(file_id)')
  // Disparo guarda cópia das partes: editar/excluir o modelo depois não muda histórico nem reprocessamento
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS template_id BIGINT REFERENCES message_templates(id) ON DELETE SET NULL')
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS template_name VARCHAR(100)')
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS parts JSONB')
  // Envio programado (status 'scheduled' até o horário; lista e mensagem são lidas no momento do envio)
  await query('ALTER TABLE broadcast_runs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ')
  await query("CREATE INDEX IF NOT EXISTS idx_broadcast_runs_scheduled ON broadcast_runs(scheduled_at) WHERE status = 'scheduled'")
}

// Idempotente: roda a cada boot porque o init.sql só executa em volume novo do Postgres
const ensurePanelSchema = async () => {
  await ensureMessagesTable()
  await ensureContactsTable()
  await ensureFilesTable()
  await ensureBroadcastTables()
  await ensureTemplateTables()
}

module.exports = { ensurePanelSchema }
