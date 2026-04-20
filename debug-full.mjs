import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/root/AIClient-2-API/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

console.log('\n🔍 登录流程调试\n');

const browser = await chromium.launch({ 
  headless: true, 
  args: ['--no-sandbox', '--disable-gpu'] 
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  // 启用 localStorage 持久化
  storageState: undefined
});
const page = await context.newPage();

// 捕获所有网络请求
page.on('request', req => {
  if (req.url().includes('/api/')) {
    console.log(`[Request] ${req.method()} ${req.url()}`);
  }
});

page.on('response', async res => {
  if (res.url().includes('/api/')) {
    const status = res.status();
    let body = '';
    try { body = await res.text(); } catch {}
    console.log(`[Response] ${status} ${res.url()} - ${body.substring(0, 150)}`);
  }
});

// 捕获控制台日志
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('login') || text.includes('Login') || text.includes('token') || text.includes('Token') || text.includes('redirect') || text.includes('ERROR')) {
    console.log(`[Console] ${msg.type()}: ${text.substring(0, 200)}`);
  }
});

try {
  console.log('--- 步骤 1: 访问登录页 ---');
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-01-login-page.png'), fullPage: true });
  console.log(`URL: ${page.url()}\n`);

  console.log('--- 步骤 2: 填写表单 ---');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  console.log('表单已填写\n');

  console.log('--- 步骤 3: 点击登录 ---');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForTimeout(100)
  ]);
  
  // 等待网络空闲
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  const urlAfterLogin = page.url();
  const token = await page.evaluate(() => localStorage.getItem('authToken'));
  console.log(`\n登录后 URL: ${urlAfterLogin}`);
  console.log(`Token: ${token ? token.substring(0, 30) + '...' : 'null'}`);
  
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-02-after-login.png'), fullPage: true });
  
  // 检查页面文本
  const text = await page.evaluate(() => document.body?.innerText?.substring(0, 300));
  console.log(`\n页面内容:\n${text}\n`);

  // 如果还在登录页，检查路由守卫
  if (urlAfterLogin.includes('/login')) {
    console.log('--- 诊断: 仍在登录页 ---');
    console.log('检查 localStorage:');
    const allStorage = await page.evaluate(() => {
      const storage = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        storage[key] = localStorage.getItem(key);
      }
      return storage;
    });
    console.log(JSON.stringify(allStorage, null, 2));
    
    // 手动设置 token 并导航
    console.log('\n--- 手动设置 token 并导航 ---');
    const loginResponse = await page.evaluate(async () => {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('authToken', data.token);
        return { success: true, token: data.token.substring(0, 20) };
      }
      return { success: false };
    });
    console.log(`手动登录结果: ${JSON.stringify(loginResponse)}`);
    
    await page.waitForTimeout(500);
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-03-manual-nav.png'), fullPage: true });
    const finalUrl = page.url();
    const finalText = await page.evaluate(() => document.body?.innerText?.substring(0, 500));
    console.log(`\n最终 URL: ${finalUrl}`);
    console.log(`\n最终页面内容:\n${finalText}`);
  }

} catch (err) {
  console.error('❌ 错误:', err.message);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-error.png'), fullPage: true });
} finally {
  await browser.close();
  console.log('\n✅ 调试完成\n');
}
