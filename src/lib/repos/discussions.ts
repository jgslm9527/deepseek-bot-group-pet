import type { DiscussionPhase, DiscussionState } from '@/types'
import { execute, select } from '@/lib/db'
import { nowIso } from '@/lib/id'
import { mapDiscussion, type DiscussionRow } from './mappers'

export async function getDiscussion(roomId: string): Promise<DiscussionState | null> {
  const rows = await select<DiscussionRow>('SELECT * FROM discussions WHERE room_id = ?', [
    roomId,
  ])
  return rows[0] ? mapDiscussion(rows[0]) : null
}

export async function saveDiscussion(state: DiscussionState): Promise<void> {
  await execute(
    `INSERT INTO discussions (room_id, phase, request, turn_count, max_turns, mode, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(room_id) DO UPDATE SET
       phase = excluded.phase,
       request = excluded.request,
       turn_count = excluded.turn_count,
       max_turns = excluded.max_turns,
       mode = excluded.mode,
       updated_at = excluded.updated_at`,
    [
      state.roomId,
      state.phase,
      state.request,
      state.turnCount,
      state.maxTurns,
      state.mode,
      state.updatedAt,
    ],
  )
}

export async function setDiscussionPhase(
  roomId: string,
  phase: DiscussionPhase,
): Promise<void> {
  await execute('UPDATE discussions SET phase = ?, updated_at = ? WHERE room_id = ?', [
    phase,
    nowIso(),
    roomId,
  ])
}

export async function getAwaitingDiscussions(): Promise<DiscussionState[]> {
  const rows = await select<DiscussionRow>(
    "SELECT * FROM discussions WHERE phase = 'awaiting_confirm'",
  )
  return rows.map(mapDiscussion)
}
