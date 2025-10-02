@echo off
REM Script para iniciar os servidores de Backend e Frontend do TVBOX

echo Iniciando servidor Backend...
start "Backend" cmd /k "cd /d c:\xampp\htdocs\TVBOX3\backend && npm start"

echo.
echo Iniciando servidor Frontend...
start "Frontend" cmd /k "cd /d c:\xampp\htdocs\TVBOX3 && npm run dev"

echo.
echo Servidores iniciados em novas janelas.