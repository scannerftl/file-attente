@echo off
REM =====================================================================
REM  Etape 3 (facultative) — Test de fumee : rejoue un cycle metier
REM  complet (prendre -> appeler -> cloturer -> stats) sur MySQL.
REM =====================================================================
setlocal
cd /d "%~dp0.."
call "%~dp0config.env.bat"
call npm run test:mysql
echo.
pause
endlocal
