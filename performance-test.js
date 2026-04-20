import http from 'http';

const BASE_URL = 'http://192.168.7.103:30000';

const PAGES = [
  { path: '/', name: 'Dashboard' },
  { path: '/index.html', name: 'Index' },
  { path: '/guide', name: 'Guide' },
  { path: '/tutorial', name: 'Tutorial' },
  { path: '/config', name: 'Config' },
  { path: '/providers', name: 'Providers' },
  { path: '/custom-models', name: 'CustomModels' },
  { path: '/upload-config', name: 'UploadConfig' },
  { path: '/usage', name: 'Usage' },
  { path: '/plugins', name: 'Plugins' },
  { path: '/logs', name: 'Logs' },
  { path: '/gpu-monitor', name: 'GPUMonitor' },
  { path: '/test-api', name: 'TestAPI' },
  { path: '/model-usage-stats', name: 'ModelUsageStats' },
  { path: '/potluck', name: 'Potluck' },
  { path: '/potluck-user', name: 'PotluckUser' },
  { path: '/login.html', name: 'Login' }
];

const API_ENDPOINTS = [
  { path: '/api/login', method: 'POST', name: 'LoginAPI', body: JSON.stringify({ password: 'admin123' }) },
  { path: '/api/config', method: 'GET', name: 'ConfigAPI' },
  { path: '/api/providers', method: 'GET', name: 'ProvidersAPI' },
  { path: '/api/usage', method: 'GET', name: 'UsageAPI' },
  { path: '/api/dashboard', method: 'GET', name: 'DashboardAPI' },
  { path: '/api/plugins', method: 'GET', name: 'PluginsAPI' },
  { path: '/health', method: 'GET', name: 'Health' }
];

const REQUEST_TIMEOUT = 30000;

