import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import i18n from './locales'
import { errorHandler } from './utils/error-handler.js'

const app = createApp(App)

errorHandler.setupGlobalErrorHandlers()

app.config.errorHandler = (error, instance, info) => {
  errorHandler.handleVueError(error, instance, info)
}

app.use(router)
app.use(ElementPlus)
app.use(i18n)
app.mount('#app')
