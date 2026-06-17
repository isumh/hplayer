/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './apps/hplayer_web/index.html',
    './apps/hplayer_web/src/**/*.{vue,ts}',
    './packages/ui/src/**/*.{vue,ts}',
    './packages/views/src/**/*.{vue,ts}',
  ],
  corePlugins: {
    // 避免 Tailwind preflight 重置 Vant 组件样式
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
};
