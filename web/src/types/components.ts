import type { ReactNode } from 'react'
import type { BroadcastListMember, BroadcastListSummary, BroadcastPacing, BroadcastReportSummary, BroadcastRun, ReportSituation, ChatSummary, Contact, PanelFile, SessionStatus, StoredMessage, WhatsAppSession } from './api'
import type { PanelView, ReportState, TableKey, TableState } from '../hooks/usePanelSearchParams'

export interface StatusLampProps {
  status: SessionStatus
  showLabel?: boolean
}

export interface SessionRailProps {
  sessions: WhatsAppSession[]
  isLoading: boolean
  selectedSessionId: string | null
  activeView: PanelView
  onSelect: (sessionId: string) => void
  onOpenView: (view: PanelView) => void
  onLogout: () => void
}

export interface SessionRailItemProps {
  session: WhatsAppSession
  isSelected: boolean
  onSelect: (sessionId: string) => void
}

export interface NewSessionFormProps {
  onCreated: (sessionId: string) => void
}

export interface QrCardProps {
  session: WhatsAppSession
}

export interface SearchInputProps {
  value: string
  onSearchChange: (search: string) => void
  placeholder: string
  label: string
}

export interface ChatListPaneProps {
  session: WhatsAppSession
  selectedChatId: string | null
  page: number
  search: string
  onSelectChat: (chatId: string) => void
  onPageChange: (page: number) => void
  onSearchChange: (search: string) => void
}

export interface NewChatFormProps {
  sessionId: string
  isConnected: boolean
  onOpenChat: (chatId: string) => void
}

export interface ContactSuggestionsProps {
  contacts: Contact[]
  isDisabled: boolean
  onPick: (contact: Contact) => void
}

export interface ChatRowProps {
  chat: ChatSummary
  isSelected: boolean
  onSelect: (chatId: string) => void
}

export interface PaginationProps {
  page: number
  perPage: number
  total: number
  label: string
  onPageChange: (page: number) => void
}

export interface ConversationPaneProps {
  session: WhatsAppSession
  chatId: string
  onClose: () => void
}

export interface MessageBubbleProps {
  message: StoredMessage
  showAuthor: boolean
}

export interface MessageComposerProps {
  sessionId: string
  chatId: string
  isConnected: boolean
}

export interface EmptyStateProps {
  title: string
  children?: ReactNode
}

export interface DataTableColumn<Row> {
  key: string
  header: string
  render: (row: Row) => ReactNode
  align?: 'start' | 'end'
}

export interface DataTableProps<Row> {
  caption: string
  columns: DataTableColumn<Row>[]
  rows: Row[]
  getRowKey: (row: Row) => string
  isBusy?: boolean
}

export interface ContactsPaneProps {
  // Instância usada para "Conversar"; null quando nenhuma está selecionada
  session: WhatsAppSession | null
  page: number
  search: string
  onPageChange: (page: number) => void
  onSearchChange: (search: string) => void
  onOpenChat: (chatId: string) => void
}

export interface ContactRowActionsProps {
  contact: Contact
  canChat: boolean
  isResolving: boolean
  onChat: (contact: Contact) => void
}

export interface ConfirmButtonProps {
  label: string
  confirmLabel: string
  onConfirm: () => void
  isPending?: boolean
  isDisabled?: boolean
  tone?: 'danger' | 'primary'
  className?: string
}

export interface FileUploadButtonProps {
  label?: string
  className?: string
  onUploaded?: (file: PanelFile) => void
}

export interface FilePickerProps {
  selectedFile: PanelFile | null
  onChange: (file: PanelFile | null) => void
  isDisabled?: boolean
}

// Tabela paginada com busca, estado vindo da URL
export interface TablePaneProps {
  page: number
  search: string
  onPageChange: (page: number) => void
  onSearchChange: (search: string) => void
}

export interface ReportControls {
  report: ReportState
  onOpenReport: (runId: string | null) => void
  onReportPage: (page: number) => void
  onReportSituation: (situation: ReportSituation) => void
}

export interface BroadcastsPaneProps extends ReportControls {
  sessions: WhatsAppSession[]
  defaultSessionId: string | null
  lists: TableState
  runs: TableState
  onTablePage: (table: TableKey, page: number) => void
  onTableSearch: (table: TableKey, search: string) => void
}

export interface BroadcastReportProps {
  runId: string
  page: number
  situation: ReportSituation
  onClose: () => void
  onPageChange: (page: number) => void
  onSituationChange: (situation: ReportSituation) => void
}

export interface ReportSummaryCardsProps {
  summary: BroadcastReportSummary
}

export interface ReportSituationFilterProps {
  value: ReportSituation
  onChange: (situation: ReportSituation) => void
}

export interface BroadcastSendFormProps {
  sessions: WhatsAppSession[]
  defaultSessionId: string | null
}

export interface BroadcastListEditorProps {
  listId: string | null
  initialName: string
  initialMembers: BroadcastListMember[]
  onDone: () => void
}

export interface BroadcastListEditorLoaderProps {
  listId: string
  onDone: () => void
}

export interface BroadcastListRowActionsProps {
  list: BroadcastListSummary
  onEdit: (listId: string) => void
}

export interface ContactPickerProps {
  selected: Map<string, BroadcastListMember>
  onChange: (selected: Map<string, BroadcastListMember>) => void
}

export interface BroadcastRunsSectionProps {
  page: number
  openReportId: string | null
  onPageChange: (page: number) => void
  onOpenReport: (runId: string) => void
}

export interface BroadcastRunActionsProps {
  run: BroadcastRun
  isReportOpen: boolean
  onOpenReport: (runId: string) => void
}

export interface PacingFieldsProps {
  value: BroadcastPacing
  onChange: (pacing: BroadcastPacing) => void
  isDisabled?: boolean
}
