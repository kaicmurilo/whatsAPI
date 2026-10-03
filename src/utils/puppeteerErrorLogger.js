const { CdpPage } = require('puppeteer-core/lib/cjs/puppeteer/cdp/Page.js')

let isInstalled = false

const describeError = (error) => (error?.stack || error?.message || String(error)).split('\n').slice(0, 4).join(' ⏎ ')

/**
 * O whatsapp-web.js roda a inicialização dentro de funções expostas à página: uma exceção ali volta
 * para a página e some, e a sessão fica "autenticando" sem nenhum log. Foi assim que o
 * "Target closed" da troca de alvo passou despercebido. Loga a exceção e a falha do exposeFunction.
 */
// ponytail: patch no prototype do puppeteer; some com o log se a lib passar a reportar esses erros
const installPuppeteerErrorLogger = () => {
  if (isInstalled) return
  isInstalled = true
  const originalExpose = CdpPage.prototype.exposeFunction
  CdpPage.prototype.exposeFunction = function loggedExpose (name, fn) {
    const loggedFn = typeof fn === 'function'
      ? async (...args) => {
        try {
          return await fn(...args)
        } catch (error) {
          console.warn(`[puppeteer] função exposta ${name} lançou: ${describeError(error)}`)
          throw error
        }
      }
      : fn
    return originalExpose.call(this, name, loggedFn).catch((error) => {
      console.warn(`[puppeteer] exposeFunction ${name} falhou: ${describeError(error)}`)
      throw error
    })
  }
}

module.exports = { installPuppeteerErrorLogger }
