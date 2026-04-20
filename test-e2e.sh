#!/bin/bash
# AIClient-2-API 端到端功能测试脚本

BASE_URL="http://localhost:30000"
PASS="admin123"

echo "================================================"
echo "  AIClient-2-API 端到端功能测试"
echo "================================================"
echo ""

# 1. 登录并获取Token
echo "=== 1. 测试登录功能 ==="
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$PASS\"}")
  
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败，无法获取Token"
  echo "响应: $LOGIN_RESPONSE"
  exit 1
fi
echo "✓ 登录成功，已获取Token"
echo ""

# 设置认证头
AUTH_HEADER="Authorization: Bearer $TOKEN"

# 2. 测试仪表盘数据
echo "=== 2. 测试仪表盘(Dashboard)数据 ==="
echo "--- 2.1 系统监控信息 ---"
SYS_INFO=$(curl -s "$BASE_URL/api/system/info" -H "$AUTH_HEADER")
echo "$SYS_INFO" | python3 -m json.tool 2>/dev/null | head -20
echo ""

echo "--- 2.2 仪表盘摘要 ---"
DASHBOARD=$(curl -s "$BASE_URL/api/dashboard/summary" -H "$AUTH_HEADER")
echo "$DASHBOARD" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('✓ 数据获取成功')
if 'system' in data:
    print(f\"  - CPU: {data['system'].get('cpu', {}).get('usage', 'N/A')}%\")
    print(f\"  - 内存: {data['system'].get('memory', {}).get('usagePercent', 'N/A')}%\")
if 'python' in data:
    print(f'  - Python控制器: {\"已连接\" if data[\"python\"].get(\"success\") else \"未连接\"}')
" 2>/dev/null
echo ""

echo "--- 2.3 GPU状态 ---"
GPU_STATUS=$(curl -s "$BASE_URL/api/python/manage/gpu" -H "$AUTH_HEADER")
echo "$GPU_STATUS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('success'):
    print('✓ GPU状态获取成功')
    print(f\"  - 状态: {data.get('status', 'N/A')}\")
    if data.get('status') == 'available':
        print(f\"  - 使用率: {data.get('utilization', 'N/A')}%\")
        print(f\"  - 温度: {data.get('temperature', 'N/A')}°C\")
else:
    print(f'○ GPU状态: {data.get(\"message\", \"不可用\")}')
" 2>/dev/null
echo ""

# 3. 测试配置管理
echo "=== 3. 测试配置(Config)管理 ==="
echo "--- 3.1 加载配置 ---"
CONFIG=$(curl -s "$BASE_URL/api/config" -H "$AUTH_HEADER")
echo "$CONFIG" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('✓ 配置加载成功')
print(f\"  - 提供商: {data.get('MODEL_PROVIDER', 'N/A')}\")
print(f\"  - 端口: {data.get('SERVER_PORT', 'N/A')}\")
" 2>/dev/null
echo ""

echo "--- 3.2 支持的提供商列表 ---"
PROVIDERS_STATIC=$(curl -s "$BASE_URL/api/providers/static" -H "$AUTH_HEADER")
echo "$PROVIDERS_STATIC" | python3 -c "
import sys, json
data = json.load(sys.stdin)
providers = data.get('supportedProviders', [])
print(f'✓ 共支持 {len(providers)} 个提供商类型')
for p in providers[:5]:
    print(f\"  - {p.get('id', 'unknown')}: {p.get('name', 'N/A')}\")
if len(providers) > 5:
    print(f'  ... 还有 {len(providers)-5} 个')
" 2>/dev/null
echo ""

# 4. 测试提供商管理
echo "=== 4. 测试提供商(Providers)管理 ==="
echo "--- 4.1 提供商动态状态 ---"
PROVIDERS_DYNAMIC=$(curl -s "$BASE_URL/api/providers/dynamic" -H "$AUTH_HEADER")
echo "$PROVIDERS_DYNAMIC" | python3 -c "
import sys, json
data = json.load(sys.stdin)
providers = data.get('providers', {})
print(f'✓ 已配置 {len(providers)} 个提供商类型')
for ptype, accounts in list(providers.items())[:3]:
    healthy = sum(1 for a in accounts if a.get('isHealthy') and not a.get('isDisabled'))
    total = len(accounts)
    print(f\"  - {ptype}: {healthy}/{total} 健康\")
" 2>/dev/null
echo ""

echo "--- 4.2 模型列表 ---"
MODELS=$(curl -s "$BASE_URL/api/models" -H "$AUTH_HEADER")
echo "$MODELS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
models = data.get('models', [])
if isinstance(models, list):
    print(f'✓ 共 {len(models)} 个可用模型')
    for m in models[:5]:
        print(f\"  - {m if isinstance(m, str) else m.get('id', 'unknown')}\")
elif isinstance(models, dict):
    print(f'✓ 共 {len(models)} 个可用模型')
    for name in list(models.keys())[:5]:
        print(f\"  - {name}\")
" 2>/dev/null
echo ""

# 5. 测试用量统计
echo "=== 5. 测试用量统计(Stats) ==="
echo "--- 5.1 Token使用统计 ---"
TOKEN_USAGE=$(curl -s "$BASE_URL/api/usage/tokens?range=hour" -H "$AUTH_HEADER")
echo "$TOKEN_USAGE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('✓ Token统计获取成功')
print(f\"  - 总请求: {data.get('totalRequests', 0)}\")
print(f\"  - 总Tokens: {data.get('totalTokens', 0)}\")
print(f\"  - 输入Tokens: {data.get('inputTokens', 0)}\")
print(f\"  - 输出Tokens: {data.get('outputTokens', 0)}\")
" 2>/dev/null
echo ""

# 6. 测试插件管理
echo "=== 6. 测试插件(Plugins)管理 ==="
PLUGINS=$(curl -s "$BASE_URL/api/plugins" -H "$AUTH_HEADER")
echo "$PLUGINS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
plugins = data.get('plugins', [])
print(f'✓ 共 {len(plugins)} 个插件')
for p in plugins:
    status = '✓ 启用' if p.get('enabled') else '○ 禁用'
    print(f\"  - {p.get('name', 'unknown')}: {status}\")
" 2>/dev/null
echo ""

# 7. 测试日志
echo "=== 7. 测试日志(Logs) ==="
LOGS=$(curl -s "$BASE_URL/api/logs?count=5" -H "$AUTH_HEADER")
echo "$LOGS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
logs = data.get('logs', [])
print(f'✓ 获取到 {len(logs)} 条日志')
for log in logs[:3]:
    print(f\"  [{log.get('level', 'unknown').upper()}] {log.get('message', '')[:80]}\")
" 2>/dev/null
echo ""

# 8. 测试Python控制器
echo "=== 8. 测试Python控制器集成 ==="
echo "--- 8.1 模型状态 ---"
MODEL_STATUS=$(curl -s "$BASE_URL/api/python/models/status" -H "$AUTH_HEADER")
echo "$MODEL_STATUS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('success'):
    models = data.get('models', {})
    print(f'✓ 获取到 {len(models)} 个本地模型')
    for name, status in list(models.items())[:3]:
        running = status.get('running', False)
        print(f\"  - {name}: {'运行中' if running else '已停止'}\")
else:
    print(f'○ Python控制器未连接: {data.get(\"error\", \"未知错误\")}')
" 2>/dev/null
echo ""

# 9. 测试SSE事件流
echo "=== 9. 测试SSE事件流 ==="
curl -s -N --max-time 2 "$BASE_URL/api/events" -H "$AUTH_HEADER" -o /dev/null 2>&1 && echo "✓ SSE事件流连接正常" || echo "○ SSE事件流连接超时（预期行为）"
echo ""

# 10. 测试健康检查
echo "=== 10. 测试健康检查 ==="
HEALTH=$(curl -s "$BASE_URL/health")
echo "$HEALTH" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'✓ 服务状态: {data.get(\"status\", \"unknown\")}')
print(f\"  - 时间戳: {data.get('timestamp', 'N/A')}\")
print(f\"  - 当前提供商: {data.get('provider', 'N/A')}\")
" 2>/dev/null
echo ""

# 11. 测试Master进程管理
echo "=== 11. 测试Master进程管理 ==="
MASTER_STATUS=$(curl -s "$BASE_URL/master/status")
echo "$MASTER_STATUS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'✓ Master状态: {data.get(\"status\", \"unknown\")}')
if 'worker' in data:
    worker = data['worker']
    print(f\"  - Worker PID: {worker.get('pid', 'N/A')}\")
    print(f\"  - Worker状态: {worker.get('status', 'N/A')}\")
" 2>/dev/null
echo ""

echo "================================================"
echo "  测试完成！"
echo "================================================"
