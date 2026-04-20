const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    
    // 拦截并阻止字体请求
    await page.route('**/*', route => {
        const url = route.request().url();
        if (url.includes('font') || url.includes('woff') || url.includes('ttf')) {
            route.abort();
        } else {
            route.continue();
        }
    });
    
    // 访问登录页
    await page.goto('http://localhost:30000/login.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // 强制设置字体
    await page.addStyleTag({ content: `
        * { font-family: 'Noto Sans SC', 'WenQuanYi Micro Hei', 'Microsoft YaHei', 'PingFang SC', sans-serif !important; }
    ` });
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: '/root/AIClient-2-API/screenshot-login-fix1.png', fullPage: true });
    console.log('Login page screenshot saved');
    
    await browser.close();
})();
