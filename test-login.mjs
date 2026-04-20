import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/root/AIClient-2-API/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage({ viewport: { width: 1280, height: 800 } });

// 捕获控制台日志
const consoleLogs = [];
page.on('console', msg => {
  consoleLogs.push({ type: msg.type(), text: msg.text() });
});

let step = 0;
async function screenshot(name) {
  step++;
  const filePath = path.join(SCREENSHOT_DIR, `${step}-${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`📸 步骤 ${step}: ${name} - ${filePath}`);
  return filePath;
}

try {
  // 1. 访问登录页
  console.log('\n1. 访问登录页');
  await page.goto('http://localhost:5175/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await screenshot('登录页面');
  
  // 2. 填写表单
  console.log('\n2. 填写登录表单');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await screenshot('填写表单后');
  
  // 3. 点击登录
  console.log('\n3. 点击登录按钮');
  await page.click('button[type="submit"]');
  
  // 等待导航
  await page.waitForTimeout(2000);
  await screenshot('登录后');
  
  // 4. 检查 URL 和内容
  const currentUrl = page.url();
  console.log(`\n当前 URL: ${currentUrl}`);
  
  const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500));
  console.log(`页面内容:\n${pageText}`);
  
  // 5. 检查 localStorage 中的 token
  const token = await page.evaluate(() => localStorage.getItem('authToken'));
  console.log(`\nToken: ${token ? token.substring(0, 20) + '...' : '未找到'}`);
  
  // 6. 如果还在登录页，尝试直接访问首页
  if (currentUrl.includes('/login')) {
    console.log('\n仍在登录页，尝试直接访问首页...');
    await page.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await screenshot('直接访问首页');
    
    const newUrl = page.url();
    console.log(`新 URL: ${newUrl}`);
    const newText = await page.evaluate(() => document.body?.innerText?.substring(0, 500));
    console.log(`新页面内容:\n${newText}`);
  }
  
  // 7. 检查控制台错误
  const errors = consoleLogs.filter(l => l.type === 'error');
  if (errors.length > 0) {
    console.log('\n⚠️ 控制台错误:');
    errors.forEach((e, i) => console.log(`${i+1}. ${e.text.substring(0, 200)}`));
  }
  
} catch (err) {
  console.error('错误:', err.message);
  await screenshot('错误状态');
} finally {
  await browser.close();
}
