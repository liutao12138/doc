@echo off
echo 🚀 使用conda环境启动Excel转Markdown服务...
echo.

REM 设置conda环境名称
set CONDA_ENV_NAME=doc_env

REM 检查conda是否安装
conda --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到conda，请先安装Anaconda或Miniconda
    echo 💡 提示: 运行 setup_conda_env.bat 来设置环境
    pause
    exit /b 1
)

REM 检查环境是否存在
conda env list | findstr %CONDA_ENV_NAME% >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: conda环境 %CONDA_ENV_NAME% 不存在
    echo 💡 提示: 运行 setup_conda_env.bat 来创建环境
    pause
    exit /b 1
)

echo ✅ 找到conda环境: %CONDA_ENV_NAME%
echo.

echo 🎯 选择启动方式:
echo   1. 启动所有服务 (推荐)
echo   2. 仅启动后端服务
echo   3. 仅启动前端服务
echo   4. 退出
echo.

set /p choice="请输入选择 (1-4): "

if "%choice%"=="1" (
    echo 🚀 启动所有服务...
    echo.
    echo 将在新窗口中启动各个服务，请保持所有窗口打开
    echo.
    
    REM 启动后端API服务
    echo 📡 启动后端API服务...
    start "后端API服务" cmd /k "call conda activate %CONDA_ENV_NAME% && python -m app.api.routes"
    timeout /t 3 /nobreak >nul
    
    REM 启动Celery Worker
    echo ⚙️ 启动Celery Worker...
    start "Celery Worker" cmd /k "call conda activate %CONDA_ENV_NAME% && celery -A app.core.celery_app.app worker --loglevel=info --queues=excel_conversion,vectorization"
    timeout /t 3 /nobreak >nul
    
    REM 启动前端应用
    echo 🌐 启动前端应用...
    start "前端应用" cmd /k "cd frontend && npm start"
    
    echo.
    echo ✅ 所有服务已启动！
    echo.
    echo 📱 访问地址:
    echo   前端应用: http://localhost:3000
    echo   后端API: http://localhost:8000
    echo   API文档: http://localhost:8000/docs
    echo.
    echo 💡 提示: 关闭服务时请关闭对应的命令行窗口
    echo.
    
) else if "%choice%"=="2" (
    echo 📡 启动后端服务...
    start "后端API服务" cmd /k "call conda activate %CONDA_ENV_NAME% && python -m app.api.routes"
    echo ✅ 后端服务已启动: http://localhost:8000
    
) else if "%choice%"=="3" (
    echo 🌐 启动前端服务...
    start "前端应用" cmd /k "cd frontend && npm start"
    echo ✅ 前端服务已启动: http://localhost:3000
    
) else if "%choice%"=="4" (
    echo 👋 退出
    exit /b 0
    
) else (
    echo ❌ 无效选择
)

echo.
pause
