import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ReportSituation } from '../types/api'

const PARAM = {
  view: 'view',
  session: 'session',
  chat: 'chat',
  page: 'page',
  search: 'q',
  report: 'report',
  reportPage: 'reppage',
  reportSituation: 'repsit',
} as const

const REPORT_SITUATIONS: ReportSituation[] = ['all', 'pending', 'sent', 'delivered', 'read', 'failed']

// Cada tabela paginada tem página e busca próprias na URL
const TABLE_PARAMS = {
  contacts: { page: 'cpage', search: 'cq' },
  lists: { page: 'lpage', search: 'lq' },
  files: { page: 'fpage', search: 'fq' },
  runs: { page: 'rpage', search: 'rq' },
} as const

export type TableKey = keyof typeof TABLE_PARAMS

const PANEL_VIEWS = ['chats', 'contacts', 'broadcasts', 'files'] as const
export type PanelView = (typeof PANEL_VIEWS)[number]

export interface TableState {
  page: number
  search: string
}

export interface ReportState {
  runId: string | null
  page: number
  situation: ReportSituation
}

export interface PanelSelection {
  view: PanelView
  sessionId: string | null
  chatId: string | null
  page: number
  search: string
  tables: Record<TableKey, TableState>
  report: ReportState
}

type ParamMutation = (next: URLSearchParams) => void

function readPage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

const readSituation = (value: string | null): ReportSituation =>
  REPORT_SITUATIONS.find((situation) => situation === value) ?? 'all'

const readView = (value: string | null): PanelView =>
  PANEL_VIEWS.find((view) => view === value) ?? 'chats'

const writePage = (pageKey: string, page: number): ParamMutation => (next) => {
  if (page > 1) next.set(pageKey, String(page))
  else next.delete(pageKey)
}

// Busca nova sempre volta para a primeira página
const writeSearch = (searchKey: string, pageKey: string, search: string): ParamMutation => (next) => {
  if (search) next.set(searchKey, search)
  else next.delete(searchKey)
  next.delete(pageKey)
}

const readTables = (params: URLSearchParams): Record<TableKey, TableState> => {
  const entries = Object.entries(TABLE_PARAMS).map(([key, names]) => [
    key,
    { page: readPage(params.get(names.page)), search: params.get(names.search) ?? '' },
  ])
  return Object.fromEntries(entries) as Record<TableKey, TableState>
}

// View, instância, chat, páginas e buscas vivem na URL: recarregar ou compartilhar o link mantém a tela
export function usePanelSearchParams() {
  const [params, setParams] = useSearchParams()

  const selection: PanelSelection = {
    view: readView(params.get(PARAM.view)),
    sessionId: params.get(PARAM.session),
    chatId: params.get(PARAM.chat),
    page: readPage(params.get(PARAM.page)),
    search: params.get(PARAM.search) ?? '',
    tables: readTables(params),
    report: {
      runId: params.get(PARAM.report),
      page: readPage(params.get(PARAM.reportPage)),
      situation: readSituation(params.get(PARAM.reportSituation)),
    },
  }

  const update = useCallback((mutate: ParamMutation) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      mutate(next)
      return next
    })
  }, [setParams])

  const selectSession = useCallback((sessionId: string) => update((next) => {
    next.set(PARAM.session, sessionId)
    for (const key of [PARAM.view, PARAM.chat, PARAM.page, PARAM.search]) next.delete(key)
  }), [update])

  const selectChat = useCallback((chatId: string | null) => update((next) => {
    if (chatId) next.set(PARAM.chat, chatId)
    else next.delete(PARAM.chat)
  }), [update])

  // Vindo da agenda: volta para as conversas já com o chat aberto
  const openChat = useCallback((chatId: string) => update((next) => {
    next.delete(PARAM.view)
    next.set(PARAM.chat, chatId)
  }), [update])

  const setView = useCallback((view: PanelView) => update((next) => {
    if (view === 'chats') next.delete(PARAM.view)
    else next.set(PARAM.view, view)
  }), [update])

  const setPage = useCallback((page: number) => update(writePage(PARAM.page, page)), [update])
  const setSearch = useCallback((search: string) => update(writeSearch(PARAM.search, PARAM.page, search)), [update])

  const setTablePage = useCallback(
    (table: TableKey, page: number) => update(writePage(TABLE_PARAMS[table].page, page)),
    [update],
  )
  const setTableSearch = useCallback(
    (table: TableKey, search: string) => update(writeSearch(TABLE_PARAMS[table].search, TABLE_PARAMS[table].page, search)),
    [update],
  )

  // Abrir outro relatório (ou fechar) volta para a 1ª página sem filtro
  const openReport = useCallback((runId: string | null) => update((next) => {
    if (runId) next.set(PARAM.report, runId)
    else next.delete(PARAM.report)
    next.delete(PARAM.reportPage)
    next.delete(PARAM.reportSituation)
  }), [update])

  const setReportPage = useCallback((page: number) => update(writePage(PARAM.reportPage, page)), [update])

  // Trocar o filtro reseta a página
  const setReportSituation = useCallback((situation: ReportSituation) => update((next) => {
    if (situation === 'all') next.delete(PARAM.reportSituation)
    else next.set(PARAM.reportSituation, situation)
    next.delete(PARAM.reportPage)
  }), [update])

  return {
    selection,
    selectSession,
    selectChat,
    openChat,
    setView,
    setPage,
    setSearch,
    setTablePage,
    setTableSearch,
    openReport,
    setReportPage,
    setReportSituation,
  }
}
