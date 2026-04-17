import { fetch } from 'undici';

const TEST_SERVER_BASE_URL = 'http://localhost:30000';
const TEST_API_KEY = 'sk-2e3513944ecac08f466a2e01872ba91d';

async function makeRequest(url, method, body = null, headers = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_API_KEY}`,
        ...headers
    };

    const options = {
        method,
        headers: defaultHeaders
    };

    if (body) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    return await fetch(url, options);
}

async function testToolCall() {
    console.log('\n=== Testing Tool Call Request ===');
    
    const toolCallRequest = {
        model: "gemma-2-9b-it",
        messages: [
            {
                role: "user",
                content: "What's the weather like in Beijing?"
            }
        ],
        tools: [
            {
                type: "function",
                function: {
                    name: "get_weather",
                    description: "Get the current weather in a specific location",
                    parameters: {
                        type: "object",
                        properties: {
                            location: {
                                type: "string",
                                description: "The city and country, e.g., Beijing, China"
                            }
                        },
                        required: ["location"]
                    }
                }
            }
        ],
        tool_choice: "auto",
        stream: false
    };

    try {
        const response = await makeRequest(
            `${TEST_SERVER_BASE_URL}/v1/chat/completions`,
            'POST',
            toolCallRequest,
            { 'model-provider': 'local-model' }
        );

        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers.get('content-type'));
        
        if (response.status === 200) {
            const data = await response.json();
            console.log('Response:', JSON.stringify(data, null, 2));
            return { success: true, data };
        } else {
            const error = await response.json();
            console.log('Error:', JSON.stringify(error, null, 2));
            return { success: false, error };
        }
    } catch (error) {
        console.log('Request failed:', error.message);
        return { success: false, error: error.message };
    }
}

async function testToolCallStreaming() {
    console.log('\n=== Testing Tool Call Streaming ===');
    
    const toolCallRequest = {
        model: "gemma-2-9b-it",
        messages: [
            {
                role: "user",
                content: "Find information about Apple Inc."
            }
        ],
        tools: [
            {
                type: "function",
                function: {
                    name: "web_search",
                    description: "Search the web for information",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "The search query"
                            }
                        },
                        required: ["query"]
                    }
                }
            }
        ],
        tool_choice: "auto",
        stream: true
    };

    try {
        const response = await makeRequest(
            `${TEST_SERVER_BASE_URL}/v1/chat/completions`,
            'POST',
            toolCallRequest,
            { 'model-provider': 'local-model' }
        );

        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers.get('content-type'));
        
        if (response.status === 200) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let chunks = [];
            let chunkCount = 0;
            
            try {
                while (chunkCount < 10) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    chunks.push(chunk);
                    chunkCount++;
                }
            } finally {
                reader.releaseLock();
            }
            
            console.log(`Received ${chunks.length} chunks`);
            console.log('First chunk:', chunks[0]?.substring(0, 500));
            return { success: true, chunkCount: chunks.length };
        } else {
            const error = await response.json();
            console.log('Error:', JSON.stringify(error, null, 2));
            return { success: false, error };
        }
    } catch (error) {
        console.log('Request failed:', error.message);
        return { success: false, error: error.message };
    }
}

async function testImageRequest() {
    console.log('\n=== Testing Image Request ===');
    
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    
    const imageRequest = {
        model: "gemma-4-31b-it",
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "Describe this image"
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: testImageBase64
                        }
                    }
                ]
            }
        ],
        stream: false
    };

    try {
        const response = await makeRequest(
            `${TEST_SERVER_BASE_URL}/v1/chat/completions`,
            'POST',
            imageRequest,
            { 'model-provider': 'local-model' }
        );

        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers.get('content-type'));
        
        if (response.status === 200) {
            const data = await response.json();
            console.log('Response:', JSON.stringify(data, null, 2));
            return { success: true, data };
        } else {
            const error = await response.json();
            console.log('Error:', JSON.stringify(error, null, 2));
            return { success: false, error };
        }
    } catch (error) {
        console.log('Request failed:', error.message);
        return { success: false, error: error.message };
    }
}

async function testImageRequestStreaming() {
    console.log('\n=== Testing Image Request Streaming ===');
    
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    
    const imageRequest = {
        model: "gemma-4-31b-it",
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "What is in this image?"
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: testImageBase64
                        }
                    }
                ]
            }
        ],
        stream: true
    };

    try {
        const response = await makeRequest(
            `${TEST_SERVER_BASE_URL}/v1/chat/completions`,
            'POST',
            imageRequest,
            { 'model-provider': 'local-model' }
        );

        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers.get('content-type'));
        
        if (response.status === 200) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let chunks = [];
            let chunkCount = 0;
            
            try {
                while (chunkCount < 10) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    chunks.push(chunk);
                    chunkCount++;
                }
            } finally {
                reader.releaseLock();
            }
            
            console.log(`Received ${chunks.length} chunks`);
            console.log('First chunk:', chunks[0]?.substring(0, 500));
            return { success: true, chunkCount: chunks.length };
        } else {
            const error = await response.json();
            console.log('Error:', JSON.stringify(error, null, 2));
            return { success: false, error };
        }
    } catch (error) {
        console.log('Request failed:', error.message);
        return { success: false, error: error.message };
    }
}

async function testToolResult() {
    console.log('\n=== Testing Tool Result (Function Response) ===');
    
    const toolResultRequest = {
        model: "gemma-2-9b-it",
        messages: [
            {
                role: "user",
                content: "What's the weather like in Beijing?"
            },
            {
                role: "assistant",
                content: "",
                tool_calls: [
                    {
                        id: "call_weather_123",
                        type: "function",
                        function: {
                            name: "get_weather",
                            arguments: JSON.stringify({ location: "Beijing, China" })
                        }
                    }
                ]
            },
            {
                role: "tool",
                tool_call_id: "call_weather_123",
                content: JSON.stringify({
                    temperature: 25,
                    condition: "sunny",
                    humidity: 60
                })
            }
        ],
        stream: false
    };

    try {
        const response = await makeRequest(
            `${TEST_SERVER_BASE_URL}/v1/chat/completions`,
            'POST',
            toolResultRequest,
            { 'model-provider': 'local-model' }
        );

        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers.get('content-type'));
        
        if (response.status === 200) {
            const data = await response.json();
            console.log('Response:', JSON.stringify(data, null, 2));
            return { success: true, data };
        } else {
            const error = await response.json();
            console.log('Error:', JSON.stringify(error, null, 2));
            return { success: false, error };
        }
    } catch (error) {
        console.log('Request failed:', error.message);
        return { success: false, error: error.message };
    }
}

async function testHealthCheck() {
    console.log('\n=== Testing Health Check ===');
    
    try {
        const response = await makeRequest(`${TEST_SERVER_BASE_URL}/health`, 'GET');
        console.log('Status:', response.status);
        
        if (response.status === 200) {
            const data = await response.json();
            console.log('Health:', JSON.stringify(data, null, 2));
            return { success: true, data };
        } else {
            return { success: false, status: response.status };
        }
    } catch (error) {
        console.log('Health check failed:', error.message);
        return { success: false, error: error.message };
    }
}

async function runAllTests() {
    console.log('Running Tool Call and Image Request Tests...');
    
    const results = [];
    
    const healthResult = await testHealthCheck();
    results.push({ test: 'Health Check', ...healthResult });
    
    if (healthResult.success) {
        const toolCallResult = await testToolCall();
        results.push({ test: 'Tool Call (Non-streaming)', ...toolCallResult });
        
        const toolCallStreamResult = await testToolCallStreaming();
        results.push({ test: 'Tool Call (Streaming)', ...toolCallStreamResult });
        
        const imageResult = await testImageRequest();
        results.push({ test: 'Image Request (Non-streaming)', ...imageResult });
        
        const imageStreamResult = await testImageRequestStreaming();
        results.push({ test: 'Image Request (Streaming)', ...imageStreamResult });
        
        const toolResult = await testToolResult();
        results.push({ test: 'Tool Result', ...toolResult });
    }
    
    console.log('\n=== Test Summary ===');
    console.table(results.map(r => ({
        Test: r.test,
        Success: r.success,
        Error: r.error || '-'
    })));
    
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    console.log(`\n${passed}/${total} tests passed`);
}

runAllTests().catch(console.error);