# Phase 4: 页面 + 路由

> 对应原文档 `2026-06-13-hplayer-v1.0-mvp.md` 第 2683-3407 行（Phase 4 完整内容）。
>
> **六个并行 Agent：A 首页 / B 搜索 / C 设置 / D 详情 / E 收藏&历史 / F 播放**。
> 文件无重叠，全并行。

## 状态

- [ ] pending
- [ ] in_progress
- [x] completed

> 主 agent 在 P3 完成后派发 P4-A / P4-B / P4-C / P4-D / P4-E / P4-F 六个 subagent。STATE.md 中需为六者各创建独立状态行。

## 依赖

- P3 完成（所有 UI 组件已就绪）。
- 跨 agent 引用：P4-A 创建 `router/index.ts` 注册所有路由（被 P4-B / P4-C / P4-D / P4-E / P4-F 引用）。**P4-A 完成后**其他 agent 才能正确 type-check。

## 阶段目标

实现 packages/views 下的全部 8 个页面 + 路由配置 + ui 包聚合导出：
- **P4-A**：TabLayout（壳）+ home（首页）+ router（路由）+ ui 包 index.ts 导出
- **P4-B**：search（搜索页）
- **P4-C**：settings（设置页）+ settings/source-form（新增/编辑源页）
- **P4-D**：detail（详情页）
- **P4-E**：favorite（收藏页）+ history（历史页）
- **P4-F**：player（播放页，集成 hls.js + artplayer）

## 并行约束

- 文件无重叠，但 **P4-A 负责 router/index.ts**——其他 agent 的页面在 router 中注册后才能被引用。**类型检查必须在 P4-A 完成后**对其他 agent 才有意义。
- P4-A 的 Task 4.4（修复 ui 包导出）是其他 agent `from '@hplayer/ui'` 能解析的前提；**P4-A 完成后**其他 agent 才能 `pnpm type-check` 通过。
- 推荐派发顺序：先 P4-A（独立），再同时派发 P4-B / P4-C / P4-D / P4-E / P4-F 五个。

## 中断恢复说明

- 六个 agent 各自维护 `STATE.md` 中的状态行。
- **恢复点**：`STATE.md` 中 `- [P4-X]` 行的 `last_task` 字段（格式 `Task N.M`）。
- 子 agent 在自己的 task 列表中找下一个 `- [ ]` 继续。

---

## Agent P4-A: 首页 + TabLayout + Router

**Own Files:**
- Create: `packages/views/src/layouts/TabLayout.vue`, `packages/views/src/home/index.vue`
- Create: `packages/router/src/index.ts`
- Modify: `packages/ui/src/index.ts`（注册组件导出）

---

- [x] **Task 4.1: TabLayout.vue**

```vue
<script setup lang="ts">
import { HPlayerTabBar } from '@hplayer/ui';
</script>

<template>
  <div class="tab-layout">
    <div class="content">
      <router-view />
    </div>
    <HPlayerTabBar />
  </div>
</template>

<style scoped>
.tab-layout { display: flex; flex-direction: column; height: 100%; }
.content { flex: 1; overflow: auto; padding-bottom: 50px; }
</style>
```

- [ ] **Task 4.2: home/index.vue**

