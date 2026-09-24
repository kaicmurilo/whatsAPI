const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { panelFilesPath } = require('../config')

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Nome em disco é sempre um UUID gerado aqui: o nome enviado pelo usuário nunca vira caminho
const pathForKey = (storageKey) => {
  if (!UUID_PATTERN.test(storageKey)) throw new Error('storage key inválida')
  return path.join(panelFilesPath, storageKey)
}

const writeFileBytes = async (bytes) => {
  await fs.promises.mkdir(panelFilesPath, { recursive: true })
  const storageKey = randomUUID()
  await fs.promises.writeFile(pathForKey(storageKey), bytes, { flag: 'wx' })
  return storageKey
}

const readFileBase64 = async (storageKey) => (await fs.promises.readFile(pathForKey(storageKey))).toString('base64')

const removeFileBytes = (storageKey) => fs.promises.rm(pathForKey(storageKey), { force: true })

module.exports = { writeFileBytes, readFileBase64, removeFileBytes }
