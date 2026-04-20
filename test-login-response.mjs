import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

// 捕获响应体
page.on('response', async res => {
  if (res.url().includes('/api/login')) {
    const status = res.status();
    const headers = await res.headers();
    let body = '';
    try { body = await res.text(); } catch {}
    console.log(`[Login Response]`);
    console.log(`  Status: ${status}`);
    console.log(`  Content-Type: ${headers['content-type']}`);
    console.log(`  Body (first 300 chars): ${body.substring(0, 300)}`);
    console.log(`  Body length: ${body.length}`);
  }
});

console.log('测试登录响应...');
await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });

// 直接使用 JavaScript 测试 fetch
const result = await page.evaluate(async () => {
  // 测试 1: fetch
  const res1 = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  
  const text1 = await res1.text();
  
  // 测试 2: XMLHttpRequest
  const xhrResult = await new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/login', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      resolve({ status: xhr.status, responseText: xhr.responseText });
    };
    xhr.send(JSON.stringify({ username: 'admin', password: 'admin123' }));
  });
  
  return {
    fetch: { status: res1.status, text: text1.substring(0, 200) },
    xhr: xhrResult
  };
});

console.log('\n测试结果:');
console.log('Fetch:', JSON.stringify(result.fetch, null, 2));
console.log('XHR:', JSON.stringify(result.xhr, null, 2));

await browser.close();