```vue
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { VodList, EmptyState, LoadingState, AppHeader, CategoryBar } from '@hplayer/ui';
import { useSourceStore, adapterProxy, type Category, type VodItem } from '@hplayer/core';

const router = useRouter();
const sourceStore = useSourceStore();

const categories = ref<Category[]>([]);
const activeCategory = ref<Category | null>(null);
const items = ref<VodItem[]>([]);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const finished = ref(false);

async function loadCategories() {
  if (!sourceStore.activeSource) return;
  try {
    categories.value = await adapterProxy.getCategories(sourceStore.activeSource);
    if (categories.value.length && !activeCategory.value) {
      activeCategory.value = categories.value[0]!;
      await loadList(true);
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadList(reset = false) {
  if (!sourceStore.activeSource || !activeCategory.value) return;
  loading.value = true;
  try {
    const ps = sourceStore.activeSource.pageSize ?? 20;
    const targetPage = reset ? 1 : page.value;
    const res = await adapterProxy.getList(sourceStore.activeSource, {
      categoryId: activeCategory.value.id,
      page: targetPage,
      pageSize: ps,
    });
    if (reset) {
      items.value = res.list;
      page.value = 1;
    } else {
      items.value = items.value.concat(res.list);
    }
    finished.value = targetPage >= res.pageCount;
    if (!finished.value) page.value = targetPage + 1;
  } finally {
    loading.value = false;
  }
}

function onCategorySelect(c: Category) {
  activeCategory.value = c;
  finished.value = false;
  loadList(true);
}

function goDetail(it: VodItem) {
  router.push({ path: `/detail/${it.id}`, query: { sourceId: it.sourceId } });
}

onMounted(loadCategories);
watch(() => sourceStore.activeSourceId, () => {
  activeCategory.value = null;
  items.value = [];
  loadCategories();
});
</script>

<template>
  <div class="home">
    <AppHeader />
    <CategoryBar v-if="categories.length" :items="categories" @select="onCategorySelect" />
    <div v-if="loading && !items.length" class="loader"><LoadingState /></div>
    <VodList
      v-else-if="items.length"
      :items="items"
      :loading="loading"
      :finished="finished"
      @load="loadList()"
      @refresh="loadList(true)"
      @select="goDetail"
    />
    <EmptyState v-else text="请先在设置中添加视频源" />
  </div>
</template>

<style scoped>
.home { display: flex; flex-direction: column; min-height: 100%; }
.loader { padding: 12px; }
</style>
```

- [ ] **Task 4.3: router/index.ts**

```ts
import { createRouter, createWebHashHistory } from 'vue-router';
import { useSourceStore } from '@hplayer/core';

const TabLayout = () => import('@hplayer/views/layouts/TabLayout.vue');

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    {
      path: '/',
      component: TabLayout,
      children: [
        { path: 'home', component: () => import('@hplayer/views/home/index.vue'), meta: { title: '首页' } },
        { path: 'search', component: () => import('@hplayer/views/search/index.vue'), meta: { title: '搜索' } },
        { path: 'settings', component: () => import('@hplayer/views/settings/index.vue'), meta: { title: '设置' } },
      ],
    },
    { path: '/detail/:id', component: () => import('@hplayer/views/detail/index.vue'), meta: { title: '详情' } },
    { path: '/player/:id', component: () => import('@hplayer/views/player/index.vue'), meta: { title: '播放' } },
    { path: '/favorite', component: () => import('@hplayer/views/favorite/index.vue'), meta: { title: '收藏' } },
    { path: '/history', component: () => import('@hplayer/views/history/index.vue'), meta: { title: '历史' } },
    { path: '/settings/source/add', component: () => import('@hplayer/views/settings/source-form.vue'), meta: { title: '新增视频源' } },
    { path: '/settings/source/edit/:id', component: () => import('@hplayer/views/settings/source-form.vue'), meta: { title: '编辑视频源', props: true } },
  ],
});

router.beforeEach((to) => {
  const sourceStore = useSourceStore();
  if (sourceStore.list.length === 0 &&
      (to.path === '/home' || to.path.startsWith('/detail') || to.path.startsWith('/player'))) {
    return { path: '/settings/source/add', replace: true };
  }
});
```

- [ ] **Task 4.4: 修复 ui 包导出**

`packages/ui/src/index.ts`:
```ts
// layouts
export { default as AppHeader } from './components/AppHeader.vue';
export { default as TabBar } from './components/TabBar.vue';
export { default as NavBar } from './components/NavBar.vue';
export { default as EmptyState } from './components/EmptyState.vue';
export { default as LoadingState } from './components/LoadingState.vue';

// business
export { default as VodCard } from './business/VodCard.vue';
export { default as VodList } from './business/VodList.vue';
export { default as ImagePreview } from './business/ImagePreview.vue';
export { default as SourcePicker } from './business/SourcePicker.vue';
export { default as CategoryBar } from './business/CategoryBar.vue';
export { default as SearchBar } from './business/SearchBar.vue';
export { default as SearchHistory } from './business/SearchHistory.vue';
export { default as EpisodeList } from './business/EpisodeList.vue';
export { default as SourceForm } from './business/SourceForm.vue';
```

