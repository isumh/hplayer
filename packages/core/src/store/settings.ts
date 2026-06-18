import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { setDeviceType } from '../api/ua-pool'
import type { DeviceType, Settings, Theme } from '../types/settings'
import { STORAGE_KEYS, storage } from '../utils/storage'

const defaultSettings: Settings = { theme: 'auto', deviceType: 'mobile' }

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>(storage.get<Settings>(STORAGE_KEYS.settings, defaultSettings))

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
    const theme = settings.value.theme
    const root = document.documentElement
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = theme === 'dark' || (theme === 'auto' && prefersDark)
    root.classList.toggle('dark', isDark)
  }

  watch(() => settings.value.theme, applyTheme, { immediate: false })

  return { settings, setTheme, setDeviceType: setDeviceTypeAction, applyTheme }
})
