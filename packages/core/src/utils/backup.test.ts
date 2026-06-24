import { beforeEach, describe, expect, it } from 'vitest'
import type { FavoriteItem } from '../types/favorite'
import type { HistoryItem } from '../types/history'
import type { Settings } from '../types/settings'
import type { VideoSource } from '../types/source'
import { type BackupFile, exportBackup, importBackup } from './backup'
import { STORAGE_KEYS, storage } from './storage'

beforeEach(() => {
  localStorage.clear()
})

const sampleSource: VideoSource = {
  id: 's1',
  name: '测试',
  type: 't1_json',
  baseUrl: 'https://x.com',
  pageSize: 20,
  enabled: true,
  createdAt: 1,
  order: 0,
}

const sampleFav: FavoriteItem = {
  id: 'f1',
  sourceId: 's1',
  vod: { id: 'v1', sourceId: 's1', name: 'V', pic: '' },
  createdAt: 0,
}

const sampleHistory: HistoryItem = {
  id: 'h1',
  sourceId: 's1',
  vod: { id: 'v1', sourceId: 's1', name: 'V', pic: '' },
  episode: { name: '第1集', url: 'ep1' },
  progress: 0,
  lastWatchTime: 0,
}

const sampleSettings: Settings = { theme: 'dark', deviceType: 'desktop' }

describe('exportBackup', () => {
  it('导出包含 version/exportedAt/sources/favorites/history/settings', () => {
    storage.set(STORAGE_KEYS.sources, [sampleSource])
    storage.set(STORAGE_KEYS.favorites, [sampleFav])
    storage.set(STORAGE_KEYS.history, [sampleHistory])
    storage.set(STORAGE_KEYS.settings, sampleSettings)
    const raw = exportBackup()
    const data: BackupFile = JSON.parse(raw)
    expect(data.version).toBeDefined()
    expect(data.exportedAt).toBeGreaterThan(0)
    expect(data.sources).toHaveLength(1)
    expect(data.favorites).toHaveLength(1)
    expect(data.history).toHaveLength(1)
    expect(data.settings).toEqual(sampleSettings)
  })

  it('空 localStorage 导出默认值', () => {
    const raw = exportBackup()
    const data: BackupFile = JSON.parse(raw)
    expect(data.sources).toEqual([])
    expect(data.favorites).toEqual([])
    expect(data.history).toEqual([])
    expect(data.settings).toEqual({ theme: 'light', deviceType: 'mobile' })
  })
})

describe('importBackup', () => {
  it('有效 JSON 恢复 sources', () => {
    const file: BackupFile = {
      version: 'v0.2.0',
      exportedAt: 0,
      sources: [sampleSource],
      favorites: [],
      history: [],
      settings: sampleSettings,
    }
    expect(importBackup(JSON.stringify(file))).toBe(true)
    expect(storage.get<VideoSource[]>(STORAGE_KEYS.sources, [])).toHaveLength(1)
  })

  it('同时恢复 favorites 与 history', () => {
    const file: BackupFile = {
      version: 'v0.2.0',
      exportedAt: 0,
      sources: [sampleSource],
      favorites: [sampleFav],
      history: [sampleHistory],
      settings: sampleSettings,
    }
    expect(importBackup(JSON.stringify(file))).toBe(true)
    expect(storage.get<FavoriteItem[]>(STORAGE_KEYS.favorites, [])).toHaveLength(1)
    expect(storage.get<HistoryItem[]>(STORAGE_KEYS.history, [])).toHaveLength(1)
  })

  it('无效 JSON 返回 false', () => {
    expect(importBackup('not json')).toBe(false)
  })

  it('缺少 sources 字段返回 false', () => {
    expect(importBackup(JSON.stringify({ version: 'v0.1.0' }))).toBe(false)
  })

  it('sources 非数组返回 false', () => {
    expect(importBackup(JSON.stringify({ version: 'v0.1.0', sources: 'x' }))).toBe(false)
  })

  it('sources 是对象也返回 false', () => {
    expect(importBackup(JSON.stringify({ version: 'v0.1.0', sources: {} }))).toBe(false)
  })

  it('缺 favorites/history 时仅恢复 sources', () => {
    const file: BackupFile = {
      version: 'v0.2.0',
      exportedAt: 0,
      sources: [],
      favorites: [],
      history: [],
      settings: sampleSettings,
    }
    expect(importBackup(JSON.stringify(file))).toBe(true)
  })

  it('favorites 非数组时仅恢复 sources', () => {
    const file = { version: 'v0.1.0', exportedAt: 0, sources: [sampleSource], favorites: 'oops' }
    expect(importBackup(JSON.stringify(file))).toBe(true)
    expect(storage.get(STORAGE_KEYS.favorites, [])).toEqual([])
  })

  it('导出后导入应还原一致', () => {
    storage.set(STORAGE_KEYS.sources, [sampleSource])
    storage.set(STORAGE_KEYS.favorites, [sampleFav])
    storage.set(STORAGE_KEYS.history, [sampleHistory])
    storage.set(STORAGE_KEYS.settings, sampleSettings)
    const raw = exportBackup()
    localStorage.clear()
    expect(importBackup(raw)).toBe(true)
    expect(storage.get<VideoSource[]>(STORAGE_KEYS.sources, [])).toEqual([sampleSource])
    expect(storage.get<FavoriteItem[]>(STORAGE_KEYS.favorites, [])).toEqual([sampleFav])
    expect(storage.get<HistoryItem[]>(STORAGE_KEYS.history, [])).toEqual([sampleHistory])
    expect(storage.get<Settings>(STORAGE_KEYS.settings, { theme: 'light', deviceType: 'mobile' })).toEqual(sampleSettings)
  })

  it('恢复 settings', () => {
    const file: BackupFile = {
      version: 'v0.2.0',
      exportedAt: 0,
      sources: [sampleSource],
      favorites: [],
      history: [],
      settings: sampleSettings,
    }
    expect(importBackup(JSON.stringify(file))).toBe(true)
    expect(storage.get<Settings>(STORAGE_KEYS.settings, { theme: 'light', deviceType: 'mobile' })).toEqual(sampleSettings)
  })

  it('settings 不合法时不覆盖当前设置', () => {
    storage.set(STORAGE_KEYS.settings, sampleSettings)
    const file = { version: 'v0.2.0', exportedAt: 0, sources: [sampleSource], settings: { theme: 'red', deviceType: 'tv' } }
    expect(importBackup(JSON.stringify(file))).toBe(true)
    expect(storage.get<Settings>(STORAGE_KEYS.settings, { theme: 'light', deviceType: 'mobile' })).toEqual(sampleSettings)
  })

  it('settings.theme 为已废弃的 "auto" 时不覆盖当前设置', () => {
    storage.set(STORAGE_KEYS.settings, sampleSettings)
    const file = { version: 'v0.2.0', exportedAt: 0, sources: [sampleSource], settings: { theme: 'auto', deviceType: 'mobile' } }
    expect(importBackup(JSON.stringify(file))).toBe(true)
    expect(storage.get<Settings>(STORAGE_KEYS.settings, { theme: 'light', deviceType: 'mobile' })).toEqual(sampleSettings)
  })
})