- [ ] **Task 4.5: Type-check + build + commit**

```bash
cd /workspace/hplayer && pnpm type-check && pnpm build
git add -A && git commit -m "feat(P4-A): home page + tab layout + router + ui exports"
```

---

## Agent P4-B: 搜索页

**Own Files:**
- Create: `packages/views/src/search/index.vue`

---

- [x] **Task 4.6: search/index.vue**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { VodList, SearchBar, SearchHistory, EmptyState } from '@hplayer/ui';
import { useSourceStore, useSearchHistoryStore, adapterProxy, aggregateSearch, type VodItem } from '@hplayer/core';

const router = useRouter();
const sourceStore = useSourceStore();
const searchHistoryStore = useSearchHistoryStore();

const keyword = ref('');
const mode = ref<'single' | 'aggregate'>('aggregate');
const items = ref<(VodItem & { sourceName?: string })[]>([]);
const page = ref(1);
const finished = ref(false);
const loading = ref(false);
const searched = ref(false);

async function doSearch(kw: string) {
  const trimmed = kw.trim();
  if (!trimmed) return;
  searchHistoryStore.touch(trimmed);
  await loadResults(trimmed, true);
}

async function loadResults(kw: string, reset = false) {
  if (!kw) return;
  searched.value = true;
  loading.value = true;
  try {
    const targetPage = reset ? 1 : page.value;
    if (mode.value === 'single') {
      if (!sourceStore.activeSource) return;
      const res = await adapterProxy.search(sourceStore.activeSource, { keyword: kw, page: targetPage });
      items.value = reset ? res.list.map((it) => ({ ...it, sourceName: sourceStore.activeSource!.name })) : items.value.concat(res.list.map((it) => ({ ...it, sourceName: sourceStore.activeSource!.name })));
      finished.value = targetPage >= res.pageCount;
    } else {
      const res = await aggregateSearch(sourceStore.list, { keyword: kw, page: targetPage });
      items.value = reset ? res.list : items.value.concat(res.list);
      finished.value = res.list.length === 0;
    }
    page.value = targetPage + 1;
  } finally {
    loading.value = false;
  }
}

function onHistorySelect(kw: string) {
  keyword.value = kw;
  doSearch(kw);
}

function goDetail(it: VodItem) {
  router.push({ path: `/detail/${it.id}`, query: { sourceId: it.sourceId } });
}

watch(mode, () => { if (keyword.value) doSearch(keyword.value); });
</script>

<template>
  <div class="search-page">
    <SearchBar v-model="keyword" v-model:mode="mode" @search="doSearch" />
    <SearchHistory v-if="!searched" @select="onHistorySelect" />
    <VodList
      v-else-if="items.length"
      :items="items"
      :source-name="mode === 'single' ? sourceStore.activeSource?.name : undefined"
      :loading="loading"
      :finished="finished"
      @load="loadResults(keyword)"
      @refresh="loadResults(keyword, true)"
      @select="goDetail"
    />
    <EmptyState v-else-if="searched" text="无搜索结果" />
  </div>
</template>

