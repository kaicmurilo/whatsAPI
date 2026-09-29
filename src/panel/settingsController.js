const { sendErrorResponse } = require('../utils')
const { getSettings, saveSettings } = require('./settingsRepository')
const { parseSettingsInput } = require('./sendPolicy')

const getPanelSettings = async (req, res) => {
  try {
    const settings = await getSettings(req.user.user_id)
    res.json({ success: true, data: settings })
  } catch (error) {
    console.error(`[panel] falha ao ler configuração user=${req.user.user_id}:`, error)
    sendErrorResponse(res, 500, 'Erro ao ler configuração')
  }
}

const updatePanelSettings = async (req, res) => {
  const { settings, error } = parseSettingsInput(req.body)
  if (error) return sendErrorResponse(res, 422, error)
  try {
    const saved = await saveSettings(req.user.user_id, settings)
    console.log(`[panel] configuração atualizada user=${req.user.user_id} supressão=${saved.suppressionEnabled} resposta=${saved.stopOnReply} nome=${saved.prependFirstName} teto=${saved.dailyCapEnabled} horário=${saved.quietHoursEnabled}`)
    res.json({ success: true, data: saved })
  } catch (saveError) {
    console.error(`[panel] falha ao salvar configuração user=${req.user.user_id}:`, saveError)
    sendErrorResponse(res, 500, 'Erro ao salvar configuração')
  }
}

module.exports = { getPanelSettings, updatePanelSettings }
