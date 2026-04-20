import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const consoleMessages = [];
const pageErrors = [];
const failedRequests = [];
const networkResponses = [];

page.on('console', msg => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});
page.on('pageerror', error => {
  pageErrors.push({ message: error.message, stack: error.stack?.substring(0, 500) });
});
page.on('requestfailed', request => {
  failedRequests.push({ url: request.url(), failure: request.failure()?.errorText });
});
page.on('response', response => {
  if (response.status() >= 400 || response.url().includes('/app/')) {
    networkResponses.push({ url: response.url(), status: response.status() });
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

await page.screenshot({ path: '/root/AIClient-2-API/screenshot-main-dashboard.png', fullPage: true });

console.log('=== CONSOLE MESSAGES (errors and warnings) ===');
consoleMessages.filter(m => m.type === 'error' || m.type === 'warning').forEach(m => {
  console.log(`[${m.type}] ${m.text}`);
});

console.log('\n=== PAGE ERRORS ===');
pageErrors.forEach(e => {
  console.log(`Message: ${e.message}`);
  console.log(`Stack: ${e.stack}`);
});

console.log('\n=== FAILED REQUESTS ===');
failedRequests.forEach(r => {
  console.log(`URL: ${r.url}, Failure: ${r.failure}`);
});

console.log('\n=== NETWORK RESPONSES (4xx/5xx or /app/ paths) ===');
networkResponses.forEach(r => {
  console.log(`URL: ${r.url}, Status: ${r.status}`);
});

const navItems = await page.$$eval('.nav-item', els => 
  els.map(el => ({
    text: el.innerText?.trim(),
    section: el.getAttribute('data-section'),
    visible: el.offsetParent !== null
  }))
);
console.log('\n=== NAV ITEMS ===');
console.log(JSON.stringify(navItems, null, 2));

const sections = await page.$$eval('section[id], div[id].section', els => 
  els.map(el => ({
    id: el.id,
    visible: el.offsetParent !== null,
    hasContent: el.innerHTML.length > 100,
    childCount: el.children.length
  }))
);
console.log('\n=== SECTIONS ===');
console.log(JSON.stringify(sections, null, 2));

const gpuSection = await page.$('#gpu-monitor');
if (gpuSection) {
  const gpuHtml = await page.evaluate(() => {
    const el = document.getElementById('gpu-monitor');
    return el ? el.innerHTML.substring(0, 1000) : 'NOT FOUND';
  });
  console.log('\n=== GPU MONITOR SECTION HTML ===');
  console.log(gpuHtml);
}

const customModelsSection = await page.$('#custom-models');
if (customModelsSection) {
  const customModelsHtml = await page.evaluate(() => {
    const el = document.getElementById('custom-models');
    return el ? el.innerHTML.substring(0, 1000) : 'NOT FOUND';
  });
  console.log('\n=== CUSTOM MODELS SECTION HTML ===');
  console.log(customModelsHtml);
}

const usageSection = await page.$('#usage');
if (usageSection) {
  const usageHtml = await page.evaluate(() => {
    const el = document.getElementById('usage');
    return el ? el.innerHTML.substring(0, 1000) : 'NOT FOUND';
  });
  console.log('\n=== USAGE SECTION HTML ===');
  console.log(usageHtml);
}

await browser.close();
