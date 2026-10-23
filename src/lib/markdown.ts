import DOMPurify from 'dompurify'
import { Marked, Renderer } from 'marked'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const renderer = new Renderer()
renderer.code = ({ text, lang }) => {
  const language = (lang || '').split(/\s+/)[0].slice(0, 24)
  const label = language || 'code'
  return `<div class="md-code"><div class="md-code-head"><span>${escapeHtml(
    label,
  )}</span><button type="button" class="md-copy">复制</button></div><pre><code>${escapeHtml(
    text,
  )}</code></pre></div>`
}

const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer,
})

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noreferrer noopener')
  }
})

export function renderMarkdown(content: string): string {
  const raw = marked.parse(content ?? '', { async: false }) as string
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target'],
  })
}
