import type { VideoSource } from './source'

export interface Category {
  id: string
  name: string
  sourceId: string
}

export interface VodItem {
  id: string
  sourceId: string
  name: string
  pic: string
  year?: string
  area?: string
  type?: string
  remarks?: string
  actor?: string
  director?: string
  desc?: string
}

export interface PlayLine {
  name: string
}

export interface Episode {
  name: string
  url: string
}

export interface VodDetail extends VodItem {
  playFrom: PlayLine[]
  playList: Record<string, Episode[]>
}

export interface ListPage<T> {
  list: T[]
  total: number
  pageCount: number
  currentPage: number
}

export type SourceTypeMap = Record<VideoSource['type'], 'mac-cms-json' | 'mac-cms-xml'>
