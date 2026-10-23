import { notifyPet } from '@/lib/tauri'

let activeRequests = 0
let idleTimer: ReturnType<typeof setTimeout> | null = null

function fire(payload: Parameters<typeof notifyPet>[0]): void {
  void notifyPet(payload).catch(() => undefined)
}

export function petThinking(on: boolean): void {
  activeRequests = Math.max(0, activeRequests + (on ? 1 : -1))
  if (on) {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    fire({ mode: 'thinking' })
    return
  }
  if (activeRequests === 0) {
    idleTimer = setTimeout(() => {
      if (activeRequests === 0) fire({ mode: 'idle' })
    }, 400)
  }
}

export function petNewMessage(botName: string, accent: string, text: string): void {
  fire({
    mode: 'new-message',
    botName,
    accent,
    text: text.replace(/\s+/g, ' ').slice(0, 90),
  })
}

export function petError(text: string): void {
  fire({ mode: 'error', text: text.slice(0, 110) })
}

export function petMuted(): void {
  fire({ mode: 'muted', text: '全部 Bot 已静音' })
}

export function resetPetState(): void {
  activeRequests = 0
  fire({ mode: 'idle' })
}
