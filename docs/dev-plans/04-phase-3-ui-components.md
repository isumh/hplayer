# Phase 3: 共享 UI 组件

> 对应原文档 `2026-06-13-hplayer-v1.0-mvp.md` 第 2010-2679 行（Phase 3 完整内容）。
>
> **三个并行 Agent：A 布局 / B 视频 / C 业务**。
> 文件无重叠，可全并行。

## 状态

- [ ] pending
- [ ] in_progress
- [x] completed

> 主 agent 在 P2 完成后派发 P3-A / P3-B / P3-C 三个 subagent。STATE.md 中需为三者各创建独立状态行。

## 依赖

- P2 完成（CmsAdapter / aggregateSearch / adapterProxy 已就绪）。
- 跨 agent 引用：`P3-A AppHeader.vue` 引用 `P3-C SourcePicker.vue`（占位 import），运行 `pnpm type-check` 时必须在所有 P3 agent 完成后才通过。

## 阶段目标

实现 packages/ui 下的全部 11 个共享 UI 组件：
- **P3-A（布局）**：AppHeader / TabBar / NavBar / EmptyState / LoadingState（5 个）
- **P3-B（视频）**：VodCard / VodList / ImagePreview（3 个）
- **P3-C（业务）**：SourcePicker / CategoryBar / SearchBar / SearchHistory / EpisodeList / SourceForm（6 个）

## 并行约束

- 三个 agent 文件无重叠，**理论上可全并行**。
- 但 P3-A 的 `AppHeader.vue` 会 `import SourcePicker`（来自 P3-C）。**该 import 在 P3-A 完成时不会立即报错**（Vue SFC 编译时按需解析），但**最终 `pnpm type-check` 必须在 P3-C 完成后才通过**。
- 解决：P3-A 完成 type-check 时可临时注释掉该 import（后续 P3-C 完成后恢复），或先并行启动 P3-C 优先于 P3-A 完成 SourcePicker。

## 中断恢复说明

- 三个 agent 各自维护 `STATE.md` 中的状态行。
- **恢复点**：`STATE.md` 中 `- [P3-X]` 行的 `last_task` 字段（格式 `Task N.M`）。
- 子 agent 在自己的 task 列表中找下一个 `- [ ]` 继续。

---

## Agent P3-A: 布局与导航组件

**Own Files:**
- Create: `packages/ui/src/components/AppHeader.vue`, `packages/ui/src/components/TabBar.vue`, `packages/ui/src/components/NavBar.vue`
- Create: `packages/ui/src/components/EmptyState.vue`, `packages/ui/src/components/LoadingState.vue`

---

- [x] **Task 3.1: AppHeader.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useSourceStore, useFavoriteStore, useHistoryStore } from '@hplayer/core';
import SourcePicker from '../business/SourcePicker.vue';

const sourceStore = useSourceStore();
const activeSource = computed(() => sourceStore.activeSource);

function openFavorites() {
  // 由 router 注入
}
function openHistory() {
  // 由 router 注入
}
</script>

