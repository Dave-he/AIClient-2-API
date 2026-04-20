import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--ignore-certificate-errors'
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    console.log('=== 旧界面最终验证 ===\n');

    await page.goto('http://127.0.0.1:30000/login.html', { waitUntil: 'networkidle0' });
    await page.type('#password', 'admin123');
    await page.click('#loginButton');
    await new Promise(r => setTimeout(r, 5000));

    const dashboard = await page.evaluate(() => ({
      gpuStatus: document.getElementById('pythonGpuConnectionStatus')?.textContent?.trim(),
      gpuName: document.getElementById('pythonGpuName')?.textContent?.trim(),
      gpuUtil: document.getElementById('pythonGpuUtilization')?.textContent?.trim(),
      gpuMem: document.getElementById('pythonGpuMemory')?.textContent?.trim(),
      gpuTemp: document.getElementById('pythonGpuTemp')?.textContent?.trim(),
      gpuPower: document.getElementById('pythonGpuPower')?.textContent?.trim(),
      gpuTotalMem: document.getElementById('pythonGpuTotalMemory')?.textContent?.trim(),
      uptime: document.getElementById('uptime')?.textContent?.trim(),
      appVersion: document.getElementById('appVersion')?.textContent?.trim()
    }));

    console.log('仪表盘状态:');
    console.log('  GPU状态:', dashboard.gpuStatus);
    console.log('  GPU名称:', dashboard.gpuName);
    console.log('  GPU利用率:', dashboard.gpuUtil);
    console.log('  GPU内存:', dashboard.gpuMem);
    console.log('  GPU温度:', dashboard.gpuTemp);
    console.log('  GPU功率:', dashboard.gpuPower);
    console.log('  GPU总内存:', dashboard.gpuTotalMem);
    console.log('  运行时间:', dashboard.uptime);
    console.log('  版本:', dashboard.appVersion);

    await page.screenshot({ path: '/root/AIClient-2-API/screenshot-final.png', fullPage: true });
    console.log('\n截图已保存: screenshot-final.png');

    console.log('\n控制台错误:', errors.length === 0 ? '无' : errors);

    console.log('\n=== 验证结果 ===');
    const allOK =
      dashboard.gpuStatus?.includes('已连接') &&
      dashboard.gpuName &&
      dashboard.gpuMem &&
      errors.length === 0;

    if (allOK) {
      console.log('✅ 所有验证通过！旧界面工作正常。');
    } else {
      console.log('❌ 部分验证未通过');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
})();