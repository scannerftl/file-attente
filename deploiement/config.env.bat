@echo off
REM =====================================================================
REM  Configuration du deploiement Windows — A ADAPTER a votre serveur.
REM  Ce fichier est appele (call) par les autres scripts .bat.
REM =====================================================================

REM --- SGBD : 'mysql' en production (base MySQL de WampServer) ---
set DB_DRIVER=mysql

REM --- Connexion a la base MySQL de WampServer ---
set MYSQL_HOST=localhost
set MYSQL_PORT=3306
set MYSQL_USER=root
REM  Mot de passe root de MySQL Wamp (VIDE par defaut sur une install neuve).
set MYSQL_PASSWORD=
set MYSQL_DATABASE=file_attente

REM --- Port d'ecoute du serveur Node (evitez 80 : deja pris par Apache/Wamp) ---
set PORT=3000

REM --- Interface d'ecoute : 0.0.0.0 = accessible sur tout le reseau ---
set HOST=0.0.0.0

REM --- Delai avant abandon d'un ticket appele non cloture (minutes, RG6) ---
set DELAI_ABANDON_MIN=5