<template>
  <header class="app-header">
    <div class="left">
      <span class="logo">▶</span>
      <span class="title">hplayer</span>
    </div>
    <div class="center">
      <SourcePicker />
    </div>
    <div class="right">
      <button class="icon-btn" @click="openFavorites" aria-label="收藏">★</button>
      <button class="icon-btn" @click="openHistory" aria-label="历史">🕒</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 12px;
  background: var(--van-nav-bar-background);
  border-bottom: 1px solid var(--van-border-color);
}
.left { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.logo { color: var(--van-primary-color); font-size: 20px; }
.title { font-weight: 600; font-size: 16px; }
.center { flex: 1; display: flex; justify-content: center; min-width: 0; }
.right { display: flex; gap: 4px; flex: 0 0 auto; }
.icon-btn {
  background: none; border: none; padding: 6px;
  font-size: 18px; color: var(--van-text-color);
  cursor: pointer;
}
</style>
```

> **SourcePicker** 由 P3-C 创建；此处先 import 占位。Phase 3 完成后必须可解析。

- [ ] **Task 3.2: TabBar.vue（Vant Tabbar 封装）**

```vue
<script setup lang="ts">
import { Tabbar, TabbarItem } from 'vant';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const active = computed(() => route.path);

function go(path: string) {
  router.push(path);
}
</script>

<script lang="ts">
import { computed } from 'vue';
export default { name: 'HPlayerTabBar' };
</script>

<template>
  <Tabbar :model-value="active" safe-area-inset-bottom fixed>
    <TabbarItem name="/home" icon="home-o" @click="go('/home')">首页</TabbarItem>
    <TabbarItem name="/search" icon="search" @click="go('/search')">搜索</TabbarItem>
    <TabbarItem name="/settings" icon="setting-o" @click="go('/settings')">设置</TabbarItem>
  </Tabbar>
</template>
```

- [ ] **Task 3.3: NavBar.vue（Vant Navbar 封装）**

```vue
<script setup lang="ts">
import { NavBar } from 'vant';
import { useRouter } from 'vue-router';

const props = withDefaults(defineProps<{ title?: string; showBack?: boolean }>(), {
  title: '',
  showBack: true,
});

const router = useRouter();
function back() {
  if (window.history.length > 1) router.back();
  else router.push('/home');
}
</script>

<template>
  <NavBar :title="title" :left-arrow="showBack" @click-left="back" fixed safe-area-inset-top />
</template>
```

- [ ] **Task 3.4: EmptyState.vue**

```vue
<script setup lang="ts">
withDefaults(defineProps<{ text?: string; icon?: string }>(), {
  text: '暂无数据',
  icon: 'inbox-o',
});
</script>

<template>
  <div class="empty">
    <span class="icon">📭</span>
    <p class="text">{{ text }}</p>
  </div>
</template>

<style scoped>
.empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 20px; gap: 12px;
  color: var(--van-text-color-2);
}
.icon { font-size: 48px; }
.text { margin: 0; font-size: 14px; }
</style>
```

- [x] **Task 3.5: LoadingState.vue**

```vue
<template>
  <div class="loading">
    <van-skeleton :row="3" :row-width="['60%', '100%', '80%']" avatar />
  </div>
</template>

<script setup lang="ts">
import { Skeleton } from 'vant';
</script>

<style scoped>
.loading { padding: 12px; }
</style>
```

- [ ] **Task 3.6: Type-check + commit**

```bash
cd /workspace/hplayer && pnpm type-check
git add -A && git commit -m "feat(P3-A): layout components (AppHeader/TabBar/NavBar/Empty/Loading)"
```

---

## Agent P3-B: 视频展示组件

**Own Files:**
- Create: `packages/ui/src/business/VodCard.vue`, `packages/ui/src/business/VodList.vue`, `packages/ui/src/business/ImagePreview.vue`

---

- [ ] **Task 3.7: VodCard.vue**

```vue
<script setup lang="ts">
import { showImagePreview } from 'vant';
import type { VodItem } from '@hplayer/core';

const props = defineProps<{ item: VodItem; sourceName?: string }>();
const emit = defineEmits<{ (e: 'click', item: VodItem): void }>();

function previewImage(e: Event) {
  e.stopPropagation();
  showImagePreview({ images: [props.item.pic], closeable: true });
}

function goPlay(e: Event) {
  e.stopPropagation();
  emit('click', props.item);
}
</script>

<template>
  <div class="vod-card" @click="emit('click', item)">
    <div class="cover-wrap" @click="previewImage">
      <img class="cover" :src="item.pic" :alt="item.name" loading="lazy" />
      <button class="play-btn" @click="goPlay" aria-label="播放">▶</button>
      <span v-if="item.remarks" class="remark">{{ item.remarks }}</span>
    </div>
    <div class="name">{{ item.name }}</div>
    <div v-if="sourceName" class="source">{{ sourceName }}</div>
  </div>
</template>

