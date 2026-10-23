/** Produces a compact, readable conversation preview from Markdown. */
export function markdownPreview(input: string, max = 84): string {
  let text = input.replace(/\r/g, '')
  text = text.replace(/```[\s\S]*?```/g, ' [代码] ')
  text = text.replace(/(?:\[代码\]\s*)+/g, '[代码产物] ')
  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  text = text.replace(/[*_`>~]/g, '')
  text = text.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}
