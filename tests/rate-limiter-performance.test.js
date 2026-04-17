import { RateLimiter, RATE_LIMIT_CONFIG } from '../src/utils/rate-limiter.js';
import os from 'os';

const TEST_DURATION_SECONDS = 60;
const RATE_LIMIT_VALUES = [50, 100, 200, 500, 1000, 2000];
const CONCURRENT_CLIENTS = 10;
const REQUESTS_PER_CLIENT_PER_SECOND = 2;

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

function createMockRequest(ip, clientId) {
    return {
        headers: {
            'x-forwarded-for': ip,
            'authorization': `Bearer test-api-key-${clientId}`
        },
        socket: {
            remoteAddress: ip
        },
        query: {}
    };
}

async function runRateLimitTest(rateLimitValue, durationSeconds) {
    const rateLimiter = new RateLimiter();
    rateLimiter.updateConfig({ limit: rateLimitValue, windowMs: 60000 });
    
    let completed = 0;
    let blocked = 0;
    let startTime = Date.now();
    let stopTime = startTime + (durationSeconds * 1000);
    
    const metricsHistory = [];
    const metricsInterval = setInterval(() => {
        metricsHistory.push(getSystemMetrics());
    }, 1000);
    
    const requestDelay = 1000 / REQUESTS_PER_CLIENT_PER_SECOND;
    
    const runClient = async (clientId) => {
        const ip = `192.168.1.${(clientId % 254) + 1}`;
        const req = createMockRequest(ip, clientId);
        
        while (Date.now() < stopTime) {
            const result = rateLimiter.checkLimit(req);
            if (result.allowed) {
                completed++;
            } else {
                blocked++;
            }
            await new Promise(resolve => setTimeout(resolve, requestDelay));
        }
    };
    
    const clients = Array(CONCURRENT_CLIENTS).fill(null).map((_, i) => runClient(i));
    await Promise.all(clients);
    
    clearInterval(metricsInterval);
    
    const elapsed = (Date.now() - startTime) / 1000;
    const rps = completed / elapsed;
    
    const successRate = completed + blocked > 0 
        ? ((completed / (completed + blocked)) * 100).toFixed(2)
        : '100.00';
    
    const avgMetrics = metricsHistory.length > 0 ? {
        cpuPercent: (metricsHistory.reduce((a, m) => a + parseFloat(m.cpuPercent), 0) / metricsHistory.length).toFixed(2),
        rss: (metricsHistory.reduce((a, m) => a + parseFloat(m.rss), 0) / metricsHistory.length).toFixed(2),
        heapUsed: (metricsHistory.reduce((a, m) => a + parseFloat(m.heapUsed), 0) / metricsHistory.length).toFixed(2),
        maxCpu: Math.max(...metricsHistory.map(m => parseFloat(m.cpuPercent))).toFixed(2),
        maxRss: Math.max(...metricsHistory.map(m => parseFloat(m.rss))).toFixed(2)
    } : { cpuPercent: '0', rss: '0', heapUsed: '0', maxCpu: '0', maxRss: '0' };
    
    return {
        rateLimitValue,
        durationSeconds,
        completedRequests: completed,
        blockedRequests: blocked,
        totalRequests: completed + blocked,
        successRate,
        rps: rps.toFixed(2),
        avgMetrics
    };
}

function printResults(results) {
    console.log('\n' + '='.repeat(120));
    console.log('RATE LIMITER PERFORMANCE TEST RESULTS SUMMARY');
    console.log('='.repeat(120));
    
    const headers = [
        'Rate Limit', 'Duration(s)', 'Completed', 'Blocked', 'Total', 'Success Rate',
        'RPS', 'Avg CPU(%)', 'Max CPU(%)', 'Avg RSS(MB)', 'Max RSS(MB)'
    ];
    
    console.log('\n' + headers.map(h => h.padEnd(12)).join(' '));
    console.log('-'.repeat(120));
    
    results.forEach(result => {
        console.log([
            result.rateLimitValue.toString().padEnd(12),
            result.durationSeconds.toString().padEnd(12),
            result.completedRequests.toString().padEnd(12),
            result.blockedRequests.toString().padEnd(12),
            result.totalRequests.toString().padEnd(12),
            `${result.successRate}%`.padEnd(12),
            result.rps.padEnd(12),
            `${result.avgMetrics.cpuPercent}%`.padEnd(12),
            `${result.avgMetrics.maxCpu}%`.padEnd(12),
            `${result.avgMetrics.rss}MB`.padEnd(12),
            `${result.avgMetrics.maxRss}MB`.padEnd(12)
        ].join(' '));
    });
    
    console.log('\n' + '='.repeat(120));
}

