import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/root/AIClient-2-API/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

console.log('\n🧪 Vue UI 完整交互测试 (v2)\n');
console.log('=' .repeat(60));

const browser = await chromium.launch({ 
  headless: true, 
  args: ['--no-sandbox', '--disable-gpu'] 
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

// 捕获所有请求和响应
const apiCalls = [];
page.on('request', req => {
  if (req.url().includes('/api/')) {
    apiCalls.push({ method: req.method(), url: req.url(), timestamp: Date.now() });
  }
});

page.on('response', async res => {
  if (res.url().includes('/api/')) {
    const lastCall = apiCalls[apiCalls.length - 1];
    if (lastCall) {
      lastCall.status = res.status();
      try { lastCall.body = (await res.text()).substring(0, 200); } catch {}
    }
  }
});

async function screenshot(name) {
  const filePath = path.join(SCREENSHOT_DIR, `v2-${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`📸 ${name}`);
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

try {
  // ===== 步骤 1: 访问登录页 =====
  console.log('\n📍 步骤 1: 访问登录页');
  console.log('-'.repeat(60));
  
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await wait(1000);
  
  const url1 = page.url();
  console.log(`   URL: ${url1}`);
  await screenshot('01-登录页面');
  
  // ===== 步骤 2: 填写并登录 =====
  console.log('\n📍 步骤 2: 登录');
  console.log('-'.repeat(60));
  
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  // 等待网络空闲和页面跳转
  await wait(5000);
  
  const url2 = page.url();
  console.log(`   登录后 URL: ${url2}`);
  await screenshot('02-登录后');
  
  // ===== 步骤 3: 检查 token =====
  console.log('\n📍 步骤 3: 检查认证状态');
  console.log('-'.repeat(60));
  
  const token = await page.evaluate(() => localStorage.getItem('authToken'));
  console.log(`   Token: ${token ? token.substring(0, 30) + '...' : '❌ 未找到'}`);
  
  // ===== 步骤 4: 如果还在登录页，诊断问题 =====
  if (url2.includes('/login')) {
    console.log('\n   诊断: 仍在登录页，检查控制台日志...');
    
    const logs = await page.evaluate(() => {
      // 获取 Vue 组件状态
      return {
        error: document.querySelector('.error-message, [class*="error"]')?.textContent
      };
    });
    console.log(`   错误信息: ${logs.error || '无'}`);
    
    // 检查 API 调用
    console.log('\n   API 调用记录:');
    apiCalls.forEach(call => {
      console.log(`   ${call.method} ${call.url.split('/').pop()} -> ${call.status || 'pending'} - ${call.body?.substring(0, 100) || ''}`);
    });
    
    // 手动导航到首页
    console.log('\n   手动导航到首页...');
    await page.evaluate(t => {
      localStorage.setItem('authToken', t);
      window.location.href = '/';
    }, 'manual-token-for-testing');
    
    await wait(3000);
    const url3 = page.url();
    console.log(`   新 URL: ${url3}`);
    await screenshot('03-手动导航后');
  }
  
  // ===== 步骤 5: 检查 Dashboard =====
  console.log('\n📍 步骤 5: 检查 Dashboard');
  console.log('-'.repeat(60));
  
  const pageContent = await page.evaluate(() => {
    return {
      url: window.location.href,
      hasSidebar: !!document.querySelector('.sidebar'),
      hasHeader: !!document.querySelector('.header'),
      hasContent: !!document.querySelector('main'),
      text: document.body?.innerText?.substring(0, 600)
    };
  });
  
  console.log(`   URL: ${pageContent.url}`);
  console.log(`   侧边栏: ${pageContent.hasSidebar ? '✅' : '❌'}`);
  console.log(`   页头: ${pageContent.hasHeader ? '✅' : '❌'}`);
  console.log(`   内容: ${pageContent.hasContent ? '✅' : '❌'}`);
  console.log(`\n   页面内容:\n${pageContent.text}`);
  
  // ===== 步骤 6: API 请求统计 =====
  console.log('\n📍 步骤 6: API 请求统计');
  console.log('-'.repeat(60));
  
  let successCount = 0, failCount = 0;
  apiCalls.forEach(call => {
    if (call.status >= 200 && call.status < 300) successCount++;
    else if (call.status >= 400) failCount++;
  });
  console.log(`   总计: ${apiCalls.length} 请求, ${successCount} 成功, ${failCount} 失败`);

  console.log('\n✅ 测试完成\n');

} catch (err) {
  console.error('❌ 错误:', err.message);
  await screenshot('error');
} finally {
  await browser.close();
}
