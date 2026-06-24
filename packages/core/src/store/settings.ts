import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { setDeviceType } from '../api/ua-pool'
import type { DeviceType, Settings, Theme } from '../types/settings'
import { STORAGE_KEYS, storage } from '../utils/storage'

const defaultSettings: Settings = { theme: 'light', deviceType: 'mobile' }

/**
 * 规范化主题值：旧版本可能持久化了 'auto'（跟随系统），现在该选项已移除。
 * 读时回退为 'light'，不主动迁移存储。
 */
function normalizeTheme(theme: unknown): Theme {
  return theme === 'dark' ? 'dark' : 'light'
}

export const useSettingsStore = defineStore('settings', () => {
  const stored = storage.get<Settings>(STORAGE_KEYS.settings, defaultSettings)
  const settings = ref<Settings>({
    ...stored,
    theme: normalizeTheme(stored.theme),
  })

  function persist(): void {
    storage.set(STORAGE_KEYS.settings, settings.value)
  }

  function setTheme(theme: Theme): void {
    settings.value.theme = theme
    persist()
  }

  function setDeviceTypeAction(device: DeviceType): void {
    settings.value.deviceType = device
    persist()
    setDeviceType(device)
  }

  function applyTheme(): void {
    const root = document.documentElement
    root.classList.toggle('dark', settings.value.theme === 'dark')
  }

  watch(() => settings.value.theme, applyTheme, { immediate: false })

  return { settings, setTheme, setDeviceType: setDeviceTypeAction, applyTheme }
})
