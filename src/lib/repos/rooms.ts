import type { Room, RoomKind } from '@/types'
import { execute, select } from '@/lib/db'
import { newId, nowIso } from '@/lib/id'
import { mapRoom, type RoomRow } from './mappers'

export interface CreateRoomInput {
  name: string
  kind: RoomKind
  botIds: string[]
}

export async function listRooms(): Promise<Room[]> {
  const rows = await select<RoomRow>(
    `SELECT r.*,
       (SELECT content FROM messages m WHERE m.room_id = r.id AND m.sender_type != 'system' ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message,
       (SELECT created_at FROM messages m WHERE m.room_id = r.id AND m.sender_type != 'system' ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_at,
       (SELECT COUNT(*) FROM room_bots rb WHERE rb.room_id = r.id) AS member_count,
       (SELECT GROUP_CONCAT(rb.bot_id) FROM room_bots rb WHERE rb.room_id = r.id) AS member_ids
     FROM rooms r
     ORDER BY COALESCE(last_message_at, r.updated_at) DESC`,
  )
  return rows.map(mapRoom)
}

export async function getRoom(id: string): Promise<Room | null> {
  const rows = await select<RoomRow>('SELECT * FROM rooms WHERE id = ?', [id])
  return rows[0] ? mapRoom(rows[0]) : null
}

export async function createRoom(input: CreateRoomInput): Promise<Room> {
  const id = newId('room')
  const now = nowIso()
  await execute(
    `INSERT INTO rooms
      (id, name, kind, auto_poll, allow_bot_mentions, cooldown_seconds,
       max_auto_messages, context_messages, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 2, 6, 24, ?, ?)`,
    [id, input.name.trim(), input.kind, input.kind === 'group' ? 1 : 0, now, now],
  )
  for (const [index, botId] of input.botIds.entries()) {
    await execute(
      'INSERT OR IGNORE INTO room_bots (room_id, bot_id, position, joined_at) VALUES (?, ?, ?, ?)',
      [id, botId, index, now],
    )
  }
  const room = await getRoom(id)
  if (!room) throw new Error('创建会话失败')
  return room
}

export async function findDirectRoom(botId: string): Promise<Room | null> {
  const rows = await select<RoomRow>(
    `SELECT r.* FROM rooms r
     JOIN room_bots rb ON rb.room_id = r.id
     WHERE r.kind = 'direct' AND rb.bot_id = ?
     LIMIT 1`,
    [botId],
  )
  return rows[0] ? mapRoom(rows[0]) : null
}

const ROOM_FIELDS: Record<string, string> = {
  name: 'name',
  autoPoll: 'auto_poll',
  allowBotMentions: 'allow_bot_mentions',
  cooldownSeconds: 'cooldown_seconds',
  maxAutoMessages: 'max_auto_messages',
  contextMessages: 'context_messages',
}

export async function updateRoom(
  id: string,
  patch: Partial<Pick<Room, 'name' | 'autoPoll' | 'allowBotMentions' | 'cooldownSeconds' | 'maxAutoMessages' | 'contextMessages'>>,
): Promise<void> {
  const assignments: string[] = []
  const values: unknown[] = []
  for (const [key, column] of Object.entries(ROOM_FIELDS)) {
    if (!(key in patch)) continue
    const value = (patch as Record<string, unknown>)[key]
    assignments.push(`${column} = ?`)
    values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value)
  }
  if (!assignments.length) return
  assignments.push('updated_at = ?')
  values.push(nowIso(), id)
  await execute(`UPDATE rooms SET ${assignments.join(', ')} WHERE id = ?`, values)
}

export async function touchRoom(id: string): Promise<void> {
  await execute('UPDATE rooms SET updated_at = ? WHERE id = ?', [nowIso(), id])
}

export async function deleteRoom(id: string): Promise<void> {
  await execute('DELETE FROM messages WHERE room_id = ?', [id])
  await execute('DELETE FROM room_bots WHERE room_id = ?', [id])
  await execute('DELETE FROM memories WHERE room_id = ?', [id])
  await execute('DELETE FROM discussions WHERE room_id = ?', [id])
  await execute('DELETE FROM rooms WHERE id = ?', [id])
}
