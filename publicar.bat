@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Publicar no GitHub - JVM Dielectric Lab
cd /d "%~dp0"

echo ==============================================================
echo   PUBLICAR NO GITHUB - JVM Dielectric Lab
echo   O login e feito pelo navegador (Git Credential Manager).
echo   Nenhum token precisa ser digitado ou salvo neste arquivo.
echo ==============================================================
echo.

REM ---------------------------------------------------------------
REM 1. Verifica se o Git esta instalado
REM ---------------------------------------------------------------
where git >nul 2>nul
if errorlevel 1 (
  echo [ERRO] O Git nao esta instalado neste computador.
  echo        Baixe e instale em: https://git-scm.com/download/win
  echo        ^(mantenha as opcoes padrao, incluindo o Git Credential Manager^)
  goto :fim_erro
)

REM ---------------------------------------------------------------
REM 2. Protecao: nunca enviar node_modules, dist ou arquivos .env
REM ---------------------------------------------------------------
if not exist ".gitignore" (
  > ".gitignore" (
    echo node_modules/
    echo dist/
    echo .env
    echo .env.local
    echo .env.*.local
  )
)

REM ---------------------------------------------------------------
REM 3. Primeira publicacao nesta pasta: liga ao repositorio do GitHub
REM ---------------------------------------------------------------
if not exist ".git" (
  echo Esta pasta ainda nao esta ligada ao GitHub.
  echo.
  set "REPO_URL="
  set /p "REPO_URL=Cole a URL do repositorio (ex: https://github.com/usuario/repositorio.git): "
  if "!REPO_URL!"=="" (
    echo [ERRO] Nenhuma URL informada.
    goto :fim_erro
  )
  set "BRANCH="
  set /p "BRANCH=Branch ligado ao AI Studio [Enter = main]: "
  if "!BRANCH!"=="" set "BRANCH=main"
  git init -q
  git remote add origin "!REPO_URL!"
  git symbolic-ref HEAD refs/heads/!BRANCH!
) else (
  for /f "delims=" %%b in ('git symbolic-ref --short HEAD 2^>nul') do set "BRANCH=%%b"
  if "!BRANCH!"=="" set "BRANCH=main"
)

REM ---------------------------------------------------------------
REM 4. Identificacao do autor dos commits (pedida so uma vez)
REM ---------------------------------------------------------------
set "GIT_EMAIL="
for /f "delims=" %%e in ('git config user.email 2^>nul') do set "GIT_EMAIL=%%e"
if "!GIT_EMAIL!"=="" (
  set /p "GIT_NAME=Seu nome (para o historico do GitHub): "
  set /p "GIT_EMAIL=Seu e-mail do GitHub: "
  git config --global user.name "!GIT_NAME!"
  git config --global user.email "!GIT_EMAIL!"
)

REM ---------------------------------------------------------------
REM 5. Busca a versao atual do GitHub
REM ---------------------------------------------------------------
echo.
echo Consultando o GitHub (branch !BRANCH!)...
set "REMOTE_OK=0"
git fetch -q origin "!BRANCH!" 2>nul
if not errorlevel 1 set "REMOTE_OK=1"

if "!REMOTE_OK!"=="1" (
  set "BEHIND=0"
  git rev-parse -q --verify HEAD >nul 2>nul
  if not errorlevel 1 (
    for /f %%c in ('git rev-list --count HEAD..FETCH_HEAD 2^>nul') do set "BEHIND=%%c"
  )
  if not "!BEHIND!"=="0" (
    echo.
    echo [ATENCAO] O GitHub tem !BEHIND! alteracao^(oes^) mais nova^(s^) que esta pasta
    echo           ^(por exemplo, feitas pelo Google AI Studio^).
    echo           Se continuar, o conteudo DESTA PASTA vai substituir o do GitHub.
    echo           O historico anterior continua guardado no GitHub.
    set "CONF="
    set /p "CONF=Deseja continuar? (S/N): "
    if /i not "!CONF!"=="S" (
      echo Publicacao cancelada. Nada foi alterado no GitHub.
      goto :fim_ok
    )
  )
  REM Coloca esta pasta como nova versao sobre o historico do GitHub
  REM (sem push forcado: nada do historico e apagado)
  git update-ref refs/heads/!BRANCH! FETCH_HEAD
  git reset -q
) else (
  echo Branch !BRANCH! ainda nao existe no GitHub. Sera criado agora.
)

REM ---------------------------------------------------------------
REM 6. Prepara as alteracoes (inclui arquivos apagados)
REM ---------------------------------------------------------------
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo Nada para publicar: o GitHub ja esta igual a esta pasta.
  goto :fim_ok
)

set "N_ADD=0" & set "N_MOD=0" & set "N_DEL=0"
for /f "tokens=1" %%s in ('git diff --cached --name-status') do (
  if "%%s"=="A" set /a N_ADD+=1
  if "%%s"=="M" set /a N_MOD+=1
  if "%%s"=="D" set /a N_DEL+=1
)
echo.
echo Alteracoes a publicar: !N_ADD! novo^(s^), !N_MOD! modificado^(s^), !N_DEL! apagado^(s^)
echo.
echo Para cancelar, feche esta janela agora.
echo.

REM ---------------------------------------------------------------
REM 7. Mensagem do commit
REM ---------------------------------------------------------------
for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"`) do set "AGORA=%%d"
set "MSG="
set /p "MSG=Descricao desta versao [Enter = Atualizacao !AGORA!]: "
if "!MSG!"=="" set "MSG=Atualizacao !AGORA!"

git commit -q -m "!MSG!"
if errorlevel 1 (
  echo [ERRO] Nao foi possivel registrar as alteracoes.
  goto :fim_erro
)

REM ---------------------------------------------------------------
REM 8. Envia ao GitHub (na primeira vez abre o login no navegador)
REM ---------------------------------------------------------------
echo.
echo Enviando ao GitHub...
git push -u origin "!BRANCH!"
if errorlevel 1 (
  echo.
  echo [ERRO] O envio falhou. Verifique:
  echo   - se voce esta conectado a internet;
  echo   - se fez login na janela do GitHub que abriu no navegador;
  echo   - se sua conta tem permissao de escrita neste repositorio.
  echo Depois, execute este arquivo novamente.
  goto :fim_erro
)

echo.
echo ==============================================================
echo   PUBLICADO COM SUCESSO no branch !BRANCH!
echo.
echo   Proximo passo no Google AI Studio:
echo   Configuracoes (engrenagem) ^> aba GitHub ^> Pull
echo ==============================================================
goto :fim_ok

:fim_erro
echo.
pause
exit /b 1

:fim_ok
echo.
pause
exit /b 0
