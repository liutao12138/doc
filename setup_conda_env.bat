@echo off
echo 🔧 设置conda环境...
echo.

REM 设置环境名称
set ENV_NAME=doc_env
set PYTHON_VERSION=3.8

echo 📋 环境配置:
echo   环境名称: %ENV_NAME%
echo   Python版本: %PYTHON_VERSION%
echo.

REM 检查conda是否安装
conda --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到conda，请先安装Anaconda或Miniconda
    echo 💡 下载地址: https://docs.conda.io/en/latest/miniconda.html
    pause
    exit /b 1
)

echo ✅ conda已安装
echo.

REM 检查环境是否已存在
conda env list | findstr %ENV_NAME% >nul 2>&1
if not errorlevel 1 (
    echo ⚠️ 环境 %ENV_NAME% 已存在
    set /p recreate="是否重新创建? (y/n，默认n): "
    if /i "%recreate%"=="y" (
        echo 🗑️ 删除现有环境...
        conda env remove -n %ENV_NAME% -y
    ) else (
        echo ✅ 使用现有环境
        goto :activate_env
    )
)

echo 🆕 创建conda环境...
conda create -n %ENV_NAME% python=%PYTHON_VERSION% -y
if errorlevel 1 (
    echo ❌ 创建环境失败
    pause
    exit /b 1
)

echo ✅ 环境创建成功
echo.

:activate_env
echo 🔄 激活环境并安装依赖...
call conda activate %ENV_NAME%

echo 📦 安装Python依赖...
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ 安装Python依赖失败
    pause
    exit /b 1
)

echo ✅ Python依赖安装完成
echo.

echo 🎉 conda环境设置完成！
echo.
echo 📋 使用方法:
echo   1. 激活环境: conda activate %ENV_NAME%
echo   2. 运行启动脚本: start_all.bat
echo   3. 选择使用conda环境
echo.
echo 💡 提示: 环境已激活，可以直接运行Python命令
echo.

pause
