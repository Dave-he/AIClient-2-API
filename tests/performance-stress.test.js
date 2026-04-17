import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const http = require('http');
const os = require('os');

const TEST_SERVER_BASE_URL = 'http://localhost:3000';
const TEST_API_KEY = '123456';
const TEST_DURATION_SECONDS = 30;
const CONCURRENCY_LEVELS = [10, 50, 100, 200, 500];
const RATE_LIMIT_VALUES = [100, 200, 500, 1000, 2000];

const TEST_REQUEST_BODY = JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
        { role: "user", content: "Hello, what is 2+2?" }
    ],
    stream: false
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
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
        external: (memUsage.external / 1024 / 1024).toFixed(2)
    };
}

async function makeRequest() {
    return new Promise((resolve) => {
        const url = new URL(`${TEST_SERVER_BASE_URL}/v1/chat/completions`);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_API_KEY}`
            },
            timeout: 30000
        };
        
        const start = Date.now();
        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const duration = Date.now() - start;
                resolve({
                    status: res.statusCode,
                    duration,
                    success: res.statusCode >= 200 && res.statusCode < 400,
                    error: res.statusCode >= 400 ? data : null
                });
            });
        });
        
        req.on('error', (err) => {
            const duration = Date.now() - start;
            resolve({
                status: 0,
                duration,
                success: false,
                error: err.message
            });
        });
        
        req.on('timeout', () => {
            const duration = Date.now() - start;
            req.destroy();
            resolve({
                status: 408,
                duration,
                success: false,
                error: 'Request timeout'
            });
        });
        
        req.write(TEST_REQUEST_BODY);
        req.end();
    });
}

async function runLoadTest(concurrency, durationSeconds) {
    const results = [];
    const errors = [];
    let completed = 0;
    let running = 0;
    let startTime = Date.now();
    let stopTime = startTime + (durationSeconds * 1000);
    
    const metricsHistory = [];
    const metricsInterval = setInterval(() => {
        metricsHistory.push(getSystemMetrics());
    }, 1000);
    
    const runTask = async () => {
        running++;
        while (Date.now() < stopTime) {
            const result = await makeRequest();
            results.push(result);
            if (!result.success) {
                errors.push(result);
            }
            completed++;
        }
        running--;
    };
    
    const tasks = Array(concurrency).fill(null).map(() => runTask());
    await Promise.all(tasks);
    
    clearInterval(metricsInterval);
    
    const elapsed = (Date.now() - startTime) / 1000;
    const rps = completed / elapsed;
    
    const successfulRequests = results.filter(r => r.success).length;
    const successRate = (successfulRequests / results.length) * 100;
    
    const durations = results.filter(r => r.success).map(r => r.duration);
    const avgLatency = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0;
    const p95Latency = durations.length > 0 
        ? [...durations].sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] 
        : 0;
    const p99Latency = durations.length > 0 
        ? [...durations].sort((a, b) => a - b)[Math.floor(durations.length * 0.99)] 
        : 0;
    
    const avgMetrics = metricsHistory.length > 0 ? {
        cpuPercent: (metricsHistory.reduce((a, m) => a + parseFloat(m.cpuPercent), 0) / metricsHistory.length).toFixed(2),
        rss: (metricsHistory.reduce((a, m) => a + parseFloat(m.rss), 0) / metricsHistory.length).toFixed(2),
        heapUsed: (metricsHistory.reduce((a, m) => a + parseFloat(m.heapUsed), 0) / metricsHistory.length).toFixed(2)
    } : { cpuPercent: '0', rss: '0', heapUsed: '0' };
    
    const errorSummary = errors.reduce((acc, err) => {
        const key = err.status || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    
    return {
        concurrency,
        durationSeconds,
        completedRequests: completed,
        successfulRequests,
        failedRequests: errors.length,
        successRate: successRate.toFixed(2),
        rps: rps.toFixed(2),
        avgLatency: avgLatency.toFixed(2),
        p95Latency: p95Latency.toFixed(2),
        p99Latency: p99Latency.toFixed(2),
        avgMetrics,
        errorSummary
    };
}

function printResults(results) {
    console.log('\n' + '='.repeat(120));
    console.log('PERFORMANCE STRESS TEST RESULTS SUMMARY');
    console.log('='.repeat(120));
    
    const headers = [
        'Concurrency', 'Duration(s)', 'Completed', 'Success', 'Failed', 'Success Rate',
        'RPS', 'Avg Latency(ms)', 'P95 Latency(ms)', 'P99 Latency(ms)',
        'Avg CPU(%)', 'Avg RSS(MB)', 'Avg Heap(MB)', 'Errors'
    ];
    
    console.log('\n' + headers.map(h => h.padEnd(14)).join(' '));
    console.log('-'.repeat(120));
    
    results.forEach(result => {
        const errorStr = Object.entries(result.errorSummary)
            .map(([code, count]) => `${code}:${count}`)
            .join(',');
        
        console.log([
            result.concurrency.toString().padEnd(14),
            result.durationSeconds.toString().padEnd(14),
            result.completedRequests.toString().padEnd(14),
            result.successfulRequests.toString().padEnd(14),
            result.failedRequests.toString().padEnd(14),
            `${result.successRate}%`.padEnd(14),
            result.rps.padEnd(14),
            `${result.avgLatency}ms`.padEnd(14),
            `${result.p95Latency}ms`.padEnd(14),
            `${result.p99Latency}ms`.padEnd(14),
            `${result.avgMetrics.cpuPercent}%`.padEnd(14),
            `${result.avgMetrics.rss}MB`.padEnd(14),
            `${result.avgMetrics.heapUsed}MB`.padEnd(14),
            errorStr.padEnd(14)
        ].join(' '));
    });
    
    console.log('\n' + '='.repeat(120));
}

function analyzeOptimalLimit(results) {
    console.log('\nOPTIMAL LIMIT ANALYSIS');
    console.log('='.repeat(120));
    
    const candidates = results.filter(r => {
        const successRate = parseFloat(r.successRate);
        const cpuUsage = parseFloat(r.avgMetrics.cpuPercent);
        return successRate >= 95 && cpuUsage < 80;
    });
    
    if (candidates.length === 0) {
        console.log('No optimal limit found within acceptable thresholds');
        return null;
    }
    
    candidates.sort((a, b) => {
        const rpsDiff = parseFloat(b.rps) - parseFloat(a.rps);
        if (rpsDiff !== 0) return rpsDiff;
        return parseFloat(a.avgLatency) - parseFloat(b.avgLatency);
    });
    
    const optimal = candidates[0];
    
    console.log('\nOptimal Configuration Found:');
    console.log(`  Concurrency Level: ${optimal.concurrency}`);
    console.log(`  RPS: ${optimal.rps}`);
    console.log(`  Success Rate: ${optimal.successRate}%`);
    console.log(`  Avg Latency: ${optimal.avgLatency}ms`);
    console.log(`  P95 Latency: ${optimal.p95Latency}ms`);
    console.log(`  P99 Latency: ${optimal.p99Latency}ms`);
    console.log(`  Avg CPU Usage: ${optimal.avgMetrics.cpuPercent}%`);
    console.log(`  Avg Memory Usage: ${optimal.avgMetrics.rss}MB`);
    
    return optimal;
}

async function main() {
    console.log('\n' + '='.repeat(120));
    console.log('AIClient-2-API END-TO-END PERFORMANCE STRESS TEST');
    console.log('='.repeat(120));
    console.log(`Test Server: ${TEST_SERVER_BASE_URL}`);
    console.log(`Test Duration per Level: ${TEST_DURATION_SECONDS} seconds`);
    console.log(`Concurrency Levels: ${CONCURRENCY_LEVELS.join(', ')}`);
    console.log('='.repeat(120));
    
    const allResults = [];
    
    for (const concurrency of CONCURRENCY_LEVELS) {
        console.log(`\n[${new Date().toISOString()}] Testing concurrency level: ${concurrency}`);
        
        const result = await runLoadTest(concurrency, TEST_DURATION_SECONDS);
        allResults.push(result);
        
        console.log(`  Completed: ${result.completedRequests} requests`);
        console.log(`  Success Rate: ${result.successRate}%`);
        console.log(`  RPS: ${result.rps}`);
        console.log(`  Avg Latency: ${result.avgLatency}ms`);
        console.log(`  Avg CPU: ${result.avgMetrics.cpuPercent}%`);
        console.log(`  Avg Memory: ${result.avgMetrics.rss}MB`);
        
        if (result.failedRequests > 0) {
            console.log(`  Errors: ${JSON.stringify(result.errorSummary)}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    printResults(allResults);
    analyzeOptimalLimit(allResults);
    
    console.log('\n' + '='.repeat(120));
    console.log('TEST COMPLETED');
    console.log('='.repeat(120));
}

main().catch(console.error);