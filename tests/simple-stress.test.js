import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const http = require('http');
const os = require('os');

const TEST_SERVER_BASE_URL = 'http://localhost:30000';
const TEST_API_KEY = 'sk-2e3513944ecac08f466a2e01872ba91d';
const TEST_DURATION_SECONDS = 30;

const RATE_LIMIT_VALUES = [100, 200, 500, 1000];
const CONCURRENCY_LEVELS = [5, 10, 20];

const TEST_REQUEST_BODY = JSON.stringify({
    model: "gemma-4-31b",
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

async function updateRateLimit(limitValue) {
    const loginResponse = await fetch(`${TEST_SERVER_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin123' })
    });
    const loginData = await loginResponse.json();
    
    await fetch(`${TEST_SERVER_BASE_URL}/api/config`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loginData.token}`
        },
        body: JSON.stringify({ RATE_LIMIT: limitValue })
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
                'model-provider': 'local-model'
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

async function runLoadTest(rateLimit, concurrency, durationSeconds) {
    console.log(`  Running: rateLimit=${rateLimit}, concurrency=${concurrency}`);
    
    await updateRateLimit(rateLimit);
    await new Promise(r => setTimeout(r, 1500));
    
    const results = [];
    const metricsHistory = [];
    const metricsInterval = setInterval(() => metricsHistory.push(getSystemMetrics()), 1000);
    
    let startTime = Date.now();
    let stopTime = startTime + (durationSeconds * 1000);
    
    const runClient = async () => {
        while (Date.now() < stopTime) {
            const result = await makeRequest();
            results.push(result);
            await new Promise(r => setTimeout(r, 50));
        }
    };
    
    const clients = Array(concurrency).fill(null).map(() => runClient());
    await Promise.all(clients);
    clearInterval(metricsInterval);
    
    const elapsed = (Date.now() - startTime) / 1000;
    const completed = results.length;
    const successful = results.filter(r => r.success).length;
    const successRate = ((successful / completed) * 100).toFixed(2);
    const rps = (completed / elapsed).toFixed(2);
    
    const avgMetrics = metricsHistory.length ? {
        cpuPercent: (metricsHistory.reduce((a, m) => a + parseFloat(m.cpuPercent), 0) / metricsHistory.length).toFixed(2),
        maxCpu: Math.max(...metricsHistory.map(m => parseFloat(m.cpuPercent))).toFixed(2)
    } : { cpuPercent: '0', maxCpu: '0' };
    
    const rateLimitBlocks = results.filter(r => r.status === 429).length;
    
    return { rateLimit, concurrency, completed, successful, successRate, rps, avgMetrics, rateLimitBlocks };
}

async function main() {
    console.log('\n' + '='.repeat(100));
    console.log('AIClient-2-API SIMPLE STRESS TEST');
    console.log('='.repeat(100));
    
    const results = [];
    
    for (const rateLimit of RATE_LIMIT_VALUES) {
        for (const concurrency of CONCURRENCY_LEVELS) {
            const result = await runLoadTest(rateLimit, concurrency, TEST_DURATION_SECONDS);
            results.push(result);
            
            console.log(`  Result: Success=${result.successRate}% | RPS=${result.rps} | CPU=${result.avgMetrics.cpuPercent}% | Blocks=${result.rateLimitBlocks}`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    console.log('\n' + '='.repeat(100));
    console.log('RESULTS SUMMARY');
    console.log('='.repeat(100));
    
    console.log('\nRateLimit | Concurrency | Completed | Success | SuccessRate | RPS | CPU% | Blocks');
    console.log('----------|-------------|-----------|---------|-------------|-----|------|-------');
    
    for (const r of results) {
        console.log(`${r.rateLimit.toString().padStart(10)} | ${r.concurrency.toString().padStart(11)} | ${r.completed.toString().padStart(9)} | ${r.successful.toString().padStart(7)} | ${r.successRate.padStart(11)} | ${r.rps.padStart(4)} | ${r.avgMetrics.cpuPercent.padStart(5)} | ${r.rateLimitBlocks.toString().padStart(6)}`);
    }
    
    const fs = require('fs');
    fs.mkdirSync('tests/reports', { recursive: true });
    fs.writeFileSync(`tests/reports/simple-stress-report-${Date.now()}.json`, JSON.stringify(results, null, 2));
    
    console.log('\n' + '='.repeat(100));
}

main().catch(console.error);