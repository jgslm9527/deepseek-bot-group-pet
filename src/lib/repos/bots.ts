import type { Bot, BotRole, ChatModel, MemoryScope } from '@/types'
import { CHAT_MODELS } from '@/types'
import { execute, select } from '@/lib/db'
import { newId, nowIso } from '@/lib/id'
import { mapBot, type BotRow } from './mappers'

export interface BotInput {
  name: string
  avatar: string
  accent: string
  systemPrompt: string
  model: ChatModel
  temperature: number
  maxTokens: number
  autoMemory: boolean
  shareMemories: boolean
  memoryScope: MemoryScope
  memoryLimit: number
}

export function roleForModel(model: ChatModel): BotRole {
  return CHAT_MODELS.find((entry) => entry.value === model)?.role ?? 'planner'
}

export async function listBots(): Promise<Bot[]> {
  const rows = await select<BotRow>('SELECT * FROM bots ORDER BY created_at ASC')
  return rows.map(mapBot)
}

export async function getBot(id: string): Promise<Bot | null> {
  const rows = await select<BotRow>('SELECT * FROM bots WHERE id = ?', [id])
  return rows[0] ? mapBot(rows[0]) : null
}

export async function createBot(input: BotInput): Promise<Bot> {
  const id = newId('bot')
  const now = nowIso()
  await execute(
    `INSERT INTO bots
      (id, name, avatar, accent, system_prompt, model, temperature, max_tokens,
       muted, auto_memory, share_memories, memory_scope, memory_limit, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.avatar,
      input.accent,
      input.systemPrompt,
      input.model,
      input.temperature,
      input.maxTokens,
      input.autoMemory ? 1 : 0,
      input.shareMemories ? 1 : 0,
      input.memoryScope,
      Math.max(5, Math.min(200, input.memoryLimit)),
      roleForModel(input.model),
      now,
      now,
    ],
  )
  const bot = await getBot(id)
  if (!bot) throw new Error('创建 Bot 失败')
  return bot
}

const FIELD_MAP: Record<string, string> = {
  name: 'name',
  avatar: 'avatar',
  accent: 'accent',
  systemPrompt: 'system_prompt',
  model: 'model',
  temperature: 'temperature',
  maxTokens: 'max_tokens',
  muted: 'muted',
  autoMemory: 'auto_memory',
  shareMemories: 'share_memories',
  memoryScope: 'memory_scope',
  memoryLimit: 'memory_limit',
}

export async function updateBot(
  id: string,
  patch: Partial<BotInput & { muted: boolean }>,
): Promise<void> {
  const values: unknown[] = []
  const assignments: string[] = []

  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (!(key in patch)) continue
    const raw = (patch as Record<string, unknown>)[key]
    let value = raw
    if (typeof raw === 'boolean') value = raw ? 1 : 0
    if (key === 'model') {
      assignments.push('role = ?')
      values.push(roleForModel(raw as ChatModel))
    }
    assignments.push(`${column} = ?`)
    values.push(value)
  }
  if (!assignments.length) return

  assignments.push('updated_at = ?')
  values.push(nowIso(), id)
  await execute(`UPDATE bots SET ${assignments.join(', ')} WHERE id = ?`, values)
}

export async function muteAllBots(muted = true): Promise<void> {
  await execute('UPDATE bots SET muted = ?, updated_at = ?', [muted ? 1 : 0, nowIso()])
}

export async function deleteBot(id: string): Promise<void> {
  await execute('DELETE FROM room_bots WHERE bot_id = ?', [id])
  await execute('DELETE FROM memories WHERE bot_id = ?', [id])
  await execute('DELETE FROM bots WHERE id = ?', [id])
}

export async function getRoomBots(roomId: string): Promise<Bot[]> {
  const rows = await select<BotRow>(
    `SELECT b.* FROM bots b
     JOIN room_bots rb ON rb.bot_id = b.id
     WHERE rb.room_id = ?
     ORDER BY rb.position ASC, rb.joined_at ASC`,
    [roomId],
  )
  return rows.map(mapBot)
}

export async function addBotToRoom(roomId: string, botId: string): Promise<void> {
  const rows = await select<{ max_pos: number | null }>(
    'SELECT MAX(position) AS max_pos FROM room_bots WHERE room_id = ?',
    [roomId],
  )
  const position = Number(rows[0]?.max_pos ?? -1) + 1
  await execute(
    'INSERT OR IGNORE INTO room_bots (room_id, bot_id, position, joined_at) VALUES (?, ?, ?, ?)',
    [roomId, botId, position, nowIso()],
  )
}

export async function removeBotFromRoom(roomId: string, botId: string): Promise<void> {
  await execute('DELETE FROM room_bots WHERE room_id = ? AND bot_id = ?', [roomId, botId])
}

export async function listBotsOutsideRoom(roomId: string): Promise<Bot[]> {
  const rows = await select<BotRow>(
    `SELECT * FROM bots
     WHERE id NOT IN (SELECT bot_id FROM room_bots WHERE room_id = ?)
     ORDER BY created_at ASC`,
    [roomId],
  )
  return rows.map(mapBot)
}
