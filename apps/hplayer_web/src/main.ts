import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { createApp } from 'vue';
import { router } from '@hplayer/router';
import App from './App.vue';
import './styles/tailwind.css';
import './styles/vant-theme.css';

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.use(router);
app.mount('#app');
