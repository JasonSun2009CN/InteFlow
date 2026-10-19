@echo off
REM Windows：双击本文件即可一键启动 InteFlow。
REM 优先用 PowerShell 7（pwsh），没有则回退到系统自带 powershell。
setlocal
cd /d "%~dp0"

set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"

%PS% -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"

echo.
echo InteFlow 已退出。
pause
