@echo off
echo 🚀 启动Excel转Markdown完整服务...
echo.

REM 设置conda环境名称（如果使用conda）
set CONDA_ENV_NAME=doc

REM 检查是否使用conda环境
set /p use_conda="是否使用conda环境? (y/n，默认n): "
if "%use_conda%"=="" set use_conda=n

if /i "%use_conda%"=="y" (
    echo 🔧 使用conda环境: %CONDA_ENV_NAME%
    
    REM 检查conda是否安装
    conda --version >nul 2>&1
    if errorlevel 1 (
        echo ❌ 错误: 未找到conda，请先安装Anaconda或Miniconda
        pause
        exit /b 1
    )
    
    REM 激活conda环境
    call conda activate %CONDA_ENV_NAME%
    if errorlevel 1 (
        echo ❌ 错误: 无法激活conda环境 %CONDA_ENV_NAME%
        echo 💡 提示: 请先创建环境: conda create -n %CONDA_ENV_NAME% python=3.8
        pause
        exit /b 1
    )
    
    echo ✅ conda环境已激活: %CONDA_ENV_NAME%
) else (
    echo 🔧 使用系统Python环境
    
    REM 检查Python是否安装
    python --version >nul 2>&1
    if errorlevel 1 (
        echo ❌ 错误: 未找到Python，请先安装Python 3.8+
        pause
        exit /b 1
    )
)

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

echo 📋 启动服务列表:
echo   1. 后端API服务 (端口 8000)
echo   2. Celery Worker (后台任务处理)
echo   3. 前端应用 (端口 3000)
echo.

REM 创建启动脚本目录
if not exist scripts mkdir scripts

echo 🔧 创建启动脚本...

REM 创建后端启动脚本
echo @echo off > scripts\start_backend.bat
echo echo 启动后端API服务... >> scripts\start_backend.bat
if /i "%use_conda%"=="y" (
    echo call conda activate %CONDA_ENV_NAME% >> scripts\start_backend.bat
)
echo python -m app.api.routes >> scripts\start_backend.bat

REM 创建Celery启动脚本
echo @echo off > scripts\start_celery.bat
echo echo 启动Celery Worker... >> scripts\start_celery.bat
if /i "%use_conda%"=="y" (
    echo call conda activate %CONDA_ENV_NAME% >> scripts\start_celery.bat
)
echo celery -A app.core.celery_app.app worker --loglevel=info --queues=excel_conversion,vectorization >> scripts\start_celery.bat

REM 创建前端启动脚本
echo @echo off > scripts\start_frontend.bat
echo echo 启动前端应用... >> scripts\start_frontend.bat
echo cd frontend >> scripts\start_frontend.bat
echo npm start >> scripts\start_frontend.bat

echo ✅ 启动脚本创建完成
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
    if /i "%use_conda%"=="y" (
        start "后端API服务" cmd /k "call conda activate %CONDA_ENV_NAME% && python -m app.api.routes"
    ) else (
        start "后端API服务" cmd /k "python -m app.api.routes"
    )
    timeout /t 3 /nobreak >nul
    
    REM 启动Celery Worker
    echo ⚙️ 启动Celery Worker...
    if /i "%use_conda%"=="y" (
        start "Celery Worker" cmd /k "call conda activate %CONDA_ENV_NAME% && celery -A app.core.celery_app.app worker --loglevel=info --queues=excel_conversion,vectorization"
    ) else (
        start "Celery Worker" cmd /k "celery -A app.core.celery_app.app worker --loglevel=info --queues=excel_conversion,vectorization"
    )
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
    if /i "%use_conda%"=="y" (
        start "后端API服务" cmd /k "call conda activate %CONDA_ENV_NAME% && python -m app.api.routes"
    ) else (
        start "后端API服务" cmd /k "python -m app.api.routes"
    )
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
