import type { Bot, BotRole } from '@/types'

export type PipelineMode = 'auto' | 'mention' | 'direct' | 'revision' | 'final'

export interface PipelineStage {
  key: string
  role: BotRole
  label: string
  instruction: string
}

const INITIAL_STAGES: PipelineStage[] = [
  {
    key: 'proposal',
    role: 'planner',
    label: '初步方案',
    instruction:
      '请拆解我的需求，输出初步方案：目标、边界与非目标、核心流程/模块、关键假设、主要风险、验收标准。当前仍是讨论阶段，禁止输出最终完整代码。',
  },
  {
    key: 'review',
    role: 'reviewer',
    label: '评审推演',
    instruction:
      '请严格评审上一位的初步方案。主动寻找逻辑漏洞、边界条件、状态/并发问题、安全风险与实现成本，做优化推演，并给出具体修订建议。当前仍是讨论阶段，禁止输出最终完整代码。',
  },
  {
    key: 'implementation-plan',
    role: 'builder',
    label: '落地计划',
    instruction:
      '请基于目前的讨论，给出可落地的实现计划：目录/模块、关键数据结构、接口、实施步骤、测试清单和风险。当前仍是讨论阶段，绝对禁止输出最终完整代码或声称已执行。',
  },
  {
    key: 'revision',
    role: 'planner',
    label: '方案修订',
    instruction:
      '请吸收评审意见，输出修订后的方案，明确说明改了什么、为什么改、哪些取舍仍待确认。仍然不要输出最终代码。',
  },
  {
    key: 'closure',
    role: 'reviewer',
    label: '闭环复核',
    instruction:
      '请做最后闭环复核：确认评审问题是否被解决，列出仍然存在的风险。若可以进入实现，请以「闭环结论：可以进入实现」开头；若不可以，明确写出阻塞项。不要输出最终代码。',
  },
  {
    key: 'ready',
    role: 'builder',
    label: '实现准备',
    instruction:
      '请确认最终实现边界与验收清单，并简述确认后的实施顺序。只输出准备信息，不要输出代码。',
  },
]

const REVISION_STAGES: PipelineStage[] = [
  {
    key: 'revision-proposal',
    role: 'planner',
    label: '修订方案',
    instruction:
      '用户驳回了上一轮结论并给出了修改意见。请重新梳理需求与已有讨论，输出针对该意见的修订方案，说明影响范围。不要输出最终代码。',
  },
  {
    key: 'revision-review',
    role: 'reviewer',
    label: '修订复核',
    instruction:
      '请复核修订方案是否解决了用户的修改意见，指出新引入的风险与遗漏，并给出明确结论。不要输出最终代码。',
  },
  {
    key: 'revision-plan',
    role: 'builder',
    label: '修订落地计划',
    instruction:
      '请更新落地计划与验收清单，确保与修订方案一致。不要输出最终代码。',
  },
  {
    key: 'revision-closure',
    role: 'reviewer',
    label: '再次闭环',
    instruction:
      '请做最终复核。如果问题已经解决，以「闭环结论：可以进入实现」开头；否则列出阻塞项。不要输出最终代码。',
  },
]

export function buildPipeline(mode: 'auto' | 'revision'): PipelineStage[] {
  return mode === 'revision' ? REVISION_STAGES : INITIAL_STAGES
}

export function pickBotForStage(
  stage: PipelineStage,
  bots: Bot[],
  previousBotId?: string | null,
): Bot | null {
  const available = bots.filter((bot) => !bot.muted)
  if (!available.length) return null
  const byRole = available.filter((bot) => bot.role === stage.role)
  if (byRole.length) {
    return byRole.find((bot) => bot.id !== previousBotId) ?? byRole[0]
  }
  return available.find((bot) => bot.id !== previousBotId) ?? available[0]
}

interface PromptInput {
  bot: Bot
  userProfile: string
  memoryBlock: string
  shortTermContext: string
  members: Bot[]
  request: string
  stage: PipelineStage | null
  mode: PipelineMode
  allowBotMentions: boolean
  attachments: string
}

export function buildSystemPrompt(input: PromptInput): string {
  const discussionStage = input.mode !== 'final' && input.mode !== 'direct'
  const mentionRule = input.allowBotMentions
    ? '如需其他 Bot 补充，可以在发言中 @ 对方；但不要互相刷屏，每轮只推进一个明确问题。'
    : '本轮不允许 @ 其他 Bot，也不要假装其他 Bot 已经发言。'
  const stageRule = discussionStage
    ? '现在是讨论阶段。绝对不要输出最终完整代码、脚本产物，也不要声称已经创建文件或运行命令。只做方案、评审和落地计划。'
    : input.mode === 'final'
      ? '用户已经明确点击「确认开始实现」。现在可以输出最终、完整、可运行的代码。请给出完整文件树、逐个文件内容、运行步骤与必要说明；不要省略关键实现。'
      : '这是一次普通对话回复。除非用户明确要求，不要声称已经在其电脑上执行任何操作。'

  return [
    `# 身份与职责\n${input.bot.systemPrompt || `你是 ${input.bot.name}，请专业地协助用户。`}`,
    `# 你的名字\n${input.bot.name}`,
    `# 全局用户档案（所有 Bot 可见）\n${input.userProfile || '（用户尚未填写固定偏好）'}`,
    `# 与当前话题相关的长期记忆（由前置筛选调用选出，可能为空）\n${input.memoryBlock}`,
    `# 群成员\n我（用户）、${input.members.map((bot) => `${bot.name}（${bot.model}）`).join('、') || '暂无其他 Bot'}`,
    `# 当前会话短期上下文\n${input.shortTermContext || '（暂无历史消息）'}`,
    `# 行为约束\n- 你只能代表 ${input.bot.name} 发言，不要替用户或其他 Bot 说话。\n- 使用中文，结构清晰，避免空话和重复客套。\n- ${stageRule}\n- ${mentionRule}\n- 若信息不足，明确列出需要确认的问题，不要编造事实。`,
  ].join('\n\n')
}

export function buildUserPrompt(input: {
  request: string
  stage: PipelineStage | null
  mode: PipelineMode
  attachments: string
}): string {
  const parts: string[] = []
  if (input.mode === 'revision') {
    parts.push(`原始需求与当前修改要求如下：\n${input.request}`)
  } else {
    parts.push(`我的需求：\n${input.request}`)
  }
  if (input.attachments) {
    parts.push(`本次用户附带的文件：\n${input.attachments}`)
  }
  if (input.stage) {
    parts.push(`当前流水线阶段：${input.stage.label}\n${input.stage.instruction}`)
  } else if (input.mode === 'final') {
    parts.push('请现在输出最终完整实现。')
  } else if (input.mode === 'direct') {
    parts.push('请直接回应我的这条消息。')
  } else {
    parts.push('请回应我。')
  }
  parts.push('请直接给出你的发言，不要加「好的」「以下是」之类的过度铺垫。')
  return parts.join('\n\n')
}
