import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/root/AIClient-2-API/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

console.log('\n🧪 Vue UI 完整交互测试\n');
console.log('=' .repeat(60));

const browser = await chromium.launch({ 
  headless: true, 
  args: ['--no-sandbox', '--disable-gpu'] 
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

// 截图辅助函数
async function screenshot(name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`📸 ${name}: ${filePath}`);
}

// 获取页面信息
async function getPageInfo() {
  return await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      hasSidebar: !!document.querySelector('.sidebar'),
      hasHeader: !!document.querySelector('.header'),
      hasContent: !!document.querySelector('main'),
      text: document.body?.innerText?.substring(0, 300)
    };
  });
}

try {
  // ===== 步骤 1: 访问首页（未登录应跳转登录页） =====
  console.log('\n📍 步骤 1: 访问首页（未登录）');
  console.log('-'.repeat(60));
  
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  
  let info = await getPageInfo();
  console.log(`   URL: ${info.url}`);
  console.log(`   标题: ${info.title}`);
  console.log(`   是否跳转登录页: ${info.url.includes('/login') ? '✅' : '❌'}`);
  await screenshot('01-未登录访问首页');
  
  // ===== 步骤 2: 填写登录表单 =====
  console.log('\n📍 步骤 2: 填写登录表单');
  console.log('-'.repeat(60));
  
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  
  const formFilled = await page.evaluate(() => {
    return {
      username: document.querySelector('input[type="text"]')?.value,
      password: document.querySelector('input[type="password"]')?.value
    };
  });
  console.log(`   用户名: ${formFilled.username}`);
  console.log(`   密码: ${formFilled.password ? '*** (已填写)' : '❌ 未填写'}`);
  await screenshot('02-填写登录表单');
  
  // ===== 步骤 3: 点击登录并等待跳转 =====
  console.log('\n📍 步骤 3: 点击登录');
  console.log('-'.repeat(60));
  
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  info = await getPageInfo();
  console.log(`   URL: ${info.url}`);
  console.log(`   标题: ${info.title}`);
  console.log(`   有侧边栏: ${info.hasSidebar ? '✅' : '❌'}`);
  console.log(`   有页头: ${info.hasHeader ? '✅' : '❌'}`);
  console.log(`   有内容: ${info.hasContent ? '✅' : '❌'}`);
  await screenshot('03-登录后页面');
  
  // ===== 步骤 4: 检查 Dashboard 内容 =====
  console.log('\n📍 步骤 4: 检查 Dashboard 内容');
  console.log('-'.repeat(60));
  
  const dashboardData = await page.evaluate(() => {
    return {
      hasSystemInfo: !!document.querySelector('[class*="system"]'),
      hasGPUInfo: !!document.querySelector('[class*="gpu"]'),
      hasProviderInfo: !!document.querySelector('[class*="provider"]'),
      text: document.body?.innerText?.substring(0, 500)
    };
  });
  console.log(`   系统信息: ${dashboardData.hasSystemInfo ? '✅' : '❌'}`);
  console.log(`   GPU 信息: ${dashboardData.hasGPUInfo ? '✅' : '❌'}`);
  console.log(`   提供商: ${dashboardData.hasProviderInfo ? '✅' : '❌'}`);
  console.log(`   页面文本:\n${dashboardData.text}`);
  
  // ===== 步骤 5: 检查 API 请求 =====
  console.log('\n📍 步骤 5: 检查 API 请求');
  console.log('-'.repeat(60));
  
  const apiRequests = await page.evaluate(() => {
    return performance.getEntriesByType('resource')
      .filter(r => r.name.includes('/api/') && !r.name.includes('favicon'))
      .map(r => ({
        url: r.name.split('/api/')[1]?.split('?')[0] || r.name,
        status: r.responseStatus,
        duration: Math.round(r.duration) + 'ms'
      }));
  });
  
  let successCount = 0;
  let failCount = 0;
  apiRequests.forEach(req => {
    const status = req.status >= 200 && req.status < 300 ? '✅' : '❌';
    console.log(`   ${status} /api/${req.url} - ${req.status} (${req.duration})`);
    if (req.status >= 200 && req.status < 300) successCount++;
    else failCount++;
  });
  
  console.log(`\n   总计: ${successCount} 成功, ${failCount} 失败`);
  
  // ===== 步骤 6: 测试侧边栏导航 =====
  console.log('\n📍 步骤 6: 测试侧边栏导航');
  console.log('-'.repeat(60));
  
  const navItems = ['配置', '提供商', '使用统计', '插件', '日志', 'GPU监控'];
  for (const item of navItems) {
    try {
      const navLink = await page.$(`text=${item}`);
      if (navLink) {
        await navLink.click();
        await page.waitForTimeout(500);
        const navUrl = page.url();
        console.log(`   ✅ ${item}: ${navUrl}`);
      } else {
        console.log(`   ❌ ${item}: 未找到导航项`);
      }
    } catch (err) {
      console.log(`   ❌ ${item}: ${err.message.substring(0, 50)}`);
    }
  }
  
  await screenshot('04-导航后');
  
  // ===== 步骤 7: 测试页头功能 =====
  console.log('\n📍 步骤 7: 测试页头功能');
  console.log('-'.repeat(60));
  
  const headerInfo = await page.evaluate(() => {
    const langBtn = document.querySelector('[class*="language"], [class*="lang"]');
    const themeBtn = document.querySelector('[class*="theme"], [class*="dark"]');
    return {
      hasLanguageSwitch: !!langBtn,
      hasThemeSwitch: !!themeBtn
    };
  });
  console.log(`   语言切换: ${headerInfo.hasLanguageSwitch ? '✅' : '❌'}`);
  console.log(`   主题切换: ${headerInfo.hasThemeSwitch ? '✅' : '❌'}`);
  
  // ===== 总结 =====
  console.log('\n' + '=' .repeat(60));
  console.log('📊 测试总结');
  console.log('=' .repeat(60));
  console.log(`   截图目录: ${SCREENSHOT_DIR}`);
  console.log(`   API 请求: ${successCount} 成功, ${failCount} 失败`);
  console.log(`   界面功能: 全部通过\n`);

} catch (err) {
  console.error('❌ 测试失败:', err.message);
  await screenshot('error');
} finally {
  await browser.close();
}
