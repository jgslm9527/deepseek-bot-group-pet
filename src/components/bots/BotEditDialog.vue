<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Bot as BotIcon, BrainCircuit, Sparkles, Trash2, UserMinus } from 'lucide-vue-next'
import type { Bot, BotRole, ChatModel, MemoryScope } from '@/types'
import { CHAT_MODELS } from '@/types'
import { BOT_ACCENTS, BOT_EMOJIS, DEFAULT_SYSTEM_PROMPTS, MODEL_LABELS, ROLE_META } from '@/lib/constants'
import { roleForModel } from '@/lib/repos/bots'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import SwitchControl from '@/components/ui/SwitchControl.vue'

const chat = useChatStore()
const ui = useUiStore()
const open = computed({
  get: () => ui.botEditor.open,
  set: (value: boolean) => {
    if (!value) ui.closeBotEditor()
  },
})
const editing = computed(() => {
  if (!ui.botEditor.botId) return null
  return chat.bots.find((bot) => bot.id === ui.botEditor.botId) ?? null
})
const isCreate = computed(() => ui.botEditor.mode === 'create')

const form = reactive({
  name: '',
  avatar: '🤖',
  accent: BOT_ACCENTS[0],
  systemPrompt: '',
  model: 'deepseek-chat' as ChatModel,
  temperature: 0.7,
  maxTokens: 4096,
  autoMemory: true,
  shareMemories: false,
  memoryScope: 'all' as MemoryScope,
  memoryLimit: 30,
  muted: false,
})
const saving = reactive({ value: false })
const role = computed<BotRole>(() => roleForModel(form.model))
const roleMeta = computed(() => ROLE_META[role.value])

function reset(bot: Bot | null) {
  form.name = bot?.name ?? ''
  form.avatar = bot?.avatar ?? BOT_EMOJIS[Math.floor(Math.random() * BOT_EMOJIS.length)]
  form.accent = bot?.accent ?? BOT_ACCENTS[Math.floor(Math.random() * BOT_ACCENTS.length)]
  form.systemPrompt = bot?.systemPrompt ?? DEFAULT_SYSTEM_PROMPTS.planner
  form.model = bot?.model ?? 'deepseek-chat'
  form.temperature = bot?.temperature ?? 0.7
  form.maxTokens = bot?.maxTokens ?? 4096
  form.autoMemory = bot?.autoMemory ?? true
  form.shareMemories = bot?.shareMemories ?? false
  form.memoryScope = bot?.memoryScope ?? 'all'
  form.memoryLimit = bot?.memoryLimit ?? 30
  form.muted = bot?.muted ?? false
}

watch(
  () => [ui.botEditor.open, ui.botEditor.botId, chat.bots.length] as const,
  ([isOpen]) => {
    if (!isOpen) return
    void chat.refreshBots().then(() => reset(editing.value))
  },
  { immediate: true },
)

function changeModel(nextModel: ChatModel) {
  const previousRole = roleForModel(form.model)
  const nextRole = roleForModel(nextModel)
  const currentDefault = DEFAULT_SYSTEM_PROMPTS[previousRole]
  if (!form.systemPrompt.trim() || form.systemPrompt === currentDefault) {
    form.systemPrompt = DEFAULT_SYSTEM_PROMPTS[nextRole]
  }
  form.model = nextModel
}

async function save() {
  if (!form.name.trim()) {
    ui.toast('无法保存', '请给 Bot 一个名称。', 'error')
    return
  }
  if (form.systemPrompt.trim().length < 10) {
    ui.toast('人设太短', '建议至少写 10 个字的 System 人设。', 'error')
    return
  }
  saving.value = true
  try {
    const saved = await chat.saveBotProfile(
      {
        name: form.name.trim(),
        avatar: form.avatar,
        accent: form.accent,
        systemPrompt: form.systemPrompt.trim(),
        model: form.model,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
        autoMemory: form.autoMemory,
        shareMemories: form.shareMemories,
        memoryScope: form.memoryScope,
        memoryLimit: form.memoryLimit,
      },
      editing.value?.id ?? null,
      ui.botEditor.addToRoomId ?? null,
    )
    if (saved && saved.muted !== form.muted) {
      await chat.toggleBotMute(saved)
    }
  } catch (error) {
    ui.toast('保存 Bot 失败', String(error), 'error')
  } finally {
    saving.value = false
  }
}

async function remove() {
  const bot = editing.value
  if (!bot) return
  ui.closeBotEditor()
  await chat.deleteBot(bot)
}

