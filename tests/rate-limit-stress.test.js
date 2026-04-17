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
        heapUsed: (memUsage.heap