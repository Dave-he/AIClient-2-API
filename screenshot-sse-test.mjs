import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];

page.on('pageerror', error => {
  pageErrors.push({ message: error.message, stack: error.stack?.substring(0, 500) });
});
page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});
page.on('requestfailed', request => {
  failedRequests.push({ url: request.url(), failure: request.failure()?.errorText, resourceType: request.resourceType() });
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

const connectionStatus = await page.evaluate(() => {
  const statusEl = document.getElementById('serverStatus');
  return statusEl ? statusEl.innerText.trim() : 'NOT FOUND';
});
console.log(`Initial Connection Status: ${connectionStatus}`);

// Stay on dashboard for 10 seconds
await page.waitForTimeout(10000);

const connectionStatus2 = await page.evaluate(() => {
  const statusEl = document.getElementById('serverStatus');
  return statusEl ? statusEl.innerText.trim() : 'NOT FOUND';
});
console.log(`After 10s Connection Status: ${connectionStatus2}`);

// Navigate to different sections
const sections = ['guide', 'config', 'providers', 'gpu-monitor', 'dashboard'];
for (const section of sections) {
  const navItem = await page.$(`.nav-item[data-section="${section}"]`);
  if (navItem) {
    await navItem.click();
    await page.waitForTimeout(2000);
  }
}

const connectionStatus3 = await page.evaluate(() => {
  const statusEl = document.getElementById('serverStatus');
  return statusEl ? statusEl.innerText.trim() : 'NOT FOUND';
});
console.log(`After navigation Connection Status: ${connectionStatus3}`);

// Wait another 10 seconds
await page.waitForTimeout(10000);

const connectionStatus4 = await page.evaluate(() => {
  const statusEl = document.getElementById('serverStatus');
  return statusEl ? statusEl.innerText.trim() : 'NOT FOUND';
});
console.log(`After 20s Connection Status: ${connectionStatus4}`);

console.log('\n=== PAGE ERRORS ===');
console.log(JSON.stringify(pageErrors, null, 2));

console.log('\n=== CONSOLE ERRORS (excluding ERR_ABORTED) ===');
consoleErrors.filter(e => !e.includes('ERR_ABORTED')).forEach(e => console.log(e));

console.log('\n=== FAILED REQUESTS (excluding /app/ ERR_ABORTED) ===');
failedRequests.filter(r => !r.url.includes('/app/') || r.failure !== 'net::ERR_ABORTED').forEach(r => {
  console.log(`URL: ${r.url}, Type: ${r.resourceType}, Failure: ${r.failure}`);
});

await browser.close();
