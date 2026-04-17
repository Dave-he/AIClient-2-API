import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const http = require('http');
const os = require('os');

const TEST_SERVER_BASE_URL = 'http://localhost:30000';
const TEST_API_KEY = 'sk-2e3513944ecac08f466a2e01872ba91d';
const TEST_DURATION_SECONDS = 30;

const INITIAL_RATE_LIMIT = 50;
const MAX_RATE_LIMIT = 2000;
const RATE_LIMIT_STEP = 50;
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
        rss: (memUsage.rss / 1024 / 1024).toFixed(2),
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2)
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
                resolve({ status: res.statusCode, duration, success, error: !success ? data : null });
            });
        });
        
        req.on('error', (err) => {
            resolve({ status: 0, duration: Date.now() - start, success: false, error: err.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ status: 408, duration: Date.now() - start, success: false, error: 'Timeout' });
        });
        
        req.write(TEST_REQUEST_BODY);
        req.end();
    });
}

async function runLoadTest(rateLimit, concurrency, durationSeconds) {
    console.log(`    Running load test with rate limit ${rateLimit}...`);
    
    const results = [];
    let completed = 0;
    let startTime = Date.now();
    let stopTime = startTime + (durationSeconds * 1000);
    
    const metricsHistory = [];
    const metricsInterval = setInterval(() => metricsHistory.push(getSystemMetrics()), 1000);
    
    const runClient = async (clientId) => {
        while (Date.now() < stopTime) {
            const result = await makeRequest(clientId);
            results.push(result);
            completed++;
            await new Promise(r => setTimeout(r, 50));
        }
    };
    
    const clients = Array(concurrency).fill(null).map((_, i) => runClient(i));
    await Promise.all(clients);
    clearInterval(metricsInterval);
    
    const elapsed = (Date.now() - startTime) / 1000;
    const successful = results.filter(r => r.success).length;
    const successRate = ((successful / results.length) * 100).toFixed(2);
    const rps = (completed / elapsed).toFixed(2);
    
    const durations = results.filter(r => r.success).map(r => r.duration);
    const avgLatency = durations.length ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) : '0';
    const p95Latency = durations.length ? [...durations].sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] : 0;
    
    const avgMetrics = metricsHistory.length ? {
        cpuPercent: (metricsHistory.reduce((a, m) => a + parseFloat(m.cpuPercent), 0) / metricsHistory.length).toFixed(2),
        maxCpu: Math.max(...metricsHistory.map(m => parseFloat(m.cpuPercent))).toFixed(2),
        rss: (metricsHistory.reduce((a, m) => a + parseFloat(m.rss), 0) / metricsHistory.length).toFixed(2)
    } : { cpuPercent: '0', maxCpu: '0', rss: '0' };
    
    const errorSummary = results.filter(r => !r.success).reduce((acc, err) => {
        const key = err.status === 429 ? 'RATE_LIMIT' : err.status === 408 ? 'TIMEOUT' : 
                    err.status === 500 ? 'INTERNAL_ERROR' : err.status || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    
    return {
        rateLimit,
        concurrency,
        durationSeconds,
        completedRequests: completed,
        successfulRequests: successful,
        successRate,
        rps,
        avgLatency,
        p95Latency: p95Latency.toFixed(2),
        avgMetrics,
        errorSummary
    };
}

async function main() {
    console.log('\n' + '='.repeat(120));
    console.log('AIClient-2-API AUTO RATE LIMIT OPTIMIZATION TEST');
    console.log('='.repeat(120));
    console.log(`Test Server: ${TEST_SERVER_BASE_URL}`);
    console.log(`Test Duration per Limit: ${TEST_DURATION_SECONDS} seconds`);
    console.log(`Concurrency Level: ${CONCURRENCY_LEVEL}`);
    console.log(`Rate Limit Range: ${INITIAL_RATE_LIMIT} - ${MAX_RATE_LIMIT} (step: ${RATE_LIMIT_STEP})`);
    console.log('='.repeat(120));
    
    const results = [];
    let currentLimit = INITIAL_RATE_LIMIT;
    let previousSuccessRate = 100;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    const MIN_SUCCESS_RATE = 90;
    
    while (currentLimit <= MAX_RATE_LIMIT && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
        console.log(`\n[${new Date().toISOString()}] Testing rate limit: ${currentLimit}`);
        
        await updateRateLimit(currentLimit);
        await new Promise(r => setTimeout(r, 2000));
        
        const result = await runLoadTest(currentLimit, CONCURRENCY_LEVEL, TEST_DURATION_SECONDS);
        results.push(result);
        
        console.log(`    Results:`);
        console.log(`      Completed: ${result.completedRequests} | Success: ${result.successRate}% | RPS: ${result.rps}`);
        console.log(`      Avg Latency: ${result.avgLatency}ms | P95: ${result.p95Latency}ms`);
        console.log(`      CPU: ${result.avgMetrics.cpuPercent}% (max: ${result.avgMetrics.maxCpu}%)`);
        
        if (Object.keys(result.errorSummary).length > 0) {
            console.log(`      Errors: ${JSON.stringify(result.errorSummary)}`);
        }
        
        const currentSuccessRate = parseFloat(result.successRate);
        
        if (currentSuccessRate < MIN_SUCCESS_RATE || 
            (previousSuccessRate - currentSuccessRate > 10 && currentSuccessRate < 95)) {
            consecutiveFailures++;
            console.log(`    ⚠️  Performance degradation detected`);
        } else {
            consecutiveFailures = 0;
        }
        
        previousSuccessRate = currentSuccessRate;
        currentLimit += RATE_LIMIT_STEP;
        
        await new Promise(r => setTimeout(r, 3000));
    }
    
    console.log('\n' + '='.repeat(120));
    console.log('TEST COMPLETE - ANALYZING RESULTS');
    console.log('='.repeat(120));
    
    const candidates = results.filter(r => {
        const successRate = parseFloat(r.successRate);
        const cpu = parseFloat(r.avgMetrics.cpuPercent);
        const maxCpu = parseFloat(r.avgMetrics.maxCpu);
        return successRate >= 95 && cpu < 80 && maxCpu < 90;
    });
    
    if (candidates.length === 0) {
        console.log('No optimal rate limit found within strict criteria');
        const relaxed = results.filter(r => parseFloat(r.successRate) >= 90);
        if (relaxed.length > 0) {
            candidates.push(...relaxed);
        }
    }
    
    candidates.sort((a, b) => parseFloat(b.rps) - parseFloat(a.rps));
    const optimal = candidates[0];
    
    if (optimal) {
        console.log(`\nOptimal Rate Limit Found: ${optimal.rateLimit} requests/minute`);
        console.log(`  Expected RPS: ${optimal.rps}`);
        console.log(`  Success Rate: ${optimal.successRate}%`);
        console.log(`  Avg Latency: ${optimal.avgLatency}ms`);
        console.log(`  CPU Usage: ${optimal.avgMetrics.cpuPercent}%`);
        
        await updateRateLimit(optimal.rateLimit);
        console.log(`\n✅ Rate limit has been set to ${optimal.rateLimit}`);
    } else {
        console.log('No optimal rate limit found');
    }
    
    const fs = require('fs');
    fs.mkdirSync('tests/reports', { recursive: true });
    const report = {
        testDate: new Date().toISOString(),
        server: TEST_SERVER_BASE_URL,
        optimalRateLimit: optimal?.rateLimit || null,
        results: results
    };
    fs.writeFileSync(`tests/reports/auto-rate-limit-report-${Date.now()}.json`, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to tests/reports/auto-rate-limit-report-${Date.now()}.json`);
    
    console.log('\n' + '='.repeat(120));
}

main().catch(console.error);