function analyzeOptimalLimit(results) {
    console.log('\nOPTIMAL RATE LIMIT ANALYSIS');
    console.log('='.repeat(120));
    
    console.log('\nSelection Criteria:');
    console.log('  - Success Rate >= 99% (minimal rate limiting impact)');
    console.log('  - CPU Usage < 80%');
    console.log('  - Maximize RPS while maintaining stability\n');
    
    const candidates = results.filter(r => {
        const successRate = parseFloat(r.successRate);
        const cpuUsage = parseFloat(r.avgMetrics.cpuPercent);
        const maxCpu = parseFloat(r.avgMetrics.maxCpu);
        return successRate >= 99 && cpuUsage < 80 && maxCpu < 90;
    });
    
    if (candidates.length === 0) {
        console.log('No optimal rate limit found within acceptable thresholds');
        
        const relaxedCandidates = results.filter(r => {
            const successRate = parseFloat(r.successRate);
            const cpuUsage = parseFloat(r.avgMetrics.cpuPercent);
            return successRate >= 95 && cpuUsage < 90;
        });
        
        if (relaxedCandidates.length === 0) {
            console.log('  No candidates found even with relaxed criteria');
            return null;
        }
        
        relaxedCandidates.sort((a, b) => parseFloat(b.rps) - parseFloat(a.rps));
        const optimal = relaxedCandidates[0];
        
        console.log(`\n  Best candidate with relaxed criteria:`);
        console.log(`    Rate Limit: ${optimal.rateLimitValue}`);
        console.log(`    RPS: ${optimal.rps}`);
        console.log(`    Success Rate: ${optimal.successRate}%`);
        console.log(`    Avg CPU: ${optimal.avgMetrics.cpuPercent}%`);
        
        return optimal;
    }
    
    candidates.sort((a, b) => parseFloat(b.rps) - parseFloat(a.rps));
    const optimal = candidates[0];
    
    console.log('Optimal Rate Limit Configuration Found:');
    console.log(`  Rate Limit: ${optimal.rateLimitValue} requests/minute`);
    console.log(`  Expected RPS: ${optimal.rps}`);
    console.log(`  Success Rate: ${optimal.successRate}%`);
    console.log(`  Avg CPU Usage: ${optimal.avgMetrics.cpuPercent}%`);
    console.log(`  Max CPU Usage: ${optimal.avgMetrics.maxCpu}%`);
    console.log(`  Avg Memory Usage: ${optimal.avgMetrics.rss}MB`);
    
    console.log('\nRecommendation:');
    console.log(`  Set RATE_LIMIT to ${optimal.rateLimitValue} in production configuration.`);
    console.log(`  This provides optimal throughput while maintaining stability.`);
    
    return optimal;
}

function generateReport(results) {
    const fs = require('fs');
    const report = {
        testDate: new Date().toISOString(),
        testDurationPerLimit: TEST_DURATION_SECONDS,
        concurrentClients: CONCURRENT_CLIENTS,
        requestsPerClientPerSecond: REQUESTS_PER_CLIENT_PER_SECOND,
        results: results,
        optimalLimit: analyzeOptimalLimit(results)?.rateLimitValue || null
    };
    
    fs.mkdirSync('tests/reports', { recursive: true });
    const reportPath = `tests/reports/rate-limiter-performance-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\nReport saved to: ${reportPath}`);
    
    return report;
}

async function main() {
    console.log('\n' + '='.repeat(120));
    console.log('AIClient-2-API RATE LIMITER PERFORMANCE TEST');
    console.log('='.repeat(120));
    console.log(`Test Duration per Limit: ${TEST_DURATION_SECONDS} seconds`);
    console.log(`Concurrent Clients: ${CONCURRENT_CLIENTS}`);
    console.log(`Requests per Client per Second: ${REQUESTS_PER_CLIENT_PER_SECOND}`);
    console.log(`Rate Limit Values to Test: ${RATE_LIMIT_VALUES.join(', ')}`);
    console.log('='.repeat(120));
    
    const allResults = [];
    
    for (const limitValue of RATE_LIMIT_VALUES) {
        console.log(`\n[${new Date().toISOString()}] Testing rate limit: ${limitValue}`);
        
        const result = await runRateLimitTest(limitValue, TEST_DURATION_SECONDS);
        allResults.push(result);
        
        console.log(`  Results:`);
        console.log(`    Completed: ${result.completedRequests}`);
        console.log(`    Blocked: ${result.blockedRequests}`);
        console.log(`    Success Rate: ${result.successRate}%`);
        console.log(`    RPS: ${result.rps}`);
        console.log(`    Avg CPU: ${result.avgMetrics.cpuPercent}%`);
        console.log(`    Max CPU: ${result.avgMetrics.maxCpu}%`);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    printResults(allResults);
    generateReport(allResults);
    
    console.log('\n' + '='.repeat(120));
    console.log('TEST COMPLETED');
    console.log('='.repeat(120));
}

main().catch(console.error);