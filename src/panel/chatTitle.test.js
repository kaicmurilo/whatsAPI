const { pickChatTitle } = require('./chatTitle')

describe('pickChatTitle', () => {
  const groupId = '120363123456789012@g.us'

  test('prefers the first real title and skips the raw group id', () => {
    expect(pickChatTitle(groupId, groupId, '120363123456789012', 'Família')).toBe('Família')
    expect(pickChatTitle(groupId, '  Clientes  ', 'Outro')).toBe('Clientes')
  })

  test('returns null when every candidate is empty or the id itself', () => {
    expect(pickChatTitle(groupId, null, '', '  ', groupId, '120363123456789012')).toBeNull()
    expect(pickChatTitle(groupId)).toBeNull()
  })

  test('keeps a short name that is not the jid', () => {
    expect(pickChatTitle('5511999999999@c.us', 'Maria')).toBe('Maria')
  })
})
