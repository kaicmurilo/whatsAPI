const { query, withTransaction } = require('../database')

const TEMPLATE_COLUMNS = 't.id, t.name, t.text, t.audio_as_voice AS "audioAsVoice", t.updated_at AS "updatedAt"'

const listTemplates = async (userId, { page, perPage, search }) => {
  const result = await query(
    `SELECT ${TEMPLATE_COLUMNS},
            (SELECT COUNT(*) FROM message_template_files f WHERE f.template_id = t.id)::int AS "attachmentCount",
            COUNT(*) OVER() AS total
     FROM message_templates t
     WHERE t.user_id = $1 AND ($2::text IS NULL OR t.name ILIKE $2 OR t.text ILIKE $2)
     ORDER BY t.name, t.id
     LIMIT $3 OFFSET $4`,
    [userId, search ? `%${search}%` : null, perPage, (page - 1) * perPage]
  )
  const total = result.rows.length > 0 ? Number(result.rows[0].total) : 0
  const items = result.rows.map(({ total: _total, ...template }) => template)
  return { items, total, page, perPage }
}

const findTemplate = async (userId, templateId) => {
  const templateResult = await query(`SELECT ${TEMPLATE_COLUMNS} FROM message_templates t WHERE t.user_id = $1 AND t.id = $2`, [userId, templateId])
  const template = templateResult.rows[0]
  if (!template) return null
  const files = await query(
    `SELECT p.id, p.original_name AS name, p.mimetype, p.size_bytes AS "sizeBytes"
     FROM message_template_files f JOIN panel_files p ON p.id = f.file_id
     WHERE f.template_id = $1
     ORDER BY f.position`,
    [templateId]
  )
  return { ...template, files: files.rows }
}

const countOwnedFiles = async (client, userId, fileIds) => {
  const result = await client.query('SELECT COUNT(*)::int AS owned FROM panel_files WHERE user_id = $1 AND id = ANY($2::bigint[])', [userId, fileIds])
  return result.rows[0].owned
}

/**
 * Cria (templateId null) ou substitui um modelo com seus anexos na ordem dada.
 * @returns {{ template?: object, error?: 'not_found' | 'foreign_files' }}
 */
const saveTemplate = (userId, { templateId, name, text, audioAsVoice, fileIds }) => withTransaction(async (client) => {
  if (await countOwnedFiles(client, userId, fileIds) !== fileIds.length) return { error: 'foreign_files' }
  const saved = templateId
    ? await client.query(
      `UPDATE message_templates SET name = $3, text = $4, audio_as_voice = $5, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND id = $2 RETURNING id, name`,
      [userId, templateId, name, text, audioAsVoice]
    )
    : await client.query(
      'INSERT INTO message_templates (user_id, name, text, audio_as_voice) VALUES ($1, $2, $3, $4) RETURNING id, name',
      [userId, name, text, audioAsVoice]
    )
  const template = saved.rows[0]
  if (!template) return { error: 'not_found' }
  await client.query('DELETE FROM message_template_files WHERE template_id = $1', [template.id])
  await client.query(
    `INSERT INTO message_template_files (template_id, position, file_id)
     SELECT $1, ordinality - 1, file_id FROM unnest($2::bigint[]) WITH ORDINALITY AS f(file_id, ordinality)`,
    [template.id, fileIds]
  )
  return { template: { ...template, attachmentCount: fileIds.length } }
})

const deleteTemplate = async (userId, templateId) => {
  const result = await query('DELETE FROM message_templates WHERE user_id = $1 AND id = $2', [userId, templateId])
  return result.rowCount > 0
}

// Para avisar ao excluir um arquivo da biblioteca
const listTemplateNamesUsingFile = async (userId, fileId) => {
  const result = await query(
    `SELECT DISTINCT t.name FROM message_template_files f JOIN message_templates t ON t.id = f.template_id
     WHERE t.user_id = $1 AND f.file_id = $2 ORDER BY t.name`,
    [userId, fileId]
  )
  return result.rows.map((row) => row.name)
}

module.exports = { listTemplates, findTemplate, saveTemplate, deleteTemplate, listTemplateNamesUsingFile }
