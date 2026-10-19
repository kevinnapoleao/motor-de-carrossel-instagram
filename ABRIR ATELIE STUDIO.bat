@echo off
setlocal
cd /d "%~dp0"

echo Atelie Studio - servidor local
netstat -ano | findstr "127.0.0.1:3000" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Iniciando o servidor nesta sessao do Windows...
  start "Atelie Studio - servidor local" cmd /k "cd /d ""%~dp0"" && npm run dev"
) else (
  echo Ja existe um servidor ouvindo na porta 3000.
)

for /L %%i in (1,1,25) do (
  netstat -ano | findstr "127.0.0.1:3000" | findstr "LISTENING" >nul
  if not errorlevel 1 goto :open
  timeout /t 1 /nobreak >nul
)

echo O servidor nao abriu a porta 3000 em 25 segundos.
echo Confira a janela "Atelie Studio - servidor local" para ver o erro.
pause
exit /b 1

:open
echo Abrindo http://127.0.0.1:3000
start "" http://127.0.0.1:3000
endlocal
