import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN.json';
import en from './en.json';

const messages = {
  'zh-CN': zhCN,
  'en': en
};

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages
});

export default i18n;