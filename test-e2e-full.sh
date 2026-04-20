#!/bin/bash
# AIClient-2-API 旧版界面端到端验证脚本
# 全面验证30000端口的所有功能

BASE_URL="http://localhost:30000"
PASS="admin123"

echo "================================================"
echo "  AIClient-2-API 旧版界面端到端验证"
echo "  端口: 30000"
echo "================================================"
echo ""

# 1. 服务状态
echo "=== 1. 服务状态 ==="
curl -s "$BASE_URL/health" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"✅ 服务状态: {data.get('status', 'unknown')}\")
print(f\"  时间戳: {data.get('timestamp', 'N/A')}\")
print(f\"  提供商: {data.get('provider', 'N/A')}\")
" 2>/dev/null || echo "❌ 健康检查失败"
echo ""

# 2. 静态资源
echo "=== 2. 静态资源 ==="
RESOURCES=(
  "login.html"
  "index.html"
  "app/base.css"
  "app/mobile.css"
  "app/app.js"
  "app/auth.js"
  "app/component-loader.js"
  "app/system-monitor.js"
  "app/gpu-monitor.js"
  "app/provider-manager.js"
  "app/config-manager.js"
  "app/i18n.js"
  "app/navigation.js"
  "app/monitor-cache.js"
  "components/header.html"
  "components/sidebar.html"
  "components/section-dashboard.html"
  "components/section-gpu-monitor.html"
  "components/section-providers.html"
  "components/section-config.html"
)

ALL_OK=true
for res in "${RESOURCES[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/$res")
  if [ "$STATUS" = "200" ]; then
    echo "  ✅ $res"
  else
    echo "  ❌ $res (HTTP $STATUS)"
    ALL_OK=false
  fi
done

if [ "$ALL_OK" = true ]; then
  echo "  所有静态资源加载成功"
else
  echo "  ⚠️ 部分资源加载失败"
fi
echo ""

# 3. 登录认证
echo "=== 3. 登录认证 ==="
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$PASS\"}")
  
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败"
  echo "响应: $LOGIN_RESPONSE"
  exit 1
fi
echo "✅ 登录成功，Token: ${TOKEN:0:30}..."
echo ""

AUTH_HEADER="Authorization: Bearer $TOKEN"

# 4. Dashboard数据
echo "=== 4. Dashboard数据 ==="
DASHBOARD=$(curl -s "$BASE_URL/api/dashboard/summary" -H "$AUTH_HEADER")
echo "$DASHBOARD" | python3 -c "
import sys, json
data = json.load(sys.stdin)

