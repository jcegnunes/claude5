@echo off
setlocal EnableExtensions EnableDelayedExpansion
title JVM Dielectric Lab - Executar localmente
cd /d "%~dp0"

echo ==============================================================
echo   JVM DIELECTRIC LAB - EXECUTAR NO COMPUTADOR
echo   Endereco: http://localhost:3000
echo   Para encerrar: feche esta janela ou pressione Ctrl+C
echo ==============================================================
echo.

REM 1. Confere se esta pasta e o projeto
if not exist "package.json" (
  echo [ERRO] package.json nao encontrado.
  echo        Coloque o executar.bat dentro da pasta extraida do projeto.
  goto :fim_erro
)

REM 2. Confere se o Node.js esta instalado
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] O Node.js nao esta instalado neste computador.
  echo        Baixe a versao LTS em: https://nodejs.org
  echo        Instale com as opcoes padrao e execute este arquivo novamente.
  start "" "https://nodejs.org"
  goto :fim_erro
)
for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
echo Node.js !NODE_VER! encontrado.

REM 3. Instala as dependencias na primeira vez ou quando o package.json mudar
set "PRECISA_INSTALAR=0"
if not exist "node_modules" set "PRECISA_INSTALAR=1"
if exist "node_modules" (
  for /f %%r in ('powershell -NoProfile -Command "if ((Get-Item package.json).LastWriteTime -gt (Get-Item node_modules).LastWriteTime) { 1 } else { 0 }"') do set "PRECISA_INSTALAR=%%r"
)
if "!PRECISA_INSTALAR!"=="1" (
  echo.
  echo Instalando dependencias - pode levar alguns minutos na primeira vez...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao instalar as dependencias. Confira a internet e tente de novo.
    goto :fim_erro
  )
  REM marca a instalacao como atualizada
  powershell -NoProfile -Command "(Get-Item node_modules).LastWriteTime = Get-Date" >nul 2>nul
)

REM 4. Mostra o endereco para abrir no celular na mesma rede Wi-Fi
set "IP_LOCAL="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1).IPAddress"`) do set "IP_LOCAL=%%i"
echo.
echo ==============================================================
echo   No computador:  http://localhost:3000
if not "!IP_LOCAL!"=="" echo   No celular ^(mesmo Wi-Fi^):  http://!IP_LOCAL!:3000
echo ==============================================================
echo.

REM 5. Abre o navegador alguns segundos depois e inicia o servidor
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:3000'"
call npm run dev
goto :fim_ok

:fim_erro
echo.
pause
exit /b 1

:fim_ok
echo.
pause
exit /b 0
