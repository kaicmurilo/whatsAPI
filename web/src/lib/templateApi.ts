import type { MessageTemplateDetail, MessageTemplatePage, MessageTemplateSummary, TemplateInput } from '../types/api'
import { requestData, requestRaw } from './apiClient'
import { pageParams, TABLE_PER_PAGE, type PageQuery } from './panelApi'

const templatePath = (templateId: string) => `/panel/templates/${encodeURIComponent(templateId)}`

export function fetchTemplates(token: string, query: PageQuery, perPage = TABLE_PER_PAGE): Promise<MessageTemplatePage> {
  return requestData<MessageTemplatePage>(`/panel/templates?${pageParams(query, perPage)}`, { token })
}

export function fetchTemplate(token: string, templateId: string): Promise<MessageTemplateDetail> {
  return requestData<MessageTemplateDetail>(templatePath(templateId), { token })
}

// templateId null cria; com id substitui texto e anexos
export function saveTemplate(token: string, templateId: string | null, input: TemplateInput): Promise<MessageTemplateSummary> {
  return templateId
    ? requestData<MessageTemplateSummary>(templatePath(templateId), { token, method: 'PUT', body: input })
    : requestData<MessageTemplateSummary>('/panel/templates', { token, method: 'POST', body: input })
}

export async function deleteTemplate(token: string, templateId: string): Promise<void> {
  await requestRaw(templatePath(templateId), { token, method: 'DELETE' })
}
