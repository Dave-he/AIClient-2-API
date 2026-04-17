import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const http = require('http');
const os = require('os');

const TEST_SERVER_BASE_URL = 'http://localhost:30000';
const TEST_API_KEY = 'sk-2e3513944ecac08f466a2e01872ba91d';
const TEST_DURATION_SECONDS = 15;
const CONCURRENCY = 10;

const TEST_REQUEST_BODY = JSON.stringify({
    model: "claude-3-5-sonnet-20241022",
    messages: [{ role: "user", content: "Hello" }],
    stream: false,
    max_tokens: 10
});

function getSystemMetrics() {
    const cpus = os.cpus();
    const totalCpuUsage = cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;
    
    const memUsage = process.memoryUsage();
    
    return {
        cpuPercent: totalCpuUsage.toFixed(2),
        rss: (memUsage.rss / 1024 / 1024).toFixed(2)
    };
}

async function login() {
    const response = await fetch(`${TEST_SERVER_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin123' })
    });
    const data = await response.json();
    return data.token;
}

async function updateRateLimitConfig(token, rateLimit, burstLimit) {
    await fetch(`${TEST_SERVER_BASE_URL}/api/config`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ RATE_LIMIT: rateLimit, BURST_LIMIT: burstLimit })
    });
}

async function makeRequest() {
    const start = Date.now();
    try {
        const response = await fetch(`${TEST_SERVER_BASE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_API_KEY}`,
                'model-provider': 'claude-custom'
            },
            body: TEST_REQUEST_BODY,
            timeout: 60000
        });
        const duration = Date.now() - start;
        return { status: response.status, duration, success: response.ok };
    } catch (err) {
        return { status: 0, duration: Date.now() - start, success: false };
    }
}

async function runLoadTest(rateLimit, burstLimit) {
    const results = [];
    const metricsHistory = [];
    const metricsInterval = setInterval(() => metricsHistory.push(getSystemMetrics()), 1000);
    
    let startTime = Date.now();
    let stopTime = startTime + (TEST_DURATION_SECONDS * 1000);
    
    const runClient = async () => {
        while (Date.now() < stopTime) {
            const result = await makeRequest();
            results.push(result);
            await new Promise(r => setTimeout(r, 50));
        }
    };
    
    const clients = Array(CONCURRENCY).fill(null).map(() => runClient());
    await Promise.all(clients);
    clearInterval(metricsInterval);
    
    const elapsed = (Date.now() - startTime) / 1000;
    const completed = results.length;
    const successful = results.filter(r => r.success).length;
    const successRate = completed > 0 ? ((successful / completed) * 100) : 0;
    const rps = completed > 0 ? (completed / elapsed) : 0;
    
    const avgMetrics = metricsHistory.length ? {
        cpuPercent: (metricsHistory.reduce((a, m) => a + parseFloat(m.cpuPercent), 0) / metricsHistory.length),
        maxCpu: Math.max(...metricsHistory.map(m => parseFloat(m.cpuPercent)))
    } : { cpuPercent: 0, maxCpu: 0 };
    
    const rateLimitBlocks = results.filter(r => r.status === 429).length;
    
    return {
        rateLimit,
        burstLimit,
        completedRequests: completed,
        successfulRequests: successful,
        successRate: successRate.toFixed(2),
        rps: rps.toFixed(2),
        avgCpu: avgMetrics.cpuPercent.toFixed(2),
        maxCpu: avgMetrics.maxCpu.toFixed(2),
        rateLimitBlocks
    };
}

async function findOptimalConfig(token) {
    console.log('\n🔍 Starting automatic rate limit optimization...');
    
    const MIN_RATE_LIMIT = 100;
    const MAX_RATE_LIMIT = 2000;
    const STEP = 100;
    
    let low = MIN_RATE_LIMIT;
    let high = MAX_RATE_LIMIT;
    let bestConfig = null;
    let bestRps = 0;
    
    const testedConfigs = [];
    
    while (low <= high) {
        const rateLimit = low;
        const burstLimit = Math.min(Math.floor(rateLimit / 5), 500);
        
        console.log(`\n📊 Testing rateLimit=${rateLimit}, burstLimit=${burstLimit}`);
        
        await updateRateLimitConfig(token, rateLimit, burstLimit);
        await new Promise(r => setTimeout(r, 1500));
        
        const result = await runLoadTest(rateLimit, burstLimit);
        testedConfigs.push(result);
        
        const successRate = parseFloat(result.successRate);
        const cpu = parseFloat(result.avgCpu);
        const currentRps = parseFloat(result.rps);
        
        console.log(`   Result: Success=${result.successRate}% | RPS=${result.rps} | CPU=${result.avgCpu}% | Blocks=${result.rateLimitBlocks}`);
        
        if (successRate >= 95 && cpu < 80 && result.rateLimitBlocks === 0) {
            if (currentRps > bestRps) {
                bestRps = currentRps;
                bestConfig = { rateLimit, burstLimit, ...result };
            }
            low = rateLimit + STEP;
        } else {
            high = rateLimit - STEP;
        }
        
        await new Promise(r => setTimeout(r, 2000));
    }
    
    return { bestConfig, testedConfigs };
}

async function main() {
    console.log('\n' + '='.repeat(100));
    console.log('AIClient-2-API AUTO RATE LIMIT OPTIMIZATION');
    console.log('='.repeat(100));
    
    const token = await login();
    console.log('✅ Login successful');
    
    const { bestConfig, testedConfigs } = await findOptimalConfig(token);
    
    console.log('\n' + '='.repeat(100));
    console.log('OPTIMIZATION RESULTS');
    console.log('='.repeat(100));
    
    console.log('\nTested Configurations:');
    console.log('---------------------');
    testedConfigs.forEach(c => {
        console.log(`  RateLimit=${c.rateLimit} | Burst=${c.burstLimit} | RPS=${c.rps} | Success=${c.successRate}% | CPU=${c.avgCpu}%`);
    });
    
    if (bestConfig) {
        console.log(`\n🎉 Optimal Configuration Found:`);
        console.log(`  Rate Limit: ${bestConfig.rateLimit} requests/minute`);
        console.log(`  Burst Limit: ${bestConfig.burstLimit} requests/second`);
        console.log(`  Expected RPS: ${bestConfig.rps}`);
        console.log(`  Success Rate: ${bestConfig.successRate}%`);
        console.log(`  CPU Usage: ${bestConfig.avgCpu}%`);
        
        await updateRateLimitConfig(token, bestConfig.rateLimit, bestConfig.burstLimit);
        console.log(`\n✅ System rate limit has been set to ${bestConfig.rateLimit} requests/minute`);
    } else {
        console.log('\n❌ No optimal configuration found within tested range');
    }
    
    const fs = require('fs');
    fs.mkdirSync('tests/reports', { recursive: true });
    fs.writeFileSync(`tests/reports/auto-optimize-report-${Date.now()}.json`, JSON.stringify({
        testDate: new Date().toISOString(),
        concurrency: CONCURRENCY,
        testDuration: TEST_DURATION_SECONDS,
        bestConfig,
        testedConfigs
    }, null, 2));
    
    console.log('\n📄 Report saved to tests/reports/auto-optimize-report.json');
    console.log('\n' + '='.repeat(100));
}

main().catch(console.error);