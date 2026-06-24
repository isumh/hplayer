<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import type { VideoSource } from '@hplayer/core'
import { clampPageSize, parseReservedCategories, useSourceStore } from '@hplayer/core'
import {
  Button,
  CellGroup,
  Field,
  Form,
  Radio,
  RadioGroup,
  Stepper,
  Switch,
  showConfirmDialog,
  showToast,
} from 'vant'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ sourceId?: string }>()
const router = useRouter()
const store = useSourceStore()

// 表单内部用字符串承载 reservedCategories，便于编辑；
// 提交时通过 parseReservedCategories 转成 string[]
const form = ref<Omit<VideoSource, 'id' | 'createdAt' | 'order'> & { reservedCategoriesText: string }>({
  name: '',
  type: 't1_json',
  baseUrl: '',
  pageSize: 20,
  enabled: true,
  remark: '',
  forceHttpsImage: false,
  reservedCategoriesText: '',
})

watch(
  () => props.sourceId,
  (id) => {
    if (id) {
      const s = store.list.find((x) => x.id === id)
      if (s) {
        const next: Omit<VideoSource, 'id' | 'createdAt' | 'order'> & {
          reservedCategoriesText: string
        } = {
          name: s.name,
          type: s.type,
          baseUrl: s.baseUrl,
          pageSize: s.pageSize ?? 20,
          enabled: s.enabled,
          forceHttpsImage: s.forceHttpsImage ?? false,
          reservedCategoriesText: (s.reservedCategories ?? []).join(' '),
        }
        form.value = next
      }
    }
  },
  { immediate: true },
)

async function probeCors(url: string): Promise<boolean> {
  // 原生环境通过 CapacitorHttp 请求，不存在 WebView CORS 问题
  if (Capacitor.isNativePlatform()) return true
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    await fetch(url, { method: 'GET', mode: 'cors', signal: controller.signal })
    clearTimeout(timer)
    return true
  } catch {
    return false
  }
}

async function submit() {
  if (!form.value.baseUrl.trim()) return showToast('请输入接口地址')
  if (!form.value.name.trim()) return showToast('请输入名称')
  const reserved = parseReservedCategories(form.value.reservedCategoriesText)
  const { reservedCategoriesText: _omit, ...rest } = form.value
  void _omit
  // 注意：必须始终写入 reservedCategories（清空时传 []），不能用"key 缺失"表达清除。
  // 因为 sourceStore.update 走的是 { ...current, ...patch }，spread 不会删除 current 上的字段，
  // 缺 key 会导致旧值被保留，首页继续按旧保留分类过滤。
  // [] 与 undefined 对 filterCategoriesByReserved 等价（都显示所有分类）。
  const cleaned: Omit<VideoSource, 'id' | 'createdAt' | 'order'> = {
    ...rest,
    name: rest.name.trim(),
    baseUrl: rest.baseUrl.trim().replace(/\/+$/, ''),
    pageSize: clampPageSize(rest.pageSize, 20),
    reservedCategories: reserved,
  }
  // 非原生环境下探测源站 CORS，失败时提示用户仍要保存
  const corsOk = await probeCors(cleaned.baseUrl)
  if (!corsOk) {
    const keep = await showConfirmDialog({
      title: '跨域提示',
      message:
        '该源站在当前浏览器/WebView 中可能存在 CORS 限制，保存后可能无法正常访问。是否继续保存？',
    })
      .then(() => true)
      .catch(() => false)
    if (!keep) return
  }
  if (props.sourceId) {
    store.update(props.sourceId, cleaned)
    showToast('已更新')
  } else {
    store.add(cleaned)
    showToast('已添加')
  }
  router.replace('/settings')
}

async function remove() {
  if (!props.sourceId) return
  const src = store.list.find((s) => s.id === props.sourceId)
  const name = src?.name ?? '该视频源'
  const ok = await showConfirmDialog({
    title: '删除视频源',
    message: `确认删除"${name}"？此操作不可恢复`,
  })
    .then(() => true)
    .catch(() => false)
  if (!ok) return
  store.remove(props.sourceId)
  showToast('已删除')
  router.replace('/settings')
}
</script>

<template>
  <Form @submit="submit">
    <CellGroup inset>
      <!-- 顺序：接口地址 → 名称 → 类型 → 每页条数 → 启用 → 备注 -->
      <Field v-model="form.baseUrl" label="接口地址" placeholder="https://.../api.php/provide/vod" required />
      <Field v-model="form.name" label="名称" placeholder="如：猫咪" required :maxlength="20" />
      <Field name="type" label="类型">
        <template #input>
          <RadioGroup v-model="form.type" direction="horizontal">
            <Radio name="t1_json">JSON</Radio>
            <Radio name="t0_xml">XML</Radio>
          </RadioGroup>
        </template>
      </Field>
      <!-- 保留分类：限定首页分类栏；用空格分隔多个名称，例如"电影 足球"；为空则显示所有分类 -->
      <Field
        v-model="form.reservedCategoriesText"
        label="保留分类"
        placeholder="用空格分隔，例如：电影 足球"
      />
      <Field name="pageSize" label="每页条数">
        <template #input>
          <Stepper v-model="form.pageSize as number" :min="1" :max="100" />
        </template>
      </Field>
      <Field name="enabled" label="启用">
        <template #input>
          <Switch v-model="form.enabled" />
        </template>
      </Field>
      <Field name="forceHttpsImage" label="图片强制 HTTPS">
        <template #input>
          <Switch v-model="form.forceHttpsImage" />
        </template>
      </Field>
      <Field v-model="form.remark as string" label="备注" type="textarea" placeholder="选填" :maxlength="200" rows="2" autosize />
    </CellGroup>
    <div class="actions">
      <Button type="primary" native-type="submit" block>保存</Button>
      <!-- 删除按钮：仅编辑模式显示 -->
      <Button
        v-if="sourceId"
        type="danger"
        plain
        block
        class="delete-btn"
        @click="remove"
      >
        删除视频源
      </Button>
    </div>
  </Form>
</template>

<style scoped>
.actions { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.delete-btn { margin-top: 4px; }
</style>
