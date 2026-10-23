import { defineConfig, presetUno, transformerDirectives } from 'unocss'

export default defineConfig({
  presets: [presetUno()],
  transformers: [transformerDirectives()],
  theme: {
    colors: {
      wechat: {
        green: '#95ec69',
        bg: '#f5f5f5',
        sidebar: '#ededed',
      },
    },
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif',
    },
  },
  shortcuts: {
    'icon-btn':
      'inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-2)] hover:bg-[var(--hover)] active:scale-95 transition-all duration-150 select-none',
    'panel-surface': 'bg-[var(--surface)] text-[var(--text-1)]',
    'field-base':
      'w-full rounded-lg bg-[var(--field)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-1)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]',
    'primary-btn':
      'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:brightness-105 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40',
    'secondary-btn':
      'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--text-1)] transition-all duration-150 hover:bg-[var(--hover)] active:scale-[.98] disabled:opacity-40',
    'danger-btn':
      'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-105 active:scale-[.98] disabled:opacity-40',
  },
})
