const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    
    // 访问登录页
    await page.goto('http://localhost:30000/login.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/login_page.png', fullPage: true });
    console.log('Login page screenshot saved to /tmp/login_page.png');
    
    // 尝试登录（默认密码 admin123）
    try {
        const passwordInput = await page.$('input[type="password"]');
        if (passwordInput) {
            await passwordInput.fill('admin123');
            const submitBtn = await page.$('button[type="submit"]');
            if (submitBtn) await submitBtn.click();
            await page.waitForTimeout(5000);
            await page.screenshot({ path: '/tmp/dashboard_page.png', fullPage: true });
            console.log('Dashboard page screenshot saved to /tmp/dashboard_page.png');
        } else {
            console.log('No password input found');
        }
    } catch (e) {
        console.log('Login failed or no password field:', e.message);
    }
    
    await browser.close();
})();
