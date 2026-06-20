<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update'
import { exportBackup, importBackup, useSettingsStore, useSourceStore } from '@hplayer/core'
import {
  Button,
  Cell,
  CellGroup,
  Field,
  NavBar,
  Picker,
  Popup,
  Switch,
  showConfirmDialog,
  showToast,
} from 'vant'
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

async function checkUpdate() {
  if (!Capacitor.isNativePlatform()) {
    showToast('检查更新仅支持原生应用')
    return
  }
  try {
    const info = await AppUpdate.getAppUpdateInfo()
    if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) {
      const ok = await showConfirmDialog({
        title: '发现新版本',
        message: `当前版本：${info.currentVersionName}\n最新版本：${info.availableVersionName}\n是否前往应用商店更新？`,
      })
        .then(() => true)
        .catch(() => false)
      if (ok) await AppUpdate.openAppStore()
    } else {
      showToast('当前已是最新版本')
    }
  } catch (err) {
    console.error('[checkUpdate]', err)
    showToast('检查更新失败')
  }
}

function deviceLabel(device: 'mobile' | 'desktop' | 'tablet'): string {
  if (device === 'mobile') return '移动端'
  if (device === 'desktop') return '桌面端'
  return '平板'
}

function setDevice(device: 'mobile' | 'desktop' | 'tablet') {
  settingsStore.setDeviceType(device)
  showToast(`已切换至${deviceLabel(device)} UA`)
}

const showThemePicker = ref(false)
const showDevicePicker = ref(false)

const themeColumns = [
  { text: '亮色', value: 'light' },
  { text: '暗色', value: 'dark' },
  { text: '跟随系统', value: 'auto' },
]

const deviceColumns = [
  { text: '移动端', value: 'mobile', label: 'iPhone / Android（推荐）' },
  { text: '桌面端', value: 'desktop', label: 'Windows / Mac / Linux' },
  { text: '平板', value: 'tablet', label: 'iPad / Android Tablet' },
]

const themeResult = computed(() => {
  const item = themeColumns.find((c) => c.value === settingsStore.settings.theme)
  return item?.text ?? '跟随系统'
})

const deviceResult = computed(() => {
  const item = deviceColumns.find((c) => c.value === settingsStore.settings.deviceType)
  return item?.text ?? '移动端'
})

const themePickerValue = computed(() => {
  const value = settingsStore.settings.theme
  return themeColumns.some((c) => c.value === value) ? [value] : ['auto']
})

const devicePickerValue = computed(() => {
  const value = settingsStore.settings.deviceType
  return deviceColumns.some((c) => c.value === value) ? [value] : ['mobile']
})

function onThemeConfirm({ selectedValues }: { selectedValues: (string | number)[] }) {
  const value = selectedValues[0] as 'light' | 'dark' | 'auto'
  setTheme(value)
  showThemePicker.value = false
}

function onDeviceConfirm({ selectedValues }: { selectedValues: (string | number)[] }) {
  const value = selectedValues[0] as 'mobile' | 'desktop' | 'tablet'
  setDevice(value)
  showDevicePicker.value = false
}

const BACKUP_DIR = 'hplayer'
const BACKUP_FILE_PREFIX = 'hplayer-backup'

function backupFileName(): string {
  return `${BACKUP_FILE_PREFIX}-${new Date().toISOString().slice(0, 10)}.json`
}

async function ensureBackupDir(dir: Directory, path: string): Promise<void> {
  try {
    await Filesystem.readdir({ directory: dir, path })
  } catch {
    await Filesystem.mkdir({ directory: dir, path, recursive: true })
  }
}

async function exportDataNative() {
  const raw = exportBackup()
  const fileName = backupFileName()

  // 请求公共存储读写权限（Android 6+ 需要运行时授权）
  try {
    const perm = await Filesystem.requestPermissions()
    if (perm.publicStorage !== 'granted') {
      showToast('需要存储权限才能导出备份')
      return
    }
  } catch (err) {
    console.warn('[exportDataNative] requestPermissions failed:', err)
  }

  // 优先尝试保存到 Downloads/hplayer/，失败则回退到 Documents/hplayer/
  const strategies: { dir: Directory; path: string; label: string }[] = [
    {
      dir: Directory.ExternalStorage,
      path: `Download/${BACKUP_DIR}/${fileName}`,
      label: 'Download/hplayer',
    },
    { dir: Directory.Documents, path: `${BACKUP_DIR}/${fileName}`, label: 'Documents/hplayer' },
  ]

  for (const { dir, path, label } of strategies) {
    try {
      const dirPath = path.slice(0, path.lastIndexOf('/'))
      await ensureBackupDir(dir, dirPath)
      const result = await Filesystem.writeFile({
        directory: dir,
        path,
        data: raw,
        encoding: Encoding.UTF8,
      })
      showToast(`已导出到 ${label}/${fileName}`)
      console.log('[exportDataNative] uri:', result.uri)
      return
    } catch (err) {
      console.warn(`[exportDataNative] failed to write to ${label}:`, err)
    }
  }

  showToast('导出失败，请检查存储权限')
}

function exportDataWeb() {
  const raw = exportBackup()
  const blob = new Blob([raw], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName()
  a.click()
  URL.revokeObjectURL(url)
  showToast('导出成功')
}

async function exportData() {
  if (Capacitor.isNativePlatform()) {
    await exportDataNative()
  } else {
    exportDataWeb()
  }
}

function triggerImport() {
  fileInput.value?.click()
}

function handleImport(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    showToast('未选择文件')
    return
  }
  if (!file.name.endsWith('.json')) {
    showToast('请选择 .json 备份文件')
    target.value = ''
    return
  }
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

    <CellGroup inset>
      <Field
        :model-value="themeResult"
        is-link
        readonly
        input-align="right"
        name="theme"
        label="主题"
        placeholder="点击选择主题"
        @click="showThemePicker = true"
      />
      <Popup v-model:show="showThemePicker" destroy-on-close position="bottom" lock-scroll>
        <Picker
          :columns="themeColumns"
          :model-value="themePickerValue"
          @confirm="onThemeConfirm"
          @cancel="showThemePicker = false"
        />
      </Popup>

      <Field
        :model-value="deviceResult"
        is-link
        readonly
        input-align="right"
        name="device"
        label="UA 设备类型"
        placeholder="点击选择设备类型"
        @click="showDevicePicker = true"
      />
      <Popup v-model:show="showDevicePicker" destroy-on-close position="bottom" lock-scroll>
        <Picker
          :columns="deviceColumns"
          :model-value="devicePickerValue"
          @confirm="onDeviceConfirm"
          @cancel="showDevicePicker = false"
        />
      </Popup>
    </CellGroup>

    <div class="section">
      <CellGroup inset>
        <Cell title="检查更新" clickable is-link @click="checkUpdate" />
        <Cell title="关于 hplayer" value="v0.1.0" />
        <Cell title="开源协议" value="MIT" />
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
.settings {
  padding-top: 46px;
  padding-top: calc(46px + constant(safe-area-inset-top));
  padding-top: calc(46px + env(safe-area-inset-top));
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  overflow-x: hidden;
}
.section { margin-bottom: 16px; }
.section-title { padding: 8px 16px; font-size: 12px; color: var(--van-text-color-2); }
.add-btn { padding: 12px 16px; }
.hint { font-size: 12px; color: var(--van-text-color-2); }
</style>
