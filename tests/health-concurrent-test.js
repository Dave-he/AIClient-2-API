import http from 'http';

const config = {
    url: 'http://localhost:3000',
    apiKey: '123456',
    concurrency: 5,
    totalRequests: 20,
    timeout: 60000
};

class Statistics {
    constructor() {
        this.completed = 0;
        this.failed = 0;
        this.responseTimes = [];
        this.errors = {};
        this.startTime = null;
        this.endTime = null;
    }

    recordSuccess(responseTime) {
        this.completed++;
        this.responseTimes.push(responseTime);
    }

    recordFailure(error) {
        this.failed++;
        const errorKey = error.message || String(error);
        this.errors[errorKey] = (this.errors[errorKey] || 0) + 1;
    }

    start() {
        this.startTime = Date.now();
    }

    end() {
        this.endTime = Date.now();
    }

    getReport() {
        const totalTime = this.endTime - this.startTime;
        const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
        
        const percentile = (p) => {
            if (sortedTimes.length === 0) return 0;
            const index = Math.ceil((p / 100) * sortedTimes.length) - 1;
            return sortedTimes[Math.max(0, index)];
        };

        const avg = sortedTimes.length > 0 
            ? sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length 
            : 0;

        return {
            totalRequests: this.completed + this.failed,
            completed: this.completed,
            failed: this.failed,
            successRate: ((this.completed / (this.completed + this.failed)) * 100).toFixed(2) + '%',
            totalTime: totalTime,
            requestsPerSecond: ((this.completed + this.failed) / (totalTime / 1000)).toFixed(2),
            responseTime: {
                min: sortedTimes.length > 0 ? sortedTimes[0] : 0,
                max: sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1] : 0,
                avg: avg.toFixed(2),
                p50: percentile(50),
                p90: percentile(90),
                p95: percentile(95),
                p99: percentile(99)
            },
            errors: this.errors
        };
    }
}

function sendRequest(requestId) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const url = new URL(`/health?key=${config.apiKey}`, config.url);

        const options = {
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname + url.search,
            method: 'GET',
            timeout: config.timeout
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const responseTime = Date.now() - startTime;
                
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({
                        success: true,
                        requestId,
                        statusCode: res.statusCode,
                        responseTime,
                        dataLength: data.length
                    });
                } else {
                    reject({
                        success: false,
                        requestId,
                        statusCode: res.statusCode,
                        responseTime,
                        error: `HTTP ${res.statusCode}`
                    });
                }
            });
        });

        req.on('error', (error) => {
            const responseTime = Date.now() - startTime;
            reject({
                success: false,
                requestId,
                responseTime,
                error: error.code === 'ECONNREFUSED' 
                    ? `连接被拒绝` 
                    : (error.message || error.code || 'Unknown error')
            });
        });

        req.on('timeout', () => {
            req.destroy();
            const responseTime = Date.now() - startTime;
            reject({
                success: false,
                requestId,
                responseTime,
                error: '请求超时'
            });
        });

        req.end();
    });
}

class ConcurrencyController {
    constructor(concurrency) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    async run(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        while (this.running < this.concurrency && this.queue.length > 0) {
            const { task, resolve, reject } = this.queue.shift();
            this.running++;

            task()
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    this.running--;
                    this.processQueue();
                });
        }
    }
}

function showProgress(current, total, stats) {
    const percentage = ((current / total) * 100).toFixed(1);
    const barLength = 30;
    const filled = Math.round((current / total) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    
    process.stdout.write(`\r[${bar}] ${percentage}% (${current}/${total}) | 成功: ${stats.completed} | 失败: ${stats.failed}`);
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              API 健康检查并发测试                          ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 目标地址: ${config.url.padEnd(47)}║`);
    console.log(`║ 测试端点: /health                                         ║`);
    console.log(`║ 并发数量: ${String(config.concurrency).padEnd(47)}║`);
    console.log(`║ 总请求数: ${String(config.totalRequests).padEnd(47)}║`);
    console.log(`║ 超时时间: ${(config.timeout + 'ms').padEnd(47)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    const stats = new Statistics();
    const controller = new ConcurrencyController(config.concurrency);

    console.log('开始测试...\n');
    stats.start();

    const tasks = [];
    for (let i = 1; i <= config.totalRequests; i++) {
        const requestId = i;

        tasks.push(
            controller.run(() => sendRequest(requestId))
                .then((result) => {
                    stats.recordSuccess(result.responseTime);
                })
                .catch((result) => {
                    stats.recordFailure(new Error(result.error));
                })
                .finally(() => {
                    showProgress(stats.completed + stats.failed, config.totalRequests, stats);
                })
        );
    }

    await Promise.all(tasks);
    stats.end();

    console.log('\n\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                      测试结果报告                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const report = stats.getReport();

    console.log('\n📊 总体统计:');
    console.log(`   总请求数:     ${report.totalRequests}`);
    console.log(`   成功请求:     ${report.completed}`);
    console.log(`   失败请求:     ${report.failed}`);
    console.log(`   成功率:       ${report.successRate}`);
    console.log(`   总耗时:       ${report.totalTime}ms`);
    console.log(`   吞吐量:       ${report.requestsPerSecond} req/s`);

    console.log('\n⏱️  响应时间统计 (ms):');
    console.log(`   最小值:       ${report.responseTime.min}`);
    console.log(`   最大值:       ${report.responseTime.max}`);
    console.log(`   平均值:       ${report.responseTime.avg}`);
    console.log(`   P50:          ${report.responseTime.p50}`);
    console.log(`   P90:          ${report.responseTime.p90}`);
    console.log(`   P95:          ${report.responseTime.p95}`);
    console.log(`   P99:          ${report.responseTime.p99}`);

    if (Object.keys(report.errors).length > 0) {
        console.log('\n❌ 错误统计:');
        for (const [error, count] of Object.entries(report.errors)) {
            console.log(`   ${error}: ${count}次`);
        }
    }

    console.log('\n════════════════════════════════════════════════════════════════');

    process.exit(report.failed > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error('测试脚本执行失败:', error);
    process.exit(1);
});