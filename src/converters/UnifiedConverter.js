/**
 * 统一协议转换器服务
 * 支持自动检测输入协议并转换到目标协议
 * 实现多种协议格式之间的无缝转换
 */

import { MODEL_PROTOCOL_PREFIX } from '../utils/constants.js';
import { ConverterFactory } from './ConverterFactory.js';
import { protocolDetector, detectProtocol } from './ProtocolDetector.js';
import logger from '../utils/logger.js';

/**
 * 统一转换器类
 * 提供自动协议检测和转换功能
 */
export class UnifiedConverter {
    constructor() {
        this.converterFactory = ConverterFactory;
        this.protocolDetector = protocolDetector;
    }

    /**
     * 自动检测并转换请求数据
     * @param {Object} data - 请求数据
     * @param {string} targetProtocol - 目标协议
     * @param {string} [sourceProtocol] - 源协议（可选，不提供则自动检测）
     * @returns {Object} 转换后的数据
     */
    convertRequest(data, targetProtocol, sourceProtocol = null) {
        if (!data || typeof data !== 'object') {
            logger.warn('[UnifiedConverter] Invalid input data for request conversion');
            return data;
        }

        // 如果未指定源协议，自动检测
        if (!sourceProtocol) {
            sourceProtocol = this.detectProtocol(data);
            logger.debug(`[UnifiedConverter] Auto-detected source protocol: ${sourceProtocol}`);
        }

        // 如果源协议和目标协议相同，直接返回
        if (sourceProtocol === targetProtocol) {
            return data;
        }

        try {
            const converter = this.converterFactory.getConverter(sourceProtocol);
            if (!converter) {
                logger.error(`[UnifiedConverter] No converter available for protocol: ${sourceProtocol}`);
                return data;
            }

            const converted = converter.convertRequest(data, targetProtocol);
            logger.debug(`[UnifiedConverter] Successfully converted request from ${sourceProtocol} to ${targetProtocol}`);
            return converted;
        } catch (error) {
            logger.error(`[UnifiedConverter] Error converting request: ${error.message}`);
            return data;
        }
    }

    /**
     * 自动检测并转换响应数据
     * @param {Object} data - 响应数据
     * @param {string} targetProtocol - 目标协议
     * @param {string} [sourceProtocol] - 源协议（可选，不提供则自动检测）
     * @param {string} [model] - 模型名称
     * @returns {Object} 转换后的数据
     */
    convertResponse(data, targetProtocol, sourceProtocol = null, model = null) {
        if (!data || typeof data !== 'object') {
            logger.warn('[UnifiedConverter] Invalid input data for response conversion');
            return data;
        }

        // 如果未指定源协议，自动检测
        if (!sourceProtocol) {
            sourceProtocol = this.detectProtocol(data);
            logger.debug(`[UnifiedConverter] Auto-detected source protocol for response: ${sourceProtocol}`);
        }

        // 如果源协议和目标协议相同，直接返回
        if (sourceProtocol === targetProtocol) {
            return data;
        }

        try {
            const converter = this.converterFactory.getConverter(sourceProtocol);
            if (!converter) {
                logger.error(`[UnifiedConverter] No converter available for protocol: ${sourceProtocol}`);
                return data;
            }

            const converted = converter.convertResponse(data, targetProtocol, model);
            logger.debug(`[UnifiedConverter] Successfully converted response from ${sourceProtocol} to ${targetProtocol}`);
            return converted;
        } catch (error) {
            logger.error(`[UnifiedConverter] Error converting response: ${error.message}`);
            return data;
        }
    }

    /**
     * 自动检测并转换流式响应块
     * @param {Object} chunk - 流式响应块
     * @param {string} targetProtocol - 目标协议
     * @param {string} [sourceProtocol] - 源协议（可选，不提供则自动检测）
     * @param {string} [model] - 模型名称
     * @param {string} [requestId] - 请求ID
     * @returns {Object} 转换后的流式响应块
     */
    convertStreamChunk(chunk, targetProtocol, sourceProtocol = null, model = null, requestId = null) {
        if (!chunk) {
            return null;
        }

        // 如果未指定源协议，自动检测
        if (!sourceProtocol) {
            sourceProtocol = this.detectProtocol(chunk);
            logger.debug(`[UnifiedConverter] Auto-detected source protocol for stream chunk: ${sourceProtocol}`);
        }

        // 如果源协议和目标协议相同，直接返回
        if (sourceProtocol === targetProtocol) {
            return chunk;
        }

        try {
            const converter = this.converterFactory.getConverter(sourceProtocol);
            if (!converter) {
                logger.error(`[UnifiedConverter] No converter available for protocol: ${sourceProtocol}`);
                return chunk;
            }

            const converted = converter.convertStreamChunk(chunk, targetProtocol, model, requestId);
            logger.debug(`[UnifiedConverter] Successfully converted stream chunk from ${sourceProtocol} to ${targetProtocol}`);
            return converted;
        } catch (error) {
            logger.error(`[UnifiedConverter] Error converting stream chunk: ${error.message}`);
            return chunk;
        }
    }

