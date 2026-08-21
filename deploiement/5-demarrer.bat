@echo off
REM =====================================================================
REM  Etape 5 — Demarre le serveur (a laisser ouvert pendant l'exploitation).
REM  Double-cliquez pour lancer. Fermez la fenetre pour arreter.
REM  Pour un demarrage automatique/permanent, voir 6-installer-service.bat.
REM =====================================================================
setlocal
cd /d "%~dp0.."
call "%~dp0config.env.bat"
echo Demarrage du serveur (SGBD=%DB_DRIVER%, port=%PORT%)...
echo Les URLs d'acces reseau s'affichent ci-dessous.
echo.
node server\server.js
echo.
echo *** Le serveur s'est arrete. ***
pause
endlocal
