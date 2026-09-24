// Ids do WhatsApp: 5511...@c.us, 1203...@g.us, 9876...@lid
const CHAT_ID_PATTERN = /^[\w.@:-]{3,100}$/
const MAX_SEARCH_LENGTH = 100

// undefined → fallback; fora do intervalo ou não inteiro → null (o controller responde 422)
const parseBoundedInt = (value, { fallback, min, max }) => {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null
}

const parseId = (value) => parseBoundedInt(value, { fallback: null, min: 1, max: Number.MAX_SAFE_INTEGER })

const parseSearch = (value) => {
  const search = typeof value === 'string' ? value.trim() : ''
  return search.length <= MAX_SEARCH_LENGTH ? search : null
}

const parsePagination = (query, { defaultPerPage }) => ({
  page: parseBoundedInt(query.page, { fallback: 1, min: 1, max: 100000 }),
  perPage: parseBoundedInt(query.perPage, { fallback: defaultPerPage, min: 1, max: 100 }),
  search: parseSearch(query.search)
})

const isValidPagination = ({ page, perPage, search }) => page !== null && perPage !== null && search !== null

module.exports = { CHAT_ID_PATTERN, parseBoundedInt, parseId, parsePagination, isValidPagination }
