<#
.SYNOPSIS
    InteFlow — 一键启动（Windows / PowerShell）。

.DESCRIPTION
    幂等：首次运行自动建 .venv、装后端/前端依赖；之后再运行直接启动。
    同时拉起后端（:8000）与前端（:5173），等后端健康后自动打开浏览器。
    在本窗口按 Ctrl-C 同时停止两端。

    相关脚本：
      .\scripts\setup.ps1   只建环境、装依赖，不启动
      .\scripts\dev.ps1     用已建好的环境直接启动（不做前置检查）
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
# 老版本 PowerShell 没有这个变量；显式关掉，避免环境把原生程序非 0 退出当成异常。
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ROOT

$BackendPort  = if ($null -ne $env:INTEFLOW_BACKEND_PORT)  { [int]$env:INTEFLOW_BACKEND_PORT }  else { 8000 }
$FrontendPort = if ($null -ne $env:INTEFLOW_FRONTEND_PORT) { [int]$env:INTEFLOW_FRONTEND_PORT } else { 5173 }
$BackendUrl   = "http://localhost:$BackendPort"
$FrontendUrl  = "http://localhost:$FrontendPort"

function Write-Ok   ($m) { Write-Host $m -ForegroundColor Green }
function Write-Info ($m) { Write-Host $m -ForegroundColor Cyan }
function Write-Warn ($m) { Write-Host $m -ForegroundColor Yellow }
function Fail       ($m) { Write-Host $m -ForegroundColor Red; exit 1 }

Write-Host "🚀 InteFlow 一键启动"
Write-Host "   根目录：$ROOT"
Write-Host ""

# --- 依赖检查 -------------------------------------------------------------
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Fail "❌ 找不到 python，请先安装 Python 3.11+：https://www.python.org/downloads/"
}
& python -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" 2>$null
if ($LASTEXITCODE -ne 0) {
    Fail "❌ 需要 Python 3.11+，当前为 $((& python -V 2>&1))"
}
foreach ($cmd in @("node", "npm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Fail "❌ 找不到 $cmd，请先安装 Node.js 18+：https://nodejs.org/"
    }
}

# --- Python 环境（缺才装） ------------------------------------------------
$venvPy = Join-Path $ROOT ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    Write-Info "📦 创建 Python 虚拟环境 .venv ..."
    & python -m venv .venv
}
& $venvPy -c "import fastapi, uvicorn, fitz" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Info "📦 安装后端依赖（backend\requirements.txt）..."
    & $venvPy -m pip install --upgrade pip | Out-Null
    & $venvPy -m pip install -r "backend\requirements.txt"
} else {
    Write-Ok "✅ 后端依赖就绪"
}

# --- 前端环境（缺才装） ---------------------------------------------------
if (-not (Test-Path "$ROOT\frontend\node_modules")) {
    Write-Info "📦 安装前端依赖（frontend\npm install）..."
    Push-Location "$ROOT\frontend"
    try { & npm install } finally { Pop-Location }
} else {
    Write-Ok "✅ 前端依赖就绪"
}

# --- 端口检查 -------------------------------------------------------------
function Test-PortBusy ([int]$Port) {
    $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}
if (Test-PortBusy $BackendPort) {
    Fail "❌ 端口 $BackendPort 已被占用。先停止占用进程，或换端口： `$env:INTEFLOW_BACKEND_PORT=8010; .\start.ps1"
}
if (Test-PortBusy $FrontendPort) {
    Fail "❌ 端口 $FrontendPort 已被占用。先停止占用进程，或换端口： `$env:INTEFLOW_FRONTEND_PORT=5174; .\start.ps1"
}

# --- 环境变量模板 ---------------------------------------------------------
if ((-not (Test-Path ".env")) -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
    Write-Ok "✅ 已生成 .env（按需修改，不影响启动）"
}

# --- 启动后端 -------------------------------------------------------------
Write-Info "🔧 启动后端 $BackendUrl ..."
$backend = Start-Process -FilePath $venvPy `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--app-dir", "`"$ROOT\backend`"", "--reload", "--port", "$BackendPort" `
    -PassThru -NoNewWindow

$healthy = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        Invoke-WebRequest -Uri "$BackendUrl/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
        $healthy = $true
        break
    } catch {
        Start-Sleep -Milliseconds 500
    }
}
if ($healthy) {
    Write-Ok "✅ 后端就绪：$BackendUrl/api/health"
} else {
    Write-Warn "⚠️  后端健康检查超时，仍继续启动前端（请查看后端日志）"
}

# --- 启动前端 -------------------------------------------------------------
Write-Info "🔧 启动前端 $FrontendUrl ..."
$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCmd) { $npmCmd = Get-Command npm -ErrorAction SilentlyContinue }
$frontend = Start-Process -FilePath $npmCmd.Source `
    -ArgumentList "run", "dev", "--", "--port", "$FrontendPort", "--strictPort" `
    -PassThru -NoNewWindow -WorkingDirectory "$ROOT\frontend"

for ($i = 0; $i -lt 60; $i++) {
    if (Test-PortBusy $FrontendPort) { break }
    Start-Sleep -Milliseconds 500
}
if ($env:INTEFLOW_NO_OPEN -ne "1") { Start-Process $FrontendUrl }

Write-Host ""
Write-Ok "🔗 前端页面：$FrontendUrl   ← 浏览器打开这个"
Write-Host "🩺 健康检查：$BackendUrl/api/health"
Write-Host "   按 Ctrl-C 停止（前后端一起退出）"
Write-Host ""

try {
    Wait-Process -Id $frontend.Id
} finally {
    Write-Warn "🛑 正在停止 InteFlow ..."
    foreach ($p in @($frontend, $backend)) {
        if ($p) { & taskkill /T /F /PID $p.Id 2>$null | Out-Null }
    }
    Write-Ok "✅ 已停止"
}
