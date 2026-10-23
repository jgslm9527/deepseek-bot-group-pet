import type { BotRole, ChatModel } from '@/types'
import { CHAT_MODELS } from '@/types'

export const MODEL_LABELS: Record<ChatModel, string> = Object.fromEntries(
  CHAT_MODELS.map((model) => [model.value, model.short]),
) as Record<ChatModel, string>

export const ROLE_META: Record<BotRole, { label: string; description: string; color: string }> = {
  planner: {
    label: '方案架构',
    description: '拆解需求、搭建方案框架',
    color: '#3B82F6',
  },
  reviewer: {
    label: '逻辑评审',
    description: '找漏洞、推演边界、优化方案',
    color: '#8B5CF6',
  },
  builder: {
    label: '落地实现',
    description: '制定落地计划、确认后编写代码',
    color: '#F59E0B',
  },
}

export const BOT_ACCENTS = [
  '#3B82F6',
  '#8B5CF6',
  '#F59E0B',
  '#10B981',
  '#EC4899',
  '#06B6D4',
  '#EF4444',
  '#6366F1',
]

export const BOT_EMOJIS = [
  '🛰️', '🧠', '⚡', '🦾', '🧩', '🔭', '🧪', '🌊', '🐋', '🪐', '🛠️', '✨', '🤖', '🧭', '🎛️',
]

export const DEFAULT_SYSTEM_PROMPTS: Record<BotRole, string> = {
  planner:
    '你负责需求拆解、输出初步方案和梳理框架。准确澄清目标与边界，把模糊想法变成结构化计划；讨论阶段不要输出最终完整代码。',
  reviewer:
    '你负责逻辑推演、方案评审、寻找缺陷与优化方案。质疑必须有依据，关注边界条件、状态、安全与实现成本；讨论阶段不要写最终代码。',
  builder:
    '你负责最终实现与脚本落地。在用户明确确认前只输出落地计划、关键接口和测试清单，绝不提前产出最终完整代码。',
}

export const EMPTY_STATE_SUGGESTIONS = [
  '帮我设计一个 macOS 菜单栏番茄钟，先讨论方案，不要写代码。',
  '评审一下这个需求的技术风险：本地 SQLite 存储 + 多 Bot 协同。',
  '为这个产品设计一套可验证的 MVP 验收标准。',
]
