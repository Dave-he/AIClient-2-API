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
  failedRequests.push({ url: request.url(), failure: request.failure()?.errorText });
});

await page.goto('http://localhost:30000/', { waitUntil: 'networkidle', timeout: 30000 });

const passwordInput = await page.$('#password');
if (passwordInput) {
  await passwordInput.fill('admin123');
  const loginButton = await page.$('#loginButton');
  if (loginButton) {
    await loginButton.click();
    await page.waitForTimeout(8000);
  }
}

const connectionStatus = await page.evaluate(() => {
  const statusEl = document.getElementById('serverStatus');
  return statusEl ? statusEl.innerText.trim() : 'NOT FOUND';
});
console.log(`Connection Status: ${connectionStatus}`);

const sections = ['dashboard', 'guide', 'tutorial', 'config', 'providers', 'custom-models', 'upload-config', 'usage', 'plugins', 'gpu-monitor', 'logs'];

const issues = [];

for (const section of sections) {
  pageErrors.length = 0;
  consoleErrors.length = 0;
  
  const navItem = await page.$(`.nav-item[data-section="${section}"]`);
  if (navItem) {
    await navItem.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `/root/AIClient-2-API/screenshot-verify-${section}.png`, fullPage: true });
    
    const sectionInfo = await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return { found: false };
      const visible = el.offsetParent !== null || getComputedStyle(el).display !== 'none';
      const allText = el.innerText.trim();
      
      const emptyContainers = [];
      el.querySelectorAll('.provider-list, .model-list, .config-list, .log-container, .gpu-status-content, .current-model-container, .queue-status-content, .quick-switch-content, .python-service-status, .config-content, .custom-models-container, .usage-panel, .plugin-list').forEach(container => {
        if (container.offsetParent !== null && container.innerText.trim().length < 5) {
          emptyContainers.push(container.className);
        }
      });
      
      const loadingElements = [];
      el.querySelectorAll('.loading, .skeleton, .spinner, [class*="loading"]').forEach(e => {
        if (e.offsetParent !== null) {
          loadingElements.push(e.className);
        }
      });
      
      return { found: true, visible, textLength: allText.length, emptyContainers, loadingElements, first200: allText.substring(0, 200) };
    }, section);
    
    let hasIssue = false;
    let issueDesc = [];
    
    if (!sectionInfo.found) {
      hasIssue = true;
      issueDesc.push('Section not found');
    }
    if (!sectionInfo.visible) {
      hasIssue = true;
      issueDesc.push('Section not visible');
    }
    if (sectionInfo.emptyContainers?.length > 0) {
      hasIssue = true;
      issueDesc.push(`Empty containers: ${sectionInfo.emptyContainers.join(', ')}`);
    }
    if (pageErrors.length > 0) {
      hasIssue = true;
      issueDesc.push(`Page errors: ${pageErrors.map(e => e.message).join('; ')}`);
    }
    if (consoleErrors.length > 0) {
      const filteredErrors = consoleErrors.filter(e => !e.includes('ERR_ABORTED'));
      if (filteredErrors.length > 0) {
        hasIssue = true;
        issueDesc.push(`Console errors: ${filteredErrors.join('; ')}`);
      }
    }
    
    if (hasIssue) {
      issues.push({ section, issues: issueDesc });
    }
    
    console.log(`[${hasIssue ? '❌' : '✅'}] ${section}: visible=${sectionInfo.visible}, textLen=${sectionInfo.textLength}${issueDesc.length ? ', issues: ' + issueDesc.join(', ') : ''}`);
  }
}

console.log('\n=== ISSUES SUMMARY ===');
if (issues.length === 0) {
  console.log('No issues found!');
} else {
  issues.forEach(i => {
    console.log(`${i.section}: ${i.issues.join(', ')}`);
  });
}

console.log('\n=== ALL PAGE ERRORS ===');
console.log(JSON.stringify(pageErrors, null, 2));

console.log('\n=== ALL CONSOLE ERRORS (excluding ERR_ABORTED) ===');
consoleErrors.filter(e => !e.includes('ERR_ABORTED')).forEach(e => console.log(e));

console.log('\n=== ALL FAILED REQUESTS (excluding /app/ ERR_ABORTED) ===');
failedRequests.filter(r => !r.url.includes('/app/') || r.failure !== 'net::ERR_ABORTED').forEach(r => {
  console.log(`URL: ${r.url}, Failure: ${r.failure}`);
});

await browser.close();
