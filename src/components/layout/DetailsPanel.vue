<script setup lang="ts">
import { computed } from 'vue'
import {
  Clock3,
  MemoryStick,
  MessageCircleMore,
  Plus,
  Trash2,
  UserMinus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import { MODEL_LABELS, ROLE_META } from '@/lib/constants'
import BotAvatar from '@/components/bots/BotAvatar.vue'
import GroupAvatar from '@/components/bots/GroupAvatar.vue'
import UserAvatar from '@/components/chat/UserAvatar.vue'
import SwitchControl from '@/components/ui/SwitchControl.vue'
import MemoryPanel from '@/components/memory/MemoryPanel.vue'

const chat = useChatStore()
const ui = useUiStore()

const room = computed(() => chat.activeRoom)
const isGroup = computed(() => room.value?.kind === 'group')
const autoPoll = computed({
  get: () => !!room.value?.autoPoll,
  set: (value: boolean) => void chat.setAutoPoll(value),
})
const allowMentions = computed({
  get: () => !!room.value?.allowBotMentions,
  set: (value: boolean) => void chat.setAllowBotMentions(value),
})

function updateNumber(
  key: 'cooldownSeconds' | 'maxAutoMessages' | 'contextMessages',
  event: Event,
  min: number,
  max: number,
) {
  const input = event.target as HTMLInputElement
  const value = Math.max(min, Math.min(max, Math.round(Number(input.value) || min)))
  input.value = String(value)
  void chat.patchRoomSettings({ [key]: value })
}

async function unmute(botId: string) {
  const bot = chat.activeBots.find((item) => item.id === botId)
  if (bot) await chat.toggleBotMute(bot)
}

async function remove(botId: string) {
  const bot = chat.activeBots.find((item) => item.id === botId)
  if (!bot) return
  const okay = await ui.askConfirm({
    title: `将「${bot.name}」移出房间？`,
    description: 'Bot 本身和它的记忆不会删除，只是不再参与本房间讨论。',
    confirmText: '移出房间',
    tone: 'danger',
  })
  if (okay) await chat.removeMember(room.value!.id, bot)
}
</script>

<template>
  <aside v-if="room" class="details-pane">
    <div class="details-head" data-tauri-drag-region>
      <div class="flex items-center gap-2">
        <span class="details-title">{{ isGroup ? '群聊详情' : '私聊详情' }}</span>
        <span class="pill !px-1.5 !py-0.5 !text-[9px]">{{ chat.activeBots.length + 1 }} 人</span>
      </div>
      <button class="icon-btn" title="关闭详情" @click="ui.detailsOpen = false">
        <X :size="15" />
      </button>
    </div>

    <div class="details-tabs">
      <button class="details-tab" :class="{ active: ui.detailsTab === 'members' }" @click="ui.detailsTab = 'members'">
        <Users :size="12" /> 成员
      </button>
      <button class="details-tab" :class="{ active: ui.detailsTab === 'memory' }" @click="ui.detailsTab = 'memory'">
        <MemoryStick :size="12" /> 记忆
      </button>
    </div>

    <div class="details-scroll">
      <template v-if="ui.detailsTab === 'members'">
        <div class="mb-4 flex flex-col items-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_62%,transparent)] px-4 py-4 text-center">
          <div class="mb-2 flex -space-x-2">
            <GroupAvatar v-if="isGroup" :bots="chat.activeBots" :size="46" />
            <BotAvatar v-else-if="chat.activeBots[0]" :bot="chat.activeBots[0]" :size="46" />
          </div>
          <div class="max-w-full truncate text-[13px] font-semibold">{{ room.name }}</div>
          <div class="mt-0.5 text-[10px] text-[var(--text-3)]">
            {{ isGroup ? '多 Bot 流水线协作空间' : '一对一长期对话' }}
          </div>
          <div class="mt-2 flex items-center gap-1">
            <span v-for="bot in chat.activeBots.slice(0, 4)" :key="bot.id" :title="bot.name">
              <BotAvatar :bot="bot" :size="19" />
            </span>
            <span v-if="chat.activeBots.length > 4" class="text-[9px] text-[var(--text-3)]">+{{ chat.activeBots.length - 4 }}</span>
          </div>
        </div>

        <section class="detail-section">
          <h3 class="detail-section-title">成员 · {{ chat.activeBots.length + 1 }}</h3>
          <div class="me-card">
            <UserAvatar :size="32" />
            <div class="min-w-0 flex-1">
              <div class="member-name">我 <span class="pill !py-0 !text-[8px]">owner</span></div>
              <div class="member-role">本地工作区</div>
            </div>
          </div>

          <button
            v-for="bot in chat.activeBots"
            :key="bot.id"
            class="member-card"
            @click="ui.openBotEditor(bot.id)"
          >
            <BotAvatar :bot="bot" :size="32" :muted="bot.muted" />
            <div class="min-w-0 flex-1">
              <div class="member-name">
                <span class="truncate">{{ bot.name }}</span>
                <span v-if="bot.muted" class="text-[var(--text-3)]"><VolumeX :size="10" /></span>
              </div>
              <div class="member-role truncate">
                {{ ROLE_META[bot.role].label }} · {{ MODEL_LABELS[bot.model] }}
                <span v-if="bot.autoMemory"> · 记忆</span>
              </div>
            </div>
            <div class="member-actions">
              <button
                class="icon-btn !h-6 !w-6"
                :title="bot.muted ? '取消静音' : '静音'"
                @click.stop="chat.toggleBotMute(bot)"
              >
                <Volume2 v-if="bot.muted" :size="11" />
                <VolumeX v-else :size="11" />
              </button>
              <button
                v-if="isGroup"
                class="icon-btn !h-6 !w-6 hover:!text-[var(--danger)]"
                title="移出群聊"
                @click.stop="remove(bot.id)"
              >
                <UserMinus :size="11" />
              </button>
            </div>
          </button>

          <button v-if="isGroup" class="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-strong)] py-1.5 text-[10.5px] text-[var(--text-3)] transition hover:bg-[var(--hover)] hover:text-[var(--text-1)]" @click="ui.addMemberOpen = true">
            <Plus :size="11" /> 添加成员
          </button>
        </section>

        <section v-if="isGroup" class="detail-section">
          <h3 class="detail-section-title">协同规则</h3>
          <div class="settings-block">
            <div class="detail-field">
              <div>
                <div class="toggle-line-label">自动轮询发言</div>
                <div class="toggle-line-hint">按流水线自动接力，闭环后等待确认</div>
              </div>
              <SwitchControl v-model="autoPoll" label="自动轮询" />
            </div>
            <div class="h-px bg-[var(--border)]" />
            <div class="detail-field">
              <div>
                <div class="toggle-line-label">允许 Bot 之间互相 @</div>
                <div class="toggle-line-hint">关闭后 Bot 只回应我的消息</div>
              </div>
              <SwitchControl v-model="allowMentions" label="允许互相提及" />
            </div>
            <div class="h-px bg-[var(--border)]" />
            <div class="detail-field">
              <span class="detail-field-label inline-flex items-center gap-1"><Clock3 :size="10" /> 发言冷却</span>
              <div class="flex items-center gap-1">
                <input
                  class="mini-number"
                  type="number"
                  min="1"
                  max="30"
                  :value="room.cooldownSeconds"
                  @change="updateNumber('cooldownSeconds', $event, 1, 30)"
                />
                <span class="text-[10px] text-[var(--text-3)]">秒</span>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-label">单轮消息上限</span>
              <input
                class="mini-number"
                type="number"
                min="3"
                max="12"
                :value="room.maxAutoMessages"
                @change="updateNumber('maxAutoMessages', $event, 3, 12)"
              />
            </div>
            <div class="detail-field">
              <span class="detail-field-label">短期上下文条数</span>
              <input
                class="mini-number"
                type="number"
                min="6"
                max="60"
                :value="room.contextMessages"
                @change="updateNumber('contextMessages', $event, 6, 60)"
              />
            </div>
          </div>
          <div class="mt-2 flex items-center gap-1.5 px-1 text-[9.5px] leading-relaxed text-[var(--text-3)]">
            <MessageCircleMore :size="10" />
            讨论闭环后强制确认，确认前实现 Bot 不会输出最终代码。
          </div>
        </section>

        <section v-if="isGroup" class="detail-section">
          <h3 class="detail-section-title">流水线角色</h3>
          <div class="settings-block">
            <div v-for="bot in chat.activeBots" :key="bot.id" class="detail-field !py-1.5">
              <span class="detail-field-label">{{ ROLE_META[bot.role].label }}</span>
              <span class="detail-field-value">{{ bot.name }}</span>
            </div>
            <div v-if="!chat.activeBots.length" class="py-2 text-[10px] text-[var(--text-3)]">尚未添加 Bot</div>
          </div>
        </section>

        <section class="detail-section">
          <button class="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[10.5px] text-[var(--text-3)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]" @click="chat.deleteActiveRoom">
            <Trash2 :size="11" /> 删除当前会话
          </button>
        </section>
      </template>

      <MemoryPanel v-else />
    </div>
  </aside>
</template>
