<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Activity,
  BarChart3,
  Check,
  Cpu,
  Database,
  Eye,
  EyeOff,
  Fingerprint,
  Gauge,
  HardDrive,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-vue-next'
import type { SettingsTab } from '@/stores/ui'
import type { UsageBreakdown } from '@/types'
import { useSettingsStore } from '@/stores/settings'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import { CHAT_MODELS } from '@/types'
import { compactNumber } from '@/lib/time'
import { errorMessage } from '@/lib/tauri'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import SwitchControl from '@/components/ui/SwitchControl.vue'
import appIcon from '@/assets/app-icon.png'

const settings = useSettingsStore()
const chat = useChatStore()
const ui = useUiStore()
const open = computed({
  get: () => ui.settingsOpen,
  set: (value: boolean) => (ui.settingsOpen = value),
})
const activeTab = computed({
  get: () => ui.settingsTab,
  set: (value: SettingsTab) => (ui.settingsTab = value),
})
const apiKey = ref('')
const showKey = ref(false)
const message = reactive<{ tone: 'ok' | 'error' | ''; text: string }>({ tone: '', text: '' })
const testing = ref(false)
const savingApi = ref(false)
const savingProfile = ref(false)
const savingPrefs = ref(false)

const tabs = [
  { id: 'api', label: 'API 与模型', icon: KeyRound },
  { id: 'profile', label: '用户档案', icon: Fingerprint },
  { id: 'usage', label: '额度统计', icon: BarChart3 },
  { id: 'about', label: '关于', icon: Sparkles },
] as const

const maxGroupTokens = computed(() => {
  const list = settings.usage.byBot.map((row) => Number(row.total_tokens ?? 0))
  return Math.max(1, ...list)
})
const maxRoomTokens = computed(() => {
  const list = settings.usage.byRoom.map((row) => Number(row.total_tokens ?? 0))
  return Math.max(1, ...list)
})
const maxModelTokens = computed(() => {
  const list = settings.usage.byModel.map((row) => Number(row.total_tokens ?? 0))
  return Math.max(1, ...list)
})
const maxDayTokens = computed(() => {
  const list = settings.usage.daily.map((row) => Number(row.total ?? 0))
  return Math.max(1, ...list)
})

function botName(id: string | null): string {
  return chat.bots.find((bot) => bot.id === id)?.name ?? '未知 Bot'
}
function roomName(id: string | null): string {
  return chat.rooms.find((room) => room.id === id)?.name ?? '已删除会话'
}
function modelName(id: string | null): string {
  return CHAT_MODELS.find((model) => model.value === id)?.short ?? id ?? '未知模型'
}
function kindName(id: string | null): string {
  const labels: Record<string, string> = {
    chat: '主对话',
    memory_filter: '记忆筛选',
    memory_extract: '记忆抽取',
    final: '最终实现',
  }
  return labels[id ?? ''] ?? id ?? '其他'
}
function tokenRow(row: { total_tokens: number; prompt_tokens: number; completion_tokens: number }): UsageBreakdown {
  return {
    label: '',
    tokens: Number(row.total_tokens ?? 0),
    prompt: Number(row.prompt_tokens ?? 0),
    completion: Number(row.completion_tokens ?? 0),
    calls: 0,
  }
}

watch(
  () => ui.settingsOpen,
  async (isOpen) => {
    if (!isOpen) return
    apiKey.value = ''
    message.tone = ''
    message.text = ''
    await settings.load()
    if (ui.settingsTab === 'usage') await settings.loadUsage()
  },
)
watch(
  () => ui.settingsTab,
  async (tab) => {
    if (tab === 'usage' && ui.settingsOpen) await settings.loadUsage()
  },
)

async function saveApi() {
  if (!apiKey.value.trim() && !settings.api.hasKey) {
    message.tone = 'error'
    message.text = '请先填写 DeepSeek API Key。'
    return
  }
  savingApi.value = true
  message.tone = ''
  try {
    await settings.saveApi({
      apiKey: apiKey.value.trim() || undefined,
      baseUrl: settings.api.baseUrl,
    })
    apiKey.value = ''
    message.tone = 'ok'
    message.text = 'API 配置已保存到本机配置文件。'
    ui.toast('API 配置已保存', undefined, 'success')
  } catch (error) {
    message.tone = 'error'
    message.text = errorMessage(error)
    ui.toast('保存失败', errorMessage(error), 'error')
  } finally {
    savingApi.value = false
  }
}

