/**
 * 协议格式自动检测器
 * 根据请求数据的结构特征自动判断其所属的API协议格式
 */

import { MODEL_PROTOCOL_PREFIX } from '../utils/constants.js';
import logger from '../utils/logger.js';

/**
 * 协议检测器类
 * 通过分析请求数据的结构特征来自动识别协议类型
 */
export class ProtocolDetector {
    constructor() {
        this.detectors = [
            {
                protocol: MODEL_PROTOCOL_PREFIX.GEMINI,
                detect: this.detectGemini.bind(this)
            },
            {
                protocol: MODEL_PROTOCOL_PREFIX.CLAUDE,
                detect: this.detectClaude.bind(this)
            },
            {
                protocol: MODEL_PROTOCOL_PREFIX.CODEX,
                detect: this.detectCodex.bind(this)
            },
            {
                protocol: MODEL_PROTOCOL_PREFIX.OPENAI_RESPONSES,
                detect: this.detectOpenAIResponses.bind(this)
            },
            {
                protocol: MODEL_PROTOCOL_PREFIX.GROK,
                detect: this.detectGrok.bind(this)
            },
            {
                protocol: MODEL_PROTOCOL_PREFIX.OPENAI,
                detect: this.detectOpenAI.bind(this)
            }
        ];
    }

    /**
     * 检测请求数据的协议类型
     * @param {Object} data - 请求数据
     * @returns {string|null} 协议前缀或null（无法识别）
     */
    detect(data) {
        if (!data || typeof data !== 'object') {
            return null;
        }

        for (const { protocol, detect } of this.detectors) {
            if (detect(data)) {
                logger.debug(`[ProtocolDetector] Detected protocol: ${protocol}`);
                return protocol;
            }
        }

        logger.debug('[ProtocolDetector] Could not detect protocol, defaulting to OpenAI');
        return MODEL_PROTOCOL_PREFIX.OPENAI;
    }

