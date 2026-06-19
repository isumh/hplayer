import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Episode, VodItem } from '../types/vod'

interface PlayerPayload {
  vod: VodItem
  sourceId: string
  episode?: Episode
  startAt?: number
}

export const usePlayerStore = defineStore('player', () => {
  const current = ref<PlayerPayload | null>(null)

  function setCurrent(payload: PlayerPayload): void {
    current.value = payload
  }

  function clear(): void {
    current.value = null
  }

  return { current, setCurrent, clear }
})
