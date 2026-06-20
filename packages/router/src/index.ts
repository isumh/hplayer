import { useSourceStore } from '@hplayer/core'
import { createRouter, createWebHashHistory } from 'vue-router'

const TabLayout = () => import('@hplayer/views/layouts/TabLayout.vue')

export const router = createRouter({
  // Capacitor Android WebView 的 back/forward 列表依赖 URL 变化；hash 模式可确保
  // 每次 router.push 都产生不同的 file://.../#/xxx URL，从而正确支持返回键。
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    {
      path: '/',
      component: TabLayout,
      children: [
        {
          path: 'home',
          component: () => import('@hplayer/views/home/index.vue'),
          meta: { title: '首页' },
        },
        {
          path: 'search',
          component: () => import('@hplayer/views/search/index.vue'),
          meta: { title: '搜索' },
        },
        {
          path: 'settings',
          component: () => import('@hplayer/views/settings/index.vue'),
          meta: { title: '设置' },
        },
      ],
    },
    {
      path: '/detail/:id',
      component: () => import('@hplayer/views/detail/index.vue'),
      meta: { title: '详情' },
    },
    {
      path: '/player/:id',
      component: () => import('@hplayer/views/player/index.vue'),
      meta: { title: '播放' },
    },
    {
      path: '/favorite',
      component: () => import('@hplayer/views/favorite/index.vue'),
      meta: { title: '收藏' },
    },
    {
      path: '/history',
      component: () => import('@hplayer/views/history/index.vue'),
      meta: { title: '历史' },
    },
    {
      path: '/settings/source/add',
      component: () => import('@hplayer/views/settings/source-form.vue'),
      meta: { title: '新增视频源' },
    },
    {
      path: '/settings/source/edit/:id',
      component: () => import('@hplayer/views/settings/source-form.vue'),
      meta: { title: '编辑视频源' },
      props: true,
    },
  ],
})

router.beforeEach((to) => {
  const sourceStore = useSourceStore()
  if (
    sourceStore.list.length === 0 &&
    (to.path === '/home' || to.path.startsWith('/detail') || to.path.startsWith('/player'))
  ) {
    return { path: '/settings/source/add', replace: true }
  }
})
