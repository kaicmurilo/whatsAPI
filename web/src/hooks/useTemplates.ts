import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import type { PageQuery } from '../lib/panelApi'
import { queryKeys } from '../lib/queryKeys'
import { deleteTemplate, fetchTemplate, fetchTemplates, saveTemplate } from '../lib/templateApi'
import type { TemplateInput } from '../types/api'

export function useTemplates(query: PageQuery) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.templates(query),
    queryFn: () => fetchTemplates(token, query),
    placeholderData: keepPreviousData,
  })
}

// Todos (até 100) para o seletor do disparo
export function useAllTemplates() {
  const token = useRequiredToken()
  const query = { page: 1, search: '' }
  return useQuery({
    queryKey: [...queryKeys.templates(query), 'all'],
    queryFn: () => fetchTemplates(token, query, 100),
  })
}

export function useTemplate(templateId: string | null) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.template(templateId ?? ''),
    queryFn: () => fetchTemplate(token, templateId as string),
    enabled: templateId !== null,
  })
}

interface SaveTemplateInput {
  templateId: string | null
  input: TemplateInput
}

// Modelos travam arquivos da biblioteca (não dá para excluir arquivo em uso): recarrega os dois
export function useSaveTemplate() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, input }: SaveTemplateInput) => saveTemplate(token, templateId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allTemplates }),
  })
}

export function useDeleteTemplate() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (templateId: string) => deleteTemplate(token, templateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allTemplates }),
  })
}
