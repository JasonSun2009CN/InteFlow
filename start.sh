#!/usr/bin/env bash
# InteFlow — 一键启动（macOS / Linux）
#
#   ./start.sh
#
# 幂等：首次运行自动建 .venv、装后端/前端依赖；之后再运行直接启动。
# 同时拉起后端（:8000）与前端（:5173），等后端健康后自动打开浏览器。
# 按 Ctrl-C 同时停止两端。
#
# 相关脚本：
#   ./scripts/setup.sh   只建环境、装依赖，不启动
#   ./scripts/dev.sh     用已建好的环境直接启动（不做前置检查）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
export INTEFLOW_DEV=1

BACKEND_PORT="${INTEFLOW_BACKEND_PORT:-8000}"
FRONTEND_PORT="${INTEFLOW_FRONTEND_PORT:-5173}"
BACKEND_URL="http://localhost:${BACKEND_PORT}"
FRONTEND_URL="http://localhost:${FRONTEND_PORT}"

if [ -t 1 ]; then
  C_OK=$'\033[32m'; C_INFO=$'\033[36m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_OFF=$'\033[0m'
else
  C_OK=''; C_INFO=''; C_WARN=''; C_ERR=''; C_OFF=''
fi
info() { printf '%s%s%s\n' "$C_INFO" "$*" "$C_OFF"; }
ok()   { printf '%s%s%s\n' "$C_OK"   "$*" "$C_OFF"; }
warn() { printf '%s%s%s\n' "$C_WARN" "$*" "$C_OFF"; }
die()  { printf '%s%s%s\n' "$C_ERR"  "$*" "$C_OFF" >&2; exit 1; }

printf '🚀 InteFlow 一键启动\n'
printf '   根目录：%s\n\n' "$ROOT"

# --- 依赖检查 -------------------------------------------------------------
command -v python3 >/dev/null 2>&1 \
  || die "❌ 找不到 python3，请先安装 Python 3.11+：https://www.python.org/downloads/"
if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
  die "❌ 需要 Python 3.11+，当前为 $(python3 -V 2>&1)"
fi
command -v node >/dev/null 2>&1 \
  || die "❌ 找不到 node，请先安装 Node.js 18+：https://nodejs.org/"
command -v npm >/dev/null 2>&1 \
  || die "❌ 找不到 npm，请先安装 Node.js 18+：https://nodejs.org/"

# --- Python 环境（缺才装） ------------------------------------------------
VENV_PY="$ROOT/.venv/bin/python"
if [ ! -x "$VENV_PY" ]; then
  info "📦 创建 Python 虚拟环境 .venv ..."
  python3 -m venv .venv
fi
if ! "$VENV_PY" -c 'import fastapi, uvicorn, fitz' >/dev/null 2>&1; then
  info "📦 安装后端依赖（backend/requirements.txt）..."
  "$VENV_PY" -m pip install --upgrade pip >/dev/null
  "$VENV_PY" -m pip install -r backend/requirements.txt
else
  ok "✅ 后端依赖就绪"
fi

# --- 前端环境（缺才装） ---------------------------------------------------
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  info "📦 安装前端依赖（frontend/npm install）..."
  ( cd "$ROOT/frontend" && npm install )
else
  ok "✅ 前端依赖就绪"
fi

# --- 端口检查 -------------------------------------------------------------
port_busy() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$port") >/dev/null 2>&1
  fi
}
if port_busy "$BACKEND_PORT"; then
  die "❌ 端口 ${BACKEND_PORT} 已被占用。先停止占用进程（lsof -i :${BACKEND_PORT}），或换端口：\
INTEFLOW_BACKEND_PORT=8010 ./start.sh"
fi
if port_busy "$FRONTEND_PORT"; then
  die "❌ 端口 ${FRONTEND_PORT} 已被占用。先停止占用进程（lsof -i :${FRONTEND_PORT}），或换端口：\
INTEFLOW_FRONTEND_PORT=5174 ./start.sh"
fi

# --- 环境变量模板 ---------------------------------------------------------
if [ ! -f "$ROOT/.env" ] && [ -f "$ROOT/.env.example" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  ok "✅ 已生成 .env（按需修改，不影响启动）"
fi

# --- 进程管理与退出清理 ---------------------------------------------------
pids=()
kill_tree() {
  local pid="$1" kids k
  kids="$(pgrep -P "$pid" 2>/dev/null || true)"
  for k in $kids; do kill_tree "$k"; done
  kill "$pid" 2>/dev/null || true
}
cleanup() {
  trap - INT TERM EXIT
  printf '\n%s\n' "🛑 正在停止 InteFlow ..."
  local pid
  for pid in "${pids[@]:-}"; do
    [ -n "$pid" ] && kill_tree "$pid"
  done
  wait 2>/dev/null || true
  ok "✅ 已停止"
}
trap cleanup INT TERM EXIT

# --- 启动后端 -------------------------------------------------------------
info "🔧 启动后端 ${BACKEND_URL} ..."
( exec "$VENV_PY" -m uvicorn app.main:app --app-dir "$ROOT/backend" --reload --port "$BACKEND_PORT" ) &
pids+=("$!")

healthy=0
for _ in $(seq 1 60); do
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "${BACKEND_URL}/api/health" >/dev/null 2>&1 && { healthy=1; break; }
  else
    "$VENV_PY" - "$BACKEND_URL" <<'PY' >/dev/null 2>&1 && { healthy=1; break; }
import sys, urllib.request
urllib.request.urlopen(sys.argv[1] + "/api/health", timeout=1)
PY
  fi
  sleep 0.5
done
if [ "$healthy" = "1" ]; then
  ok "✅ 后端就绪：${BACKEND_URL}/api/health"
else
  warn "⚠️  后端健康检查超时，仍继续启动前端（请查看上方后端日志）"
fi

# --- 启动前端 -------------------------------------------------------------
info "🔧 启动前端 ${FRONTEND_URL} ..."
( cd "$ROOT/frontend" && exec npm run dev -- --port "$FRONTEND_PORT" --strictPort ) &
pids+=("$!")

# --- 打开浏览器 -----------------------------------------------------------
open_browser() {
  if command -v open >/dev/null 2>&1; then
    open "$FRONTEND_URL" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$FRONTEND_URL" >/dev/null 2>&1 || true
  fi
}
if [ "${INTEFLOW_NO_OPEN:-0}" != "1" ]; then
  ( sleep 3; open_browser ) &
fi

printf '\n'
ok "🔗 前端页面：${FRONTEND_URL}   ← 浏览器打开这个"
ok "🩺 健康检查：${BACKEND_URL}/api/health"
printf '%s\n\n' "   按 Ctrl-C 停止（前后端一起退出）"

wait || true
