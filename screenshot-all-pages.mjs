import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];

page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', error => {
  pageErrors.push(error.message);
});
page.on('requestfailed', request => {
  failedRequests.push({ url: request.url(), failure: request.failure()?.errorText });
});

await page.goto('http://localhost:30000/', { waitUntil: 'networkidle', timeout: 30000 });

const passwordInput = await page.$('#password');
if (passwordInput) {
  await passwordInput.fill('admin123');
  const loginButton = await page.$('#loginButton');
  if (loginButton) {
    await loginButton.click();
    await page.waitForTimeout(3000);
  }
}

await page.screenshot({ path: '/root/AIClient-2-API/screenshot-dashboard.png', fullPage: true });

const pages = [
  { name: 'guide', href: '#guide' },
  { name: 'tutorial', href: '#tutorial' },
  { name: 'config', href: '#config' },
  { name: 'providers', href: '#providers' },
  { name: 'custom-models', href: '#custom-models' },
  { name: 'upload-config', href: '#upload-config' },
  { name: 'usage', href: '#usage' },
  { name: 'plugins', href: '#plugins' },
  { name: 'gpu-monitor', href: '#gpu-monitor' },
  { name: 'logs', href: '#logs' },
];

for (const p of pages) {
  try {
    const link = await page.$(`a[href="${p.href}"]`);
    if (link) {
      await link.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `/root/AIClient-2-API/screenshot-${p.name}.png`, fullPage: true });
      
      const sectionText = await page.evaluate((selector) => {
        const el = document.querySelector(selector) || document.querySelector('.content-area') || document.querySelector('main') || document.body;
        return el.innerText.substring(0, 500);
      }, p.href.replace('#', '.'));
    }
  } catch (e) {
    console.log(`Error navigating to ${p.name}: ${e.message}`);
  }
}

console.log('=== ALL CONSOLE ERRORS ===');
console.log(JSON.stringify(consoleErrors, null, 2));

console.log('=== ALL PAGE ERRORS ===');
console.log(JSON.stringify(pageErrors, null, 2));

console.log('=== ALL FAILED REQUESTS ===');
console.log(JSON.stringify(failedRequests, null, 2));

await browser.close();