<style scoped>
.vod-card { display: flex; flex-direction: column; gap: 4px; cursor: pointer; }
.cover-wrap { position: relative; aspect-ratio: 2/3; overflow: hidden; border-radius: 6px; background: var(--van-background-2); }
.cover { width: 100%; height: 100%; object-fit: cover; }
.play-btn {
  position: absolute; top: 6px; right: 6px;
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(0, 0, 0, 0.6); color: white;
  border: none; font-size: 12px; cursor: pointer;
}
.remark {
  position: absolute; bottom: 4px; right: 4px;
  background: rgba(0, 0, 0, 0.6); color: white;
  font-size: 10px; padding: 1px 4px; border-radius: 3px;
}
.name { font-size: 13px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--van-text-color); }
.source { font-size: 11px; color: var(--van-text-color-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
```

- [x] **Task 3.8: VodList.vue**

```vue
<script setup lang="ts">
import { PullRefresh, List } from 'vant';
import type { VodItem } from '@hplayer/core';
import VodCard from './VodCard.vue';

const props = defineProps<{
  items: VodItem[];
  sourceName?: string;
  loading: boolean;
  finished: boolean;
}>();

const emit = defineEmits<{
  (e: 'load'): void;
  (e: 'refresh'): void;
  (e: 'select', item: VodItem): void;
}>();

function onLoad() { emit('load'); }
function onRefresh() { emit('refresh'); }
</script>

<template>
  <PullRefresh v-model="refreshing" @refresh="onRefresh">
    <List :loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad">
      <div class="grid">
        <VodCard
          v-for="item in items"
          :key="`${item.sourceId}-${item.id}`"
          :item="item"
          :source-name="sourceName"
          @click="(it: VodItem) => emit('select', it)"
        />
      </div>
    </List>
  </PullRefresh>
</template>

<script lang="ts">
import { ref } from 'vue';
const refreshing = ref(false);
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 12px;
}
@media (min-width: 768px) {
  .grid { grid-template-columns: repeat(5, 1fr); }
}
@media (min-width: 1024px) {
  .grid { grid-template-columns: repeat(6, 1fr); max-width: 1200px; margin: 0 auto; }
}
</style>
```

- [ ] **Task 3.9: ImagePreview.vue（Vant ImagePreview 二次封装）**

```vue
<script setup lang="ts">
import { showImagePreview } from 'vant';

const props = withDefaults(defineProps<{ src: string }>(), {});
defineExpose({ open });

function open() {
  showImagePreview({ images: [props.src], closeable: true });
}
</script>

<template>
  <span class="hidden"></span>
</template>

<style scoped>
.hidden { display: none; }
</style>
```

- [ ] **Task 3.10: Type-check + commit**

```bash
cd /workspace/hplayer && pnpm type-check
git add -A && git commit -m "feat(P3-B): video display components (VodCard/VodList/ImagePreview)"
```

---

## Agent P3-C: 业务组件

**Own Files:**
- Create: `packages/ui/src/business/SourcePicker.vue`, `packages/ui/src/business/CategoryBar.vue`, `packages/ui/src/business/SearchBar.vue`, `packages/ui/src/business/SearchHistory.vue`, `packages/ui/src/business/EpisodeList.vue`, `packages/ui/src/business/SourceForm.vue`

---

- [ ] **Task 3.11: SourcePicker.vue**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { Popup, Cell, CellGroup, Tag } from 'vant';
import { useSourceStore } from '@hplayer/core';

const store = useSourceStore();
const showPicker = ref(false);
const activeName = computed(() => store.activeSource?.name ?? '选择视频源');
const sources = computed(() => store.list.filter((s) => s.enabled).sort((a, b) => a.order - b.order));

function pick(id: string) {
  store.setActive(id);
  showPicker.value = false;
}
</script>

<template>
  <div class="source-picker" @click="showPicker = true">
    <span class="name">{{ activeName }}</span>
    <span class="arrow">▾</span>
  </div>
  <Popup v-model:show="showPicker" position="top" round :style="{ background: 'var(--van-background)' }">
    <CellGroup>
      <Cell
        v-for="s in sources"
        :key="s.id"
        :title="s.name"
        clickable
        @click="pick(s.id)"
      >
        <template #value>
          <Tag v-if="s.id === store.activeSourceId" type="primary">当前</Tag>
        </template>
      </Cell>
    </CellGroup>
  </Popup>
</template>

<style scoped>
.source-picker {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 10px; border-radius: 16px;
  background: var(--van-background-2);
  max-width: 60vw; cursor: pointer;
}
.name { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arrow { font-size: 12px; color: var(--van-text-color-2); }
</style>
```

- [ ] **Task 3.12: CategoryBar.vue（横向滚动）**

```vue
<script setup lang="ts">
import { ref } from 'vant';
import type { Category } from '@hplayer/core';

const props = defineProps<{ items: Category[] }>();
const emit = defineEmits<{ (e: 'select', cat: Category): void }>();
const activeId = ref<string | number | null>(null);

function pick(c: Category) {
  activeId.value = c.id;
  emit('select', c);
}
</script>

<template>
  <div class="cat-bar">
    <button
      v-for="c in items"
      :key="c.id"
      :class="['cat-item', { active: c.id === activeId }]"
      @click="pick(c)"
    >
      {{ c.name }}
    </button>
  </div>
</template>

<style scoped>
.cat-bar {
  display: flex; gap: 6px; padding: 8px 12px;
  overflow-x: auto; white-space: nowrap;
  background: var(--van-background);
  border-bottom: 1px solid var(--van-border-color);
}
.cat-item {
  flex: 0 0 auto;
  padding: 6px 14px; border-radius: 16px;
  background: var(--van-background-2);
  color: var(--van-text-color);
  border: none; font-size: 13px; cursor: pointer;
}
.cat-item.active { background: var(--van-primary-color); color: white; }
</style>
```

- [ ] **Task 3.13: SearchBar.vue**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import { Search, RadioGroup, Radio } from 'vant';

const props = withDefaults(defineProps<{ modelValue: string; mode: 'single' | 'aggregate' }>(), {
  modelValue: '',
  mode: 'aggregate',
});
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void;
  (e: 'update:mode', v: 'single' | 'aggregate'): void;
  (e: 'search', keyword: string): void;
}>();

