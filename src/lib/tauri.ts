import { invoke } from '@tauri-apps/api/core'
import type { ApiSettings, ChatApiRequest, ChatApiResult, PetNotification } from '@/types'

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return '发生未知错误'
}

export async function chatCompletion(request: ChatApiRequest): Promise<ChatApiResult> {
  return invoke<ChatApiResult>('deepseek_chat', { request })
}

export async function testConnection(): Promise<ChatApiResult> {
  return invoke<ChatApiResult>('test_deepseek')
}

export async function readApiSettings(): Promise<ApiSettings> {
  return invoke<ApiSettings>('get_api_settings')
}

export async function writeApiSettings(payload: {
  apiKey?: string
  baseUrl?: string
  clearApiKey?: boolean
}): Promise<ApiSettings> {
  return invoke<ApiSettings>('save_api_settings', { payload })
}

export async function openMainWindow(): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('show_main')
}

export async function hideMainWindow(): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('hide_main')
}

export async function notifyPet(payload: PetNotification): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('notify_pet', { payload })
}

export async function startPetDrag(): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('start_pet_drag')
}

export async function updatePetHitTest(zone: {
  cx: number
  cy: number
  rx: number
  ry: number
}): Promise<boolean> {
  if (!isTauriRuntime()) return true
  return invoke<boolean>('update_pet_hit_test', { zone })
}

export async function showPetMenu(): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('show_pet_menu')
}

export async function rememberPetPosition(): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('remember_pet_position')
}

export async function quitApp(): Promise<void> {
  if (!isTauriRuntime()) return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().close()
}
