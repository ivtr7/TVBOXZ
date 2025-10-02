@echo off
echo ========================================
echo    TVBOX3 - Sistema de Inicializacao
echo ========================================
echo.

REM Verificar se Python esta instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Python nao encontrado!
    echo Por favor, instale Python 3.7 ou superior
    pause
    exit /b 1
)

REM Verificar se Node.js esta instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor, instale Node.js
    pause
    exit /b 1
)

echo Iniciando sistema TVBOX3...
echo.

REM Executar o script Python de inicializacao
python start_tvbox.py

echo.
echo Sistema finalizado.
pause