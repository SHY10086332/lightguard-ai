@echo off
cd /d "%~dp0"
title 光稳智检 LIGHTGUARD AI - 启动脚本
cls
echo ========================================
echo   光稳智检 LIGHTGUARD AI
echo   iCAN AI应用创新挑战赛演示系统
echo ========================================
echo.
echo [1/2] 检查 Python 环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo [启动失败] 未找到 Python，请先安装 Python 3.10 或更高版本。
    pause
    exit /b 1
)
echo [通过] Python 环境正常
echo.
echo [2/2] 检查并安装运行依赖...
python -c "import flask, torch, torchvision, PIL, cv2, numpy" >nul 2>&1
if errorlevel 1 (
    echo 正在安装缺失的依赖包，请稍候...
    python -m pip install -r requirements.txt -q
    if errorlevel 1 (
        echo [提示] 部分依赖安装失败，尝试继续启动...
    )
) else (
    echo [通过] 运行依赖完整
)
echo.
echo ========================================
echo   正在启动检测服务...
echo   访问地址：http://127.0.0.1:5000
echo   停止服务：按 Ctrl+C
echo ========================================
echo.
python -u app.py
echo.
echo 检测服务已停止。
pause
