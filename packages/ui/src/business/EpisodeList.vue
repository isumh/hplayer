<script setup lang="ts">
import type { Episode, VodDetail } from '@hplayer/core';
import { Grid, GridItem, Tab, Tabs } from 'vant';
import { computed, ref } from 'vue';

const props = defineProps<{ detail: VodDetail }>();
const emit = defineEmits<(e: 'select', ep: Episode) => void>();

const lines = computed(() => props.detail.playFrom.map((p) => p.name));
const activeLine = ref<string>(lines.value[0] ?? '');
const episodes = computed<Episode[]>(() => props.detail.playList[activeLine.value] ?? []);
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