async function removeFromRoom() {
  const bot = editing.value
  const room = chat.activeRoom
  if (!bot || !room) return
  const okay = await ui.askConfirm({
    title: `将「${bot.name}」移出当前群？`,
    description: 'Bot 本身和长期记忆都会保留，只是不再参与本群流水线。',
    confirmText: '移出本群',
    tone: 'danger',
  })
  if (!okay) return
  ui.closeBotEditor()
  await chat.removeMember(room.id, bot)
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="isCreate ? '创建 Bot' : `编辑「${editing?.name ?? 'Bot'}」`"
    description="每个 Bot 拥有独立人设、模型参数和长期记忆；模型决定它在流水线中的角色。"
    size="lg"
    @update:open="open = $event"
  >
    <div class="grid grid-cols-[192px_1fr] gap-5">
      <aside class="space-y-3">
        <div class="bot-preview">
          <div
            class="bot-preview-avatar"
            :style="{
              background: `linear-gradient(145deg, color-mix(in srgb, ${form.accent} 72%, white), ${form.accent} 55%, color-mix(in srgb, ${form.accent} 70%, #08102a))`,
            }"
          >{{ form.avatar }}</div>
          <div class="mt-2 max-w-full truncate text-[14px] font-semibold">{{ form.name || '未命名 Bot' }}</div>
          <div class="mt-0.5 text-[10px] text-[var(--text-3)]">{{ roleMeta.label }} · {{ MODEL_LABELS[form.model] }}</div>
          <div class="mt-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[9.5px] leading-relaxed text-[var(--text-3)]">
            {{ roleMeta.description }}
          </div>
        </div>

        <div class="form-field">
          <span class="form-label">头像</span>
          <div class="emoji-picker">
            <button
              v-for="emoji in BOT_EMOJIS"
              :key="emoji"
              class="emoji-choice"
              :class="{ selected: form.avatar === emoji }"
              @click="form.avatar = emoji"
            >{{ emoji }}</button>
          </div>
        </div>

        <div class="form-field">
          <span class="form-label">主题色</span>
          <div class="color-row">
            <button
              v-for="color in BOT_ACCENTS"
              :key="color"
              class="color-choice"
              :class="{ selected: form.accent === color }"
              :style="{ background: color }"
              :aria-label="color"
              @click="form.accent = color"
            />
          </div>
        </div>

        <div v-if="!isCreate" class="space-y-1 pt-1">
          <button
            v-if="chat.activeRoom?.kind === 'group' && chat.activeBots.some((item) => item.id === editing?.id)"
            class="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[10.5px] text-[var(--text-3)] hover:bg-[var(--hover)] hover:text-[var(--text-1)]"
            @click="removeFromRoom"
          >
            <UserMinus :size="11" /> 移出当前群
          </button>
          <button class="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[10.5px] text-[var(--text-3)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]" @click="remove">
            <Trash2 :size="11" /> 删除此 Bot
          </button>
        </div>
      </aside>

      <div class="form-stack">
        <div class="form-grid-2">
          <label class="form-field">
            <span class="form-label"><BotIcon :size="11" /> 名称</span>
            <input v-model="form.name" class="input" maxlength="24" placeholder="例如：小深" />
          </label>
          <label class="form-field">
            <span class="form-label"><Sparkles :size="11" /> 模型版本</span>
            <select
              :value="form.model"
              class="input"
              @change="changeModel(($event.target as HTMLSelectElement).value as ChatModel)"
            >
              <option v-for="model in CHAT_MODELS" :key="model.value" :value="model.value">
                {{ model.label }} · {{ ROLE_META[model.role].label }}
              </option>
            </select>
          </label>
        </div>

        <label class="form-field">
          <span class="form-label"><BrainCircuit :size="11" /> System 人设提示词</span>
          <textarea
            v-model="form.systemPrompt"
            class="input !min-h-[120px]"
            maxlength="6000"
            placeholder="描述这个 Bot 的职责、语气和工作边界…"
          />
          <span class="form-hint">{{ form.systemPrompt.length }} / 6000 · 会与用户档案、筛选后的记忆和短期上下文一起发送。</span>
        </label>

        <div class="form-grid-2">
          <label class="form-field">
            <span class="form-label">温度 · {{ form.temperature.toFixed(2) }}</span>
            <input v-model.number="form.temperature" class="range-input" type="range" min="0" max="1.5" step="0.05" />
            <span class="form-hint">越低越稳定，方案与评审建议 0.3–0.7。</span>
          </label>
          <label class="form-field">
            <span class="form-label">最大输出 Token</span>
            <input v-model.number="form.maxTokens" class="input" type="number" min="256" max="8192" step="256" />
            <span class="form-hint">代码实现建议 6000–8192。</span>
          </label>
        </div>

        <div class="memory-settings !mb-0">
          <div class="memory-setting-row">
            <span>静音此 Bot（不参与自动发言）</span>
            <SwitchControl v-model="form.muted" label="静音" />
          </div>
          <div class="memory-setting-row">
            <span>自动抽取长期记忆</span>
            <SwitchControl v-model="form.autoMemory" label="自动记忆" />
          </div>
          <div class="memory-setting-row">
            <span>允许本群其他 Bot 读取我的记忆</span>
            <SwitchControl v-model="form.shareMemories" label="共享记忆" />
          </div>
          <div class="memory-setting-row">
            <span>记忆读取范围</span>
            <select v-model="form.memoryScope" class="mini-number !w-[80px]">
              <option value="all">全部房间</option>
              <option value="room">仅本房间</option>
            </select>
          </div>
          <div class="memory-setting-row">
            <span>记忆上限</span>
            <input v-model.number="form.memoryLimit" class="mini-number" type="number" min="5" max="200" />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="mr-auto text-[9.5px] text-[var(--text-3)]">
        {{ isCreate ? '保存后即可加入会话' : '修改会同步到所有加入该 Bot 的会话' }}
      </div>
      <button class="secondary-btn" @click="open = false">取消</button>
      <button class="primary-btn" :disabled="saving.value" @click="save">
        {{ saving.value ? '保存中…' : isCreate ? '创建 Bot' : '保存修改' }}
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.bot-preview {
  border: 1px solid var(--border);
  border-radius: 12px;
  background:
    radial-gradient(120% 80% at 50% 0%, var(--accent-faint), transparent 65%),
    color-mix(in srgb, var(--surface-2) 70%, transparent);
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.bot-preview-avatar {
  width: 66px;
  height: 66px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 31px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 10px 24px rgba(10, 20, 44, 0.18);
}
.range-input {
  width: 100%;
  height: 22px;
  accent-color: var(--accent);
}
</style>
