@echo off
REM =====================================================================
REM  Etape 1 — Installe les dependances Node (a faire une seule fois).
REM  Prerequis : Node.js LTS installe (https://nodejs.org).
REM =====================================================================
setlocal
cd /d "%~dp0.."
echo Installation des dependances (npm install)...
call npm install
echo.
echo Termine. En cas d'erreur "better-sqlite3", ignorez-la : en production
echo MySQL ce module n'est pas utilise (il est optionnel).
pause
endlocal
