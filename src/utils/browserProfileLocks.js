const fs = require('fs')
const path = require('path')

// Symlinks que o Chromium cria para impedir dois processos no mesmo perfil.
// O alvo do SingletonLock é "<hostname>-<pid>": em container recriado o hostname muda e o
// Chromium recusa abrir o perfil ("in use by another computer"), mesmo sem ninguém usando.
const CHROMIUM_LOCK_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket']

/**
 * Remove travas órfãs do perfil. Só é seguro porque cada sessão tem no máximo um client
 * no processo (Map de sessions) e cada volume de sessões pertence a um único container.
 * @returns {string[]} arquivos removidos
 */
const clearStaleProfileLocks = (profileDir) =>
  CHROMIUM_LOCK_FILES.filter((lockFile) => {
    const lockPath = path.join(profileDir, lockFile)
    try {
      fs.lstatSync(lockPath) // lstat: os locks são symlinks quebrados, stat falharia
    } catch {
      return false
    }
    fs.unlinkSync(lockPath)
    return true
  })

module.exports = { clearStaleProfileLocks }
