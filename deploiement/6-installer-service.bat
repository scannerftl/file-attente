@echo off
REM =====================================================================
REM  Etape 6 (recommandee en prod) — Installe le serveur comme SERVICE
REM  Windows (demarre au boot, redemarre en cas de plantage).
REM
REM  Utilise NSSM (gratuit) : telechargez nssm.exe sur https://nssm.cc/
REM  et placez-le dans ce dossier "deploiement" (ou dans le PATH).
REM  Clic droit -> "Executer en tant qu'administrateur".
REM =====================================================================
setlocal
call "%~dp0config.env.bat"
set SERVICE=FileAttente
set RACINE=%~dp0..

REM Localise nssm.exe (dossier courant sinon PATH)
set NSSM=%~dp0nssm.exe
if not exist "%NSSM%" set NSSM=nssm

REM Localise node.exe
set NODE_EXE=
for /f "delims=" %%i in ('where node') do set NODE_EXE=%%i

echo Installation du service %SERVICE% ...
"%NSSM%" install %SERVICE% "%NODE_EXE%" "%RACINE%\server\server.js"
"%NSSM%" set %SERVICE% AppDirectory "%RACINE%"
"%NSSM%" set %SERVICE% DisplayName "Systeme de file d'attente (Node)"
"%NSSM%" set %SERVICE% Start SERVICE_AUTO_START
"%NSSM%" set %SERVICE% AppEnvironmentExtra DB_DRIVER=%DB_DRIVER% MYSQL_HOST=%MYSQL_HOST% MYSQL_PORT=%MYSQL_PORT% MYSQL_USER=%MYSQL_USER% MYSQL_PASSWORD=%MYSQL_PASSWORD% MYSQL_DATABASE=%MYSQL_DATABASE% PORT=%PORT% HOST=%HOST%
"%NSSM%" start %SERVICE%

echo.
echo Service installe. Commandes utiles :
echo    nssm restart %SERVICE%     (redemarrer)
echo    nssm stop %SERVICE%        (arreter)
echo    nssm remove %SERVICE%      (desinstaller)
pause
endlocal