    /**
     * 检测是否为Gemini协议格式
     * Gemini特征：
     * - 请求格式：包含 contents 数组、systemInstruction、generationConfig
     * - 响应格式：包含 candidates 数组、usageMetadata
     * - contents/candidates 中的项包含 role（user/model）和 parts
     */
    detectGemini(data) {
        if (!data) return false;

        // 检查 Gemini 响应格式：candidates 数组
        if (Array.isArray(data.candidates)) {
            for (const candidate of data.candidates) {
                if (candidate && typeof candidate === 'object') {
                    if (candidate.content && Array.isArray(candidate.content.parts)) {
                        return true;
                    }
                }
            }
        }

        // 检查 Gemini 请求格式：systemInstruction
        if (data.systemInstruction || data.system_instruction) {
            return true;
        }

        // 检查 contents 结构（请求格式）
        if (Array.isArray(data.contents)) {
            for (const content of data.contents) {
                if (content && typeof content === 'object') {
                    // Gemini 使用 role: 'user' 或 'model'
                    if ((content.role === 'user' || content.role === 'model') && Array.isArray(content.parts)) {
                        return true;
                    }
                }
            }
        }

        // 检查 generationConfig 字段
        if (data.generationConfig && typeof data.generationConfig === 'object') {
            if (data.generationConfig.maxOutputTokens !== undefined || 
                data.generationConfig.temperature !== undefined ||
                data.generationConfig.topP !== undefined ||
                data.generationConfig.thinkingConfig !== undefined) {
                return true;
            }
        }

        // 检查 usageMetadata（响应格式）
        if (data.usageMetadata && typeof data.usageMetadata === 'object') {
            if (data.usageMetadata.promptTokenCount !== undefined || 
                data.usageMetadata.candidatesTokenCount !== undefined) {
                return true;
            }
        }

        // 检查 tools 结构（Gemini 格式）
        if (data.tools && Array.isArray(data.tools)) {
            for (const tool of data.tools) {
                if (tool.functionDeclarations || tool.googleSearch || tool.urlContext) {
                    return true;
                }
            }
        }

        // 检查 safetySettings
        if (data.safetySettings && Array.isArray(data.safetySettings)) {
            for (const setting of data.safetySettings) {
                if (setting.category && setting.threshold) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 检测是否为Claude协议格式
     * Claude特征：
     * - 请求格式：包含 messages 数组、system 字段、thinking 字段、input_schema 工具格式
     * - 响应格式：包含 id、type、role、content、stop_reason 字段
     * - messages/content 中的项包含 type: 'text'/'image'/'tool_use'/'tool_result'
     */
    detectClaude(data) {
        if (!data) return false;

        // Claude 响应格式检测
        if (data.type === 'message' && data.role === 'assistant' && Array.isArray(data.content)) {
            for (const item of data.content) {
                if (item && item.type) {
                    const claudeTypes = ['text', 'image', 'tool_use', 'tool_result', 'thinking', 'redacted_thinking'];
                    if (claudeTypes.includes(item.type)) {
                        return true;
                    }
                }
            }
        }

        // Claude 特有的 stop_reason 字段（响应格式）
        if (data.stop_reason !== undefined && data.id && data.type) {
            return true;
        }

        // Claude 特有的 thinking 字段（请求格式）
        if (data.thinking && typeof data.thinking === 'object') {
            if (data.thinking.type === 'enabled' || data.thinking.type === 'adaptive') {
                return true;
            }
        }

        // Claude 特有的 tools 结构（input_schema）
        if (data.tools && Array.isArray(data.tools)) {
            for (const tool of data.tools) {
                if (tool && tool.input_schema) {
                    return true;
                }
            }
        }

        // Claude 特有的 tool_choice 格式
        if (data.tool_choice && typeof data.tool_choice === 'object') {
            if (data.tool_choice.type === 'auto' || data.tool_choice.type === 'any' || data.tool_choice.type === 'tool') {
                return true;
            }
        }

        // 检查 messages 结构
        if (Array.isArray(data.messages)) {
            for (const message of data.messages) {
                if (message && typeof message === 'object') {
                    const content = message.content;
                    if (Array.isArray(content)) {
                        for (const item of content) {
                            if (item && item.type) {
                                const claudeTypes = ['text', 'image', 'tool_use', 'tool_result', 'thinking', 'redacted_thinking'];
                                if (claudeTypes.includes(item.type)) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }

        return false;
    }

    /**
     * 检测是否为OpenAI Responses协议格式
     * Responses特征：
     * - 包含 input 数组
     * - 包含 instructions 字段
     * - output 数组中的项包含 type: 'message'/'function_call'/'function_call_output'
     */
    detectOpenAIResponses(data) {
        if (!data) return false;

        // Responses API 特有的 instructions 字段
        if (data.instructions !== undefined) {
            return true;
        }

        // Responses API 特有的 input 字段
        if (Array.isArray(data.input)) {
            for (const item of data.input) {
                if (item && item.type) {
                    const responsesTypes = ['message', 'function_call', 'function_call_output'];
                    if (responsesTypes.includes(item.type)) {
                        return true;
                    }
                }
            }
        }

        // Responses API 特有的输出结构
        if (Array.isArray(data.output)) {
            for (const item of data.output) {
                if (item && item.type) {
                    const responsesTypes = ['message', 'function_call', 'function_call_output', 'reasoning'];
                    if (responsesTypes.includes(item.type)) {
                        return true;
                    }
                }
            }
        }

        // Responses API 特有的字段
        if (data.parallel_tool_calls !== undefined || 
            data.max_output_tokens !== undefined ||
            data.prompt_cache_key !== undefined ||
            data.safety_identifier !== undefined) {
            return true;
        }

        // Responses API 特有的 reasoning 字段
        if (data.reasoning && typeof data.reasoning === 'object') {
            if (data.reasoning.effort !== undefined) {
                return true;
            }
        }

        return false;
    }

    /**
     * 检测是否为Codex协议格式
     * Codex特征：与OpenAI Responses类似但有细微差别
     */
    detectCodex(data) {
        if (!data) return false;

        // Codex 通常使用 OpenAI Responses 格式但有一些特定特征
        if (data.object === 'response') {
            return true;
        }

        // Codex 特有的 response 字段包装
        if (data.response && typeof data.response === 'object') {
            if (data.response.object === 'response') {
                return true;
            }
        }

        return false;
    }

    /**
     * 检测是否为Grok协议格式
     * Grok特征：基于OpenAI格式，但可能有一些自定义字段
     */
    detectGrok(data) {
        if (!data) return false;

        // Grok 通常使用 OpenAI 格式，这里主要检查一些特殊字段
        if (data.grok_custom !== undefined || 
            data.x_grok_api_key !== undefined) {
            return true;
        }

        return false;
    }

    /**
     * 检测是否为标准OpenAI协议格式
     * OpenAI特征：
     * - 包含 messages 数组
     * - messages 中的项包含 role（system/user/assistant/tool）
     * - 可能包含 tools 和 tool_calls
     */
    detectOpenAI(data) {
        if (!data) return false;

        // 标准 OpenAI 格式检查
        if (Array.isArray(data.messages)) {
            for (const message of data.messages) {
                if (message && typeof message === 'object') {
                    // OpenAI 特有的 role 类型
                    const openaiRoles = ['system', 'user', 'assistant', 'tool', 'function'];
                    if (openaiRoles.includes(message.role)) {
                        // 检查 content 格式
                        const content = message.content;
                        if (typeof content === 'string' || Array.isArray(content)) {
                            return true;
                        }
                    }
                }
            }
        }

        // OpenAI 特有的工具调用格式
        if (data.tools && Array.isArray(data.tools)) {
            for (const tool of data.tools) {
                if (tool && tool.type === 'function' && tool.function) {
                    return true;
                }
            }
        }

        // OpenAI 特有的参数
        if (data.max_tokens !== undefined || 
            data.n !== undefined ||
            data.presence_penalty !== undefined ||
            data.frequency_penalty !== undefined ||
            data.best_of !== undefined) {
            return true;
        }

        return false;
    }

    /**
     * 获取所有支持的协议列表
     * @returns {Array<string>} 协议前缀数组
     */
    getSupportedProtocols() {
        return this.detectors.map(d => d.protocol);
    }

    /**
     * 检查协议是否受支持
     * @param {string} protocol - 协议前缀
     * @returns {boolean} 是否支持
     */
    isProtocolSupported(protocol) {
        return this.detectors.some(d => d.protocol === protocol);
    }
}

/**
 * 全局协议检测器实例
 */
export const protocolDetector = new ProtocolDetector();

/**
 * 检测协议类型的便捷函数
 * @param {Object} data - 请求数据
 * @returns {string|null} 协议前缀
 */
export function detectProtocol(data) {
    return protocolDetector.detect(data);
}