import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const http = require('http');
const os = require('os');

const TEST_SERVER_BASE_URL = 'http://localhost:30000';
const TEST_API_KEY = 'sk-2e3513944ecac08f466a2e01872ba91d';
const TEST_DURATION_SECONDS = 60;
const CONCURRENCY_LEVELS = [5, 10, 20, 50];

const TEST_REQUEST_BODY = JSON.stringify({
    model: "gemma-4-31b",
    messages: [
        { role: "user", content: "Hello, what is 2+2?" }
    ],
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
                resolve({
                    status: res.statusCode,
                    duration,
                    success,
                    error: !success ? data : null,
                    clientId
                });
            });
        });
        
        req.on('error', (err) => {
            const duration = Date.now() - start;
            resolve({
                status: 0,
                duration,
                success: false,
                error: err.message,
                clientId
            });
        });
        
        req.on('timeout', () => {
            const duration = Date.now() - start;
            req.destroy();
            resolve({
                status: 408,
                duration,
                success: false,
                error: 'Request timeout',
                clientId
            });
        });
        
        req.write(TEST_REQUEST_BODY);
        req.end();
    });
}

async function runLoadTest(concurrency, durationSeconds) {
    console.log(`  Starting load test with ${concurrency} concurrent clients...`);
    
    const results = [];
    const errors = [];
    let completed = 0;
    let startTime = Date.now();
    let stopTime = startTime + (durationSeconds * 1000);
    
    const metricsHistory = [];
    const metricsInterval = setInterval(() => {
        metricsHistory.push(getSystemMetrics());
    }, 1000);
    
    const runClient = async (clientId) => {
        while (Date.now() < stopTime) {
            const result = await makeRequest(clientId);
            results.push(result);
            if (!result.success) {
                errors.push(result);
            }
            completed++;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    };
    
    const clients = Array(concurrency).fill(null).map((_, i) => runClient(i));
    await Promise.all(clients);
    
    clearInterval(metricsInterval);
    
    const elapsed = (Date.now() - startTime) / 1000;
    const rps = completed / elapsed;
    
    const successfulRequests = results.filter(r => r.success).length;
    const successRate = ((successfulRequests / results.length) * 100).toFixed(2);
    
    const durations = results.filter(r => r.success).map(r => r.duration);
    const avgLatency = durations.length > 0 
        ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)
        : '0';
    const p95Latency = durations.length > 0 
        ? [...durations].sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] 
        : 0;
    const p99Latency = durations.length > 0 
        ? [...durations].sort((a, b) => a - b)[Math.floor(durations.length * 0.99)] 
        : 0;
    
    const avgMetrics = metricsHistory.length > 0 ? {
        cpuPercent: (metricsHistory.reduce((a, m) => a + parseFloat(m.cpuPercent), 0) / metricsHistory.length).toFixed(2),
        rss: (metricsHistory.reduce((a, m) => a + parseFloat(m.rss), 0) / metricsHistory.length).toFixed(2),
        heapUsed: (metricsHistory.reduce((a, m) => a + parseFloat(m.heapUsed), 0) / metricsHistory.length).toFixed(2),
        maxCpu: Math.max(...metricsHistory.map(m => parseFloat(m.cpuPercent))).toFixed(2),
        maxRss: Math.max(...metricsHistory.map(m => parseFloat(m.rss))).toFixed(2)
    } : { cpuPercent: '0', rss: '0', heapUsed: '0', maxCpu: '0', maxRss: '0' };
    
    const errorSummary = errors.reduce((acc, err) => {
        const key = err.status === 429 ? 'RATE_LIMIT' : 
                    err.status === 408 ? 'TIMEOUT' : 
                    err.status === 503 ? 'SERVICE_UNAVAILABLE' : 
                    err.status === 500 ? 'INTERNAL_ERROR' :
                    err.status || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    
    return {
        concurrency,
        durationSeconds,
        completedRequests: completed,
        successfulRequests,
        failedRequests: errors.length,
        successRate,
        rps: rps.toFixed(2),
        avgLatency,
        p95Latency: p95Latency.toFixed(2),
        p99Latency: p99Latency.toFixed(2),
        avgMetrics,
        errorSummary
    };
}

function printResults(results) {
    console.log('\n' + '='.repeat(150));
    console.log('END-TO-END PERFORMANCE STRESS TEST RESULTS SUMMARY');
    console.log('='.repeat(150));
    
    const headers = [
        'Concurrency', 'Duration(s)', 'Completed', 'Success', 'Failed', 'Success Rate',
        'RPS', 'Avg Latency(ms)', 'P95 Latency(ms)', 'P99 Latency(ms)',
        'Avg CPU(%)', 'Max CPU(%)', 'Avg RSS(MB)', 'Max RSS(MB)', 'Errors'
    ];
    
    console.log('\n' + headers.map(h => h.padEnd(12)).join(' '));
    console.log('-'.repeat(150));
    
    results.forEach(result => {
        const errorStr = Object.entries(result.errorSummary)
            .map(([code, count]) => `${code}:${count}`)
            .join(',');
        
        console.log([
            result.concurrency.toString().padEnd(12),
            result.durationSeconds.toString().padEnd(12),
            result.completedRequests.toString().padEnd(12),
            result.successfulRequests.toString().padEnd(12),
            result.failedRequests.toString().padEnd(12),
            `${result.successRate}%`.padEnd(12),
            result.rps.padEnd(12),
            `${result.avgLatency}ms`.padEnd(12),
            `${result.p95Latency}ms`.padEnd(12),
            `${result.p99Latency}ms`.padEnd(12),
            `${result.avgMetrics.cpuPercent}%`.padEnd(12),
            `${result.avgMetrics.maxCpu}%`.padEnd(12),
            `${result.avgMetrics.rss}MB`.padEnd(12),
            `${result.avgMetrics.maxRss}MB`.padEnd(12),
            errorStr.padEnd(12)
        ].join(' '));
    });
    
    console.log('\n' + '='.repeat(150));
}

function analyzeOptimalConcurrency(results) {
    console.log('\nOPTIMAL CONCURRENCY ANALYSIS');
    console.log('='.repeat(150));
    
    console.log('\nSelection Criteria:');
    console.log('  - Success Rate >= 95%');
    console.log('  - CPU Usage < 80%');
    console.log('  - Maximize RPS while maintaining stability\n');
    
    const candidates = results.filter(r => {
        const successRate = parseFloat(r.successRate);
        const cpuUsage = parseFloat(r.avgMetrics.cpuPercent);
        const maxCpu = parseFloat(r.avgMetrics.maxCpu);
        return successRate >= 95 && cpuUsage < 80 && maxCpu < 90;
    });
    
    if (candidates.length === 0) {
        console.log('No optimal concurrency found within acceptable thresholds');
        
        const relaxedCandidates = results.filter(r => {
            const successRate = parseFloat(r.successRate);
            const cpuUsage = parseFloat(r.avgMetrics.cpuPercent);
            return successRate >= 90 && cpuUsage < 90;
        });
        
        if (relaxedCandidates.length === 0) {
            console.log('  No candidates found even with relaxed criteria');
            return null;
        }
        
        relaxedCandidates.sort((a, b) => parseFloat(b.rps) - parseFloat(a.rps));
        const optimal = relaxedCandidates[0];
        
        console.log(`\n  Best candidate with relaxed criteria:`);
        console.log(`    Concurrency: ${optimal.concurrency}`);
        console.log(`    RPS: ${optimal.rps}`);
        console.log(`    Success Rate: ${optimal.successRate}%`);
        console.log(`    Avg Latency: ${optimal.avgLatency}ms`);
        console.log(`    Avg CPU: ${optimal.avgMetrics.cpuPercent}%`);
        
        return optimal;
    }
    
    candidates.sort((a, b) => parseFloat(b.rps) - parseFloat(a.rps));
    const optimal = candidates[0];
    
    console.log('Optimal Concurrency Configuration Found:');
    console.log(`  Concurrency Level: ${optimal.concurrency} simultaneous requests`);
    console.log(`  Expected RPS: ${optimal.rps}`);
    console.log(`  Success Rate: ${optimal.successRate}%`);
    console.log(`  Avg Latency: ${optimal.avgLatency}ms`);
    console.log(`  P95 Latency: ${optimal.p95Latency}ms`);
    console.log(`  P99 Latency: ${optimal.p99Latency}ms`);
    console.log(`  Avg CPU Usage: ${optimal.avgMetrics.cpuPercent}%`);
    console.log(`  Max CPU Usage: ${optimal.avgMetrics.maxCpu}%`);
    console.log(`  Avg Memory Usage: ${optimal.avgMetrics.rss}MB`);
    
    console.log('\nRecommendation:');
    console.log(`  Set system to handle ${optimal.concurrency} concurrent requests.`);
    console.log(`  This provides optimal throughput while maintaining stability.`);
    
    return optimal;
}

function generateReport(results) {
    const fs = require('fs');
    const report = {
        testDate: new Date().toISOString(),
        testServer: TEST_SERVER_BASE_URL,
        testDurationPerLevel: TEST_DURATION_SECONDS,
        results: results,
        optimalConcurrency: analyzeOptimalConcurrency(results)?.concurrency || null
    };
    
    fs.mkdirSync('tests/reports', { recursive: true });
    const reportPath = `tests/reports/e2e-stress-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\nReport saved to: ${reportPath}`);
    
    return report;
}