    /**
     * 自动检测并转换模型列表
     * @param {Object} data - 模型列表数据
     * @param {string} targetProtocol - 目标协议
     * @param {string} [sourceProtocol] - 源协议（可选，不提供则自动检测）
     * @returns {Object} 转换后的模型列表
     */
    convertModelList(data, targetProtocol, sourceProtocol = null) {
        if (!data || typeof data !== 'object') {
            logger.warn('[UnifiedConverter] Invalid input data for model list conversion');
            return data;
        }

        // 如果未指定源协议，自动检测
        if (!sourceProtocol) {
            sourceProtocol = this.detectProtocol(data);
            logger.debug(`[UnifiedConverter] Auto-detected source protocol for model list: ${sourceProtocol}`);
        }

        // 如果源协议和目标协议相同，直接返回
        if (sourceProtocol === targetProtocol) {
            return data;
        }

        try {
            const converter = this.converterFactory.getConverter(sourceProtocol);
            if (!converter) {
                logger.error(`[UnifiedConverter] No converter available for protocol: ${sourceProtocol}`);
                return data;
            }

            const converted = converter.convertModelList(data, targetProtocol);
            logger.debug(`[UnifiedConverter] Successfully converted model list from ${sourceProtocol} to ${targetProtocol}`);
            return converted;
        } catch (error) {
            logger.error(`[UnifiedConverter] Error converting model list: ${error.message}`);
            return data;
        }
    }

    /**
     * 检测协议类型
     * @param {Object} data - 数据
     * @returns {string} 协议前缀
     */
    detectProtocol(data) {
        return detectProtocol(data);
    }

    /**
     * 获取所有支持的协议列表
     * @returns {Array<string>} 协议前缀数组
     */
    getSupportedProtocols() {
        return this.converterFactory.getRegisteredProtocols();
    }

    /**
     * 检查协议是否受支持
     * @param {string} protocol - 协议前缀
     * @returns {boolean} 是否支持
     */
    isProtocolSupported(protocol) {
        return this.converterFactory.isProtocolRegistered(protocol);
    }
}

/**
 * 全局统一转换器实例
 */
export const unifiedConverter = new UnifiedConverter();

/**
 * 便捷转换函数：自动检测并转换请求
 * @param {Object} data - 请求数据
 * @param {string} targetProtocol - 目标协议
 * @param {string} [sourceProtocol] - 源协议
 * @returns {Object} 转换后的数据
 */
export function autoConvertRequest(data, targetProtocol, sourceProtocol = null) {
    return unifiedConverter.convertRequest(data, targetProtocol, sourceProtocol);
}

/**
 * 便捷转换函数：自动检测并转换响应
 * @param {Object} data - 响应数据
 * @param {string} targetProtocol - 目标协议
 * @param {string} [sourceProtocol] - 源协议
 * @param {string} [model] - 模型名称
 * @returns {Object} 转换后的数据
 */
export function autoConvertResponse(data, targetProtocol, sourceProtocol = null, model = null) {
    return unifiedConverter.convertResponse(data, targetProtocol, sourceProtocol, model);
}

/**
 * 便捷转换函数：自动检测并转换流式响应块
 * @param {Object} chunk - 流式响应块
 * @param {string} targetProtocol - 目标协议
 * @param {string} [sourceProtocol] - 源协议
 * @param {string} [model] - 模型名称
 * @param {string} [requestId] - 请求ID
 * @returns {Object} 转换后的流式响应块
 */
export function autoConvertStreamChunk(chunk, targetProtocol, sourceProtocol = null, model = null, requestId = null) {
    return unifiedConverter.convertStreamChunk(chunk, targetProtocol, sourceProtocol, model, requestId);
}

/**
 * 便捷转换函数：自动检测并转换模型列表
 * @param {Object} data - 模型列表数据
 * @param {string} targetProtocol - 目标协议
 * @param {string} [sourceProtocol] - 源协议
 * @returns {Object} 转换后的模型列表
 */
export function autoConvertModelList(data, targetProtocol, sourceProtocol = null) {
    return unifiedConverter.convertModelList(data, targetProtocol, sourceProtocol);
}