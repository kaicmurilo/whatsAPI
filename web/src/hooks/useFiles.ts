import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredToken } from '../auth/useAuth'
import { deleteFile, fetchFiles, uploadFile } from '../lib/fileApi'
import { TABLE_PER_PAGE, type PageQuery } from '../lib/panelApi'
import { queryKeys } from '../lib/queryKeys'

export function useFiles(query: PageQuery, perPage = TABLE_PER_PAGE) {
  const token = useRequiredToken()
  return useQuery({
    queryKey: queryKeys.files(query, perPage),
    queryFn: () => fetchFiles(token, query, perPage),
    placeholderData: keepPreviousData,
  })
}

export function useUploadFile() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadFile(token, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allFiles }),
  })
}

export function useDeleteFile() {
  const token = useRequiredToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) => deleteFile(token, fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allFiles }),
  })
}
