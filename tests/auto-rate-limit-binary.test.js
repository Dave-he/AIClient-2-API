import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const http = require('http');
const os = require('os');

const TEST_SERVER_BASE_URL = 'http://localhost:30000';
const TEST_API_KEY = 'sk-2e3513944ecac08f466a2e01872ba91d';
const TEST_DURATION_SECONDS = 20;

const MIN_RATE_LIMIT = 50;
const MAX_RATE_LIMIT = 2000;
const CONCURRENCY_LEVEL = 10;

const TEST_REQUEST_BODY = JSON.stringify({
    model: "gemma-4-31b",
    messages: [{ role: "user", content: "Hello, what is 2+2?" }],
    stream: false,
    max_tokens: 30
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
    return new Promise((resolve) => {
        const url = new URL(`${TEST_SERVER_BASE_URL}/api/config`);
        const options = {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_API_KEY}`
            },
            timeout: 5000
        };
        
        const req = http.request(url, options, (res) => {
            res.on('data', () => {});
            res.on('end', () => {
                resolve(res.statusCode >= 200 && res.statusCode < 400);
            });
        });
        
        req.on('error', () => resolve(false));
        req.write(JSON.stringify({ RATE_LIMIT: limitValue }));
        req.end();
    });
}

async function makeRequest(clientId) {
    return new Promise((resolve) => {
        const url = new URL(`${TEST_SERVER_BASE_URL}/v1/chat/completions`);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_API_KEY}`,
                'model-provider': 'local-model'
            },
            timeout: 60000
        };
        
        const start = Date.now();
        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const duration = Date.now() - start;
                const success = res.statusCode >= 200 && res.statusCode < 400;
                resolve({ status: res.statusCode, duration, success });
            });
        });
        
        req.on('error', () => resolve({ status: 0, duration: Date.now() - start, success: false }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ status: 408, duration: Date.now() - start, success: false });
        });
        
        req.write(TEST_REQUEST_BODY);
        req.end();
    });
}

async function runLoadTest(rateLimit, concurrency, durationSeconds) {
    const results = [];
    let startTime = Date.now();
    let stopTime = startTime + (durationSeconds * 1000);
    
    const metricsHistory = [];
    const metricsInterval = setInterval(() => metricsHistory.push(getSystemMetrics()), 1000);
    
    const runClient = async (clientId) => {
        while (Date.now() < stopTime) {
            const result = await makeRequest(clientId);
            results.push(result);
            await new Promise(r => setTimeout(r, 50));
        }
    };
    
    const clients = Array(concurrency).fill(null).map((_, i) => runClient(i));
    await Promise.all(clients);
    clearInterval(metricsInterval);
    
    const elapsed = (Date.now() - startTime) / 1000;
    const completed = results.length;
    const successful = results.filter(r => r.success).length;
    const successRate = (successful / completed) * 100;
    const rps = completed / elapsed;
    
    const avgMetrics = metricsHistory.length ? {
        cpuPercent: (metricsHistory.reduce((a, m) => a + parseFloat(m.cpuPercent), 0) / metricsHistory.length).toFixed(2),
        maxCpu: Math.max(...metricsHistory.map(m => parseFloat(m.cpuPercent))).toFixed(2)
    } : { cpuPercent: '0', maxCpu: '0' };
    const rateLimitBlocks = results.filter(r => r.status === 429).length;
    
    return {
        rateLimit,
        completedRequests: completed,
        successfulRequests: successful,
        successRate: successRate.toFixed(2),
        rps: rps.toFixed(2),
        avgMetrics,
        rateLimitBlocks,
        isAcceptable: successRate >= 95 && parseFloat(avgMetrics.cpuPercent) < 80 && rateLimitBlocks === 0
    };
}

async function binarySearchOptimalLimit(min, max) {
    let low = min;
    let high = max;
    let bestLimit = min;
    let bestResult = null;
    
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        console.log(`\n[${new Date().toISOString()}] Testing rate limit: ${mid}`);
        
        await updateRateLimit(mid);
        await new Promise(r => setTimeout(r, 1500));
        
        const result = await runLoadTest(mid, CONCURRENCY_LEVEL, TEST_DURATION_SECONDS);
        
        console.log(`    Success: ${result.successRate}% | RPS: ${result.rps} | CPU: ${result.avgMetrics.cpuPercent}%`);
        console.log(`    Rate limit blocks: ${result.rateLimitBlocks}`);
        
        if (result.isAcceptable) {
            bestLimit = mid;
            bestResult = result;
            low = mid + 50;
        } else {
            high = mid - 50;
        }
        
        await new Promise(r => setTimeout(r, 2000));
    }
    
    return { bestLimit, bestResult };
}

async function main() {
    console.log('\n' + '='.repeat(120));
    console.log('AIClient-2-API AUTO RATE LIMIT OPTIMIZATION (BINARY SEARCH)');
    console.log('='.repeat(120));
    console.log(`Test Server: ${TEST_SERVER_BASE_URL}`);
    console.log(`Test Duration per Limit: ${TEST_DURATION_SECONDS} seconds`);
    console.log(`Concurrency Level: ${CONCURRENCY_LEVEL}`);
    console.log(`Rate Limit Range: ${MIN_RATE_LIMIT} - ${MAX_RATE_LIMIT}`);
    console.log('='.repeat(120));
    
    const { bestLimit, bestResult } = await binarySearchOptimalLimit(MIN_RATE_LIMIT, MAX_RATE_LIMIT);
    
    console.log('\n' + '='.repeat(120));
    console.log('OPTIMIZATION COMPLETE');
    console.log('='.repeat(120));
    
    if (bestResult) {
        console.log(`\nOptimal Rate Limit Found: ${bestLimit} requests/minute`);
        console.log(`  Success Rate: ${bestResult.successRate}%`);
        console.log(`  RPS: ${bestResult.rps}`);
        console.log(`  CPU Usage: ${bestResult.avgMetrics.cpuPercent}%`);
        console.log(`  Rate Limit Blocks: ${bestResult.rateLimitBlocks}`);
        
        await updateRateLimit(bestLimit);
        console.log(`\n✅ System rate limit has been set to ${bestLimit}`);
    } else {
        console.log('\nNo optimal rate limit found within the tested range');
    }
    
    const fs = require('fs');
    fs.mkdirSync('tests/reports', { recursive: true });
    const report = {
        testDate: new Date().toISOString(),
        server: TEST_SERVER_BASE_URL,
        optimalRateLimit: bestLimit,
        bestResult
    };
    fs.writeFileSync(`tests/reports/binary-rate-limit-report-${Date.now()}.json`, JSON.stringify(report, null, 2));
    
    console.log('\n' + '='.repeat(120));
}

main().catch(console.error);