export type Theme = 'light' | 'dark'

export type DeviceType = 'mobile' | 'desktop' | 'tablet'

export interface Settings {
  theme: Theme
  deviceType: DeviceType
  activeSourceId?: string
}