# 系统信息
sys_info = data.get('system', {})
cpu = sys_info.get('cpu', {})
mem = sys_info.get('memory', {})
print('✅ 系统信息:')
print(f\"  CPU使用率: {cpu.get('usage', 'N/A')}%\")
print(f\"  内存使用: {mem.get('usagePercent', 'N/A')}%\")
print(f\"  内存已用: {mem.get('usedBytes', 0) / 1024**3:.2f} GB\")

# Python GPU
python_data = data.get('python', {})
print(f\"✅ Python连接: {'成功' if python_data.get('success') else '失败'}\")

gpu = python_data.get('gpu', {})
if gpu.get('status') == 'available':
    print('✅ GPU监控:')
    print(f\"  型号: {gpu.get('name', 'N/A')}\")
    print(f\"  利用率: {gpu.get('utilization', 0)}%\")
    print(f\"  显存: {gpu.get('used_memory', 0) / 1024**3:.2f} / {gpu.get('total_memory', 0) / 1024**3:.2f} GB\")
    print(f\"  温度: {gpu.get('temperature', 0)}°C\")
    print(f\"  功耗: {gpu.get('power_draw', 0)}W / {gpu.get('power_limit', 0)}W\")
else:
    print(f'○ GPU状态: {gpu.get(\"status\", \"unknown\")}')
" 2>/dev/null || echo "❌ Dashboard数据获取失败"
echo ""

# 5. GPU历史数据 (用于折线图)
echo "=== 5. GPU历史数据 ==="
GPU_HISTORY=$(curl -s "$BASE_URL/api/python/gpu/history" -H "$AUTH_HEADER")
echo "$GPU_HISTORY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('success') and data.get('history'):
    history = data['history']
    print(f'✅ GPU历史数据: {len(history)} 条记录')
    if history:
        latest = history[-1]
        print(f'  最新记录:')
        print(f\"  - 时间: {latest.get('timestamp', 'N/A')}\")
        print(f\"  - 利用率: {latest.get('utilization', 0)}%\")
        print(f\"  - 温度: {latest.get('temperature', 0)}°C\")
        print(f\"  - 功耗: {latest.get('power_draw', 0)}W\")
        print(f\"  - 显存: {latest.get('used_memory', 0) / 1024**3:.2f} GB\")
else:
    print('○ 无GPU历史数据')
" 2>/dev/null || echo "❌ GPU历史数据获取失败"
echo ""

# 6. Provider状态
echo "=== 6. Provider状态 ==="
PROVIDERS=$(curl -s "$BASE_URL/api/providers/dynamic" -H "$AUTH_HEADER")
echo "$PROVIDERS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
providers = data.get('providers', {})
print(f'✅ 提供商类型: {len(providers)} 个')
for ptype, accounts in providers.items():
    healthy = sum(1 for a in accounts if a.get('isHealthy') and not a.get('isDisabled'))
    total = len(accounts)
    print(f\"  - {ptype}: {healthy}/{total} 健康\")
" 2>/dev/null || echo "❌ Provider状态获取失败"
echo ""

# 7. Token使用统计
echo "=== 7. Token使用统计 ==="
TOKEN_USAGE=$(curl -s "$BASE_URL/api/usage/tokens?range=hour" -H "$AUTH_HEADER")
echo "$TOKEN_USAGE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('✅ Token统计:')
print(f\"  总请求: {data.get('totalRequests', 0)}\")
print(f\"  总Tokens: {data.get('totalTokens', 0):,}\")
print(f\"  输入Tokens: {data.get('inputTokens', 0):,}\")
print(f\"  输出Tokens: {data.get('outputTokens', 0):,}\")
" 2>/dev/null || echo "❌ Token统计获取失败"
echo ""

# 8. 模型列表
echo "=== 8. 模型列表 ==="
MODELS=$(curl -s "$BASE_URL/api/models" -H "$AUTH_HEADER")
echo "$MODELS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
models = data.get('models', {})
if isinstance(models, dict):
    print(f'✅ 可用模型: {len(models)} 个')
    for name in list(models.keys())[:5]:
        print(f\"  - {name}\")
    if len(models) > 5:
        print(f\"  ... 还有 {len(models) - 5} 个\")
elif isinstance(models, list):
    print(f'✅ 可用模型: {len(models)} 个')
    for m in models[:5]:
        print(f\"  - {m}\")
else:
    print('○ 无模型数据')
" 2>/dev/null || echo "❌ 模型列表获取失败"
echo ""

# 9. 配置
echo "=== 9. 配置 ==="
CONFIG=$(curl -s "$BASE_URL/api/config" -H "$AUTH_HEADER")
echo "$CONFIG" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('✅ 配置:')
print(f\"  提供商: {data.get('MODEL_PROVIDER', 'N/A')}\")
print(f\"  端口: {data.get('SERVER_PORT', 'N/A')}\")
print(f\"  健康检查: {data.get('HEALTH_CHECK', {}).get('enabled', 'N/A')}\")
" 2>/dev/null || echo "❌ 配置获取失败"
echo ""

# 10. 插件
echo "=== 10. 插件 ==="
PLUGINS=$(curl -s "$BASE_URL/api/plugins" -H "$AUTH_HEADER")
echo "$PLUGINS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
plugins = data.get('plugins', [])
print(f'✅ 插件: {len(plugins)} 个')
for p in plugins:
    status = '✓ 启用' if p.get('enabled') else '○ 禁用'
    print(f\"  - {p.get('name', 'unknown')}: {status}\")
" 2>/dev/null || echo "❌ 插件获取失败"
echo ""

echo "================================================"
echo "  验证完成！"
echo "================================================"
echo ""
echo "访问地址: http://localhost:30000"
echo "登录密码: $PASS"
