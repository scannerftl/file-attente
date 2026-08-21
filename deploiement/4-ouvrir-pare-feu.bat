@echo off
REM =====================================================================
REM  Etape 4 — Ouvre le port dans le pare-feu Windows (acces reseau).
REM  IMPORTANT : clic droit -> "Executer en tant qu'administrateur".
REM =====================================================================
setlocal
call "%~dp0config.env.bat"
echo Ajout d'une regle de pare-feu entrante pour le port TCP %PORT% ...
netsh advfirewall firewall add rule name="File d'attente Node (%PORT%)" dir=in action=allow protocol=TCP localport=%PORT%
echo.
echo Si vous voyez "Ok.", le port est ouvert. Sinon, relancez EN ADMINISTRATEUR.
pause
endlocal
