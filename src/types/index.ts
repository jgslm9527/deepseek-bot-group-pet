/** Domain types shared by the UI, scheduler and persistence layer. */

export type ChatModel =
  | 'deepseek-chat'
  | 'deepseek-reasoner'
  | 'deepseek-flash-v4'
  | 'deepseek-v4-pro'

export const CHAT_MODELS: Array<{ value: ChatModel; label: string; short: string; role: BotRole }> = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat', short: 'Chat', role: 'planner' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)', short: 'R1', role: 'reviewer' },
  { value: 'deepseek-flash-v4', label: 'DeepSeek Flash V4', short: 'Flash V4', role: 'builder' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', short: 'V4 Pro', role: 'builder' },
]

export type BotRole = 'planner' | 'reviewer' | 'builder'
export type RoomKind = 'group' | 'direct'
export type MessageSender = 'user' | 'bot' | 'system'
export type MemoryStatus = 'active' | 'pending' | 'archived'
export type MemoryScope = 'all' | 'room'
export type DiscussionPhase = 'idle' | 'discussing' | 'awaiting_confirm' | 'implementing'
export type UsageKind = 'chat' | 'memory_filter' | 'memory_extract' | 'final'

export interface Bot {
  id: string
  name: string
  avatar: string
  accent: string
  systemPrompt: string
  model: ChatModel
  temperature: number
  maxTokens: number
  muted: boolean
  autoMemory: boolean
  shareMemories: boolean
  memoryScope: MemoryScope
  memoryLimit: number
  role: BotRole
  createdAt: string
  updatedAt: string
}

export interface Room {
  id: string
  name: string
  kind: RoomKind
  autoPoll: boolean
  allowBotMentions: boolean
  cooldownSeconds: number
  maxAutoMessages: number
  contextMessages: number
  createdAt: string
  updatedAt: string
  /** UI-only values hydrated by the room list query. */
  lastMessage?: string
  lastMessageAt?: string
  memberCount?: number
  memberIds?: string[]
}

export interface RoomBot {
  roomId: string
  botId: string
  position: number
  joinedAt: string
  bot: Bot
}

export interface Attachment {
  id: string
  name: string
  size: number
  type: string
  text?: string
  truncated?: boolean
}

export interface MessageMeta {
  kind?: 'proposal' | 'review' | 'setup' | 'revision' | 'plan' | 'final' | 'final-confirmed' | 'error'
  mentions?: string[]
  attachments?: Attachment[]
  usage?: TokenUsage
  stage?: string
  botName?: string
  [key: string]: unknown
}

export interface Message {
  id: string
  roomId: string
  senderType: MessageSender
  botId: string | null
  content: string
  attachments: Attachment[]
  meta: MessageMeta
  createdAt: string
}

export interface Memory {
  id: string
  botId: string
  roomId: string | null
  summary: string
  content: string
  tags: string[]
  importance: number
  status: MemoryStatus
  confidence: number
  source: string
  createdAt: string
  updatedAt: string
}

export interface UsageLog {
  id: string
  roomId: string | null
  botId: string | null
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  kind: UsageKind
  latencyMs: number
  createdAt: string
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  latencyMs: number
}

export interface DiscussionState {
  roomId: string
  phase: DiscussionPhase
  request: string
  turnCount: number
  maxTurns: number
  mode: 'auto' | 'mention' | 'direct' | 'revision'
  updatedAt: string
}

export interface AppSettings {
  maxContextTokens: number
  autoMemoryGlobal: boolean
  defaultTimeoutSecs: number
  petPosition?: { x: number; y: number }
}

export interface ApiSettings {
  baseUrl: string
  hasKey: boolean
  keyHint: string
}

export interface ChatApiResult {
  content: string
  model: string
  usage: TokenUsage
}

export interface ChatApiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatApiRequest {
  model: ChatModel | string
  messages: ChatApiMessage[]
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
  timeoutSecs?: number
  /** Logged in the token usage panel; never sent to the provider. */
  usageContext?: {
    roomId?: string
    botId?: string
    kind?: UsageKind
  }
}

export interface UsageBreakdown {
  label: string
  tokens: number
  prompt: number
  completion: number
  calls: number
}

export interface MemoryFilterResult {
  ids: string[]
  usage?: TokenUsage
}

export interface PetNotification {
  mode: 'idle' | 'thinking' | 'new-message' | 'error' | 'muted'
  botName?: string
  accent?: string
  text?: string
}

export interface Toast {
  id: string
  title: string
  description?: string
  tone: 'default' | 'success' | 'error'
}
