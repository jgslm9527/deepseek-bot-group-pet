import type { Bot } from '@/types'

export function findMentionedBots(text: string, bots: Bot[]): Bot[] {
  return bots.filter((bot) => text.includes(`@${bot.name}`))
}

export function stripBotMentions(text: string, bots: Bot[]): string {
  let next = text
  for (const bot of bots) {
    next = next.split(`@${bot.name}`).join('')
  }
  return next.trim()
}

export function botMentionTokens(text: string, bots: Bot[]): string[] {
  return findMentionedBots(text, bots).map((bot) => `@${bot.name}`)
}
