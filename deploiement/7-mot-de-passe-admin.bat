@echo off
REM =====================================================================
REM  Etape 7 — Definit ou reinitialise le mot de passe de l'administration.
REM  A lancer sur le serveur (double-clic). Le mot de passe est saisi deux
REM  fois, sans s'afficher. Il s'applique tout de suite, sans redemarrage.
REM =====================================================================
setlocal
cd /d "%~dp0.."
call "%~dp0config.env.bat"
node server\outils\mot-de-passe-admin.js
pause
endlocal
