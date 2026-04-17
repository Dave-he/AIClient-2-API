import axios from 'axios';

const NODE_API_URL = 'http://localhost:30000';
const PYTHON_CONTROLLER_URL = 'http://localhost:5000';
const API_KEY = 'sk-2e3513944ecac08f466a2e01872ba91d';

async function testPythonControllerDirect() {
    console.log('=== 测试1: 直接调用 Python 控制器 ===');
    try {
        const response = await axios.get(`${PYTHON_CONTROLLER_URL}/v1/models`);
        console.log(`✅ Python控制器模型列表: ${JSON.stringify(response.data.data.map(m => m.id))}`);
    } catch (error) {
        console.log(`❌ Python控制器调用失败: ${error.message}`);
        return false;
    }

    try {
        const response = await axios.post(`${PYTHON_CONTROLLER_URL}/v1/chat/completions`, {
            model: 'gemma-4-31b',
            messages: [{ role: 'user', content: 'Hello!' }],
            max_tokens: 30
        });
        if (response.data.choices && response.data.choices[0]) {
            console.log(`✅ Python控制器聊天成功: ${response.data.choices[0].message.content.slice(0, 50)}...`);
            return true;
        }
    } catch (error) {
        console.log(`❌ Python控制器聊天失败: ${error.response?.data || error.message}`);
        return false;
    }
    return false;
}

async function testNodeAPIModels() {
    console.log('\n=== 测试2: Node.js API 模型列表 ===');
    try {
        const response = await axios.get(`${NODE_API_URL}/v1/models`, {
            headers: { Authorization: `Bearer ${API_KEY}` }
        });
        console.log(`✅ Node API模型列表: ${JSON.stringify(response.data.data.map(m => m.id))}`);
        return true;
    } catch (error) {
        console.log(`❌ Node API模型列表失败: ${error.response?.data || error.message}`);
        return false;
    }
}

async function testNodeAPIChat() {
    console.log('\n=== 测试3: Node.js API 聊天请求 ===');
    try {
        console.log('发送聊天请求...');
        const response = await axios.post(`${NODE_API_URL}/v1/chat/completions`, {
            model: 'gemma-4-31b',
            messages: [{ role: 'user', content: 'Hello!' }],
            max_tokens: 30,
            temperature: 0.7
        }, {
            headers: { Authorization: `Bearer ${API_KEY}` },
            timeout: 60000
        });
        console.log(`响应状态码: ${response.status}`);
        console.log(`响应数据: ${JSON.stringify(response.data).slice(0, 500)}`);
        if (response.data.choices && response.data.choices[0]) {
            console.log(`✅ Node API聊天成功: ${response.data.choices[0].message.content.slice(0, 50)}...`);
            return true;
        } else {
            console.log('❌ 响应格式异常');
            return false;
        }
    } catch (error) {
        console.log(`❌ Node API聊天失败`);
        console.log(`  - 错误类型: ${error.code}`);
        console.log(`  - 状态码: ${error.response?.status}`);
        console.log(`  - 响应数据: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
        return false;
    }
}

async function testNodeAPIHealth() {
    console.log('\n=== 测试4: Node.js API 健康检查 ===');
    try {
        const response = await axios.get(`${NODE_API_URL}/health`);
        console.log(`✅ 健康检查成功: ${JSON.stringify(response.data)}`);
        return true;
    } catch (error) {
        console.log(`❌ 健康检查失败: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('='.repeat(60));
    console.log('全链路测试 - Node.js API → Python控制器 → vLLM');
    console.log('='.repeat(60));

    const results = [];
    
    results.push({ name: 'Python控制器直接调用', pass: await testPythonControllerDirect() });
    results.push({ name: 'Node API模型列表', pass: await testNodeAPIModels() });
    results.push({ name: 'Node API健康检查', pass: await testNodeAPIHealth() });
    results.push({ name: 'Node API聊天请求', pass: await testNodeAPIChat() });

    console.log('\n' + '='.repeat(60));
    console.log('测试结果汇总:');
    console.log('='.repeat(60));
    
    let passed = 0;
    let failed = 0;
    
    for (const result of results) {
        if (result.pass) {
            console.log(`✅ ${result.name}`);
            passed++;
        } else {
            console.log(`❌ ${result.name}`);
            failed++;
        }
    }
    
    console.log(`\n总结果: ${passed} 通过, ${failed} 失败`);
    
    if (failed > 0) {
        console.log('\n可能的问题分析:');
        console.log('1. 如果Python控制器正常但Node API聊天失败，可能是OpenAI适配器配置问题');
        console.log('2. 检查provider_pools.json中的OPENAI_BASE_URL是否正确指向Python控制器');
        console.log('3. 检查Python控制器的API路径是否正确');
        console.log('4. 检查Node.js日志查看详细错误信息');
    }
}

runTests().catch(console.error);