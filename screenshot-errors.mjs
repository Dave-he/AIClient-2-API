import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];
const allRequests = [];

page.on('pageerror', error => {
  pageErrors.push({ message: error.message, stack: error.stack?.substring(0, 1000) });
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
  if (response.status() >= 400) {
    allRequests.push({ url: response.url(), status: response.status() });
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

// Navigate to tutorial section
const tutorialNav = await page.$('.nav-item[data-section="tutorial"]');
if (tutorialNav) {
  await tutorialNav.click();
  await page.waitForTimeout(3000);
}

// Navigate to logs section
const logsNav = await page.$('.nav-item[data-section="logs"]');
if (logsNav) {
  await logsNav.click();
  await page.waitForTimeout(3000);
}

console.log('=== PAGE ERRORS ===');
pageErrors.forEach(e => {
  console.log(`Message: ${e.message}`);
  console.log(`Stack: ${e.stack}`);
});

console.log('\n=== CONSOLE ERRORS ===');
consoleErrors.forEach(e => {
  console.log(e);
});

console.log('\n=== FAILED REQUESTS ===');
failedRequests.forEach(r => {
  console.log(`URL: ${r.url}, Failure: ${r.failure}`);
});

console.log('\n=== BAD RESPONSES ===');
allRequests.forEach(r => {
  console.log(`URL: ${r.url}, Status: ${r.status}`);
});

// Check if there are any broken images
const brokenImages = await page.$$eval('img', imgs => 
  imgs.map(img => ({ src: img.src, naturalWidth: img.naturalWidth, displayed: img.offsetWidth > 0 }))
    .filter(img => img.naturalWidth === 0 && img.displayed)
);
console.log('\n=== BROKEN IMAGES ===');
console.log(JSON.stringify(brokenImages, null, 2));

// Check for empty sections
const emptySections = await page.$$eval('section[id]', sections => 
  sections.map(s => ({ id: s.id, textLength: s.innerText.trim().length, htmlLength: s.innerHTML.length }))
    .filter(s => s.textLength < 10)
);
console.log('\n=== EMPTY SECTIONS ===');
console.log(JSON.stringify(emptySections, null, 2));

// Check for visible error messages
const errorElements = await page.$$eval('.error, .error-message, [class*="error"], [class*="alert-danger"]', els =>
  els.map(el => ({ text: el.innerText?.trim(), visible: el.offsetParent !== null }))
    .filter(e => e.text && e.visible)
);
console.log('\n=== VISIBLE ERROR ELEMENTS ===');
console.log(JSON.stringify(errorElements, null, 2));

await browser.close();
