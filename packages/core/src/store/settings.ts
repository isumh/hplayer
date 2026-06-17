import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { Settings, Theme } from '../types/settings';
import { STORAGE_KEYS, storage } from '../utils/storage';

const defaultSettings: Settings = { theme: 'auto' };

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>(storage.get<Settings>(STORAGE_KEYS.settings, defaultSettings));

  function persist(): void {
    storage.set(STORAGE_KEYS.settings, settings.value);
  }

  function setTheme(theme: Theme): void {
    settings.value.theme = theme;
    persist();
  }

  function applyTheme(): void {
    const theme = settings.value.theme;
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);
    root.classList.toggle('dark', isDark);
  }

  watch(() => settings.value.theme, applyTheme, { immediate: false });

  return { settings, setTheme, applyTheme };
});
