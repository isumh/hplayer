<script setup lang="ts">
import type { VideoSource } from '@hplayer/core';
import { clampPageSize, useSourceStore } from '@hplayer/core';
import {
  Button,
  CellGroup,
  Field,
  Form,
  Radio,
  RadioGroup,
  Stepper,
  Switch,
  showToast,
} from 'vant';
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

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

watch(
  () => props.sourceId,
  (id) => {
    if (id) {
      const s = store.list.find((x) => x.id === id);
      if (s) {
        const next: Omit<VideoSource, 'id' | 'createdAt' | 'order'> = {
          name: s.name,
          type: s.type,
          baseUrl: s.baseUrl,
          pageSize: s.pageSize ?? 20,
          enabled: s.enabled,
        };
        form.value = next;
      }
    }
  },
  { immediate: true },
);

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
          <Stepper v-model="form.pageSize as number" :min="1" :max="100" />
        </template>
      </Field>
      <Field name="enabled" label="启用">
        <template #input>
          <Switch v-model="form.enabled" />
        </template>
      </Field>
      <Field v-model="form.remark as string" label="备注" type="textarea" placeholder="选填" :maxlength="200" rows="2" autosize />
    </CellGroup>
    <div class="actions">
      <Button type="primary" native-type="submit" block>保存</Button>
    </div>
  </Form>
</template>

<style scoped>
.actions { padding: 16px; }
</style>
