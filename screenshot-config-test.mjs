import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];
const allResponses = [];

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
  if (response.status() >= 400 || response.url().includes('/api/')) {
    allResponses.push({ url: response.url(), status: response.status() });
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

// Navigate to config section
const configNav = await page.$('.nav-item[data-section="config"]');
if (configNav) {
  await configNav.click();
  await page.waitForTimeout(3000);
}

// Try to save config to trigger the error
const saveBtn = await page.$('#saveConfigBtn, .btn-primary[data-action="save"]');
if (saveBtn) {
  console.log('Found save button, clicking...');
  await saveBtn.click();
  await page.waitForTimeout(3000);
}

console.log('=== PAGE ERRORS ===');
console.log(JSON.stringify(pageErrors, null, 2));

console.log('\n=== CONSOLE ERRORS ===');
consoleErrors.forEach(e => console.log(e));

console.log('\n=== FAILED REQUESTS ===');
failedRequests.forEach(r => console.log(`URL: ${r.url}, Failure: ${r.failure}`));

console.log('\n=== API RESPONSES ===');
allResponses.forEach(r => console.log(`URL: ${r.url}, Status: ${r.status}`));

// Test the API directly
const apiTest = await page.evaluate(async () => {
  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/config', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    return { status: response.status, ok: response.ok, keys: Object.keys(data).slice(0, 10) };
  } catch (e) {
    return { error: e.message };
  }
});
console.log('\n=== API TEST ===');
console.log(JSON.stringify(apiTest, null, 2));

await browser.close();
