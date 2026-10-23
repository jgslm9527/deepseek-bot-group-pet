import type {
  Bot,
  ChatModel,
  DiscussionState,
  Memory,
  Message,
  Room,
  RoomBot,
  UsageKind,
  UsageLog,
} from '@/types'
import { parseJson, toBool } from '@/lib/db'
import { markdownPreview } from '@/lib/preview'

export interface BotRow {
  id: string
  name: string
  avatar: string
  accent: string
  system_prompt: string
  model: string
  temperature: number
  max_tokens: number
  muted: number | boolean
  auto_memory: number | boolean
  share_memories: number | boolean
  memory_scope: string
  memory_limit: number
  role: string
  created_at: string
  updated_at: string
}

export interface RoomRow {
  id: string
  name: string
  kind: string
  auto_poll: number | boolean
  allow_bot_mentions: number | boolean
  cooldown_seconds: number
  max_auto_messages: number
  context_messages: number
  created_at: string
  updated_at: string
  last_message?: string | null
  last_message_at?: string | null
  member_count?: number
  member_ids?: string | null
}

export interface MessageRow {
  id: string
  room_id: string
  sender_type: string
  bot_id: string | null
  content: string
  attachments: string
  meta: string
  created_at: string
}

export interface MemoryRow {
  id: string
  bot_id: string
  room_id: string | null
  summary: string
  content: string
  tags: string
  importance: number
  status: string
  confidence: number
  source: string
  created_at: string
  updated_at: string
}

export interface UsageRow {
  id: string
  room_id: string | null
  bot_id: string | null
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  kind: string
  latency_ms: number
  created_at: string
}

export interface DiscussionRow {
  room_id: string
  phase: string
  request: string
  turn_count: number
  max_turns: number
  mode: string
  updated_at: string
}

export function mapBot(row: BotRow): Bot {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    accent: row.accent,
    systemPrompt: row.system_prompt,
    model: row.model as ChatModel,
    temperature: Number(row.temperature),
    maxTokens: Number(row.max_tokens),
    muted: toBool(row.muted),
    autoMemory: toBool(row.auto_memory),
    shareMemories: toBool(row.share_memories),
    memoryScope: row.memory_scope === 'room' ? 'room' : 'all',
    memoryLimit: Number(row.memory_limit ?? 30),
    role: row.role === 'reviewer' || row.role === 'builder' ? row.role : 'planner',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapRoom(row: RoomRow): Room {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind === 'direct' ? 'direct' : 'group',
    autoPoll: toBool(row.auto_poll),
    allowBotMentions: toBool(row.allow_bot_mentions),
    cooldownSeconds: Number(row.cooldown_seconds),
    maxAutoMessages: Number(row.max_auto_messages),
    contextMessages: Number(row.context_messages),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessage: row.last_message ? markdownPreview(row.last_message, 84) : undefined,
    lastMessageAt: row.last_message_at ?? undefined,
    memberCount: Number(row.member_count ?? 0),
    memberIds: row.member_ids ? row.member_ids.split(',').filter(Boolean) : [],
  }
}

export function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    roomId: row.room_id,
    senderType:
      row.sender_type === 'user' || row.sender_type === 'system' ? row.sender_type : 'bot',
    botId: row.bot_id,
    content: row.content,
    attachments: parseJson(row.attachments, []),
    meta: parseJson(row.meta, {}),
    createdAt: row.created_at,
  }
}

export function mapMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    botId: row.bot_id,
    roomId: row.room_id,
    summary: row.summary,
    content: row.content,
    tags: parseJson<string[]>(row.tags, []),
    importance: Number(row.importance),
    status:
      row.status === 'pending' || row.status === 'archived' ? row.status : 'active',
    confidence: Number(row.confidence),
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapUsage(row: UsageRow): UsageLog {
  return {
    id: row.id,
    roomId: row.room_id,
    botId: row.bot_id,
    model: row.model,
    promptTokens: Number(row.prompt_tokens),
    completionTokens: Number(row.completion_tokens),
    totalTokens: Number(row.total_tokens),
    kind: row.kind as UsageKind,
    latencyMs: Number(row.latency_ms),
    createdAt: row.created_at,
  }
}

export function mapDiscussion(row: DiscussionRow): DiscussionState {
  const phase =
    row.phase === 'discussing' ||
    row.phase === 'awaiting_confirm' ||
    row.phase === 'implementing'
      ? row.phase
      : 'idle'
  return {
    roomId: row.room_id,
    phase,
    request: row.request,
    turnCount: Number(row.turn_count),
    maxTurns: Number(row.max_turns),
    mode:
      row.mode === 'mention' || row.mode === 'direct' || row.mode === 'revision'
        ? row.mode
        : 'auto',
    updatedAt: row.updated_at,
  }
}
