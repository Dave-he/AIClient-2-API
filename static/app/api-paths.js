export const API_PATHS = {
    PYTHON: {
        BASE: '/api/python',
        MODELS: {
            STATUS: '/api/python/models/status',
            SUMMARY: '/api/python/models/summary',
            START: '/api/python/models/{modelName}/start',
            STOP: '/api/python/models/{modelName}/stop',
            SWITCH: '/api/python/models/{modelName}/switch'
        },
        GPU: {
            STATUS: '/api/python/gpu/status',
            HISTORY: '/api/python/gpu/history'
        },
        QUEUE: {
            STATUS: '/api/python/queue/status'
        },
        HEALTH: '/api/python/health',
        VLLM: {
            MODELS: '/api/python/vllm/models'
        },
        TEST: {
            MODEL: '/api/python/test/model/{modelName}',
            SWITCH_AND_TEST: '/api/python/test/model/{modelName}/switch-and-test',
            REPORT: '/api/python/test/report/{modelName}',
            REPORTS: '/api/python/test/reports',
            COMPARATIVE: '/api/python/test/comparative',
            STATUS: '/api/python/test/status'
        },
        MONITOR: {
            SUMMARY: '/api/python/monitor/summary'
        }
    },
    PYTHON_GPU: {
        BASE: '/api/python-gpu',
        STATUS: '/api/python-gpu/status',
        SERVICE: {
            STATUS: '/api/python-gpu/service/status',
            START: '/api/python-gpu/service/start',
            STOP: '/api/python-gpu/service/stop',
            RESTART: '/api/python-gpu/service/restart'
        },
        CONFIG: '/api/python-gpu/config',
        MODELS: '/api/python-gpu/models',
        QUEUE: '/api/python-gpu/queue'
    }
};

export function formatPath(path, params = {}) {
    let formattedPath = path;
    for (const [key, value] of Object.entries(params)) {
        formattedPath = formattedPath.replace(`{${key}}`, encodeURIComponent(value));
    }
    return formattedPath;
}