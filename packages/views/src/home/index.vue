<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { VodList, EmptyState, LoadingState, AppHeader, CategoryBar } from '@hplayer/ui';
import { useSourceStore, adapterProxy, type Category, type VodItem } from '@hplayer/core';

const router = useRouter();
const sourceStore = useSourceStore();

const categories = ref<Category[]>([]);
const activeCategory = ref<Category | null>(null);
const items = ref<VodItem[]>([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);

async function loadCategories() {
  if (!sourceStore.activeSource) return;
  try {
    categories.value = await adapterProxy.getCategories(sourceStore.activeSource);
    if (categories.value.length && !activeCategory.value) {
      activeCategory.value = categories.value[0] ?? null;
      if (activeCategory.value) await loadList(true);
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

const showInitialLoader = computed(() => loading.value && !items.value.length);

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
    <div v-if="showInitialLoader" class="loader"><LoadingState /></div>
    <VodList
      v-else-if="items.length"
      :items="items"
      :loading="loading"
      :finished="finished"
      @load="() => loadList()"
      @refresh="() => loadList(true)"
      @select="goDetail"
    />
    <EmptyState v-else text="请先在设置中添加视频源" />
  </div>
</template>

<style scoped>
.home { display: flex; flex-direction: column; min-height: 100%; }
.loader { padding: 12px; }
</style>
