import type { AppSettings } from '@/types'
import { execute, select } from '@/lib/db'
import { nowIso } from '@/lib/id'

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await select<{ key: string; value: string }>(
    'SELECT key, value FROM app_settings',
  )
  const map = new Map(rows.map((row) => [row.key, row.value]))
  const maxContext = Number(map.get('max_context_tokens') ?? 12000)
  return {
    maxContextTokens: Number.isFinite(maxContext) ? maxContext : 12000,
    autoMemoryGlobal: map.get('auto_memory_global') !== '0',
    defaultTimeoutSecs: Number(map.get('default_timeout_secs') ?? 90),
  }
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  await execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, nowIso()],
  )
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<void> {
  if (settings.maxContextTokens != null) {
    await setAppSetting(
      'max_context_tokens',
      String(Math.max(2000, Math.min(64000, Math.round(settings.maxContextTokens)))),
    )
  }
  if (settings.autoMemoryGlobal != null) {
    await setAppSetting('auto_memory_global', settings.autoMemoryGlobal ? '1' : '0')
  }
  if (settings.defaultTimeoutSecs != null) {
    await setAppSetting(
      'default_timeout_secs',
      String(Math.max(20, Math.min(300, Math.round(settings.defaultTimeoutSecs)))),
    )
  }
}

export async function getUserProfile(): Promise<string> {
  const rows = await select<{ content: string }>(
    "SELECT content FROM user_profile WHERE id = 'default'",
  )
  return rows[0]?.content ?? ''
}

export async function saveUserProfile(content: string): Promise<void> {
  await execute(
    `INSERT INTO user_profile (id, content, updated_at) VALUES ('default', ?, ?)
     ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    [content, nowIso()],
  )
}
