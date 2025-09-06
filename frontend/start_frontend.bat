@echo off
chcp 65001 >nul
echo 🚀 启动前端应用...
echo ========================================

cd /d "%~dp0"

REM 设置环境变量
set DANGEROUSLY_DISABLE_HOST_CHECK=true
set WDS_SOCKET_HOST=localhost
set WDS_SOCKET_PORT=3000

echo 📋 环境配置:
echo   - 禁用主机检查: %DANGEROUSLY_DISABLE_HOST_CHECK%
echo   - Socket主机: %WDS_SOCKET_HOST%
echo   - Socket端口: %WDS_SOCKET_PORT%
echo.

echo 🔧 启动React开发服务器...
npm start

pause