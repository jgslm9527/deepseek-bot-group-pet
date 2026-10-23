import type { Bot, Memory, MemoryStatus, MemoryScope } from '@/types'
import { execute, select } from '@/lib/db'
import { newId, nowIso } from '@/lib/id'
import { mapMemory, type MemoryRow } from './mappers'

export async function listMemories(
  botId: string,
  status: MemoryStatus | 'all' = 'active',
): Promise<Memory[]> {
  const rows =
    status === 'all'
      ? await select<MemoryRow>(
          'SELECT * FROM memories WHERE bot_id = ? ORDER BY importance DESC, updated_at DESC',
          [botId],
        )
      : await select<MemoryRow>(
          'SELECT * FROM memories WHERE bot_id = ? AND status = ? ORDER BY importance DESC, updated_at DESC',
          [botId, status],
        )
  return rows.map(mapMemory)
}

export async function countMemories(
  botId: string,
  status: MemoryStatus = 'active',
): Promise<number> {
  const rows = await select<{ count: number }>(
    'SELECT COUNT(*) AS count FROM memories WHERE bot_id = ? AND status = ?',
    [botId, status],
  )
  return Number(rows[0]?.count ?? 0)
}

export async function getMemoriesByIds(ids: string[]): Promise<Memory[]> {
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(',')
  const rows = await select<MemoryRow>(
    `SELECT * FROM memories WHERE id IN (${placeholders}) AND status = 'active'`,
    ids,
  )
  return rows.map(mapMemory)
}

/**
 * Candidate memories for the LLM relevance filter. The filter only sees
 * summaries/tags/ids; full text is loaded later for the selected IDs.
 */
export async function getMemoryCandidates(
  bot: Bot,
  roomId: string,
  sharedBotIds: string[],
): Promise<Memory[]> {
  const params: unknown[] = [bot.id]
  let ownScope = ''
  if (bot.memoryScope === 'room') {
    ownScope = ' AND room_id = ?'
    params.push(roomId)
  }

  const otherIds = sharedBotIds.filter((id) => id !== bot.id)
  let sharedClause = ''
  if (otherIds.length) {
    const placeholders = otherIds.map(() => '?').join(',')
    sharedClause = ` OR (bot_id IN (${placeholders}) AND room_id = ?)`
    params.push(...otherIds, roomId)
  }

  const rows = await select<MemoryRow>(
    `SELECT * FROM memories
     WHERE status = 'active' AND (
       (bot_id = ?${ownScope})
       ${sharedClause}
     )
     ORDER BY importance DESC, updated_at DESC`,
    params,
  )
  return rows.map(mapMemory)
}

export async function createMemory(input: {
  botId: string
  roomId: string | null
  summary: string
  content: string
  tags: string[]
  importance: number
  status?: MemoryStatus
  confidence?: number
  source?: string
}): Promise<Memory> {
  const id = newId('mem')
  const now = nowIso()
  await execute(
    `INSERT INTO memories
      (id, bot_id, room_id, summary, content, tags, importance, status, confidence, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.botId,
      input.roomId,
      input.summary.trim(),
      input.content.trim(),
      JSON.stringify(input.tags),
      Math.max(1, Math.min(5, input.importance)),
      input.status ?? 'active',
      input.confidence ?? 1,
      input.source ?? 'manual',
      now,
      now,
    ],
  )
  return {
    id,
    botId: input.botId,
    roomId: input.roomId,
    summary: input.summary.trim(),
    content: input.content.trim(),
    tags: input.tags,
    importance: Math.max(1, Math.min(5, input.importance)),
    status: input.status ?? 'active',
    confidence: input.confidence ?? 1,
    source: input.source ?? 'manual',
    createdAt: now,
    updatedAt: now,
  }
}

export async function updateMemory(
  id: string,
  patch: Partial<
    Pick<Memory, 'summary' | 'content' | 'tags' | 'importance' | 'status' | 'confidence'>
  >,
): Promise<void> {
  const assignments: string[] = []
  const values: unknown[] = []
  const columns: Record<string, string> = {
    summary: 'summary',
    content: 'content',
    tags: 'tags',
    importance: 'importance',
    status: 'status',
    confidence: 'confidence',
  }
  for (const [key, column] of Object.entries(columns)) {
    if (!(key in patch)) continue
    assignments.push(`${column} = ?`)
    const value = (patch as Record<string, unknown>)[key]
    values.push(key === 'tags' ? JSON.stringify(value) : value)
  }
  if (!assignments.length) return
  assignments.push('updated_at = ?')
  values.push(nowIso(), id)
  await execute(`UPDATE memories SET ${assignments.join(', ')} WHERE id = ?`, values)
}

export async function setMemoryStatus(ids: string[], status: MemoryStatus): Promise<void> {
  if (!ids.length) return
  const placeholders = ids.map(() => '?').join(',')
  await execute(
    `UPDATE memories SET status = ?, updated_at = ? WHERE id IN (${placeholders})`,
    [status, nowIso(), ...ids],
  )
}

export async function deleteMemories(ids: string[]): Promise<void> {
  if (!ids.length) return
  const placeholders = ids.map(() => '?').join(',')
  await execute(`DELETE FROM memories WHERE id IN (${placeholders})`, ids)
}

export async function clearBotMemories(botId: string): Promise<void> {
  await execute('DELETE FROM memories WHERE bot_id = ?', [botId])
}

/**
 * Picks the lowest-value memories that may be archived to satisfy a per-bot
 * limit. Importance 4-5 memories are deliberately never evicted automatically.
 */
export async function pickEvictableMemories(
  botId: string,
  limit: number,
  incomingImportance: number,
): Promise<string[]> {
  const rows = await select<MemoryRow>(
    'SELECT * FROM memories WHERE bot_id = ? AND status = ? ORDER BY importance ASC, created_at ASC',
    [botId, 'active'],
  )
  if (rows.length < limit) return []
  const needed = rows.length - limit + 1
  const candidates = rows.filter((row) => Number(row.importance) <= 3)
  if (candidates.length < needed) {
    // Never evict importance 4-5 memories; skip the incoming item instead of
    // exceeding the configured limit.
    return []
  }
  return candidates.slice(0, needed).map((row) => row.id)
}
