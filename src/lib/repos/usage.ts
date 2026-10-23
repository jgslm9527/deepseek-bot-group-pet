import type { TokenUsage, UsageKind } from '@/types'
import { execute, select } from '@/lib/db'
import { newId, nowIso } from '@/lib/id'

export interface UsageInput {
  roomId?: string | null
  botId?: string | null
  model: string
  usage: TokenUsage
  kind: UsageKind
}

export async function addUsage(input: UsageInput): Promise<void> {
  await execute(
    `INSERT INTO usage_logs
      (id, room_id, bot_id, model, prompt_tokens, completion_tokens, total_tokens, kind, latency_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId('use'),
      input.roomId ?? null,
      input.botId ?? null,
      input.model,
      Math.max(0, Math.round(input.usage.promptTokens)),
      Math.max(0, Math.round(input.usage.completionTokens)),
      Math.max(0, Math.round(input.usage.totalTokens)),
      input.kind,
      Math.max(0, Math.round(input.usage.latencyMs)),
      nowIso(),
    ],
  )
}

export interface UsageTotalRow {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  calls: number
}

export async function getUsageTotals(since?: string): Promise<UsageTotalRow> {
  const rows = since
    ? await select<UsageTotalRow>(
        `SELECT COALESCE(SUM(prompt_tokens),0) AS prompt_tokens,
                COALESCE(SUM(completion_tokens),0) AS completion_tokens,
                COALESCE(SUM(total_tokens),0) AS total_tokens,
                COUNT(*) AS calls
         FROM usage_logs WHERE created_at >= ?`,
        [since],
      )
    : await select<UsageTotalRow>(
        `SELECT COALESCE(SUM(prompt_tokens),0) AS prompt_tokens,
                COALESCE(SUM(completion_tokens),0) AS completion_tokens,
                COALESCE(SUM(total_tokens),0) AS total_tokens,
                COUNT(*) AS calls
         FROM usage_logs`,
      )
  return {
    prompt_tokens: Number(rows[0]?.prompt_tokens ?? 0),
    completion_tokens: Number(rows[0]?.completion_tokens ?? 0),
    total_tokens: Number(rows[0]?.total_tokens ?? 0),
    calls: Number(rows[0]?.calls ?? 0),
  }
}

export interface GroupedUsageRow {
  key: string | null
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  calls: number
}

export async function getUsageBy(
  dimension: 'bot_id' | 'room_id' | 'model' | 'kind',
): Promise<GroupedUsageRow[]> {
  return select<GroupedUsageRow>(
    `SELECT ${dimension} AS key,
            COALESCE(SUM(prompt_tokens),0) AS prompt_tokens,
            COALESCE(SUM(completion_tokens),0) AS completion_tokens,
            COALESCE(SUM(total_tokens),0) AS total_tokens,
            COUNT(*) AS calls
     FROM usage_logs GROUP BY ${dimension}
     ORDER BY total_tokens DESC`,
  )
}

export async function getUsageByDay(days = 7): Promise<Array<{ day: string; total: number }>> {
  return select<{ day: string; total: number }>(
    `SELECT date(created_at, 'localtime') AS day, SUM(total_tokens) AS total
     FROM usage_logs
     GROUP BY date(created_at, 'localtime')
     ORDER BY day DESC LIMIT ?`,
    [days],
  )
}
