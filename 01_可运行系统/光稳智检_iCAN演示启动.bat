@echo off
cd /d "%~dp0"
title 光稳智检 iCAN 演示启动
cls
echo ============================================================
echo   光稳智检 LIGHTGUARD AI
echo   iCAN AI应用创新挑战赛演示系统
echo ============================================================
echo.
echo [1/3] 正在检查 Python 环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo [启动失败] 未找到 Python，请先安装 Python 3.10 或更高版本。
    pause
    exit /b 1
)
echo [通过] Python 环境正常
echo.
echo [2/3] 正在检查运行依赖...
python -c "import flask, torch, torchvision, PIL, cv2, numpy" >nul 2>&1
if errorlevel 1 (
    echo [启动失败] 运行依赖不完整，请先执行 start.bat 完成依赖安装。
    pause
    exit /b 1
)
echo [通过] 运行依赖完整
echo.
echo [3/3] 正在启动检测服务...
echo [访问地址] http://127.0.0.1:5000
echo [停止服务] 按 Ctrl+C
echo.
echo ------------------------------------------------------------
python -u app.py 2>nul
echo ------------------------------------------------------------
echo.
echo 检测服务已停止。
pause
