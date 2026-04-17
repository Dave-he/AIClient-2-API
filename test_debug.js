import axios from 'axios';
import http from 'http';
import https from 'https';

const NODE_API_URL = 'http://localhost:30000';
const PYTHON_CONTROLLER_URL = 'http://localhost:5000';
const API_KEY = 'sk-2e3513944ecac08f466a2e01872ba91d';

const customAxios = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
    timeout: 60000
});

async function testDirectPythonChat() {
    console.log('=== 测试1: 直接调用 Python 控制器 ===');
    try {
        const response = await customAxios.post(`${PYTHON_CONTROLLER_URL}/v1/chat/completions`, {
            model: 'gemma-4-31b',
            messages: [{ role: 'user', content: 'Hello!' }],
            max_tokens: 30
        });
        console.log(`✅ Python控制器响应状态: ${response.status}`);
        console.log(`✅ Python控制器响应数据: ${JSON.stringify(response.data).slice(0, 300)}`);
        return true;
    } catch (error) {
        console.log(`❌ Python控制器调用失败: ${error.message}`);
        return false;
    }
}

async function testNodeChatWithDebug() {
    console.log('\n=== 测试2: Node.js API 聊天请求 (带调试) ===');
    try {
        console.log('发送请求到 Node.js API...');
        
        const response = await customAxios.post(`${NODE_API_URL}/v1/chat/completions`, {
            model: 'gemma-4-31b',
            messages: [{ role: 'user', content: 'Hello!' }],
            max_tokens: 30,
            temperature: 0.7
        }, {
            headers: { 
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });
        
        console.log(`✅ 响应状态码: ${response.status}`);
        console.log(`✅ 响应头:`, response.headers);
        console.log(`✅ 响应数据: ${JSON.stringify(response.data)}`);
        return true;
    } catch (error) {
        console.log(`❌ 请求失败`);
        console.log(`  - 错误类型: ${error.code}`);
        console.log(`  - 错误信息: ${error.message}`);
        console.log(`  - 状态码: ${error.response?.status}`);
        console.log(`  - 响应数据: ${error.response?.data ? JSON.stringify(error.response.data) : 'N/A'}`);
        console.log(`  - 响应头:`, error.response?.headers);
        return false;
    }
}

async function testNodeModels() {
    console.log('\n=== 测试3: Node.js API 模型列表 ===');
    try {
        const response = await customAxios.get(`${NODE_API_URL}/v1/models`, {
            headers: { Authorization: `Bearer ${API_KEY}` }
        });
        console.log(`✅ 模型列表: ${JSON.stringify(response.data.data.map(m => m.id))}`);
        return true;
    } catch (error) {
        console.log(`❌ 模型列表获取失败: ${error.message}`);
        return false;
    }
}

async function testNodeHealth() {
    console.log('\n=== 测试4: Node.js API 健康检查 ===');
    try {
        const response = await customAxios.get(`${NODE_API_URL}/health`);
        console.log(`✅ 健康检查: ${JSON.stringify(response.data)}`);
        return true;
    } catch (error) {
        console.log(`❌ 健康检查失败: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('='.repeat(70));
    console.log('调试测试 - 诊断 Node.js API → Python控制器 → vLLM');
    console.log('='.repeat(70));

    await testNodeModels();
    await testNodeHealth();
    await testDirectPythonChat();
    await testNodeChatWithDebug();
}

runTests().catch(console.error);