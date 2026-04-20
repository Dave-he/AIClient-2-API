import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Step 1: Go to login page
  console.log('Step 1: Loading login page...');
  await page.goto('http://localhost:30000/login.html', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: '/tmp/screenshot-1-login.png' });
  console.log('Screenshot saved: /tmp/screenshot-1-login.png');

  // Step 2: Login
  console.log('Step 2: Logging in...');
  await page.type('#password', 'admin123');
  await page.click('#loginBtn');
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: '/tmp/screenshot-2-dashboard.png' });
  console.log('Screenshot saved: /tmp/screenshot-2-dashboard.png');

  // Step 3: Check console errors
  console.log('Step 3: Checking console errors...');
  const consoleErrors = await page.evaluate(() => {
    return window.__consoleErrors || [];
  });
  console.log('Console errors:', consoleErrors);

  // Step 4: Check if GPU monitor section exists
  console.log('Step 4: Checking GPU monitor data...');
  const gpuData = await page.evaluate(() => {
    return {
      pythonGpuUtilization: document.getElementById('pythonGpuUtilization')?.textContent,
      pythonGpuMemory: document.getElementById('pythonGpuMemory')?.textContent,
      pythonGpuTemp: document.getElementById('pythonGpuTemp')?.textContent,
      pythonGpuPower: document.getElementById('pythonGpuPower')?.textContent,
      pythonGpuName: document.getElementById('pythonGpuName')?.textContent,
      pythonGpuConnectionStatus: document.getElementById('pythonGpuConnectionStatus')?.textContent,
      pythonGpuChart: document.getElementById('pythonGpuChart') ? 'exists' : 'missing'
    };
  });
  console.log('GPU Data:', gpuData);

  // Step 5: Check models list
  console.log('Step 5: Checking models list...');
  const modelsData = await page.evaluate(() => {
    const modelsList = document.getElementById('modelsList');
    return {
      modelsListExists: !!modelsList,
      modelsCount: modelsList?.querySelectorAll('.model-tag').length || 0
    };
  });
  console.log('Models data:', modelsData);

  await browser.close();
})();
