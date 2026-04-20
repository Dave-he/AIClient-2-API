import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const pageErrors = [];
const consoleErrors = [];

page.on('pageerror', error => {
  pageErrors.push({ message: error.message, stack: error.stack?.substring(0, 800) });
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
    await page.screenshot({ path: `/root/AIClient-2-API/screenshot-final-${section}.png`, fullPage: true });
    
    const sectionInfo = await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return { found: false };
      const visible = el.offsetParent !== null || getComputedStyle(el).display !== 'none';
      const allText = el.innerText;
      const emptyElements = [];
      el.querySelectorAll('[class*="loading"], [class*="skeleton"], [class*="placeholder"]').forEach(e => {
        if (e.offsetParent !== null) {
          emptyElements.push({ class: e.className, text: e.innerText?.substring(0, 50) });
        }
      });
      const errorEls = [];
      el.querySelectorAll('[class*="error"], [class*="warning"], [class*="alert"]').forEach(e => {
        if (e.offsetParent !== null && e.innerText.trim()) {
          errorEls.push({ class: e.className, text: e.innerText?.substring(0, 100) });
        }
      });
      return { found: true, visible, textLength: allText.length, emptyElements, errorEls, first200: allText.substring(0, 200) };
    }, section);
    
    console.log(`\n=== SECTION: ${section} ===`);
    console.log(`Visible: ${sectionInfo.visible}, Text length: ${sectionInfo.textLength}`);
    if (sectionInfo.emptyElements?.length > 0) {
      console.log(`Loading/Empty elements: ${JSON.stringify(sectionInfo.emptyElements)}`);
    }
    if (sectionInfo.errorEls?.length > 0) {
      console.log(`Error/Warning elements: ${JSON.stringify(sectionInfo.errorEls)}`);
    }
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      console.log(`Page errors: ${JSON.stringify(pageErrors)}`);
      console.log(`Console errors: ${JSON.stringify(consoleErrors)}`);
    }
  }
}

console.log('\n=== SUMMARY ===');
console.log(`Total page errors: ${pageErrors.length}`);
console.log(`Total console errors: ${consoleErrors.length}`);

await browser.close();