async function makeRequest(options, data = null) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          duration,
          size: responseData.length,
          data: responseData,
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });

    req.on('error', (e) => {
      const duration = Date.now() - startTime;
      resolve({
        statusCode: 0,
        duration,
        size: 0,
        data: null,
        success: false,
        error: e.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = Date.now() - startTime;
      resolve({
        statusCode: 408,
        duration,
        size: 0,
        data: null,
        success: false,
        error: 'Request timeout'
      });
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function login() {
  const options = {
    hostname: '192.168.7.103',
    port: 30000,
    path: '/api/login',
    method: 'POST',
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  const result = await makeRequest(options, JSON.stringify({ password: 'admin123' }));
  
  if (result.success && result.data) {
    try {
      const response = JSON.parse(result.data);
      if (response.success && response.token) {
        return response.token;
      }
    } catch (e) {
      console.log('Failed to parse login response:', e);
    }
  }
  
  return null;
}

async function fetchPage(page, authToken = null) {
  const options = {
    hostname: '192.168.7.103',
    port: 30000,
    path: page.path,
    method: 'GET',
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  };

  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }

  const result = await makeRequest(options);
  
  return {
    name: page.name,
    path: page.path,
    statusCode: result.statusCode,
    duration: result.duration,
    size: result.size,
    success: result.success,
    error: result.error
  };
}

async function testApi(endpoint, authToken = null) {
  const options = {
    hostname: '192.168.7.103',
    port: 30000,
    path: endpoint.path,
    method: endpoint.method,
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  };

  if (endpoint.method !== 'GET') {
    options.headers['Content-Type'] = 'application/json';
  }

  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }

  const result = await makeRequest(options, endpoint.body);
  
  return {
    name: endpoint.name,
    path: endpoint.path,
    method: endpoint.method,
    statusCode: result.statusCode,
    duration: result.duration,
    size: result.size,
    success: result.success,
    error: result.error
  };
}

async function runPerformanceTest() {
  console.log('========================================');
  console.log('      性能测试开始 - Performance Test    ');
  console.log('========================================');
  console.log(`目标服务器: ${BASE_URL}`);
  console.log(`测试时间: ${new Date().toLocaleString()}`);
  console.log('----------------------------------------\n');

  const pageResults = [];
  const apiResults = [];
  let authToken = null;
  
  console.log('1. 尝试登录获取认证令牌...');
  const loginStartTime = Date.now();
  authToken = await login();
  const loginDuration = Date.now() - loginStartTime;
  
  if (authToken) {
    console.log(`   ✓ 登录成功，获取到令牌 (${loginDuration}ms)`);
  } else {
    console.log(`   ✗ 登录失败，将继续测试但部分页面可能返回 401 (${loginDuration}ms)`);
  }
  
  console.log('\n2. 测试页面加载性能...');
  
  for (const page of PAGES) {
    console.log(`   正在访问: ${page.name}`);
    const result = await fetchPage(page, authToken);
    pageResults.push(result);
    console.log(`             ${result.success ? '✓' : '✗'} ${result.duration}ms (${result.statusCode})`);
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n3. 测试API接口性能...');
  
  for (const endpoint of API_ENDPOINTS) {
    console.log(`   正在测试: ${endpoint.name}`);
    const result = await testApi(endpoint, authToken);
    apiResults.push(result);
    console.log(`             ${result.success ? '✓' : '✗'} ${result.duration}ms (${result.statusCode})`);
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n========================================');
  console.log('           测试结果汇总 - Summary        ');
  console.log('========================================');
  
  console.log('\n【页面加载时间统计】');
  console.log('-------------------------------------------------------------------');
  console.log('页面名称          | 状态码 | 加载时间 | 数据大小 | 状态');
  console.log('-------------------------------------------------------------------');
  
  let totalPageDuration = 0;
  let pageSuccessCount = 0;
  let pageFailedCount = 0;
  let pageMaxDuration = 0;
  let pageMinDuration = Infinity;
  
  pageResults.forEach(result => {
    const status = result.success ? '成功' : '失败';
    const durationStr = `${result.duration}ms`;
    const sizeStr = result.size > 0 ? `${(result.size / 1024).toFixed(2)}KB` : '-';
    
    console.log(
      `${result.name.padEnd(18)} | ${result.statusCode.toString().padStart(6)} | ${durationStr.padStart(9)} | ${sizeStr.padStart(9)} | ${status}`
    );
    
    if (result.success) {
      totalPageDuration += result.duration;
      pageSuccessCount++;
      pageMaxDuration = Math.max(pageMaxDuration, result.duration);
      pageMinDuration = Math.min(pageMinDuration, result.duration);
    } else {
      pageFailedCount++;
    }
  });
  
  console.log('-------------------------------------------------------------------');
  
  const pageAvgDuration = pageSuccessCount > 0 ? (totalPageDuration / pageSuccessCount).toFixed(2) : 0;
  
  console.log(`\n页面综合统计: `);
  console.log(`  总页面数: ${pageResults.length}`);
  console.log(`  成功: ${pageSuccessCount}`);
  console.log(`  失败: ${pageFailedCount}`);
  console.log(`  平均加载时间: ${pageAvgDuration}ms`);
  console.log(`  最快页面: ${pageMinDuration}ms`);
  console.log(`  最慢页面: ${pageMaxDuration}ms`);

  console.log('\n【API接口性能统计】');
  console.log('-------------------------------------------------------------------');
  console.log('接口名称          | 方法  | 状态码 | 响应时间 | 数据大小 | 状态');
  console.log('-------------------------------------------------------------------');
  
  let totalApiDuration = 0;
  let apiSuccessCount = 0;
  let apiFailedCount = 0;
  let apiMaxDuration = 0;
  let apiMinDuration = Infinity;
  
  apiResults.forEach(result => {
    const status = result.success ? '成功' : '失败';
    const durationStr = `${result.duration}ms`;
    const sizeStr = result.size > 0 ? `${(result.size / 1024).toFixed(2)}KB` : '-';
    
    console.log(
      `${result.name.padEnd(18)} | ${result.method.padStart(5)} | ${result.statusCode.toString().padStart(6)} | ${durationStr.padStart(10)} | ${sizeStr.padStart(9)} | ${status}`
    );
    
    if (result.success) {
      totalApiDuration += result.duration;
      apiSuccessCount++;
      apiMaxDuration = Math.max(apiMaxDuration, result.duration);
      apiMinDuration = Math.min(apiMinDuration, result.duration);
    } else {
      apiFailedCount++;
    }
  });
  
  console.log('-------------------------------------------------------------------');
  
  const apiAvgDuration = apiSuccessCount > 0 ? (totalApiDuration / apiSuccessCount).toFixed(2) : 0;
  
  console.log(`\nAPI综合统计: `);
  console.log(`  总接口数: ${apiResults.length}`);
  console.log(`  成功: ${apiSuccessCount}`);
  console.log(`  失败: ${apiFailedCount}`);
  console.log(`  平均响应时间: ${apiAvgDuration}ms`);
  console.log(`  最快接口: ${apiMinDuration}ms`);
  console.log(`  最慢接口: ${apiMaxDuration}ms`);

  const slowPages = pageResults
    .filter(r => r.success && r.duration > 2000)
    .sort((a, b) => b.duration - a.duration);
  
  if (slowPages.length > 0) {
    console.log(`\n【慢页面警告】(超过 2000ms):`);
    slowPages.forEach(page => {
      console.log(`  - ${page.name}: ${page.duration}ms`);
    });
  }
  
  const warningPages = pageResults
    .filter(r => r.success && r.duration > 500 && r.duration <= 2000)
    .sort((a, b) => b.duration - a.duration);
  
  if (warningPages.length > 0) {
    console.log(`\n【注意页面】(500ms - 2000ms):`);
    warningPages.forEach(page => {
      console.log(`  - ${page.name}: ${page.duration}ms`);
    });
  }
  
  const slowApis = apiResults
    .filter(r => r.success && r.duration > 2000)
    .sort((a, b) => b.duration - a.duration);
  
  if (slowApis.length > 0) {
    console.log(`\n【慢API警告】(超过 2000ms):`);
    slowApis.forEach(api => {
      console.log(`  - ${api.name}: ${api.duration}ms`);
    });
  }
  
  const failedPages = pageResults.filter(r => !r.success);
  if (failedPages.length > 0) {
    console.log(`\n【失败页面】:`);
    failedPages.forEach(page => {
      console.log(`  - ${page.name}: ${page.error || 'Unknown error'}`);
    });
  }
  
  const failedApis = apiResults.filter(r => !r.success);
  if (failedApis.length > 0) {
    console.log(`\n【失败API】:`);
    failedApis.forEach(api => {
      console.log(`  - ${api.name}: ${api.error || 'Unknown error'}`);
    });
  }
  
  console.log('\n========================================');
  console.log('            测试完成 - Done             ');
  console.log('========================================');
  
  return {
    pageResults,
    apiResults,
    summary: {
      pages: {
        totalPages: pageResults.length,
        successCount: pageSuccessCount,
        failedCount: pageFailedCount,
        avgDuration: parseFloat(pageAvgDuration),
        minDuration: pageMinDuration,
        maxDuration: pageMaxDuration,
        slowPages,
        warningPages,
        failedPages
      },
      apis: {
        totalApis: apiResults.length,
        successCount: apiSuccessCount,
        failedCount: apiFailedCount,
        avgDuration: parseFloat(apiAvgDuration),
        minDuration: apiMinDuration,
        maxDuration: apiMaxDuration,
        slowApis,
        failedApis
      }
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTest().catch(console.error);
}

export { runPerformanceTest, PAGES, API_ENDPOINTS };
