// Rejeita se a promessa não resolver no prazo (a promessa original segue rodando)
const withTimeout = (promise, timeoutMs) => {
  let timer
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`sem resposta em ${timeoutMs / 1000}s`)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

module.exports = { withTimeout }
