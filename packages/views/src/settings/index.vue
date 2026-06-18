<script setup lang="ts">
import { exportBackup, importBackup, useSettingsStore, useSourceStore } from '@hplayer/core'
import { Button, Cell, CellGroup, NavBar, Switch, showToast } from 'vant'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const sourceStore = useSourceStore()
const settingsStore = useSettingsStore()

const fileInput = ref<HTMLInputElement | null>(null)

const sources = computed(() => sourceStore.list.slice().sort((a, b) => a.order - b.order))

function toggleEnabled(id: string, enabled: boolean) {
  sourceStore.update(id, { enabled })
}

function editSource(id: string) {
  router.push(`/settings/source/edit/${id}`)
}

function setTheme(theme: 'light' | 'dark' | 'auto') {
  settingsStore.setTheme(theme)
}

function setDevice(device: 'mobile' | 'desktop' | 'tablet') {
  settingsStore.setDeviceType(device)
  showToast(
    `已切换至${device === 'mobile' ? '移动端' : device === 'desktop' ? '桌面端' : '平板'} UA`,
  )
}

function exportData() {
  const raw = exportBackup()
  const blob = new Blob([raw], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hplayer-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  showToast('导出成功')
}

function triggerImport() {
  fileInput.value?.click()
}

function handleImport(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    const raw = ev.target?.result as string | undefined
    if (!raw) {
      showToast('文件读取失败')
      return
    }
    if (importBackup(raw)) {
      showToast('导入成功，请刷新页面')
    } else {
      showToast('无效的备份文件')
    }
  }
  reader.onerror = () => showToast('文件读取失败')
  reader.readAsText(file)
  target.value = ''
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
      <div class="section-title">数据管理</div>
      <CellGroup inset>
        <Cell title="导出数据" clickable is-link @click="exportData">
          <template #right-icon><span class="hint">导出视频源、收藏、历史</span></template>
        </Cell>
        <Cell title="导入数据" clickable is-link @click="triggerImport">
          <template #right-icon><span class="hint">从备份文件恢复</span></template>
        </Cell>
      </CellGroup>
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
      <div class="section-title">UA 设备类型</div>
      <CellGroup inset>
        <Cell
          title="移动端"
          label="iPhone / Android（推荐）"
          clickable
          @click="setDevice('mobile')"
          :icon="settingsStore.settings.deviceType === 'mobile' ? 'success' : ''"
        />
        <Cell
          title="桌面端"
          label="Windows / Mac / Linux"
          clickable
          @click="setDevice('desktop')"
          :icon="settingsStore.settings.deviceType === 'desktop' ? 'success' : ''"
        />
        <Cell
          title="平板"
          label="iPad / Android Tablet"
          clickable
          @click="setDevice('tablet')"
          :icon="settingsStore.settings.deviceType === 'tablet' ? 'success' : ''"
        />
      </CellGroup>
    </div>

    <div class="section">
      <CellGroup inset>
        <Cell title="关于 hplayer" label="v0.1.0" />
        <Cell title="开源协议" label="MIT" />
      </CellGroup>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleImport"
    />
  </div>
</template>

<style scoped>
.settings { padding-top: 46px; }
.section { margin-bottom: 16px; }
.section-title { padding: 8px 16px; font-size: 12px; color: var(--van-text-color-2); }
.add-btn { padding: 12px 16px; }
.hint { font-size: 12px; color: var(--van-text-color-2); }
</style>
