const { reportTimeZone } = require('../config')
const { sendErrorResponse } = require('../utils')
const AuthService = require('../auth/authService')
const { PERIODS, listDayKeys, metricWindows } = require('./metricsRanges')
const { REPLY_WINDOW_DAYS, loadSendMetrics, loadOutcomes } = require('./metricsRepository')

const emptySlice = () => ({ sent: 0, delivered: 0, read: 0, replied: 0 })

const emptyPeriods = () => Object.fromEntries(PERIODS.map((period) => [period, emptySlice()]))

const fillInstances = (instances, sessions) => {
  const byId = new Map(instances.filter((instance) => instance.sessionId).map((instance) => [instance.sessionId, instance]))
  for (const session of sessions) {
    if (!byId.has(session.session_id)) {
      byId.set(session.session_id, { sessionId: session.session_id, periods: emptyPeriods() })
    }
  }
  return [...byId.values()].sort((left, right) =>
    right.periods.month.sent - left.periods.month.sent || left.sessionId.localeCompare(right.sessionId))
}

const fillDaily = (daily, now, timeZone) => {
  const byDay = new Map(daily.map((day) => [day.day, day]))
  return listDayKeys(now, timeZone).map((day) => byDay.get(day) ?? { day, sent: 0, delivered: 0, read: 0, replied: 0 })
}

const mergeOutcomes = (periods, outcomes) => {
  for (const period of PERIODS) {
    periods[period].failed = outcomes.failed[period]
    periods[period].suppressed = outcomes.suppressed[period]
    periods[period].optOuts = outcomes.optOuts[period]
    periods[period].campaigns = outcomes.campaigns[period]
  }
}

const getMetrics = async (req, res) => {
  const userId = req.user.user_id
  const now = new Date()
  const windows = metricWindows(now, reportTimeZone)
  try {
    const [sends, outcomes, sessions] = await Promise.all([
      loadSendMetrics(userId, windows, reportTimeZone),
      loadOutcomes(userId, windows),
      AuthService.getUserSessions(userId)
    ])
    mergeOutcomes(sends.periods, outcomes)
    res.json({
      success: true,
      data: {
        timeZone: reportTimeZone,
        replyWindowDays: REPLY_WINDOW_DAYS,
        generatedAt: now.toISOString(),
        periods: sends.periods,
        instances: fillInstances(sends.instances, sessions),
        daily: fillDaily(sends.daily, now, reportTimeZone),
        snapshot: outcomes.snapshot
      }
    })
  } catch (error) {
    console.error(`[panel] falha ao ler métricas user=${userId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao ler métricas')
  }
}

module.exports = { getMetrics }
