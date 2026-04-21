import { getPluginManager } from '../core/plugin-manager.js';
import logger from '../utils/logger.js';
import { getRequestBody } from '../utils/common.js';
import { broadcastEvent } from './event-broadcast.js';

/**
 * 获取插件列表
 */
export async function handleGetPlugins(req, res) {
    try {
        const pluginManager = getPluginManager();
        const plugins = pluginManager.getPluginList();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ plugins }));
        return true;
    } catch (error) {
        logger.error('[UI API] Failed to get plugins:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: {
                message: 'Failed to get plugins list: ' + error.message
            }
        }));
        return true;
    }
}

/**
 * 切换插件状态
 */
export async function handleTogglePlugin(req, res, pluginName) {
    try {
        const pluginManager = getPluginManager();
        const plugins = pluginManager.getPluginList();
        const plugin = plugins.find(p => p.name === pluginName);
        
        if (!plugin) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    message: 'Plugin not found'
                }
            }));
            return true;
        }
        
        const newEnabledState = !plugin.enabled;
        await pluginManager.setPluginEnabled(pluginName, newEnabledState);

        // 广播更新事件
        broadcastEvent('plugin_update', {
            action: 'toggle',
            pluginName,
            enabled: newEnabledState,
            timestamp: new Date().toISOString()
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: `Plugin ${pluginName} ${newEnabledState ? 'enabled' : 'disabled'} successfully`,
            plugin: {
                name: pluginName,
                enabled: newEnabledState
            }
        }));
        return true;
    } catch (error) {
        logger.error('[UI API] Failed to toggle plugin:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: {
                message: 'Failed to toggle plugin: ' + error.message
            }
        }));
        return true;
    }
}