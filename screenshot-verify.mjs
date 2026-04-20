import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];
const sseResponses = [];

page.on('pageerror', error => {
  pageErrors.push({ message: error.message, stack: error.stack?.substring(0, 500) });
});
page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});
page.on('requestfailed', request => {
  failedRequests.push({ url: request.url(), failure: request.failure()?.errorText });
});
page.on('response', response => {
  if (response.url().includes('/api/events')) {
    sseResponses.push({ url: response.url(), status: response.status(), headers: response.headers() });
  }
});

await page.goto('http://localhost:30000/', { waitUntil: 'networkidle', timeout: 30000 });

const passwordInput = await page.$('#password');
if (passwordInput) {
  await passwordInput.fill('admin123');
  const loginButton = await page.$('#loginButton');
  if (loginButton) {
    await loginButton.click();
    await page.waitForTimeout(5000);
  }
}

await page.screenshot({ path: '/root/AIClient-2-API/screenshot-after-fix-dashboard.png', fullPage: true });

const connectionStatus = await page.evaluate(() => {
  const statusEl = document.getElementById('serverStatus');
  return statusEl ? statusEl.innerText : 'NOT FOUND';
});
console.log('=== CONNECTION STATUS ===');
console.log(connectionStatus);

const errorElements = await page.$$eval('.error, .error-message, [class*="error"], [class*="alert-danger"]', els =>
  els.map(el => ({ text: el.innerText?.trim(), visible: el.offsetParent !== null }))
    .filter(e => e.text && e.visible)
);
console.log('\n=== VISIBLE ERROR ELEMENTS ===');
console.log(JSON.stringify(errorElements, null, 2));

console.log('\n=== SSE RESPONSES ===');
console.log(JSON.stringify(sseResponses, null, 2));

console.log('\n=== PAGE ERRORS ===');
console.log(JSON.stringify(pageErrors, null, 2));

console.log('\n=== CONSOLE ERRORS ===');
console.log(JSON.stringify(consoleErrors, null, 2));

console.log('\n=== FAILED REQUESTS ===');
console.log(JSON.stringify(failedRequests, null, 2));

const navItems = await page.$$eval('.nav-item', els => 
  els.map(el => ({
    text: el.innerText?.trim(),
    section: el.getAttribute('data-section'),
  }))
);

for (const nav of navItems) {
  const navItem = await page.$(`.nav-item[data-section="${nav.section}"]`);
  if (navItem) {
    await navItem.click();
    await page.waitForTimeout(1000);
  }
}

await page.screenshot({ path: '/root/AIClient-2-API/screenshot-after-fix-final.png', fullPage: true });

await browser.close();