async function testApi() {
  testing.value = true
  message.tone = ''
  try {
    await saveApi()
    const reply = await settings.testApi()
    message.tone = 'ok'
    message.text = `连接成功，DeepSeek 回复：${reply}`
  } catch (error) {
    message.tone = 'error'
    message.text = errorMessage(error)
  } finally {
    testing.value = false
  }
}

async function clearKey() {
  const okay = await ui.askConfirm({
    title: '清除本机 API Key？',
    description: '清除后 Bot 将无法调用 DeepSeek，聊天记录和记忆不会被删除。',
    confirmText: '清除 Key',
    tone: 'danger',
  })
  if (!okay) return
  await settings.saveApi({ clearApiKey: true })
  message.tone = 'ok'
  message.text = 'API Key 已从本机配置文件清除。'
}

async function saveProfile() {
  savingProfile.value = true
  try {
    await settings.updateProfile(settings.profile)
    ui.toast('用户档案已保存', '所有 Bot 现在都能读取这份偏好。', 'success')
  } catch (error) {
    ui.toast('保存失败', errorMessage(error), 'error')
  } finally {
    savingProfile.value = false
  }
}

async function savePreferences() {
  savingPrefs.value = true
  try {
    await settings.updatePreferences({
      maxContextTokens: Number(settings.app.maxContextTokens),
      defaultTimeoutSecs: Number(settings.app.defaultTimeoutSecs),
      autoMemoryGlobal: settings.app.autoMemoryGlobal,
    })
    ui.toast('偏好已保存', undefined, 'success')
  } finally {
    savingPrefs.value = false
  }
}

function setTab(tab: SettingsTab) {
  activeTab.value = tab
}
</script>

