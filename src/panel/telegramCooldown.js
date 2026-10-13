// Espera da conta do Telegram depois de um limite. O Telegram não diz quando libera: o fim da pausa é a nova tentativa
// (1 busca). Cada limite seguido dobra a espera, até o teto; envio com sucesso zera a contagem.
const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

const COOLDOWN_POLICIES = {
  importLimit: { baseMs: 30 * MINUTE_MS, maxMs: 12 * HOUR_MS }, // busca por telefone esgotada (retryContacts)
  peerFlood: { baseMs: 2 * HOUR_MS, maxMs: 24 * HOUR_MS } // mensagens a desconhecidos demais
}

// strikes = limites seguidos, contando este (1 → base, 2 → 2×base, 3 → 4×base…)
const backoffMs = (strikes, { baseMs, maxMs }) => Math.min(baseMs * 2 ** Math.max(0, strikes - 1), maxMs)

/**
 * @param {{ policy?: keyof COOLDOWN_POLICIES, fixedMs?: number }} cooldown fixedMs = FLOOD_WAIT (o Telegram disse quanto esperar)
 * @returns {{ ms: number, strikes: number }}
 */
const nextCooldown = (currentStrikes, cooldown) => {
  if (cooldown.fixedMs) return { ms: cooldown.fixedMs, strikes: currentStrikes }
  const strikes = currentStrikes + 1
  return { ms: backoffMs(strikes, COOLDOWN_POLICIES[cooldown.policy]), strikes }
}

module.exports = { nextCooldown, backoffMs, COOLDOWN_POLICIES }
