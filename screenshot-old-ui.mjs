import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const consoleErrors = [];
const consoleWarnings = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
  if (msg.type() === 'warning') consoleWarnings.push(msg.text());
});

const pageErrors = [];
page.on('pageerror', error => {
  pageErrors.push(error.message);
});

const failedRequests = [];
page.on('requestfailed', request => {
  failedRequests.push({ url: request.url(), failure: request.failure()?.errorText });
});

await page.goto('http://localhost:30000/', { waitUntil: 'networkidle', timeout: 30000 });
await page.screenshot({ path: '/root/AIClient-2-API/screenshot-01-login.png', fullPage: true });

const passwordInput = await page.$('#password');
if (passwordInput) {
  await passwordInput.fill('admin123');
  await page.screenshot({ path: '/root/AIClient-2-API/screenshot-02-login-filled.png', fullPage: true });
  
  const loginButton = await page.$('#loginButton');
  if (loginButton) {
    await loginButton.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/root/AIClient-2-API/screenshot-03-after-login.png', fullPage: true });
  }
}

const currentUrl = page.url();
console.log('Current URL after login:', currentUrl);

const textContent = await page.evaluate(() => document.body.innerText);
console.log('=== PAGE TEXT (first 3000 chars) ===');
console.log(textContent.substring(0, 3000));

const resourceErrors = await page.evaluate(() => {
  return window.performance.getEntriesByType('resource')
    .filter(r => r.responseStatus === 404 || r.responseStatus === 500)
    .map(r => ({ url: r.name, status: r.responseStatus }));
});

console.log('=== RESOURCE ERRORS ===');
console.log(JSON.stringify(resourceErrors, null, 2));

console.log('=== CONSOLE ERRORS ===');
console.log(JSON.stringify(consoleErrors, null, 2));

console.log('=== PAGE ERRORS ===');
console.log(JSON.stringify(pageErrors, null, 2));

console.log('=== FAILED REQUESTS ===');
console.log(JSON.stringify(failedRequests, null, 2));

const navItems = await page.$$eval('nav a, .nav-item, .sidebar a, .menu a, [class*="nav"] a, [class*="sidebar"] a, [class*="menu"] a', els => 
  els.map(el => ({ text: el.innerText?.trim(), href: el.getAttribute('href') })).filter(e => e.text)
);
console.log('=== NAV ITEMS ===');
console.log(JSON.stringify(navItems, null, 2));

const allLinks = await page.$$eval('a[href]', els => 
  els.map(el => ({ text: el.innerText?.trim().substring(0, 50), href: el.getAttribute('href') })).filter(e => e.text && e.href)
);
console.log('=== ALL LINKS ===');
console.log(JSON.stringify(allLinks.slice(0, 30), null, 2));

await browser.close();
