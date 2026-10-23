import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@unocss/reset/tailwind.css'
import 'uno.css'
import '@/styles/global.css'
import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')