async function main() {
    console.log('\n' + '='.repeat(150));
    console.log('AIClient-2-API END-TO-END PERFORMANCE STRESS TEST');
    console.log('='.repeat(150));
    console.log(`Test Server: ${TEST_SERVER_BASE_URL}`);
    console.log(`Test Duration per Concurrency Level: ${TEST_DURATION_SECONDS} seconds`);
    console.log(`Concurrency Levels: ${CONCURRENCY_LEVELS.join(', ')}`);
    console.log('='.repeat(150));
    
    console.log('\n[Initial Health Check]');
    const healthCheck = await makeRequest(0);
    if (healthCheck.success) {
        console.log(`  ✅ Server is healthy (response time: ${healthCheck.duration}ms)`);
    } else {
        console.log(`  ❌ Server health check failed: ${healthCheck.error}`);
        process.exit(1);
    }
    
    const allResults = [];
    
    for (const concurrency of CONCURRENCY_LEVELS) {
        console.log(`\n[${new Date().toISOString()}] Testing concurrency level: ${concurrency}`);
        
        const result = await runLoadTest(concurrency, TEST_DURATION_SECONDS);
        allResults.push(result);
        
        console.log(`  Results:`);
        console.log(`    Completed: ${result.completedRequests} requests`);
        console.log(`    Success Rate: ${result.successRate}%`);
        console.log(`    RPS: ${result.rps}`);
        console.log(`    Avg Latency: ${result.avgLatency}ms`);
        console.log(`    Avg CPU: ${result.avgMetrics.cpuPercent}%`);
        console.log(`    Max CPU: ${result.avgMetrics.maxCpu}%`);
        
        if (result.failedRequests > 0) {
            console.log(`    Errors: ${JSON.stringify(result.errorSummary)}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    printResults(allResults);
    generateReport(allResults);
    
    console.log('\n' + '='.repeat(150));
    console.log('TEST COMPLETED');
    console.log('='.repeat(150));
}

main().catch(console.error);