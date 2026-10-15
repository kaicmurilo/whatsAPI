import type { GroupAddStatus, GroupAdmin } from '../types/api'
import { formatPhone } from './format'

// Admin sem nome nem telefone conhecido (só LID) aparece pelo id
export const describeAdmin = (admin: GroupAdmin): string => {
  const label = admin.name || (admin.phone ? formatPhone(admin.phone) : admin.id)
  return admin.isSuperAdmin ? `${label} (criador)` : label
}

export const ADD_STATUS_LABEL: Record<GroupAddStatus, string> = {
  added: 'adicionada',
  invited: 'convite enviado',
  already: 'já estava',
  offline: 'desconectada',
  failed: 'falhou',
}
