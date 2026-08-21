@echo off
REM =====================================================================
REM  Etape 2 — Cree le schema + le referentiel dans la base MySQL.
REM  Prerequis : la base doit exister (voir le guide : CREATE DATABASE).
REM =====================================================================
setlocal
cd /d "%~dp0.."
call "%~dp0config.env.bat"
echo Initialisation du schema sur %MYSQL_USER%@%MYSQL_HOST%:%MYSQL_PORT%/%MYSQL_DATABASE% ...
call npm run init-db
echo.
pause
endlocal
