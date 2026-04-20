const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    
    // 访问登录页
    await page.goto('http://localhost:30000/login.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // 登录
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
        await passwordInput.fill('admin123');
        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) await submitBtn.click();
        await page.waitForTimeout(5000);
    }
    
    // 截图 dashboard 页面（包含折线图区域）
    await page.screenshot({ path: '/root/AIClient-2-API/screenshot-dashboard-chart.png', fullPage: true });
    console.log('Dashboard screenshot saved');
    
    // 滚动到 Token 趋势区域并截图
    const tokenChart = await page.$('#tokenTrendChart');
    if (tokenChart) {
        await tokenChart.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/root/AIClient-2-API/screenshot-token-chart.png', fullPage: false });
        console.log('Token chart screenshot saved');
    }
    
    // 滚动到 GPU 监控区域并截图
    const gpuChart = await page.$('#pythonGpuChart');
    if (gpuChart) {
        await gpuChart.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/root/AIClient-2-API/screenshot-gpu-chart.png', fullPage: false });
        console.log('GPU chart screenshot saved');
    }
    
    await browser.close();
})();
