import type { Bot, Memory, Message } from '@/types'

/** Lightweight local estimate only, used to cap context; not a tokenizer. */
export function estimateTokens(text: string): number {
  if (!text) return 0
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/g) ?? []).length
  const rest = text.replace(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/g, ' ')
  const latin = rest.trim() ? rest.trim().split(/\s+/).length * 1.3 : 0
  return Math.ceil(cjk + latin + text.length * 0.02)
}

export function truncateToTokens(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return ''
  if (estimateTokens(text) <= maxTokens) return text
  let low = 0
  let high = text.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (estimateTokens(text.slice(0, mid)) <= maxTokens) low = mid
    else high = mid - 1
  }
  return `${text.slice(0, low).trimEnd()}\n…（内容已按上下文上限截断）`
}

export function attachmentContext(message: Message): string {
  if (!message.attachments.length) return ''
  return message.attachments
    .filter((file) => file.text)
    .map((file) => `[附件：${file.name}]\n\`\`\`\n${file.text}\n\`\`\``)
    .join('\n\n')
}

export function formatContextMessage(message: Message, botMap: Map<string, Bot>): string {
  const attachments = attachmentContext(message)
  if (message.senderType === 'user') {
    return `【我】${message.content}${attachments ? `\n${attachments}` : ''}`
  }
  const bot = message.botId ? botMap.get(message.botId) : undefined
  return `【${bot?.name ?? 'Bot'}】${message.content}${attachments ? `\n${attachments}` : ''}`
}

/**
 * Builds the short-term public context from the newest messages backwards so
 * the most relevant turns survive the request budget.
 */
export function buildShortTermContext(
  messages: Message[],
  botMap: Map<string, Bot>,
  maxTokens: number,
): { text: string; included: number; truncated: boolean } {
  if (!messages.length) return { text: '', included: 0, truncated: false }
  const selected: string[] = []
  let used = 0
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const fullText = formatContextMessage(messages[index], botMap)
    const cost = estimateTokens(fullText) + 2
    const remaining = maxTokens - used
    if (remaining <= 80) {
      return {
        text: `（更早的 ${index + 1} 条消息已省略）\n\n${selected.reverse().join('\n\n')}`,
        included: selected.length,
        truncated: true,
      }
    }
    if (cost > remaining) {
      const clipped = truncateToTokens(fullText, remaining - 2)
      if (!selected.length && !clipped) break
      selected.push(clipped)
      return {
        text: `（更早的 ${index + 1} 条消息已省略，最近一条已按预算截断）\n\n${selected.reverse().join('\n\n')}`,
        included: selected.length,
        truncated: true,
      }
    }
    selected.push(fullText)
    used += cost
  }
  return { text: selected.reverse().join('\n\n'), included: selected.length, truncated: false }
}

export function memoriesToPrompt(memories: Memory[]): string {
  if (!memories.length) return '（本次没有加载长期记忆）'
  return memories
    .map(
      (memory) =>
        `- [${memory.id}] ${memory.summary}\n  标签：${memory.tags.join('、') || '无'}；重要度：${memory.importance}/5\n  ${memory.content}`,
    )
    .join('\n')
}