<style scoped>
.search-page { display: flex; flex-direction: column; min-height: 100%; }
</style>
```

- [ ] **Task 4.7: Type-check + commit**

```bash
cd /workspace/hplayer && pnpm type-check
git add -A && git commit -m "feat(P4-B): search page"
```

---

## Agent P4-C: 设置页

**Own Files:**
- Create: `packages/views/src/settings/index.vue`, `packages/views/src/settings/source-form.vue`

---

- [ ] **Task 4.8: settings/index.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { CellGroup, Cell, Button, Dialog, Switch, NavBar } from 'vant';
import { useSourceStore, useSettingsStore } from '@hplayer/core';

const router = useRouter();
const sourceStore = useSourceStore();
const settingsStore = useSettingsStore();

const sources = computed(() => sourceStore.list.slice().sort((a, b) => a.order - b.order));

async function removeSource(id: string, name: string) {
  const ok = await Dialog.confirm({ title: '删除视频源', message: `确认删除「${name}」？` }).then(() => true).catch(() => false);
  if (ok) sourceStore.remove(id);
}

function toggleEnabled(id: string, enabled: boolean) {
  sourceStore.update(id, { enabled });
}

function editSource(id: string) {
  router.push(`/settings/source/edit/${id}`);
}
</script>

<template>
  <div class="settings">
    <NavBar title="设置" />
    <div class="section">
      <div class="section-title">视频源管理</div>
      <CellGroup inset>
        <Cell
          v-for="s in sources"
          :key="s.id"
          :title="s.name"
          :label="s.baseUrl"
          clickable
          is-link
          @click="editSource(s.id)"
        >
          <template #right-icon>
            <Switch :model-value="s.enabled" @update:model-value="(v: boolean) => toggleEnabled(s.id, v)" @click.stop />
          </template>
        </Cell>
      </CellGroup>
      <div class="add-btn">
        <Button type="primary" block @click="router.push('/settings/source/add')">添加视频源</Button>
      </div>
    </div>
    <div class="section">
      <div class="section-title">主题</div>
      <CellGroup inset>
        <Cell title="亮色" clickable @click="settingsStore.setTheme('light')" :icon="settingsStore.settings.theme === 'light' ? 'success' : ''" />
        <Cell title="暗色" clickable @click="settingsStore.setTheme('dark')" :icon="settingsStore.settings.theme === 'dark' ? 'success' : ''" />
        <Cell title="跟随系统" clickable @click="settingsStore.setTheme('auto')" :icon="settingsStore.settings.theme === 'auto' ? 'success' : ''" />
      </CellGroup>
    </div>
    <div class="section">
      <CellGroup inset>
        <Cell title="关于 hplayer" label="v0.1.0" />
        <Cell title="开源协议" label="MIT" />
      </CellGroup>
    </div>
  </div>
</template>

<style scoped>
.settings { padding-top: 46px; }
.section { margin-bottom: 16px; }
.section-title { padding: 8px 16px; font-size: 12px; color: var(--van-text-color-2); }
.add-btn { padding: 12px 16px; }
</style>
```

- [x] **Task 4.9: settings/source-form.vue**

```vue
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { NavBar, SourceForm } from '@hplayer/ui';

const route = useRoute();
const router = useRouter();
const sourceId = route.params.id as string | undefined;
</script>

<template>
  <div class="source-form">
    <NavBar :title="sourceId ? '编辑视频源' : '新增视频源'" />
    <div class="form-wrap">
      <SourceForm :source-id="sourceId" />
    </div>
  </div>
</template>

<style scoped>
.source-form { padding-top: 46px; }
.form-wrap { padding: 12px 0; }
</style>
```

- [ ] **Task 4.10: Type-check + commit**

```bash
cd /workspace/hplayer && pnpm type-check
git add -A && git commit -m "feat(P4-C): settings page + source form page"
```

---

## Agent P4-D: 详情页

**Own Files:**
- Create: `packages/views/src/detail/index.vue`

---

- [x] **Task 4.11: detail/index.vue**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NavBar, EpisodeList, LoadingState, EmptyState, Cell, CellGroup } from 'vant';
import { useSourceStore, useFavoriteStore, useHistoryStore, usePlayerStore, adapterProxy, type VodDetail, type Episode } from '@hplayer/core';

const route = useRoute();
const router = useRouter();
const sourceStore = useSourceStore();
const favoriteStore = useFavoriteStore();
const historyStore = useHistoryStore();
const playerStore = usePlayerStore();

const detail = ref<VodDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const id = route.params.id as string;
const sourceId = (route.query.sourceId as string) || sourceStore.activeSourceId || '';

