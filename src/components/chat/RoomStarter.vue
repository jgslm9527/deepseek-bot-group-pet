<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, Code2, Route, ScanSearch, ShieldCheck, Sparkles } from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import { ROLE_META } from '@/lib/constants'
import BotAvatar from '@/components/bots/BotAvatar.vue'

const chat = useChatStore()
const isDirect = computed(() => chat.activeRoom?.kind === 'direct')
const directBot = computed(() => chat.activeBots[0] ?? null)
const roleOrder = ['planner', 'reviewer', 'builder'] as const
const roleIcons = { planner: Route, reviewer: ScanSearch, builder: Code2 }
const starters = computed(() => {
  if (isDirect.value) {
    return [
      `帮我梳理一个本地 AI 产品的最小可行范围`,
      '复盘一下这个方案的状态机与失败路径',
      '给我一份可验证的两周实现路线',
    ]
  }
  const botNames = chat.activeBots.map((bot) => bot.name).slice(0, 3)
  return [
    `为我的下一个产品设计 MVP 方案，${botNames.join('、')} 一起评估风险`,
    '评审本地 SQLite + 多 Bot 协作方案，重点找状态机漏洞',
    '帮我规划一个可验证的 2 周实现路线，不要提前写代码',
  ]
})
const pipeline = computed(() =>
  roleOrder.map((role) => ({
    role,
    meta: ROLE_META[role],
    bot: chat.activeBots.find((bot) => bot.role === role) ?? null,
    icon: roleIcons[role],
  })),
)

function useStarter(text: string) {
  chat.draft = text
  setTimeout(() => document.querySelector<HTMLTextAreaElement>('[data-composer-input]')?.focus(), 80)
}
</script>

<template>
  <div class="room-starter">
    <template v-if="isDirect && directBot">
      <div class="flex items-center gap-2.5">
        <BotAvatar :bot="directBot" :size="38" />
        <div>
          <div class="starter-eyebrow !mb-0">Direct line</div>
          <h2 class="!text-[18px]">和 {{ directBot.name }} 直接对话</h2>
        </div>
      </div>
      <p class="starter-sub">
        这是一对一私聊，不会启动多 Bot 流水线。{{ directBot.name }} 仍会使用自己的人设、
        全局用户档案与筛选后的长期记忆来回复。
      </p>
      <div class="starter-prompts mt-4">
        <button v-for="text in starters" :key="text" class="starter-prompt" @click="useStarter(text)">
          <span>{{ text }}</span>
          <ArrowRight :size="10" class="shrink-0 opacity-45" />
        </button>
      </div>
      <div class="starter-guard">
        <ShieldCheck :size="12" />
        <span>直接回复 · 本地记忆隔离 · 关闭主窗口后在桌宠继续运行</span>
      </div>
    </template>

    <template v-else>
      <div class="starter-eyebrow"><Sparkles :size="10" /> Pipeline ready</div>
      <h2>把一条需求交给这支小队</h2>
      <p class="starter-sub">
        架构、评审、实现三种角色会按顺序接力讨论。全部闭环后自动停下，
        由你确认才进入最终代码生成。
      </p>

      <div class="starter-pipeline">
        <div v-for="(item, index) in pipeline" :key="item.role" class="starter-stage" :style="{ '--stage-accent': item.bot?.accent ?? 'var(--text-3)' }">
          <div class="starter-stage-dot">
            <component :is="item.icon" :size="13" :stroke-width="1.9" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="starter-stage-role">{{ item.meta.label }}</div>
            <div class="starter-stage-bot">
              <template v-if="item.bot">
                <BotAvatar :bot="item.bot" :size="15" />
                <span class="truncate">{{ item.bot.name }}</span>
              </template>
              <span v-else class="text-[var(--text-3)]">未加入此角色</span>
            </div>
          </div>
          <ArrowRight v-if="index < pipeline.length - 1" :size="11" class="starter-arrow" />
        </div>
      </div>

      <div class="starter-prompts">
        <button v-for="text in starters" :key="text" class="starter-prompt" @click="useStarter(text)">
          <span>{{ text }}</span>
          <ArrowRight :size="10" class="shrink-0 opacity-45" />
        </button>
      </div>

      <div class="starter-guard">
        <ShieldCheck :size="12" />
        <span>自动轮询有冷却与消息上限 · 讨论闭环后强制人工确认</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.room-starter {
  max-width: 570px;
  margin: 30px auto 12px;
  padding: 22px 22px 16px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background:
    radial-gradient(120% 100% at 50% -20%, var(--accent-faint), transparent 58%),
    color-mix(in srgb, var(--surface) 65%, transparent);
  box-shadow: var(--shadow-sm);
  animation: slide-fade-in 420ms cubic-bezier(0.16, 1, 0.3, 1);
}
.starter-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 8.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 650;
  color: var(--accent);
  margin-bottom: 8px;
}
.room-starter h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 680;
  letter-spacing: -0.025em;
  color: var(--text-1);
}
.starter-sub {
  margin: 6px 0 0;
  max-width: 480px;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--text-3);
}
.starter-pipeline {
  display: flex;
  align-items: stretch;
  gap: 5px;
  margin: 17px 0 14px;
}
.starter-stage {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  border-radius: 9px;
  padding: 7px 7px;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--stage-accent) 18%, var(--border));
}
.starter-stage-dot {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: color-mix(in srgb, var(--stage-accent) 82%, var(--text-1));
  background: color-mix(in srgb, var(--stage-accent) 12%, transparent);
}
.starter-stage-role {
  font-size: 9px;
  color: var(--text-3);
  line-height: 1.3;
}
.starter-stage-bot {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 560;
  margin-top: 1px;
  min-width: 0;
}
.starter-arrow {
  color: var(--text-3);
  opacity: 0.45;
  flex: 0 0 auto;
}
.starter-prompts {
  display: grid;
  gap: 5px;
}
.starter-prompt {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  text-align: left;
  font-size: 10.5px;
  color: var(--text-2);
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-2) 45%, transparent);
  border-radius: 8px;
  padding: 6px 9px;
  transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
}
.starter-prompt:hover {
  background: var(--surface);
  border-color: var(--border-strong);
  color: var(--text-1);
}
.starter-guard {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 13px;
  padding-top: 11px;
  border-top: 1px solid var(--border);
  font-size: 9px;
  color: var(--text-3);
}
@media (max-width: 1080px) {
  .starter-pipeline { flex-direction: column; }
  .starter-arrow { display: none; }
}
</style>
