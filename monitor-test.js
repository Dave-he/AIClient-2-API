import http from 'http';

const BASE_URL = 'http://192.168.7.103:30000';
const REQUEST_TIMEOUT = 30000;

const MONITOR_ENDPOINTS = [
  { path: '/api/dashboard', method: 'GET', name: 'Dashboard' },
  { path: '/api/dashboard/summary', method: 'GET', name: 'DashboardSummary' },
  { path: '/api/system', method: 'GET', name: 'SystemInfo' },
  { path: '/api/system/monitor', method: 'GET', name: 'SystemMonitor' },
  { path: '/api/gpu/status', method: 'GET', name: 'GPUStatus' },
  { path: '/api/python/gpu/status', method: 'GET', name: 'PythonGPUStatus' },
  { path: '/api/python/gpu/history?minutes=5', method: 'GET', name: 'GPUHistory' },
  { path: '/api/python/models/status', method: 'GET', name: 'ModelStatus' },
  { path: '/api/python/queue/status', method: 'GET', name: 'QueueStatus' },
  { path: '/api/python/health', method: 'GET', name: 'PythonHealth' },
  { path: '/api/python/monitor/summary', method: 'GET', name: 'MonitorSummary' },
  { path: '/api/providers', method: 'GET', name: 'Providers' },
  { path: '/api/providers/static', method: 'GET', name: 'ProvidersStatic' },
  { path: '/api/providers/dynamic', method: 'GET', name: 'ProvidersDynamic' },
  { path: '/api/usage', method: 'GET', name: 'Usage' },
  { path: '/api/usage/stats?range=day', method: 'GET', name: 'UsageStats' },
  { path: '/provider_health', method: 'GET', name: 'ProviderHealth' },
  { path: '/health', method: 'GET', name: 'Health' }
];

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
        const contentLength = responseData.length;
        const contentEncoding = res.headers['content-encoding'] || 'none';
        
        let parsedData = null;
        let hasError = false;
        let errorMessage = null;
        
        try {
          if (responseData && res.headers['content-type']?.includes('application/json')) {
            parsedData = JSON.parse(responseData);
            if (parsedData.error || parsedData.success === false) {
              hasError = true;
              errorMessage = parsedData.error?.message || parsedData.message || 'Unknown error';
            }
          }
        } catch (e) {
          hasError = true;
          errorMessage = 'Failed to parse response';
        }
        
        resolve({
          statusCode: res.statusCode,
          duration,
          size: contentLength,
          compressedSize: contentEncoding !== 'none' ? contentLength : null,
          contentEncoding,
          success: res.statusCode >= 200 && res.statusCode < 400 && !hasError,
          hasError,
          errorMessage,
          data: parsedData
        });
      });
    });

    req.on('error', (e) => {
      const duration = Date.now() - startTime;
      resolve({
        statusCode: 0,
        duration,
        size: 0,
        compressedSize: null,
        contentEncoding: 'none',
        success: false,
        hasError: true,
        errorMessage: e.message,
        data: null
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = Date.now() - startTime;
      resolve({
        statusCode: 408,
        duration,
        size: 0,
        compressedSize: null,
        contentEncoding: 'none',
        success: false,
        hasError: true,
        errorMessage: 'Request timeout',
        data: null
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
  
  if (result.success && result.data?.token) {
    return result.data.token;
  }
  
  return null;
}

async function testEndpoint(endpoint, authToken = null) {
  const options = {
    hostname: '192.168.7.103',
    port: 30000,
    path: endpoint.path,
    method: endpoint.method,
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  };

  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }

  return makeRequest(options);
}

async function runMonitorTest() {
  console.log('========================================');
  console.log('      监控面板接口测试 - Monitor Test    ');
  console.log('========================================');
  console.log(`目标服务器: ${BASE_URL}`);
  console.log(`测试时间: ${new Date().toLocaleString()}`);
  console.log('----------------------------------------\n');

  let authToken = null;
  
  console.log('1. 尝试登录获取认证令牌...');
  authToken = await login();
  
  if (authToken) {
    console.log(`   ✓ 登录成功`);
  } else {
    console.log(`   ✗ 登录失败，继续测试但部分接口可能返回 401`);
  }

  console.log('\n2. 测试监控面板接口...');
  console.log('-------------------------------------------------------------------');
  console.log('接口名称               | 状态码 | 响应时间 | 数据大小 | 压缩 | 状态');
  console.log('-------------------------------------------------------------------');

  const results = [];
  let totalDuration = 0;
  let successCount = 0;
  let failedCount = 0;
  let maxDuration = 0;
  let minDuration = Infinity;
  let totalSize = 0;
  let totalCompressedSize = 0;

  for (const endpoint of MONITOR_ENDPOINTS) {
    console.log(`   正在测试: ${endpoint.name}`);
    const result = await testEndpoint(endpoint, authToken);
    results.push({ ...endpoint, ...result });
    
    totalDuration += result.duration;
    totalSize += result.size;
    if (result.compressedSize) totalCompressedSize += result.compressedSize;
    
    if (result.success) {
      successCount++;
      maxDuration = Math.max(maxDuration, result.duration);
      minDuration = Math.min(minDuration, result.duration);
    } else {
      failedCount++;
    }

    const status = result.success ? '✓' : '✗';
    const durationStr = `${result.duration}ms`;
    const sizeStr = result.size > 1024 
      ? `${(result.size / 1024).toFixed(1)}KB` 
      : `${result.size}B`;
    const compressedStr = result.contentEncoding !== 'none' ? '✓' : '-';

    console.log(`             ${status} ${result.statusCode} ${durationStr.padStart(8)} ${sizeStr.padStart(10)} ${compressedStr.padStart(7)} ${result.hasError ? `(错误: ${result.errorMessage})` : ''}`);
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('-------------------------------------------------------------------');

  const avgDuration = successCount > 0 ? (totalDuration / successCount).toFixed(2) : 0;
  const compressionRatio = totalCompressedSize > 0 
    ? ((1 - totalCompressedSize / totalSize) * 100).toFixed(1) 
    : 'N/A';

  console.log(`\n【综合统计】`);
  console.log(`  总接口数: ${MONITOR_ENDPOINTS.length}`);
  console.log(`  成功: ${successCount}`);
  console.log(`  失败: ${failedCount}`);
  console.log(`  平均响应时间: ${avgDuration}ms`);
  console.log(`  最快接口: ${minDuration}ms`);
  console.log(`  最慢接口: ${maxDuration}ms`);
  console.log(`  总数据量: ${(totalSize / 1024).toFixed(1)}KB`);
  console.log(`  压缩后: ${totalCompressedSize > 0 ? (totalCompressedSize / 1024).toFixed(1) + 'KB' : 'N/A'}`);
  console.log(`  压缩率: ${compressionRatio}`);

  const slowEndpoints = results
    .filter(r => r.success && r.duration > 100)
    .sort((a, b) => b.duration - a.duration);
  
  if (slowEndpoints.length > 0) {
    console.log(`\n【慢接口警告】(超过 100ms):`);
    slowEndpoints.forEach(e => {
      console.log(`  - ${e.name}: ${e.duration}ms`);
    });
  }

  const failedEndpoints = results.filter(r => !r.success);
  if (failedEndpoints.length > 0) {
    console.log(`\n【失败接口】:`);
    failedEndpoints.forEach(e => {
      console.log(`  - ${e.name}: ${e.errorMessage || `HTTP ${e.statusCode}`}`);
    });
  }

  console.log('\n【接口数据摘要】');
  results.forEach(result => {
    if (result.data) {
      let summary = '';
      if (result.data.devices) {
        summary = `${result.data.devices.length} 个 GPU 设备`;
      } else if (result.data.items) {
        summary = `${result.data.items.length} 个提供商`;
      } else if (result.data.totalRequests !== undefined) {
        summary = `${result.data.totalRequests} 次请求, ${result.data.totalTokens} 令牌`;
      } else if (result.data.success !== undefined) {
        summary = result.data.success ? '成功' : '失败';
      } else if (result.data.status) {
        summary = `状态: ${result.data.status}`;
      }
      
      if (summary) {
        console.log(`  ${result.name}: ${summary}`);
      }
    }
  });

  console.log('\n========================================');
  console.log('            测试完成 - Done             ');
  console.log('========================================');

  return {
    results,
    summary: {
      totalEndpoints: MONITOR_ENDPOINTS.length,
      successCount,
      failedCount,
      avgDuration: parseFloat(avgDuration),
      minDuration,
      maxDuration,
      totalSize,
      totalCompressedSize,
      compressionRatio: compressionRatio === 'N/A' ? null : parseFloat(compressionRatio),
      slowEndpoints,
      failedEndpoints
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMonitorTest().catch(console.error);
}

export { runMonitorTest, MONITOR_ENDPOINTS };
