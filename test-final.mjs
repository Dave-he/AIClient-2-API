import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/root/AIClient-2-API/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function screenshot(name) {
  const filePath = path.join(SCREENSHOT_DIR, `final-${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`📸 ${name}: ${filePath}`);
  return filePath;
}

console.log('\n🧪 最终界面测试\n');

try {
  // 步骤 1: 访问首页（未登录）
  console.log('📍 步骤 1: 访问首页（未登录应跳转登录页）');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(1000);
  console.log(`   URL: ${page.url()}`);
  await screenshot('01-未登录访问首页');
  
  // 步骤 2: 登录
  console.log('\n📍 步骤 2: 填写登录表单');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await screenshot('02-填写登录表单');
  
  // 步骤 3: 点击登录
  console.log('\n📍 步骤 3: 点击登录');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log(`   URL: ${page.url()}`);
  await screenshot('03-登录后');
  
  // 步骤 4: 检查页面内容
  console.log('\n📍 步骤 4: 检查页面元素');
  const elements = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      hasSidebar: !!document.querySelector('.sidebar'),
      hasHeader: !!document.querySelector('.header'),
      hasContent: !!document.querySelector('main, .content'),
      hasDashboard: !!document.querySelector('[class*="dashboard"]'),
      text: document.body?.innerText?.substring(0, 500)
    };
  });
  
  console.log(`   URL: ${elements.url}`);
  console.log(`   标题: ${elements.title}`);
  console.log(`   侧边栏: ${elements.hasSidebar ? '✅' : '❌'}`);
  console.log(`   页头: ${elements.hasHeader ? '✅' : '❌'}`);
  console.log(`   内容区: ${elements.hasContent ? '✅' : '❌'}`);
  console.log(`   仪表板: ${elements.hasDashboard ? '✅' : '❌'}`);
  console.log(`\n   页面文本:\n${elements.text}`);
  
  // 步骤 5: 检查 API 请求
  console.log('\n📍 步骤 5: 检查 API 请求');
  const apiRequests = await page.evaluate(() => {
    return performance.getEntriesByType('resource')
      .filter(r => r.name.includes('/api/'))
      .map(r => ({ url: r.name.split('/').pop(), status: r.responseStatus }));
  });
  apiRequests.forEach(req => {
    console.log(`   ${req.status >= 200 && req.status < 300 ? '✅' : '❌'} /api/${req.url} - ${req.status}`);
  });
  
  console.log('\n✅ 测试完成\n');
  
} catch (err) {
  console.error('❌ 错误:', err.message);
  await screenshot('error');
} finally {
  await browser.close();
}
