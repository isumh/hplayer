/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // biome-ignore lint/complexity/noBannedTypes: Vite's official SFC shim uses `{}` for default generics
  const component: DefineComponent<{}, {}, any>
  export default component
}
