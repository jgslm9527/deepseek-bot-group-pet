<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowRight, MessageSquareReply, ShieldCheck, Sparkles } from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import BaseDialog from '@/components/ui/BaseDialog.vue'

const chat = useChatStore()
const ui = useUiStore()
const feedback = ref('')

const open = computed({
  get: () => chat.showConfirmationDialog,
  set: (value: boolean) => {
    if (!value) chat.dismissConfirmation()
  },
})

const builder = computed(
  () => chat.activeBots.find((bot) => bot.role === 'builder' && !bot.muted) ?? null,
)
const roomBotNames = computed(() => chat.activeBots.map((bot) => bot.name).join('、'))
const lastReview = computed(() => {
  const reviews = chat.messages.filter(
    (message) => message.senderType === 'bot' && message.meta?.kind === 'review',
  )
  const message = reviews[reviews.length - 1]
  if (!message) return ''
  const content = message.content.replace(/\s+/g, ' ').trim()
  return content.length > 420 ? `${content.slice(0, 420)}…` : content
})
const request = computed(() => chat.activeDiscussion?.request ?? '')

watch(
  () => chat.showConfirmationDialog,
  (isOpen) => {
    if (isOpen) feedback.value = ''
  },
)

async function approve() {
  await chat.confirmImplementation()
}

async function reject() {
  await chat.rejectDiscussion(feedback.value)
  feedback.value = ''
}
</script>

<template>
  <BaseDialog
    :open="open"
    title="讨论已闭环"
    description="这是人工确认关口。确认前，实现 Bot 不会生成最终代码。"
    size="lg"
    @update:open="open = $event"
  >
    <div class="discussion-summary">
      <div class="mb-1 text-[9.5px] font-semibold uppercase tracking-widest text-[var(--text-3)]">本轮需求</div>
      <div class="whitespace-pre-wrap">{{ request || '（未记录需求）' }}</div>
    </div>

    <div class="mb-3 flex flex-wrap items-center gap-1.5">
      <span class="pill accent"><Sparkles :size="10" /> {{ chat.activeDiscussion?.turnCount }} 轮发言</span>
      <span class="pill">{{ roomBotNames }}</span>
      <span class="pill" :class="builder ? 'accent' : 'warn'">
        实现 Bot：{{ builder?.name ?? '缺少实现角色' }}
      </span>
    </div>

    <div v-if="lastReview" class="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <div class="mb-1 text-[9.5px] font-semibold uppercase tracking-widest text-[var(--text-3)]">最近一次评审结论</div>
      <p class="m-0 line-clamp-4 text-[11px] leading-relaxed text-[var(--text-2)]">{{ lastReview }}</p>
    </div>

    <div class="guard-notice">
      <ShieldCheck :size="15" class="mt-0.5 shrink-0 text-[var(--accent)]" />
      <span>
        点击确认后，仅会在本机生成代码文本与文件清单，不会自动执行任何命令。
        若仍需调整，请在下方填写修改意见并驳回。
      </span>
    </div>

    <label class="form-field mt-3">
      <span class="form-label"><MessageSquareReply :size="11" /> 驳回并继续讨论（可选）</span>
      <textarea
        v-model="feedback"
        class="input !min-h-[68px]"
        placeholder="例如：不要使用外部数据库，所有数据必须保存在本地 SQLite…"
      />
      <span class="form-hint">留空驳回时会回到输入框，你可以补充更完整的需求。</span>
    </label>

    <div v-if="!builder" class="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--warning)_9%,transparent)] px-3 py-2 text-[10.5px] leading-relaxed text-[var(--warning)]">
      当前房间没有可用的实现 Bot。请在右侧添加一个 Flash V4 或 V4 Pro 角色的 Bot，或取消静音。
    </div>

    <template #footer>
      <button class="secondary-btn" @click="reject">
        {{ feedback.trim() ? '驳回并继续讨论' : '先回到讨论' }}
      </button>
      <button class="primary-btn" :disabled="!builder" @click="approve">
        <ShieldCheck :size="13" />
        确认开始实现
        <ArrowRight :size="12" />
      </button>
    </template>
  </BaseDialog>
</template>