const local = ref(props.modelValue);
const localMode = ref(props.mode);

watch(() => props.modelValue, (v) => { local.value = v; });
watch(local, (v) => emit('update:modelValue', v));
watch(localMode, (v) => emit('update:mode', v));

let timer: ReturnType<typeof setTimeout> | null = null;
function onInput(v: string) {
  local.value = v;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => emit('search', v.trim()), 500);
}
function onSubmit() {
  if (timer) clearTimeout(timer);
  emit('search', local.value.trim());
}
</script>

<template>
  <div class="search-bar">
    <Search v-model="local" placeholder="搜索影视名称" @update:model-value="onInput" @search="onSubmit" />
    <RadioGroup v-model="localMode" direction="horizontal" class="mode-group">
      <Radio name="single">当前源</Radio>
      <Radio name="aggregate">聚合</Radio>
    </RadioGroup>
  </div>
</template>

<style scoped>
.search-bar { padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; background: var(--van-background); }
.mode-group { justify-content: center; }
</style>
```

- [x] **Task 3.14: SearchHistory.vue**

```vue
<script setup lang="ts">
import { Cell, CellGroup, Tag, Dialog } from 'vant';
import { useSearchHistoryStore } from '@hplayer/core';

const store = useSearchHistoryStore();
const emit = defineEmits<{ (e: 'select', keyword: string): void }>();

async function clearAll() {
  const confirmed = await Dialog.confirm({ title: '清空搜索历史', message: '确认删除所有搜索历史？' }).then(() => true).catch(() => false);
  if (confirmed) store.clear();
}

function removeOne(keyword: string) {
  store.remove(keyword);
}
</script>

<template>
  <div class="search-history" v-if="store.items.length">
    <div class="header">
      <span>搜索历史</span>
      <button class="clear-btn" @click="clearAll">全部删除</button>
    </div>
    <div class="tags">
      <Tag
        v-for="item in store.items"
        :key="item.keyword"
        closeable
        @click="emit('select', item.keyword)"
        @close="removeOne(item.keyword)"
        class="tag"
      >
        {{ item.keyword }}
      </Tag>
    </div>
  </div>
</template>

