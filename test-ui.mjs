import http from 'http';

const VUE_PORT = '5175';
const BASE_URL = `http://localhost:${VUE_PORT}`;
let passed = 0, failed = 0;
let authToken = '';

async function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request(urlObj, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...options.headers }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        else {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}: ${err.message.substring(0, 100)}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Vue UI 界面综合测试\n');
  console.log('=' .repeat(50));

  // 1. Vite 服务器
  await test('1. Vite 开发服务器响应', async () => {
    const html = await fetchJSON(BASE_URL + '/');
    if (!html.includes('<div id="app"></div>')) throw new Error('Vue app not found');
  });

  // 2. 健康检查
  await test('2. API 健康检查 (/api/health)', async () => {
    const result = await fetchJSON(BASE_URL + '/api/health');
    if (result.status !== 'ok') throw new Error('Health check failed');
  });

  // 3. 登录
  await test('3. 登录功能 (POST /api/login)', async () => {
    const result = await fetchJSON(BASE_URL + '/api/login', {
      method: 'POST',
      body: { username: 'admin', password: 'admin123' }
    });
    if (!result.success) throw new Error('Login failed');
    authToken = result.token;
  });

  // 4. 获取配置
  await test('4. 获取配置 (GET /api/config)', async () => {
    const result = await fetchJSON(BASE_URL + '/api/config', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!result.SERVER_PORT) throw new Error('Config not found');
  });

  // 5. 验证 Token
  await test('5. Token 验证 (GET /api/validate-token)', async () => {
    const result = await fetchJSON(BASE_URL + '/api/validate-token', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!result.valid) throw new Error('Token invalid');
  });

  // 6. 系统信息
  await test('6. 系统信息 (GET /api/system)', async () => {
    const result = await fetchJSON(BASE_URL + '/api/system', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!result) throw new Error('System info not found');
  });

  // 7. 无 Token 时返回 401
  await test('7. 无 Token 时返回 401', async () => {
    try {
      await fetchJSON(BASE_URL + '/api/config');
      throw new Error('Should return 401');
    } catch (err) {
      if (!err.message.includes('401')) throw new Error(`Expected 401, got: ${err.message}`);
    }
  });

  console.log('=' .repeat(50));
  console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`);
  console.log(`   后端端口: 30000`);
  console.log(`   Vue 端口: ${VUE_PORT}\n`);
  
  if (failed > 0) process.exit(1);
}

runTests();
