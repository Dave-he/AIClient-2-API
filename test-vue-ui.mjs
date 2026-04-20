import http from 'http';

const BASE_URL = 'http://localhost:5173';
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`);
    failed++;
  }
}

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request(urlObj, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function runTests() {
  console.log('\n🧪 开始测试 Vue UI 界面...\n');

  // Test 1: Vite dev server
  await test('1. Vite 开发服务器响应', async () => {
    const html = await fetchJSON(BASE_URL + '/');
    if (!html.includes('<div id="app"></div>')) {
      throw new Error('Vue app div not found');
    }
  });

  // Test 2: API health check
  await test('2. API 健康检查', async () => {
    const result = await fetchJSON(BASE_URL + '/api/health');
    if (result.status !== 'ok') {
      throw new Error('Health check failed');
    }
  });

  // Test 3: Login
  let token = '';
  await test('3. 登录功能', async () => {
    const result = await fetchJSON(BASE_URL + '/api/login', {
      method: 'POST',
      body: { username: 'admin', password: 'admin123' }
    });
    if (!result.success) {
      throw new Error('Login failed');
    }
    token = result.token;
  });

  // Test 4: Get config with token
  await test('4. 获取配置（带 token）', async () => {
    if (!token) throw new Error('No token from login');
    const result = await fetchJSON(BASE_URL + '/api/config', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!result.SERVER_PORT) {
      throw new Error('Config fetch failed');
    }
  });

  // Test 5: Validate token
  await test('5. 验证 token', async () => {
    if (!token) throw new Error('No token from login');
    const result = await fetchJSON(BASE_URL + '/api/validate-token', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!result.valid) {
      throw new Error('Token validation failed');
    }
  });

  // Test 6: 401 without token
  await test('6. 无 token 时返回 401', async () => {
    try {
      await fetchJSON(BASE_URL + '/api/config');
      throw new Error('Should have returned 401');
    } catch (err) {
      if (!err.message.includes('401')) {
        throw new Error(`Expected 401, got: ${err.message}`);
      }
    }
  });

  console.log(`\n📊 测试完成: ${passed} 通过, ${failed} 失败\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
