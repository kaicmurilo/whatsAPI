const { reportTimeZone } = require('../config')
const { sendErrorResponse } = require('../utils')
const AuthService = require('../auth/authService')
const { PERIODS, listDayKeys, metricWindows } = require('./metricsRanges')
const { REPLY_WINDOW_DAYS, loadSendMetrics, loadOutcomes, loadOutgoingMetrics, loadIntegrationSummary } = require('./metricsRepository')

const emptySlice = () => ({ sent: 0, delivered: 0, read: 0, replied: 0, outgoing: 0, outgoingGroups: 0, outgoingContacts: 0 })

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

const sumPeriod = (rows, period) => rows.reduce((total, row) => total + row.periods[period], 0)

const sumOutgoing = (rows, period) => {
  const groups = sumPeriod(rows.filter((row) => row.isGroup), period)
  const contacts = sumPeriod(rows.filter((row) => !row.isGroup), period)
  return { outgoing: groups + contacts, outgoingGroups: groups, outgoingContacts: contacts }
}

// Enviadas pela integração, em grupo e para contato: soma das instâncias no total e o valor de cada uma na tabela
const mergeOutgoing = (periods, instances, outgoing) => {
  for (const period of PERIODS) Object.assign(periods[period], sumOutgoing(outgoing, period))
  for (const instance of instances) {
    const rows = outgoing.filter((row) => row.sessionId === instance.sessionId)
    for (const period of PERIODS) Object.assign(instance.periods[period], sumOutgoing(rows, period))
  }
}

// Agrupamento e chats distintos da integração entram no mesmo bucket do período
const mergeIntegrationSummary = (periods, summary) => {
  for (const period of PERIODS) Object.assign(periods[period], summary[period])
}

const getMetrics = async (req, res) => {
  const userId = req.user.user_id
  const now = new Date()
  const windows = metricWindows(now, reportTimeZone)
  try {
    const [sends, outcomes, outgoing, integration, sessions] = await Promise.all([
      loadSendMetrics(userId, windows, reportTimeZone),
      loadOutcomes(userId, windows),
      loadOutgoingMetrics(userId, windows),
      loadIntegrationSummary(userId, windows),
      AuthService.getUserSessions(userId)
    ])
    mergeOutcomes(sends.periods, outcomes)
    const instances = fillInstances(sends.instances, sessions)
    mergeOutgoing(sends.periods, instances, outgoing)
    mergeIntegrationSummary(sends.periods, integration)
    res.json({
      success: true,
      data: {
        timeZone: reportTimeZone,
        replyWindowDays: REPLY_WINDOW_DAYS,
        generatedAt: now.toISOString(),
        periods: sends.periods,
        instances,
        daily: fillDaily(sends.daily, now, reportTimeZone),
        snapshot: outcomes.snapshot
      }
    })
  } catch (error) {
    console.error(`[panel] falha ao ler métricas user=${userId}:`, error)
    sendErrorResponse(res, 500, 'Erro ao ler métricas')
  }
}

module.exports = { getMetrics, mergeOutgoing, mergeIntegrationSummary }