async function load() {
  const source = sourceStore.list.find((s) => s.id === sourceId);
  if (!source) { error.value = '视频源不存在'; loading.value = false; return; }
  try {
    detail.value = await adapterProxy.getDetail(source, id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

function play(ep: Episode) {
  if (!detail.value) return;
  playerStore.setCurrent({ vod: detail.value, sourceId, episode: ep });
  historyStore.touch({ vod: detail.value, sourceId, episode: ep, progress: 0 });
  router.push({ path: `/player/${id}`, query: { sourceId, ep: ep.url } });
}

function toggleFav() {
  if (!detail.value) return;
  favoriteStore.toggle({ vod: detail.value, sourceId });
}

const isFav = computed(() => detail.value ? favoriteStore.isFavorited(detail.value.id, sourceId) : false);

onMounted(load);
</script>

<template>
  <div class="detail">
    <NavBar :title="detail?.name || '详情'" />
    <LoadingState v-if="loading" />
    <EmptyState v-else-if="error" :text="error" />
    <template v-else-if="detail">
      <div class="header">
        <img class="poster" :src="detail.pic" :alt="detail.name" />
        <div class="meta">
          <h1 class="title">{{ detail.name }}</h1>
          <div class="row" v-if="detail.year">{{ detail.year }}<span v-if="detail.area"> · {{ detail.area }}</span></div>
          <div class="row" v-if="detail.actor">主演: {{ detail.actor }}</div>
          <div class="row" v-if="detail.director">导演: {{ detail.director }}</div>
          <button class="fav-btn" :class="{ active: isFav }" @click="toggleFav">{{ isFav ? '已收藏' : '收藏' }}</button>
        </div>
      </div>
      <CellGroup inset v-if="detail.desc">
        <Cell title="剧情" :label="detail.desc" />
      </CellGroup>
      <EpisodeList v-if="detail.playFrom.length" :detail="detail" @select="play" />
    </template>
  </div>
</template>

<style scoped>
.detail { padding-top: 46px; }
.header { display: flex; gap: 12px; padding: 12px; }
.poster { width: 120px; border-radius: 6px; }
.meta { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.title { margin: 0 0 8px; font-size: 18px; }
.row { font-size: 13px; color: var(--van-text-color-2); }
.fav-btn { margin-top: 8px; padding: 6px 12px; border: 1px solid var(--van-primary-color); background: transparent; color: var(--van-primary-color); border-radius: 4px; cursor: pointer; align-self: flex-start; }
.fav-btn.active { background: var(--van-primary-color); color: white; }
</style>
```

- [ ] **Task 4.12: Type-check + commit**

```bash
cd /workspace/hplayer && pnpm type-check
git add -A && git commit -m "feat(P4-D): detail page"
```

---

## Agent P4-E: 收藏与历史

**Own Files:**
- Create: `packages/views/src/favorite/index.vue`, `packages/views/src/history/index.vue`

---

- [ ] **Task 4.13: favorite/index.vue**

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { NavBar, EmptyState, Cell, CellGroup, Button } from 'vant';
import { useFavoriteStore } from '@hplayer/core';
import type { VodItem } from '@hplayer/core';

const router = useRouter();
const store = useFavoriteStore();

function go(it: VodItem) {
  router.push({ path: `/detail/${it.id}`, query: { sourceId: it.sourceId } });
}
</script>

<template>
  <div class="favorite">
    <NavBar title="收藏" />
    <EmptyState v-if="!store.items.length" text="还没有收藏" />
    <CellGroup v-else inset>
      <Cell
        v-for="fav in store.items"
        :key="fav.id"
        :title="fav.vod.name"
        :label="fav.vod.remarks"
        clickable
        is-link
        @click="go(fav.vod)"
      >
        <template #right-icon>
          <Button size="mini" plain @click.stop="store.remove(fav.vod.id, fav.sourceId)">取消</Button>
        </template>
      </Cell>
    </CellGroup>
  </div>
</template>

<style scoped>
.favorite { padding-top: 46px; }
</style>
```

- [x] **Task 4.14: history/index.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { NavBar, EmptyState, Cell, CellGroup, Progress } from 'vant';
import { useHistoryStore } from '@hplayer/core';

const router = useRouter();
const store = useHistoryStore();
const list = computed(() => store.items.slice().sort((a, b) => b.lastWatchTime - a.lastWatchTime));

function go(item: typeof list.value[number]) {
  router.push({ path: `/player/${item.vod.id}`, query: { sourceId: item.sourceId, ep: item.episode?.url, t: Math.floor((item.progress ?? 0) * (item.duration ?? 0)) } });
}
</script>

<template>
  <div class="history">
    <NavBar title="历史" />
    <EmptyState v-if="!list.length" text="还没有播放记录" />
    <CellGroup v-else inset>
      <Cell
        v-for="item in list"
        :key="item.id"
        :title="item.vod.name"
        :label="item.episode?.name || '未选集'"
        clickable
        is-link
        @click="go(item)"
      >
        <template #label>
          <div class="progress-wrap">
            <Progress :percentage="Math.round((item.progress ?? 0) * 100)" stroke-width="4" />
          </div>
        </template>
      </Cell>
    </CellGroup>
  </div>
</template>

<style scoped>
.history { padding-top: 46px; }
.progress-wrap { margin-top: 4px; }
</style>
```

- [ ] **Task 4.15: Type-check + commit**

```bash
cd /workspace/hplayer && pnpm type-check
git add -A && git commit -m "feat(P4-E): favorite + history pages"
```

---

## Agent P4-F: 播放页

**Own Files:**
- Create: `packages/views/src/player/index.vue`

---

- [x] **Task 4.16: player/index.vue**

```vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NavBar } from 'vant';
import Hls from 'hls.js';
import Artplayer from 'artplayer';
import { usePlayerStore, useHistoryStore, detectProtocol, type Episode } from '@hplayer/core';

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const historyStore = useHistoryStore();

const container = ref<HTMLDivElement | null>(null);
let player: Artplayer | null = null;
let hlsInstance: Hls | null = null;
let lastReport = 0;

const id = route.params.id as string;
const sourceId = (route.query.sourceId as string) || '';
const epUrl = (route.query.ep as string) || '';
const startAt = Number(route.query.t ?? 0);

const episode: Episode = { name: '', url: epUrl };

onMounted(() => {
  if (!container.value || !epUrl) return;
  const protocol = detectProtocol(epUrl);
  const options: ConstructorParameters<typeof Artplayer>[0] = {
    container: container.value,
    url: epUrl,
    autoplay: true,
    playsInline: true,
    fullscreen: true,
    theme: '#3b82f6',
  };
  if (protocol === 'hls') {
    options.type = 'm3u8';
    options.customType = {
      m3u8: (video: HTMLVideoElement, url: string) => {
        if (Hls.isSupported()) {
          hlsInstance = new Hls();
          hlsInstance.loadSource(url);
          hlsInstance.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url;
        }
      },
    };
  }
  player = new Artplayer(options);
  if (startAt > 0) player.seek = startAt;

  player.on('video:timeupdate', () => {
    const now = Date.now();
    if (now - lastReport < 10_000) return;
    lastReport = now;
    const v = playerStore.current;
    if (!v) return;
    const cur = player?.currentTime ?? 0;
    const dur = player?.duration ?? 0;
    historyStore.touch({
      vod: v.vod,
      sourceId: v.sourceId,
      episode: v.episode ?? episode,
      progress: dur > 0 ? cur / dur : 0,
      duration: dur,
    });
  });
});

onBeforeUnmount(() => {
  if (hlsInstance) hlsInstance.destroy();
  if (player) player.destroy();
  playerStore.clear();
});
</script>

<template>
  <div class="player-page">
    <NavBar title="播放" />
    <div class="player-container" ref="container"></div>
  </div>
</template>

<style scoped>
.player-page { background: black; min-height: 100vh; padding-top: 46px; }
.player-container { width: 100%; aspect-ratio: 16/9; background: black; }
</style>
```

- [ ] **Task 4.17: Type-check + build + commit**

```bash
cd /workspace/hplayer && pnpm type-check && pnpm build
git add -A && git commit -m "feat(P4-F): player page with hls.js + artplayer"
```

---

## 完成判定

- [ ] P4-A 全部 5 个 task 完成（Task 4.1-4.5）
- [ ] P4-B 全部 2 个 task 完成（Task 4.6-4.7）
- [ ] P4-C 全部 3 个 task 完成（Task 4.8-4.10）
- [ ] P4-D 全部 2 个 task 完成（Task 4.11-4.12）
- [ ] P4-E 全部 3 个 task 完成（Task 4.13-4.15）
- [ ] P4-F 全部 2 个 task 完成（Task 4.16-4.17）
- [ ] `pnpm build` 通过
- [ ] 六个 agent 的 commit 已记录到 STATE.md

完成后主 agent：
1. 在本文件顶部「状态」勾选 `completed`。
2. 更新 `STATE.md`：`current_phase = 06`。
3. 派发 P5-1 subagent（单 agent）。
