@echo off
echo 🚀 启动Excel转Markdown前端应用...
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查npm是否安装
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到npm，请检查Node.js安装
    pause
    exit /b 1
)

REM 进入前端目录
cd frontend

REM 检查package.json是否存在
if not exist package.json (
    echo ❌ 错误: 未找到package.json文件
    echo 请确保在正确的项目目录中运行此脚本
    pause
    exit /b 1
)

REM 检查node_modules是否存在
if not exist node_modules (
    echo 📦 安装依赖包...
    npm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
)

REM 检查.env文件是否存在
if not exist .env (
    echo ⚙️ 创建环境配置文件...
    copy env.example .env
    echo ✅ 已创建.env文件，请根据需要修改配置
)

echo 🌐 启动开发服务器...
echo 📱 前端地址: http://localhost:3000
echo 🔗 API地址: http://localhost:8000
echo 📖 API文档: http://localhost:8000/docs
echo.
echo 按 Ctrl+C 停止服务器
echo.

REM 启动开发服务器
npm start

pause
