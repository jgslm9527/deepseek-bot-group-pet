const rtf = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })

export function formatRelative(iso?: string): string {
  if (!iso) return ''
  const value = new Date(iso).getTime()
  if (!Number.isFinite(value)) return ''
  const diff = value - Date.now()
  const abs = Math.abs(diff)
  if (abs < 60_000) return '刚刚'
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute')
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour')
  if (abs < 604_800_000) return rtf.format(Math.round(diff / 86_400_000), 'day')
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(value)
}

export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

export function isSameDay(isoA: string, isoB: string): boolean {
  return dayKey(isoA) === dayKey(isoB)
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ms <= 0) {
      resolve()
      return
    }
    const timer = setTimeout(resolve, ms)
    if (signal) {
      const abort = () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      }
      if (signal.aborted) abort()
      else signal.addEventListener('abort', abort, { once: true })
    }
  })
}

export function compactNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value < 1000) return String(value)
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`
  return `${(value / 1_000_000).toFixed(1)}m`
}
