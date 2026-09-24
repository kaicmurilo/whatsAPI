// Ritmo padrão "Seguro": envio espaçado e em ordem aleatória reduz o risco de o WhatsApp marcar o número como spam
const DEFAULT_PACING = { minSeconds: 20, maxSeconds: 45, randomOrder: true }
const MIN_ALLOWED_SECONDS = 3
const MAX_ALLOWED_SECONDS = 600

const isWholeSecond = (value) => Number.isInteger(value) && value >= MIN_ALLOWED_SECONDS && value <= MAX_ALLOWED_SECONDS

/**
 * Valida o ritmo enviado pelo painel; ausente → padrão.
 * @returns {{ pacing?: object, error?: string }}
 */
const parsePacing = (input) => {
  if (input === undefined || input === null) return { pacing: DEFAULT_PACING }
  const minSeconds = Number(input.minSeconds)
  const maxSeconds = Number(input.maxSeconds)
  if (!isWholeSecond(minSeconds) || !isWholeSecond(maxSeconds)) {
    return { error: `Intervalo deve ser em segundos inteiros, entre ${MIN_ALLOWED_SECONDS} e ${MAX_ALLOWED_SECONDS}` }
  }
  if (minSeconds > maxSeconds) return { error: 'O intervalo mínimo não pode ser maior que o máximo' }
  return { pacing: { minSeconds, maxSeconds, randomOrder: input.randomOrder !== false } }
}

// Disparo salvo no banco → ritmo do runner (reprocessar repete o mesmo ritmo)
const pacingOfRun = (run) => ({ minSeconds: run.delayMinSeconds, maxSeconds: run.delayMaxSeconds, randomOrder: run.randomOrder })

module.exports = { parsePacing, pacingOfRun, DEFAULT_PACING }
