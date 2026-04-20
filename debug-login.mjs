import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// 捕获所有控制台日志
page.on('console', msg => {
  if (msg.type() === 'error' || msg.text().includes('login') || msg.text().includes('Login')) {
    console.log(`[Browser] ${msg.type()}: ${msg.text().substring(0, 300)}`);
  }
});

try {
  console.log('1. 访问登录页');
  await page.goto('http://localhost:5175/login', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  console.log('2. 填写表单');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  
  console.log('3. 点击登录按钮并等待网络请求');
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/login')),
    page.click('button[type="submit"]')
  ]);
  
  const status = response.status();
  const body = await response.json();
  console.log(`登录响应: status=${status}, body=${JSON.stringify(body)}`);
  
  // 等待可能的跳转
  await page.waitForTimeout(2000);
  
  console.log(`当前 URL: ${page.url()}`);
  console.log(`localStorage token: ${await page.evaluate(() => localStorage.getItem('authToken'))}`);
  
  // 如果还在登录页，手动检查
  if (page.url().includes('/login')) {
    console.log('4. 手动设置 token 并导航');
    await page.evaluate(token => {
      localStorage.setItem('authToken', token);
      window.location.href = '/';
    }, body.token);
    
    await page.waitForTimeout(2000);
    console.log(`新 URL: ${page.url()}`);
    
    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 300));
    console.log(`页面内容: ${pageText}`);
  }

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await browser.close();
}
