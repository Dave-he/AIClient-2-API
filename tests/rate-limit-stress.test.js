import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const http = require('http');
const os = require('os');

const TEST_SERVER_BASE_URL = 'http://localhost:3000';
const TEST_API_KEY = '123456';
const TEST_DURATION_SECONDS = 60;
const RATE_LIMIT_VALUES = [50, 100, 200, 500, 1000, 2000];
const CONCURRENT_CLIENTS = 100;

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
                    error: res.statusCode >= 400 ? data : null,
                    rateLimitRemaining: res.headers['x-ratelimit-remaining'],
                    rateLimitLimit: res.headers['x-ratelimit-limit']
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
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    success: res.statusCode >= 200 && res.statusCode < 400
                });
            });
        });
        
        req.on('error', () => {
            resolve({ status: 0, success: false });
        });
        
        req.write(JSON.stringify({ RATE_LIMIT: limitValue }));
        req.end();
    });
}

async function runLoadTest(rateLimitValue, durationSeconds) {
    console.log(`  Setting rate limit to: ${rateLimitValue}`);
    const configResult = await updateRateLimit(rateLimitValue);
    if (!configResult.success) {
        console.log(`  Warning: Failed to update rate limit, continuing with current setting`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const results = [];
    const errors = [];
    const rateLimitHeaders = [];
    let completed = 0;
    let startTime = Date.now();
    let stopTime = startTime + (durationSeconds * 1000);
    
    const metricsHistory = [];
    const metricsInterval = setInterval(() => {
        metricsHistory.push(getSystemMetrics());
    }, 1000);
    
    const runClient = async () => {
        while (Date.now() < stopTime) {
            const result = await makeRequest();
            results.push(result);
            if (result.rateLimitRemaining !== undefined) {
                rateLimitHeaders.push({
                    remaining: parseInt(result.rateLimitRemaining),
                    limit: parseInt(result.rateLimitLimit)
                });
            }
            if (!result.success) {
                errors.push(result);
            }
            completed++;
            await new Promise(resolve => setTimeout(resolve, 1));
        }
    };
    
    const clients = Array(CONCURRENT_CLIENTS).fill(null).map(() => runClient());
    await Promise.all(clients);
    
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
        heapUsed: (metricsHistory.reduce((a, m) => a + parseFloat(m.heapUsed), 0) / metricsHistory.length).toFixed(2),
        maxCpu: Math.max(...metricsHistory.map(m => parseFloat(m.cpuPercent))).toFixed(2),
        maxRss: Math.max(...metricsHistory.map(m => parseFloat(m.rss))).toFixed(2)
    } : { cpuPercent: '0', rss: '0', heapUsed: '0', maxCpu: '0', maxRss: '0' };
    
    const errorSummary = errors.reduce((acc, err) => {
        const key = err.status === 429 ? 'RATE_LIMIT' : 
                    err.status === 408 ? 'TIMEOUT' : 
                    err.status === 503 ? 'SERVICE_UNAVAILABLE' : 
                    err.status || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    
    const rateLimitRejections = (errorSummary['RATE_LIMIT'] || 0);
    const timeoutErrors = (errorSummary['TIMEOUT'] || 0);
    const serviceErrors = (errorSummary['SERVICE_UNAVAILABLE'] || 0);
    
    return {
        rateLimitValue,
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
        errorSummary,
        rateLimitRejections,
        timeoutErrors,
        serviceErrors
    };
}

function printResults(results) {
    console.log('\n' + '='.repeat(150));
    console.log('RATE LIMIT PERFORMANCE STRESS TEST RESULTS SUMMARY');
    console.log('='.repeat(150));
    
    const headers = [
        'Rate Limit', 'Duration(s)', 'Completed', 'Success', 'Failed', 'Success Rate',
        'RPS', 'Avg Latency(ms)', 'P95 Latency(ms)', 'P99 Latency(ms)',
        'Avg CPU(%)', 'Max CPU(%)', 'Avg RSS(MB)', 'Max RSS(MB)', 
        'RL Rejects', 'Timeouts', '503 Errors'
    ];
    
    console.log('\n' + headers.map(h => h.padEnd(12)).join(' '));
    console.log('-'.repeat(150));
    
    results.forEach(result => {
        console.log([
            result.rateLimitValue.toString().padEnd(12),
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
            result.rateLimitRejections.toString().padEnd(12),
            result.timeoutErrors.toString().padEnd(12),
            result.serviceErrors.toString().padEnd(12)
        ].join(' '));
    });
    
    console.log('\n' + '='.repeat(150));
}

function analyzeOptimalLimit(results) {
    console.log('\nOPTIMAL RATE LIMIT ANALYSIS');
    console.log('='.repeat(150));
    
    console.log('\nSelection Criteria:');
    console.log('  - Success Rate >= 99%');
    console.log('  - CPU Usage < 80%');
    console.log('  - No rate limit rejections (RATE_LIMIT errors = 0)');
    console.log('  - Timeout errors < 1% of total requests');
    console.log('  - Maximize RPS while maintaining stability\n');
    
    const candidates = results.filter(r => {
        const successRate = parseFloat(r.successRate);
        const cpuUsage = parseFloat(r.avgMetrics.cpuPercent);
        const maxCpu = parseFloat(r.avgMetrics.maxCpu);
        const timeoutRate = r.completedRequests > 0 ? (r.timeoutErrors / r.completedRequests) * 100 : 0;
        
        return successRate >= 99 && 
               cpuUsage < 80 && 
               maxCpu < 90 &&
               r.rateLimitRejections === 0 && 
               timeoutRate < 1;
    });
    
    if (candidates.length === 0) {
        console.log('No optimal rate limit found within acceptable thresholds');
        console.log('\nRelaxed Criteria Candidates (Success Rate >= 95%, CPU < 90%):');
        
        const relaxedCandidates = results.filter(r => {
            const successRate = parseFloat(r.successRate);
            const cpuUsage = parseFloat(r.avgMetrics.cpuPercent);
            return successRate >= 95 && cpuUsage < 90;
        });
        
        if (relaxedCandidates.length === 0) {
            console.log('  No candidates found even with relaxed criteria');
            return null;
        }
        
        relaxedCandidates.sort((a, b) => {
            const rpsDiff = parseFloat(b.rps) - parseFloat(a.rps);
            if (rpsDiff !== 0) return rpsDiff;
            return parseFloat(a.avgLatency) - parseFloat(b.avgLatency);
        });
        
        const optimal = relaxedCandidates[0];
        
        console.log(`\n  Best candidate with relaxed criteria:`);
        console.log(`    Rate Limit: ${optimal.rateLimitValue}`);
        console.log(`    RPS: ${optimal.rps}`);
        console.log(`    Success Rate: ${optimal.successRate}%`);
        console.log(`    Avg Latency: ${optimal.avgLatency}ms`);
        console.log(`    Avg CPU: ${optimal.avgMetrics.cpuPercent}%`);
        console.log(`    Rate Limit Rejections: ${optimal.rateLimitRejections}`);
        console.log(`    Timeout Errors: ${optimal.timeoutErrors}`);
        
        return optimal;
    }
    
    candidates.sort((a, b) => {
        const rpsDiff = parseFloat(b.rps) - parseFloat(a.rps);
        if (rpsDiff !== 0) return rpsDiff;
        return parseFloat(a.avgLatency) - parseFloat(b.avgLatency);
    });
    
    const optimal = candidates[0];
    
    console.log('Optimal Rate Limit Configuration Found:');
    console.log(`  Rate Limit: ${optimal.rateLimitValue} requests/minute`);
    console.log(`  Expected RPS: ${optimal.rps}`);
    console.log(`  Success Rate: ${optimal.successRate}%`);
    console.log(`  Avg Latency: ${optimal.avgLatency}ms`);
    console.log(`  P95 Latency: ${optimal.p95Latency}ms`);
    console.log(`  P99 Latency: ${optimal.p99Latency}ms`);
    console.log(`  Avg CPU Usage: ${optimal.avgMetrics.cpuPercent}%`);
    console.log(`  Max CPU Usage: ${optimal.avgMetrics.maxCpu}%`);
    console.log(`  Avg Memory Usage: ${optimal.avgMetrics.rss}MB`);
    console.log(`  Rate Limit Rejections: ${optimal.rateLimitRejections}`);
    console.log(`  Timeout Errors: ${optimal.timeoutErrors}`);
    
    console.log('\nRecommendation:');
    console.log(`  Set RATE_LIMIT to ${optimal.rateLimitValue} in production configuration.`);
    console.log(`  This provides optimal throughput while maintaining stability.`);
    
    return optimal;
}

function generateReport(results) {
    const report = {
        testDate: new Date().toISOString(),
        testDurationPerLimit: TEST_DURATION_SECONDS,
        concurrentClients: CONCURRENT_CLIENTS,
        testServer: TEST_SERVER_BASE_URL,
        results: results,
        optimalLimit: analyzeOptimalLimit(results)?.rateLimitValue || null
    };
    
    const fs = require('fs');
    const reportPath = `tests/reports/rate-limit-stress-report-${Date.now()}.json`;
    fs.mkdirSync('tests/reports', { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\nReport saved to: ${reportPath}`);
    
    return report;
}

async function main() {
    console.log('\n' + '='.repeat(150));
    console.log('AIClient-2-API RATE LIMIT PERFORMANCE STRESS TEST');
    console.log('='.repeat(150));
    console.log(`Test Server: ${TEST_SERVER_BASE_URL}`);
    console.log(`Test Duration per Limit: ${TEST_DURATION_SECONDS} seconds`);
    console.log(`Concurrent Clients: ${CONCURRENT_CLIENTS}`);
    console.log(`Rate Limit Values to Test: ${RATE_LIMIT_VALUES.join(', ')}`);
    console.log('='.repeat(150));
    
    const allResults = [];
    
    for (const limitValue of RATE_LIMIT_VALUES) {
        console.log(`\n[${new Date().toISOString()}] Testing rate limit: ${limitValue}`);
        
        const result = await runLoadTest(limitValue, TEST_DURATION_SECONDS);
        allResults.push(result);
        
        console.log(`  Results:`);
        console.log(`    Completed: ${result.completedRequests} requests`);
        console.log(`    Success Rate: ${result.successRate}%`);
        console.log(`    RPS: ${result.rps}`);
        console.log(`    Avg Latency: ${result.avgLatency}ms`);
        console.log(`    Avg CPU: ${result.avgMetrics.cpuPercent}%`);
        console.log(`    Max CPU: ${result.avgMetrics.maxCpu}%`);
        console.log(`    Errors: ${JSON.stringify(result.errorSummary)}`);
        
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    printResults(allResults);
    generateReport(allResults);
    
    console.log('\n' + '='.repeat(150));
    console.log('TEST COMPLETED');
    console.log('='.repeat(150));
}

main().catch(console.error);