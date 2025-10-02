@echo off
echo Iniciando servidor backend...
start "Backend" cmd /c "cd /d c:\xampp\htdocs\TVBOX3\backend && npm start"

echo Iniciando servidor frontend...
start "Frontend" cmd /c "cd /d c:\xampp\htdocs\TVBOX3 && npm run dev"

echo Servidores iniciados em novas janelas.