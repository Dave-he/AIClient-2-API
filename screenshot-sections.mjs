import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const pageErrors = [];
const consoleErrors = [];

page.on('pageerror', error => {
  pageErrors.push({ message: error.message, stack: error.stack });
});
page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
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

const sections = ['dashboard', 'guide', 'tutorial', 'config', 'providers', 'custom-models', 'upload-config', 'usage', 'plugins', 'gpu-monitor', 'logs'];

for (const section of sections) {
  pageErrors.length = 0;
  consoleErrors.length = 0;
  
  const navItem = await page.$(`.nav-item[data-section="${section}"]`);
  if (navItem) {
    await navItem.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `/root/AIClient-2-API/screenshot-section-${section}.png`, fullPage: true });
    
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      console.log(`\n=== ERRORS ON SECTION: ${section} ===`);
      pageErrors.forEach(e => {
        console.log(`PageError: ${e.message}`);
        console.log(`Stack: ${e.stack?.substring(0, 500)}`);
      });
      consoleErrors.forEach(e => {
        console.log(`ConsoleError: ${e}`);
      });
    }
    
    const sectionText = await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return 'SECTION NOT FOUND';
      const visible = el.offsetParent !== null || el.style.display !== 'none';
      return `Visible: ${visible}, HTML length: ${el.innerHTML.length}, First 300 chars: ${el.innerText.substring(0, 300)}`;
    }, section);
    console.log(`Section ${section}: ${sectionText}`);
  }
}

console.log('\n=== FINAL PAGE ERRORS ===');
console.log(JSON.stringify(pageErrors, null, 2));

await browser.close();