<style scoped>
.search-history { padding: 12px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.clear-btn { background: none; border: none; color: var(--van-text-color-2); font-size: 12px; cursor: pointer; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { cursor: pointer; }
</style>
```

- [x] **Task 3.15: EpisodeList.vue**

```vue
<script setup lang="ts">
import { Tabs, Tab, Grid, GridItem } from 'vant';
import type { Episode, VodDetail } from '@hplayer/core';
import { computed } from 'vue';

const props = defineProps<{ detail: VodDetail }>();
const emit = defineEmits<{ (e: 'select', ep: Episode): void }>();

const lines = computed(() => props.detail.playFrom.map((p) => p.name));
const activeLine = ref(lines.value[0] ?? '');
const episodes = computed<Episode[]>(() => props.detail.playList[activeLine.value] ?? []);
</script>

<script lang="ts">
import { ref } from 'vue';
</script>

<template>
  <div class="episode-list">
    <Tabs v-model:active="activeLine" sticky>
      <Tab v-for="line in lines" :key="line" :title="line" :name="line">
        <Grid :column-num="4" :gutter="6">
          <GridItem
            v-for="(ep, i) in episodes"
            :key="ep.url"
            :text="ep.name || `第${i + 1}集`"
            @click="emit('select', ep)"
          />
        </Grid>
      </Tab>
    </Tabs>
  </div>
</template>

<style scoped>
.episode-list { padding: 8px 12px; }
</style>
```

- [x] **Task 3.16: SourceForm.vue**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import { Form, Field, CellGroup, RadioGroup, Radio, Switch, Stepper, Button, showToast } from 'vant';
import { useSourceStore, clampPageSize } from '@hplayer/core';
import { useRouter } from 'vue-router';
import type { VideoSource, SourceType } from '@hplayer/core';

const props = defineProps<{ sourceId?: string }>();
const router = useRouter();
const store = useSourceStore();

const form = ref<Omit<VideoSource, 'id' | 'createdAt' | 'order'>>({
  name: '',
  type: 't1_json',
  baseUrl: '',
  pageSize: 20,
  enabled: true,
  remark: '',
});

watch(() => props.sourceId, (id) => {
  if (id) {
    const s = store.list.find((x) => x.id === id);
    if (s) form.value = { name: s.name, type: s.type, baseUrl: s.baseUrl, pageSize: s.pageSize ?? 20, enabled: s.enabled, remark: s.remark ?? '' };
  }
}, { immediate: true });

function submit() {
  if (!form.value.name.trim()) return showToast('请输入名称');
  if (!form.value.baseUrl.trim()) return showToast('请输入接口地址');
  const cleaned: Omit<VideoSource, 'id' | 'createdAt' | 'order'> = {
    ...form.value,
    name: form.value.name.trim(),
    baseUrl: form.value.baseUrl.trim().replace(/\/+$/, ''),
    pageSize: clampPageSize(form.value.pageSize, 20),
  };
  if (props.sourceId) {
    store.update(props.sourceId, cleaned);
    showToast('已更新');
  } else {
    store.add(cleaned);
    showToast('已添加');
  }
  router.replace('/settings');
}
</script>

<template>
  <Form @submit="submit">
    <CellGroup inset>
      <Field v-model="form.name" label="名称" placeholder="如：猫咪" required :maxlength="20" />
      <Field name="type" label="类型">
        <template #input>
          <RadioGroup v-model="form.type" direction="horizontal">
            <Radio name="t1_json">JSON</Radio>
            <Radio name="t0_xml">XML</Radio>
          </RadioGroup>
        </template>
      </Field>
      <Field v-model="form.baseUrl" label="接口地址" placeholder="https://.../api.php/provide/vod" required />
      <Field name="pageSize" label="每页条数">
        <template #input>
          <Stepper v-model="form.pageSize" :min="1" :max="100" />
        </template>
      </Field>
      <Field name="enabled" label="启用">
        <template #input>
          <Switch v-model="form.enabled" />
        </template>
      </Field>
      <Field v-model="form.remark" label="备注" type="textarea" placeholder="选填" :maxlength="200" rows="2" autosize />
    </CellGroup>
    <div class="actions">
      <Button type="primary" native-type="submit" block>保存</Button>
    </div>
  </Form>
</template>

<style scoped>
.actions { padding: 16px; }
</style>
```

- [ ] **Task 3.17: Type-check + commit**

```bash
cd /workspace/hplayer && pnpm type-check
git add -A && git commit -m "feat(P3-C): business components (SourcePicker/CategoryBar/SearchBar/SearchHistory/EpisodeList/SourceForm)"
```

---

## 完成判定

- [ ] P3-A 全部 6 个 task 完成（Task 3.1-3.6）
- [ ] P3-B 全部 4 个 task 完成（Task 3.7-3.10）
- [ ] P3-C 全部 7 个 task 完成（Task 3.11-3.17）
- [ ] `pnpm type-check` 0 error
- [ ] 三个 agent 的 commit 已记录到 STATE.md

完成后主 agent：
1. 在本文件顶部「状态」勾选 `completed`。
2. 更新 `STATE.md`：`current_phase = 05`。
3. 在 STATE.md 的「并行 Agent 状态行」P4 段为 P4-A / P4-B / P4-C / P4-D / P4-E / P4-F 各创建一行（status=pending）。
4. 派发 P4-A / P4-B / P4-C / P4-D / P4-E / P4-F 六个 subagent。
