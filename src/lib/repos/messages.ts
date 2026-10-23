import type { Attachment, Message, MessageMeta, MessageSender } from '@/types'
import { execute, select } from '@/lib/db'
import { newId, nowIso } from '@/lib/id'
import { mapMessage, type MessageRow } from './mappers'
import { touchRoom } from './rooms'

export async function listMessages(roomId: string, limit = 500): Promise<Message[]> {
  const rows = await select<MessageRow>(
    `SELECT * FROM (
       SELECT * FROM messages WHERE room_id = ?
       ORDER BY created_at DESC, id DESC LIMIT ?
     ) ORDER BY created_at ASC, id ASC`,
    [roomId, limit],
  )
  return rows.map(mapMessage)
}

/** Messages used as short-term context for model calls. */
export async function listRecentMessages(roomId: string, limit: number): Promise<Message[]> {
  const safeLimit = Math.max(1, Math.min(120, Math.floor(limit)))
  const rows = await select<MessageRow>(
    `SELECT * FROM (
       SELECT * FROM messages WHERE room_id = ? AND sender_type != 'system'
       ORDER BY created_at DESC, id DESC LIMIT ?
     ) ORDER BY created_at ASC, id ASC`,
    [roomId, safeLimit],
  )
  return rows.map(mapMessage)
}

export interface AddMessageInput {
  roomId: string
  senderType: MessageSender
  botId?: string | null
  content: string
  attachments?: Attachment[]
  meta?: MessageMeta
}

export async function addMessage(input: AddMessageInput): Promise<Message> {
  const message: Message = {
    id: newId('msg'),
    roomId: input.roomId,
    senderType: input.senderType,
    botId: input.botId ?? null,
    content: input.content,
    attachments: input.attachments ?? [],
    meta: input.meta ?? {},
    createdAt: nowIso(),
  }
  await execute(
    `INSERT INTO messages (id, room_id, sender_type, bot_id, content, attachments, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.roomId,
      message.senderType,
      message.botId,
      message.content,
      JSON.stringify(message.attachments),
      JSON.stringify(message.meta),
      message.createdAt,
    ],
  )
  await touchRoom(input.roomId)
  return message
}

export async function clearMessages(roomId: string): Promise<void> {
  await execute("DELETE FROM messages WHERE room_id = ? AND sender_type != 'system'", [roomId])
}

export async function countRoomMessages(roomId: string): Promise<number> {
  const rows = await select<{ count: number }>(
    'SELECT COUNT(*) as count FROM messages WHERE room_id = ?',
    [roomId],
  )
  return Number(rows[0]?.count ?? 0)
}
