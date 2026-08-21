# Déploiement sur Windows + WampServer

Ce guide déploie le **serveur de file d'attente** sur une machine Windows où
**WampServer** est installé, et le rend **accessible depuis le réseau de
l'entreprise** (bornes, postes agent et écrans muraux se connectent au serveur).

> ⚠️ **Point clé à comprendre :** WampServer n'exécute **pas** Node.js. On
> utilise seulement sa **base MySQL/MariaDB** comme SGBD de production. Le
> serveur Node.js tourne à côté et se connecte à cette base. Apache (le serveur
> web de Wamp) **n'héberge pas** l'application — inutile d'y toucher.

---

## Architecture du déploiement

```
   Réseau entreprise (LAN)
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │  Borne (PC)  │   │ Poste agent  │   │ Écran mural  │   ← navigateurs
   │  Chrome      │   │ Chrome       │   │ Chrome       │
   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
          │  http://IP-SERVEUR:3000 (HTTP + WebSocket)      │
          └───────────────────┴────────────────────────────┘
                              ▼
        ┌───────────────────────────────────────────┐
        │      SERVEUR Windows (le PC avec Wamp)      │
        │  ┌─────────────────────┐   ┌─────────────┐  │
        │  │  Node.js  :3000     │──▶│ MySQL :3306 │  │
        │  │  (notre application)│   │  (WampServer)│  │
        │  └─────────────────────┘   └─────────────┘  │
        └───────────────────────────────────────────┘
```

---

## Prérequis (sur le serveur Windows)

1. **WampServer** installé et démarré (l'icône Wamp doit être **verte** dans la
   barre des tâches → MySQL/MariaDB tourne sur le port 3306).
2. **Node.js LTS** installé — à télécharger séparément sur <https://nodejs.org>
   (choisir « LTS », installeur `.msi`). Vérifier dans une invite de commandes :
   ```
   node --version
   npm --version
   ```

---

## Étapes

### 0) Copier le projet
Copiez le dossier **`file-attente`** complet sur le serveur, par exemple dans
`C:\file-attente`. Les scripts ci-dessous sont dans `C:\file-attente\deploiement`.

### 1) Installer les dépendances
Double-cliquez sur **`deploiement\1-installer-dependances.bat`**.
(Équivalent manuel : ouvrir une invite dans `C:\file-attente` et taper
`npm install`.)

> Si un message d'erreur mentionne `better-sqlite3`, **ignorez-le** : ce module
> ne sert qu'au mode SQLite de développement et est déclaré *optionnel*. En
> production MySQL il n'est jamais chargé.