<template>
  <BaseDialog
    :open="open"
    title="设置"
    description="所有数据保存在本机。只有调用模型时会访问 DeepSeek API。"
    size="xl"
    @update:open="open = $event"
  >
    <div class="settings-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="settings-tab"
        :class="{ active: activeTab === tab.id }"
        @click="setTab(tab.id)"
      >
        <component :is="tab.icon" :size="11" class="mr-1 inline" />
        {{ tab.label }}
      </button>
    </div>

    <template v-if="activeTab === 'api'">
      <div class="settings-api-status">
        <span
          class="flex h-5 w-5 items-center justify-center rounded-full"
          :style="{
            background: settings.api.hasKey ? 'color-mix(in srgb, var(--success) 13%, transparent)' : 'var(--danger-soft)',
            color: settings.api.hasKey ? 'var(--success)' : 'var(--danger)',
          }"
        >
          <Check v-if="settings.api.hasKey" :size="11" :stroke-width="2.5" />
          <KeyRound v-else :size="10" />
        </span>
        <span class="flex-1">
          {{ settings.api.hasKey ? `已配置 DeepSeek API Key ${settings.api.keyHint}` : '尚未配置 API Key' }}
        </span>
        <span class="text-[9.5px] text-[var(--text-3)]">仅保存在本机 config.json</span>
      </div>

      <div class="form-stack">
        <label class="form-field">
          <span class="form-label">DeepSeek API Key</span>
          <div class="relative">
            <input
              v-model="apiKey"
              class="input pr-9"
              :type="showKey ? 'text' : 'password'"
              placeholder="sk-…（留空则保持当前 Key）"
              autocomplete="off"
              spellcheck="false"
            />
            <button
              class="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-3)] hover:bg-[var(--hover)]"
              type="button"
              :aria-label="showKey ? '隐藏密钥' : '显示密钥'"
              @click="showKey = !showKey"
            >
              <EyeOff v-if="showKey" :size="13" />
              <Eye v-else :size="13" />
            </button>
          </div>
          <span class="form-hint">密钥只会传给 Rust 后端发起请求，不会写入前端代码或 SQLite。</span>
        </label>

        <label class="form-field">
          <span class="form-label">API Base URL</span>
          <input v-model="settings.api.baseUrl" class="input font-mono !text-[11px]" placeholder="https://api.deepseek.com" spellcheck="false" />
          <span class="form-hint">默认 https://api.deepseek.com；使用兼容网关时可替换。</span>
        </label>

        <div v-if="message.text" class="rounded-lg border px-3 py-2 text-[11px] leading-relaxed" :style="{
          borderColor: message.tone === 'error' ? 'color-mix(in srgb, var(--danger) 22%, transparent)' : 'color-mix(in srgb, var(--success) 22%, transparent)',
          background: message.tone === 'error' ? 'var(--danger-soft)' : 'color-mix(in srgb, var(--success) 8%, transparent)',
          color: message.tone === 'error' ? 'var(--danger)' : 'var(--success)',
        }">
          {{ message.text }}
        </div>

        <div class="flex items-center gap-2">
          <button class="primary-btn" :disabled="savingApi" @click="saveApi">保存 API 配置</button>
          <button class="secondary-btn" :disabled="testing || (!settings.api.hasKey && !apiKey.trim())" @click="testApi">
            <RefreshCw :size="12" :class="{ 'animate-spin': testing }" />
            {{ testing ? '测试中…' : '测试连接' }}
          </button>
          <button v-if="settings.api.hasKey" class="ml-auto text-[10.5px] text-[var(--text-3)] hover:text-[var(--danger)]" @click="clearKey">
            清除 Key
          </button>
        </div>

        <div class="h-px bg-[var(--border)]" />

        <div class="flex items-center gap-2">
          <Cpu :size="13" class="text-[var(--text-3)]" />
          <span class="text-[12px] font-semibold">请求与上下文</span>
        </div>
        <div class="settings-block space-y-1 !p-0">
          <div class="detail-field px-3">
            <div>
              <div class="toggle-line-label">单次上下文上限</div>
              <div class="toggle-line-hint">按估算 token 截断短期上下文，避免单次请求过载</div>
            </div>
            <div class="flex items-center gap-1">
              <input v-model.number="settings.app.maxContextTokens" class="mini-number !w-[68px]" type="number" min="2000" max="64000" step="1000" />
              <span class="text-[9px] text-[var(--text-3)]">tokens</span>
            </div>
          </div>
          <div class="h-px bg-[var(--border)]" />
          <div class="detail-field px-3">
            <div>
              <div class="toggle-line-label">API 超时保护</div>
              <div class="toggle-line-hint">超时后停止等待，并中断自动轮询</div>
            </div>
            <div class="flex items-center gap-1">
              <input v-model.number="settings.app.defaultTimeoutSecs" class="mini-number" type="number" min="20" max="300" />
              <span class="text-[9px] text-[var(--text-3)]">秒</span>
            </div>
          </div>
          <div class="h-px bg-[var(--border)]" />
          <div class="detail-field px-3">
            <div>
              <div class="toggle-line-label">全局自动记忆</div>
              <div class="toggle-line-hint">关闭后所有 Bot 都停止后台记忆抽取，但保留已有记忆</div>
            </div>
            <SwitchControl v-model="settings.app.autoMemoryGlobal" label="自动记忆" />
          </div>
        </div>
        <div class="flex justify-end">
          <button class="secondary-btn" :disabled="savingPrefs" @click="savePreferences">保存请求偏好</button>
        </div>

        <div class="guard-notice !my-0">
          <ShieldCheck :size="14" class="mt-0.5 shrink-0 text-[var(--accent)]" />
          <span>
            API Key 保存在 <code class="font-mono text-[10px]">~/Library/Application Support/com.deepseek.grouppet/config.json</code>，
            权限为仅当前用户可读写。源码仓库的 <code class="font-mono text-[10px]">.gitignore</code> 已排除本地配置。
          </span>
        </div>
      </div>
    </template>

    <template v-else-if="activeTab === 'profile'">
      <div class="mb-3 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-faint)] text-[var(--accent)]">
          <UserRound :size="16" />
        </span>
        <div>
          <div class="text-[12px] font-semibold">全局用户档案</div>
          <p class="m-0 mt-1 text-[10.5px] leading-relaxed text-[var(--text-3)]">
            这里的固定偏好会随每次正式请求一起发送给所有 Bot，例如工作习惯、技术偏好、沟通方式。
            长期项目规则交给 Bot 独立记忆，临时问答不要写在这里。
          </p>
        </div>
      </div>
      <textarea
        v-model="settings.profile"
        class="input !min-h-[250px] !text-[12px] !leading-relaxed"
        placeholder="例如：我使用 macOS，偏好简洁可维护的方案；回答使用中文；破坏性操作前先确认…"
      />
      <div class="mt-3 flex items-center justify-between">
        <span class="text-[9.5px] text-[var(--text-3)]">{{ settings.profile.length }} 字 · 所有 Bot 默认可读</span>
        <button class="primary-btn" :disabled="savingProfile" @click="saveProfile">保存用户档案</button>
      </div>
    </template>

    <template v-else-if="activeTab === 'usage'">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <div class="text-[12px] font-semibold">Token 消耗</div>
          <div class="text-[10px] text-[var(--text-3)]">按本地记录统计，包含主对话、记忆筛选与抽取、最终实现</div>
        </div>
        <button class="secondary-btn !py-1 !text-[10.5px]" :disabled="settings.usageLoading" @click="settings.loadUsage">
          <RefreshCw :size="11" :class="{ 'animate-spin': settings.usageLoading }" /> 刷新
        </button>
      </div>
      <div class="usage-hero">
        <div class="usage-stat">
          <div class="usage-stat-value">{{ compactNumber(settings.usage.total) }}</div>
          <div class="usage-stat-label">累计 Tokens</div>
        </div>
        <div class="usage-stat">
          <div class="usage-stat-value">{{ compactNumber(settings.usage.today) }}</div>
          <div class="usage-stat-label">今日 Tokens</div>
        </div>
        <div class="usage-stat">
          <div class="usage-stat-value">{{ settings.usage.calls }}</div>
          <div class="usage-stat-label">API 调用次数</div>
        </div>
      </div>

      <div v-if="!settings.usage.total && !settings.usageLoading" class="py-10 text-center text-[11px] text-[var(--text-3)]">
        还没有调用记录。发送一条消息后，这里会按 Bot、房间和模型汇总额度消耗。
      </div>

      <div v-else class="grid grid-cols-2 gap-x-6">
        <section>
          <div class="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[var(--text-3)]">
            <Activity :size="11" /> 按 Bot
          </div>
          <div v-for="row in settings.usage.byBot" :key="row.key ?? 'unknown'" class="usage-bar-row">
            <div class="usage-bar-meta"><span>{{ botName(row.key) }}</span><span class="font-mono">{{ compactNumber(row.total_tokens) }}</span></div>
            <div class="usage-bar-track"><div class="usage-bar-fill" :style="{ width: `${Math.max(2, (row.total_tokens / maxGroupTokens) * 100)}%` }" /></div>
          </div>
        </section>
        <section>
          <div class="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[var(--text-3)]">
            <Database :size="11" /> 按房间
          </div>
          <div v-for="row in settings.usage.byRoom" :key="row.key ?? 'unknown'" class="usage-bar-row">
            <div class="usage-bar-meta"><span class="truncate">{{ roomName(row.key) }}</span><span class="font-mono">{{ compactNumber(row.total_tokens) }}</span></div>
            <div class="usage-bar-track"><div class="usage-bar-fill" :style="{ width: `${Math.max(2, (row.total_tokens / maxRoomTokens) * 100)}%` }" /></div>
          </div>
        </section>
        <section class="mt-3">
          <div class="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[var(--text-3)]">
            <Cpu :size="11" /> 按模型
          </div>
          <div v-for="row in settings.usage.byModel" :key="row.key ?? 'unknown'" class="usage-bar-row">
            <div class="usage-bar-meta"><span>{{ modelName(row.key) }}</span><span class="font-mono">{{ compactNumber(row.total_tokens) }}</span></div>
            <div class="usage-bar-track"><div class="usage-bar-fill" :style="{ width: `${Math.max(2, (row.total_tokens / maxModelTokens) * 100)}%` }" /></div>
          </div>
        </section>
        <section class="mt-3">
          <div class="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[var(--text-3)]">
            <Gauge :size="11" /> 按调用类型
          </div>
          <div v-for="row in settings.usage.byKind" :key="row.key ?? 'unknown'" class="usage-bar-row">
            <div class="usage-bar-meta"><span>{{ kindName(row.key) }}</span><span class="font-mono">{{ compactNumber(row.total_tokens) }}</span></div>
            <div class="usage-bar-track"><div class="usage-bar-fill" :style="{ width: `${Math.max(2, (row.total_tokens / Math.max(1, ...settings.usage.byKind.map((r) => r.total_tokens))) * 100)}%` }" /></div>
          </div>
        </section>
      </div>

      <div v-if="settings.usage.daily.length" class="mt-4">
        <div class="mb-2 text-[10px] font-semibold tracking-wider text-[var(--text-3)]">近 14 天用量</div>
        <div class="flex h-[70px] items-end gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-2">
          <div
            v-for="day in [...settings.usage.daily].reverse()"
            :key="day.day"
            class="group flex h-full flex-1 flex-col justify-end"
            :title="`${day.day} · ${day.total} tokens`"
          >
            <div class="w-full rounded-sm bg-[var(--accent)] opacity-60 transition group-hover:opacity-100" :style="{ height: `${Math.max(2, (day.total / maxDayTokens) * 100)}%` }" />
          </div>
        </div>
        <div class="mt-1 flex justify-between font-mono text-[8.5px] text-[var(--text-3)]">
          <span>{{ settings.usage.daily[settings.usage.daily.length - 1]?.day }}</span>
          <span>{{ settings.usage.daily[0]?.day }}</span>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="flex items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <img :src="appIcon" alt="" class="h-16 w-16 rounded-[18px] shadow-md" />
        <div class="min-w-0">
          <div class="text-[16px] font-bold tracking-tight">DeepSeek Bot Group Pet</div>
          <div class="text-[10px] text-[var(--text-3)]">v1.0.0 · macOS 本地 AI 客户端</div>
          <p class="m-0 mt-2 text-[10.5px] leading-relaxed text-[var(--text-2)]">
            多个 Bot 在同群按角色流水线协作；讨论闭环后强制人工确认。
            内置 Muse 风格三层记忆，全部使用普通 SQLite 文本，不使用向量库或本地 Embedding。
          </p>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="settings-block !p-3">
          <div class="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold"><HardDrive :size="12" /> 本地数据</div>
          <ul class="m-0 list-disc space-y-1 pl-4 text-[9.5px] leading-relaxed text-[var(--text-3)]">
            <li>聊天记录、Bot 人设、记忆：SQLite</li>
            <li>数据库位于 App 配置目录 <code class="font-mono">deepseek-pet.db</code></li>
            <li>API Key：本机 config.json，权限 0600</li>
            <li>不上传聊天记录到任何第三方服务</li>
          </ul>
        </div>
        <div class="settings-block !p-3">
          <div class="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold"><Sparkles :size="12" /> 协作流水线</div>
          <ol class="m-0 list-decimal space-y-1 pl-4 text-[9.5px] leading-relaxed text-[var(--text-3)]">
            <li>Chat 架构师拆解需求、输出方案</li>
            <li>R1 评审漏洞与边界并推演优化</li>
            <li>Flash / V4 Pro 准备落地计划</li>
            <li>自动停下，等待你确认后写代码</li>
          </ol>
        </div>
      </div>

      <div class="mt-3 settings-block !p-3">
        <div class="text-[10px] font-semibold tracking-wider text-[var(--text-3)]">开源技术栈</div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <span v-for="tech in ['Tauri 2', 'Vue 3', 'TypeScript', 'SQLite', 'UnoCSS', 'Motion Vue', 'Reka UI', 'Lucide']" :key="tech" class="pill">{{ tech }}</span>
        </div>
        <p class="m-0 mt-2 text-[9px] leading-relaxed text-[var(--text-3)]">
          所有依赖均为免费开源软件（MIT / Apache-2.0 等）。没有付费 UI 组件或带水印素材。
          桌宠形象与应用图标由本地代码绘制。
        </p>
      </div>

      <div class="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[9.5px] text-[var(--text-3)]">
        <ShieldCheck :size="12" class="text-[var(--success)]" />
        关闭主窗口只会隐藏界面，桌宠与应用继续在后台运行。右键桌宠选择「退出应用」可完全退出。
      </div>
    </template>
  </BaseDialog>
</template>
