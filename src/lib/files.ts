import type { Attachment } from '@/types'
import { newId } from '@/lib/id'

export const MAX_ATTACHMENT_BYTES = 500 * 1024
export const MAX_ATTACHMENTS = 3
export const TEXT_FILE_EXTENSIONS = [
  '.txt', '.md', '.markdown', '.json', '.yaml', '.yml', '.toml', '.csv', '.log',
  '.ts', '.tsx', '.js', '.jsx', '.vue', '.css', '.scss', '.html', '.py', '.rs',
  '.go', '.java', '.kt', '.swift', '.c', '.h', '.cpp', '.sh', '.sql', '.xml',
]

export const ATTACHMENT_ACCEPT = TEXT_FILE_EXTENSIONS.join(',')

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function isTextFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return (
    file.type.startsWith('text/') ||
    TEXT_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension))
  )
}

export async function readAttachment(file: File): Promise<Attachment> {
  if (!isTextFile(file)) {
    throw new Error(`「${file.name}」不是文本文件，当前仅支持文本与代码文件。`)
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`「${file.name}」超过 500 KB，请拆分后再上传。`)
  }
  const raw = await file.text()
  const text = raw.length > 120_000 ? raw.slice(0, 120_000) : raw
  return {
    id: newId('file'),
    name: file.name,
    size: file.size,
    type: file.type || 'text/plain',
    text,
    truncated: raw.length > 120_000,
  }
}