### 2) Créer la base MySQL
Ouvrez **phpMyAdmin** (menu Wamp → *phpMyAdmin*, ou <http://localhost/phpmyadmin>).
Connectez-vous (utilisateur `root`, mot de passe **vide** par défaut sur Wamp),
puis exécutez dans l'onglet *SQL* :
```sql
CREATE DATABASE file_attente CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

### 3) Régler la configuration
Ouvrez **`deploiement\config.env.bat`** avec le Bloc-notes et vérifiez /
adaptez :
- `MYSQL_USER` / `MYSQL_PASSWORD` : les identifiants MySQL de Wamp
  (souvent `root` / *vide*). **En production, créez plutôt un utilisateur dédié**
  avec un mot de passe (voir « Sécurité » plus bas).
- `MYSQL_DATABASE=file_attente` (celle créée à l'étape 2).
- `PORT=3000` (laissez 3000 ; **n'utilisez pas 80**, déjà pris par l'Apache de
  Wamp).

### 4) Initialiser le schéma (tables + référentiel)
Double-cliquez sur **`deploiement\2-initialiser-base-mysql.bat`**.
Il crée les tables et charge les services / agents / guichets de démonstration.
Message attendu : `Base initialisée (mysql).`

### 5) (Facultatif) Tester la base
Double-cliquez sur **`deploiement\3-tester-mysql.bat`** : il rejoue un cycle
complet (prendre → appeler → clôturer → statistiques). Attendu :
`✅ Adaptateur MySQL : cycle complet OK.`

### 6) Ouvrir le pare-feu (accès réseau)
**Clic droit** sur **`deploiement\4-ouvrir-pare-feu.bat`** →
*Exécuter en tant qu'administrateur*. Cela autorise les connexions entrantes sur
le port 3000. (Manuel : *Pare-feu Windows Defender → Règles de trafic entrant →
Nouvelle règle → Port → TCP 3000 → Autoriser*.)

### 7) Démarrer le serveur
Double-cliquez sur **`deploiement\5-demarrer.bat`**. La fenêtre affiche les URLs,
dont une **`Accès réseau: http://192.168.x.x:3000/`** : c'est l'adresse que les
autres postes utiliseront. Laissez cette fenêtre ouverte.

Pour un fonctionnement **permanent** (démarrage automatique au boot, redémarrage
après plantage), préférez l'étape 8.

### 8) (Recommandé) Installer en service Windows
Pour que le serveur tourne tout le temps sans fenêtre ouverte :
1. Téléchargez **NSSM** sur <https://nssm.cc/> et placez `nssm.exe` dans le
   dossier `deploiement`.
2. **Clic droit** sur **`deploiement\6-installer-service.bat`** →
   *Exécuter en tant qu'administrateur*.

Le service `FileAttente` démarre alors automatiquement avec Windows.
Commandes : `nssm restart FileAttente`, `nssm stop FileAttente`,
`nssm remove FileAttente`.

---

## Côté clients (bornes, postes, écrans)

Sur chaque appareil du hall / guichet, ouvrez un navigateur (Chrome/Edge) à
l'adresse du serveur — remplacez `192.168.x.x` par l'IP affichée à l'étape 7 :

| Appareil        | URL                                  |
|-----------------|--------------------------------------|
| Borne tactile   | `http://192.168.x.x:3000/borne/`     |
| Poste agent     | `http://192.168.x.x:3000/poste/`     |
| Écran mural     | `http://192.168.x.x:3000/mural/`     |

Le WebSocket (mise à jour instantanée de l'écran mural) passe **automatiquement**
par la même adresse — rien à configurer.

**Mode kiosque (plein écran)** — lancer Chrome ainsi :
```
chrome.exe --kiosk --app=http://192.168.x.x:3000/borne/
```
Sur le poste agent, on peut préciser l'agent et le guichet dans l'URL :
```
http://192.168.x.x:3000/poste/?matricule=A001&guichet=1
```

> 💡 **Conseil réseau :** donnez une **IP fixe** (ou une réservation DHCP) au
> serveur, sinon son adresse peut changer et casser les URLs des clients.
> Idéalement, faites-lui pointer un nom DNS interne (ex. `file-attente`) pour
> utiliser `http://file-attente:3000/borne/`.

---

## Sécurité (production)

- **Ne pas laisser `root` sans mot de passe.** Créez un utilisateur MySQL dédié :
  ```sql
  CREATE USER 'file_app'@'localhost' IDENTIFIED BY 'un_mot_de_passe_solide';
  GRANT SELECT, INSERT, UPDATE, DELETE ON file_attente.* TO 'file_app'@'localhost';
  FLUSH PRIVILEGES;
  ```
  puis dans `config.env.bat` : `set MYSQL_USER=file_app` et
  `set MYSQL_PASSWORD=un_mot_de_passe_solide`.
- Le serveur Node écoute sur `0.0.0.0` (tout le réseau). Si vous voulez le
  restreindre, ajustez `HOST` dans `config.env.bat`.
- MySQL n'a pas besoin d'être exposé au réseau : il reste sur `localhost`, seul
  Node y accède.

---

## Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| `ECONNREFUSED` au démarrage | MySQL de Wamp non démarré (icône pas verte) ou mauvais `MYSQL_PORT`. |
| `ER_ACCESS_DENIED_ERROR` | Mauvais `MYSQL_USER`/`MYSQL_PASSWORD` dans `config.env.bat`. |
| `Unknown database 'file_attente'` | Base pas créée → refaire l'étape 2. |
| Les autres postes n'accèdent pas | Pare-feu non ouvert (étape 6, **en admin**) ; vérifier l'IP ; être sur le **même réseau**. |
| `node` non reconnu | Node.js pas installé ou invite ouverte avant l'installation → rouvrir l'invite. |
| Le port 3000 est déjà utilisé | Changer `PORT` dans `config.env.bat` (ex. 8080) et rouvrir le pare-feu sur ce port. |
| Erreur `better-sqlite3` à l'install | Sans effet en MySQL (module optionnel) — ignorer. |

---

## Récapitulatif express

```
1-installer-dependances.bat          (une fois)
   → phpMyAdmin : CREATE DATABASE file_attente ...
   → éditer config.env.bat (identifiants MySQL)
2-initialiser-base-mysql.bat         (une fois)
3-tester-mysql.bat                   (facultatif)
4-ouvrir-pare-feu.bat                (EN ADMIN, une fois)
5-demarrer.bat        OU     6-installer-service.bat (EN ADMIN)
   → clients : http://IP-SERVEUR:3000/borne  |  /poste  |  /mural
```
