<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { CellGroup, Cell, Button, Switch, NavBar } from 'vant';
import { useSourceStore, useSettingsStore } from '@hplayer/core';

const router = useRouter();
const sourceStore = useSourceStore();
const settingsStore = useSettingsStore();

const sources = computed(() => sourceStore.list.slice().sort((a, b) => a.order - b.order));

function toggleEnabled(id: string, enabled: boolean) {
  sourceStore.update(id, { enabled });
}

function editSource(id: string) {
  router.push(`/settings/source/edit/${id}`);
}

function setTheme(theme: 'light' | 'dark' | 'auto') {
  settingsStore.setTheme(theme);
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
            <Switch
              :model-value="s.enabled"
              @update:model-value="(v) => toggleEnabled(s.id, v as boolean)"
              @click.stop
            />
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
        <Cell
          title="亮色"
          clickable
          @click="setTheme('light')"
          :icon="settingsStore.settings.theme === 'light' ? 'success' : ''"
        />
        <Cell
          title="暗色"
          clickable
          @click="setTheme('dark')"
          :icon="settingsStore.settings.theme === 'dark' ? 'success' : ''"
        />
        <Cell
          title="跟随系统"
          clickable
          @click="setTheme('auto')"
          :icon="settingsStore.settings.theme === 'auto' ? 'success' : ''"
        />
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
