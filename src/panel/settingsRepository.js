const { query } = require('../database')

const SETTINGS_COLUMNS = `suppression_enabled AS "suppressionEnabled",
  suppression_keywords AS "suppressionKeywords",
  stop_on_reply AS "stopOnReply",
  prepend_first_name AS "prependFirstName",
  daily_cap_enabled AS "dailyCapEnabled",
  daily_cap AS "dailyCap",
  quiet_hours_enabled AS "quietHoursEnabled",
  quiet_start AS "quietStart",
  quiet_end AS "quietEnd"`

// Cria a linha padrão na primeira leitura (supressão ligada, o resto desligado)
const getSettings = async (userId) => {
  await query(
    'INSERT INTO panel_user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
    [userId]
  )
  const result = await query(`SELECT ${SETTINGS_COLUMNS} FROM panel_user_settings WHERE user_id = $1`, [userId])
  return result.rows[0]
}

const saveSettings = async (userId, settings) => {
  const result = await query(
    `INSERT INTO panel_user_settings (
       user_id, suppression_enabled, suppression_keywords, stop_on_reply, prepend_first_name,
       daily_cap_enabled, daily_cap, quiet_hours_enabled, quiet_start, quiet_end, updated_at
     ) VALUES ($1, $2, $3::text[], $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       suppression_enabled = EXCLUDED.suppression_enabled,
       suppression_keywords = EXCLUDED.suppression_keywords,
       stop_on_reply = EXCLUDED.stop_on_reply,
       prepend_first_name = EXCLUDED.prepend_first_name,
       daily_cap_enabled = EXCLUDED.daily_cap_enabled,
       daily_cap = EXCLUDED.daily_cap,
       quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
       quiet_start = EXCLUDED.quiet_start,
       quiet_end = EXCLUDED.quiet_end,
       updated_at = CURRENT_TIMESTAMP
     RETURNING ${SETTINGS_COLUMNS}`,
    [userId, settings.suppressionEnabled, settings.suppressionKeywords, settings.stopOnReply,
      settings.prependFirstName, settings.dailyCapEnabled, settings.dailyCap,
      settings.quietHoursEnabled, settings.quietStart, settings.quietEnd]
  )
  return result.rows[0]
}

module.exports = { getSettings, saveSettings }
