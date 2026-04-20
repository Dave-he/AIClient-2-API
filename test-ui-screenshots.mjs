import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const VUE_PORT = '5175';

// 创建截图目录
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function screenshot(page, name, description) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  
  // 获取页面文本内容（前500字符）
  const pageText = await page.evaluate(() => {
    const body = document.body;
    return body ? body.innerText.substring(0, 500) : 'No body found';
  });
  
  console.log(`\n📸 ${name}: ${description}`);
  console.log(`   截图: ${filePath}`);
  console.log(`   页面内容: ${pageText.replace(/\n/g, '\n   ')}`);
  
  // 检查控制台错误
  const errors = await page.evaluate(() => {
    if (window.__vueErrors) {
      return window.__vueErrors;
    }
    return [];
  });
  
  if (errors.length > 0) {
    console.log(`   ⚠️ Vue 错误: ${JSON.stringify(errors)}`);
  }
}

async function runTests() {
  console.log('🧪 开始界面渲染测试...');
  console.log(`   Vue 端口: ${VUE_PORT}`);
  console.log(`   后端端口: 30000`);
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 }
  });
  
  // 捕获控制台错误
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    consoleErrors.push(error.message);
  });
  
  try {
    // 步骤 1: 访问首页（未登录应跳转到登录页）
    console.log('\n' + '='.repeat(60));
    console.log('📍 步骤 1: 访问首页（未登录）');
    console.log('='.repeat(60));
    
    await page.goto(`http://localhost:${VUE_PORT}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    
    // 等待路由跳转
    await page.waitForTimeout(2000);
    
    const url1 = page.url();
    console.log(`   当前 URL: ${url1}`);
    
    await screenshot(page, 'step1-login-page', '未登录时访问首页，应跳转到登录页');
    
    // 步骤 2: 检查登录表单
    console.log('\n' + '='.repeat(60));
    console.log('📍 步骤 2: 检查登录表单');
    console.log('='.repeat(60));
    
    const loginFormExists = await page.evaluate(() => {
      return !!document.querySelector('input[type="text"], input[type="password"]');
    });
    console.log(`   登录表单存在: ${loginFormExists ? '✅' : '❌'}`);
    
    // 步骤 3: 输入登录信息
    console.log('\n' + '='.repeat(60));
    console.log('📍 步骤 3: 输入用户名和密码');
    console.log('='.repeat(60));
    
    const usernameInput = await page.$('input[type="text"]') || await page.$('input[placeholder*="用户名"]') || await page.$('input[placeholder*="username"]');
    const passwordInput = await page.$('input[type="password"]');
    
    if (usernameInput) {
      await usernameInput.fill('admin');
      console.log('   ✅ 用户名已填写: admin');
    } else {
      console.log('   ❌ 未找到用户名输入框');
    }
    
    if (passwordInput) {
      await passwordInput.fill('admin123');
      console.log('   ✅ 密码已填写: admin123');
    } else {
      console.log('   ❌ 未找到密码输入框');
    }
    
    await screenshot(page, 'step3-filled-form', '已填写用户名和密码');
    
    // 步骤 4: 点击登录按钮
    console.log('\n' + '='.repeat(60));
    console.log('📍 步骤 4: 点击登录按钮');
    console.log('='.repeat(60));
    
    const loginButton = await page.$('button[type="submit"]') || await page.$('button:has-text("登录")');
    if (loginButton) {
      await loginButton.click();
      console.log('   ✅ 已点击登录按钮');
      
      // 等待登录完成和页面跳转
      await page.waitForTimeout(3000);
      
      const urlAfterLogin = page.url();
      console.log(`   登录后 URL: ${urlAfterLogin}`);
      
      await screenshot(page, 'step4-after-login', '登录后的页面状态');
    } else {
      console.log('   ❌ 未找到登录按钮');
    }
    
    // 步骤 5: 检查页面元素
    console.log('\n' + '='.repeat(60));
    console.log('📍 步骤 5: 检查页面主要元素');
    console.log('='.repeat(60));
    
    const pageElements = await page.evaluate(() => {
      const elements = {
        hasSidebar: !!document.querySelector('.sidebar, [class*="sidebar"]'),
        hasHeader: !!document.querySelector('.header, [class*="header"]'),
        hasContent: !!document.querySelector('.content, [class*="content"], main'),
        hasDashboard: !!document.querySelector('[class*="dashboard"]'),
        url: window.location.href,
        title: document.title
      };
      return elements;
    });
    
    console.log(`   侧边栏: ${pageElements.hasSidebar ? '✅' : '❌'}`);
    console.log(`   页头: ${pageElements.hasHeader ? '✅' : '❌'}`);
    console.log(`   内容区: ${pageElements.hasContent ? '✅' : '❌'}`);
    console.log(`   仪表板: ${pageElements.hasDashboard ? '✅' : '❌'}`);
    console.log(`   页面标题: ${pageElements.title}`);
    
    // 步骤 6: 检查 API 请求状态
    console.log('\n' + '='.repeat(60));
    console.log('📍 步骤 6: 检查 API 请求');
    console.log('='.repeat(60));
    
    // 获取页面性能条目
    const apiRequests = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter(r => r.name.includes('/api/'))
        .map(r => ({
          url: r.name,
          status: r.responseStatus,
          duration: Math.round(r.duration) + 'ms'
        }));
    });
    
    console.log('   API 请求:');
    apiRequests.forEach(req => {
      const status = req.status >= 200 && req.status < 300 ? '✅' : '❌';
      console.log(`   ${status} ${req.url} - ${req.status} (${req.duration})`);
    });
    
    // 最终总结
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试总结');
    console.log('='.repeat(60));
    console.log(`   截图目录: ${SCREENSHOT_DIR}`);
    console.log(`   控制台错误数: ${consoleErrors.length}`);
    
    if (consoleErrors.length > 0) {
      console.log('\n   错误详情:');
      consoleErrors.slice(0, 5).forEach((err, i) => {
        console.log(`   ${i + 1}. ${err.substring(0, 200)}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    await screenshot(page, 'error-state', `错误: ${error.message}`);
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);
