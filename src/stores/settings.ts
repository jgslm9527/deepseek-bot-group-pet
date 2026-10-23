import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ApiSettings, AppSettings, UsageBreakdown } from '@/types'
import {
  getAppSettings,
  getUserProfile,
  saveAppSettings,
  saveUserProfile,
} from '@/lib/repos/settings'
import {
  getUsageBy,
  getUsageByDay,
  getUsageTotals,
  type GroupedUsageRow,
} from '@/lib/repos/usage'
import {
  errorMessage,
  readApiSettings,
  testConnection,
  writeApiSettings,
} from '@/lib/tauri'

export interface UsageSnapshot {
  total: number
  prompt: number
  completion: number
  calls: number
  today: number
  todayCalls: number
  byBot: GroupedUsageRow[]
  byRoom: GroupedUsageRow[]
  byModel: GroupedUsageRow[]
  byKind: GroupedUsageRow[]
  daily: Array<{ day: string; total: number }>
}

function emptySnapshot(): UsageSnapshot {
  return {
    total: 0,
    prompt: 0,
    completion: 0,
    calls: 0,
    today: 0,
    todayCalls: 0,
    byBot: [],
    byRoom: [],
    byModel: [],
    byKind: [],
    daily: [],
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const api = ref<ApiSettings>({ baseUrl: 'https://api.deepseek.com', hasKey: false, keyHint: '' })
  const app = ref<AppSettings>({ maxContextTokens: 12000, autoMemoryGlobal: true, defaultTimeoutSecs: 90 })
  const profile = ref('')
  const usage = ref<UsageSnapshot>(emptySnapshot())
  const loading = ref(true)
  const saving = ref(false)
  const testing = ref(false)
  const usageLoading = ref(false)
  const loadError = ref('')

  const hasApiKey = computed(() => api.value.hasKey)

  async function load() {
    loading.value = true
    loadError.value = ''
    try {
      const [apiSettings, appSettings, userProfile] = await Promise.all([
        readApiSettings(),
        getAppSettings(),
        getUserProfile(),
      ])
      api.value = apiSettings
      app.value = appSettings
      profile.value = userProfile
    } catch (error) {
      loadError.value = errorMessage(error)
    } finally {
      loading.value = false
    }
  }

  async function saveApi(input: { apiKey?: string; baseUrl?: string; clearApiKey?: boolean }) {
    saving.value = true
    try {
      api.value = await writeApiSettings(input)
      return true
    } catch (error) {
      throw new Error(errorMessage(error))
    } finally {
      saving.value = false
    }
  }

  async function testApi(): Promise<string> {
    testing.value = true
    try {
      const result = await testConnection()
      return result.content.trim() || 'pong'
    } finally {
      testing.value = false
    }
  }

  async function updatePreferences(patch: Partial<AppSettings>) {
    app.value = { ...app.value, ...patch }
    await saveAppSettings(patch)
  }

  async function updateProfile(content: string) {
    profile.value = content
    await saveUserProfile(content)
  }

  async function loadUsage() {
    usageLoading.value = true
    try {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const [all, today, byBot, byRoom, byModel, byKind, daily] = await Promise.all([
        getUsageTotals(),
        getUsageTotals(start),
        getUsageBy('bot_id'),
        getUsageBy('room_id'),
        getUsageBy('model'),
        getUsageBy('kind'),
        getUsageByDay(14),
      ])
      const dailyMap = new Map(daily.map((row) => [row.day, Number(row.total ?? 0)]))
      const padded: Array<{ day: string; total: number }> = []
      for (let offset = 0; offset < 14; offset += 1) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        padded.push({ day: key, total: dailyMap.get(key) ?? 0 })
      }
      usage.value = {
        total: Number(all.total_tokens ?? 0),
        prompt: Number(all.prompt_tokens ?? 0),
        completion: Number(all.completion_tokens ?? 0),
        calls: Number(all.calls ?? 0),
        today: Number(today.total_tokens ?? 0),
        todayCalls: Number(today.calls ?? 0),
        byBot,
        byRoom,
        byModel,
        byKind,
        daily: padded,
      }
    } catch (error) {
      console.warn('failed to load usage', error)
    } finally {
      usageLoading.value = false
    }
  }

  function breakdown(row: GroupedUsageRow, label: string): UsageBreakdown {
    return {
      label,
      tokens: Number(row.total_tokens ?? 0),
      prompt: Number(row.prompt_tokens ?? 0),
      completion: Number(row.completion_tokens ?? 0),
      calls: Number(row.calls ?? 0),
    }
  }

  return {
    api,
    app,
    profile,
    usage,
    loading,
    saving,
    testing,
    usageLoading,
    loadError,
    hasApiKey,
    load,
    saveApi,
    testApi,
    updatePreferences,
    updateProfile,
    loadUsage,
    breakdown,
  }
})
