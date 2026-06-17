export type Theme = 'light' | 'dark' | 'auto';

export interface Settings {
  theme: Theme;
  activeSourceId?: string;
}
