/**
 * 转换器模块统一导出入口
 * 提供所有协议转换相关的功能
 */

// 导出基础转换器
export { BaseConverter, ContentProcessor, ToolProcessor } from './BaseConverter.js';

// 导出转换器工厂
export { ConverterFactory, ContentProcessorFactory, ToolProcessorFactory } from './ConverterFactory.js';

// 导出具体转换器策略
export { OpenAIConverter } from './strategies/OpenAIConverter.js';
export { OpenAIResponsesConverter } from './strategies/OpenAIResponsesConverter.js';
export { ClaudeConverter } from './strategies/ClaudeConverter.js';
export { GeminiConverter } from './strategies/GeminiConverter.js';
export { CodexConverter } from './strategies/CodexConverter.js';
export { GrokConverter } from './strategies/GrokConverter.js';
export { LocalConverter } from './strategies/LocalConverter.js';

// 导出协议检测器（新增）
export { ProtocolDetector, protocolDetector, detectProtocol } from './ProtocolDetector.js';

// 导出统一转换器（新增）
export { UnifiedConverter, unifiedConverter, autoConvertRequest, autoConvertResponse, autoConvertStreamChunk, autoConvertModelList } from './UnifiedConverter.js';

// 导出工具函数
export {
    checkAndAssignOrDefault,
    generateId,
    safeParseJSON,
    extractTextFromMessageContent,
    applySystemPromptReplacements,
    extractAndProcessSystemMessages,
    cleanJsonSchemaProperties,
    mapFinishReason,
    determineReasoningEffortFromBudget,
    extractThinkingFromOpenAIText,
    toolStateManager
} from './utils.js';

// 导出转换器注册函数
export { registerAllConverters } from './register-converters.js';