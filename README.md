<img src="public/shared/logo.svg" width="64" alt="Logo" />

# Système de file d'attente d'agence

> Gestion de file d'attente pour une agence : **borne** de prise de ticket, **poste agent** pour appeler les clients, et **écran mural** qui s'actualise en temps réel.

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-ws-010101)
![SQLite](https://img.shields.io/badge/SQLite-dev-003B57?logo=sqlite&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-cible-4479A1?logo=mysql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

Implémentation complète du **dossier de conception (Phase 2)** — la mise en œuvre suit
fidèlement les modèles (MCT/MOT, diagramme de classes, séquences, états, contrats).
📄 **[Dossier de conception (PDF)](docs/Dossier-de-conception.pdf)**

---

## ✨ Fonctionnalités

- 🖥️ **Quatre interfaces** dédiées : borne, poste agent, écran mural (mode kiosque navigateur) et administration.
- 🎨 **Charte graphique** sobre (bleu marine et or), thème clair et sombre, logo et icônes SVG.
- 🏦 **Personnalisation client** : nom, logo, couleurs et messages publicitaires du client
  (ex. une banque) sur la borne et l'écran mural, réglables depuis l'administration.
- ⚡ **Temps réel** : quand un agent appelle le ticket suivant, l'écran mural s'actualise
  **instantanément** via WebSocket (repli automatique en polling 2 s).
- 🔐 **Habilitations** : chaque agent ne traite que les services pour lesquels il est habilité.
- 🎯 **Priorité configurable** : règle « le plus ancien en attente » encapsulée (patron Stratégie).
- 🧹 **Traitements automatiques** : détection des abandons (toutes les 5 min) et
  statistiques nocturnes (chaque nuit à minuit).
- 🔄 **SGBD interchangeable** : SQLite en développement, MySQL en cible — **sans toucher
  au code métier** (bascule par variable d'environnement).

## 🧩 Les interfaces

| Interface | URL | Rôle |
| --- | --- | --- |
| 🎟️ **Borne** | `/borne/` | Le client choisit un service et retire un ticket numéroté |
| 👩‍💼 **Poste agent** | `/poste/` | L'agent (avec son guichet) appelle le suivant et clôture les tickets |
| 📺 **Écran mural** | `/mural/` | Affiche le ticket appelé et les derniers appels, actualisé en temps réel |
| 📊 **Administration** | `/admin/` | Statistiques du jour, services, agents, guichets, habilitations, purge des abandons |

## 🖼️ Aperçu

**Temps réel (patron Observateur)** — quand l'agent appelle le ticket suivant, l'écran
mural se met à jour instantanément via WebSocket :

![Poste agent → écran mural en temps réel](docs/screenshots/demo-temps-reel.gif)

**Écran mural** — affichage de la salle d'attente, lisible à distance :

![Écran mural](docs/screenshots/mural.png)

| 🎟️ Borne — choix du service | 🎫 Borne — ticket émis |
| --- | --- |
| ![Borne](docs/screenshots/borne.png) | ![Ticket émis](docs/screenshots/borne-ticket.png) |

| 👩‍💼 Poste agent | 📊 Administration |
| --- | --- |
| ![Poste agent](docs/screenshots/poste.png) | ![Administration](docs/screenshots/admin.png) |

**Thème sombre** — appliqué automatiquement selon le réglage du système, ou forcé avec le
bouton en haut à droite :

| Poste agent (sombre) | Administration (sombre) |
| --- | --- |
| ![Poste agent, thème sombre](docs/screenshots/poste-sombre.png) | ![Administration, thème sombre](docs/screenshots/admin-sombre.png) |

**Accueil** — choix de l'interface à ouvrir :

![Accueil](docs/screenshots/accueil.png)

## 🎨 Charte graphique

| Élément | Valeur |
| --- | --- |
| Couleur principale | Bleu marine `#14285A` par défaut, remplacée par celle du client |
| Couleur d'accent | Or `#D4A437` par défaut (appel en cours, guichet à rejoindre) |
| Police | Inter (repli : police système) |
| Thèmes | Clair par défaut, sombre automatique (`prefers-color-scheme`) ou forcé ; écran mural toujours sombre |
| Logo | [`public/shared/logo.svg`](public/shared/logo.svg) — sert aussi de favicon |
| Icônes | Sprite SVG [`public/shared/icones.svg`](public/shared/icones.svg) (interfaces, services, actions) |

Toutes les couleurs sont des variables CSS définies dans
[`public/shared/style.css`](public/shared/style.css) : changer la couleur de marque se fait à
un seul endroit, et sont dérivées des deux couleurs du client (`--marque`, `--marque-2`)
appliquées par [`public/shared/marque.js`](public/shared/marque.js).
L'icône d'un service est choisie d'après son code dans `public/shared/theme.js`
(`iconeService`) ; un service inconnu reçoit une icône de ticket générique.

## 🏦 Personnalisation client (marque et publicité)

Les écrans publics (borne et écran mural) affichent l'identité du client de l'agence —
par exemple une banque — et ses messages publicitaires. Tout se règle dans
**Administration → Personnalisation client**, puis « Enregistrer et publier » : les écrans
ouverts se mettent à jour immédiatement (WebSocket), sans rechargement.

![Personnalisation client](docs/screenshots/personnalisation.png)

| Réglage | Effet |
| --- | --- |
| Nom, slogan | En-tête de tous les écrans et ticket imprimé |
| Logo | Image PNG, JPEG, WebP, GIF ou SVG (réduite automatiquement). Sans logo : initiales du client |
| Couleur principale | En-têtes, boutons, bandeau haut, fond teinté de l'écran mural |
| Couleur secondaire | Bandeau défilant, accents ; appel en cours sur le mural si assez visible |
| Rotation | Durée d'affichage de chaque message (3 à 120 s) |

La couleur du texte (blanc ou foncé) est calculée automatiquement pour rester lisible ;
sur l'écran mural, la couleur de l'appel en cours est choisie parmi les couleurs du
client selon son contraste avec le fond.

**Zones publicitaires** — chaque message choisit ses zones et ses écrans :

| Zone | Borne | Écran mural |
| --- | --- | --- |
| `haut` | Bandeau sous l'en-tête, messages en rotation | idem, en grand |
| `lateral` | Panneau à droite des services (avec image) | Sous les derniers appels (avec image) |
| `bas` | Bandeau défilant en pied d'écran | Bandeau défilant (remplace la consigne) |
| `ticket` | Message imprimé sur le ticket | — |
| `veille` | Écran de veille plein écran après inactivité | — |

Une zone sans message actif est masquée.

**Animations publicitaires** — chaque message peut porter un visuel : image (PNG, JPEG,
WebP, SVG), **GIF animé** (conservé tel quel) ou **vidéo MP4 / WebM** (lue sans son, en
lecture automatique ; 50 Mo maximum). Les fichiers sont envoyés depuis l'administration
et stockés dans `server/db/medias/` (variable `DOSSIER_MEDIAS`) ; ceux qui ne servent
plus sont supprimés à la publication suivante.

| Réglage | Valeurs |
| --- | --- |
| Transition entre messages | Fondu enchaîné, glissement, zoom (avec zoom lent sur les images), aucune |
| Durée d'affichage | Par défaut pour tous les messages, ou propre à un message ; une vidéo est lue jusqu'au bout |
| Vitesse du bandeau défilant | Lente, normale, rapide |
| Écran de veille (borne) | Après N secondes d'inactivité (0 = désactivé) ; le toucher qui réveille la borne ne prend pas de ticket. Aperçu : `/borne/?veille` |

Les animations sont désactivées si le système demande de réduire les mouvements
(`prefers-reduced-motion`). Des **modèles** sont fournis dans
[`server/marques/`](server/marques/) (`defaut.json`, `uba-cameroun.json` — exemple
avec des textes à remplacer) et se chargent depuis l'administration. La configuration
publiée est enregistrée dans `server/db/marque.json` (variable `CHEMIN_MARQUE`), hors
du dépôt git ; « Revenir au modèle par défaut » la supprime.

API : `GET /api/marque`, `PUT /api/marque`, `DELETE /api/marque`, `POST /api/medias`
(corps brut, type MIME en `Content-Type`),
`GET /api/marque/modeles`, `GET /api/marque/modeles/:id`.

## 🔐 Accès : administration et postes agents

| Écran | Accès |
| --- | --- |
| Borne, écran mural | Libre (écrans publics) |
| Poste agent | **Matricule + mot de passe personnel de l'agent** |
| Administration | **Mot de passe administrateur** |

Côté API, les routes du poste (`/file`, `/en-cours`, `/appeler`, `/cloturer`) exigent une
session agent, et l'appel se fait toujours **au nom de l'agent connecté** (un matricule
passé dans la requête est ignoré). Les routes d'administration (référentiel, liste des
agents, habilitations, statistiques, purge, personnalisation, médias, mots de passe des
agents) exigent une session administrateur.

### Mots de passe des agents

- L'administrateur les définit ou les réinitialise dans **Administration → Agents**
  (icône cadenas, ou champ « mot de passe » à la création d'un agent). La liste indique
  les agents qui n'en ont pas encore : ils ne peuvent pas ouvrir de poste.
- L'agent change le sien depuis son poste (bouton « Mot de passe »).
- Une réinitialisation par l'admin, un changement par l'agent ou la suppression de
  l'agent ferment ses autres sessions. Une session agent expire après 12 h
  d'inactivité ; « Fermer le poste » la termine.
- Empreintes stockées dans `server/db/agents-acces.json` (`CHEMIN_AGENTS_ACCES`), hors de
  la base : aucune migration SQLite/MySQL n'est nécessaire.

### Mot de passe administrateur

**Premier mot de passe** — au premier démarrage, il n'en existe aucun ; trois façons de
le créer :

1. ouvrir `http://localhost:3000/admin/` **sur le serveur lui-même** : la page propose
   de le créer (refusé depuis un autre poste) ;
2. lancer `npm run admin:mot-de-passe` (ou `deploiement\7-mot-de-passe-admin.bat`) sur
   le serveur : saisie masquée, deux fois ;
3. définir `ADMIN_MOT_DE_PASSE` au premier démarrage (ignoré ensuite).

Ensuite, il se change dans **Administration → Sécurité** (les autres sessions sont alors
déconnectées). En cas d'oubli, relancer la commande 2 sur le serveur : le nouveau mot de
passe s'applique sans redémarrage.

| Mesure | Détail |
| --- | --- |
| Stockage | Empreintes scrypt + sel aléatoire (`server/db/admin.json`, `server/db/agents-acces.json`), jamais en clair, hors du dépôt git |
| Session | Cookies `HttpOnly`, `SameSite=Strict` (admin et agent séparés) ; expiration après 8 h (admin) ou 12 h (agent) d'inactivité ; un redémarrage du serveur déconnecte |
| Essais en série | Après 5 échecs depuis une même adresse : attente de 1 min, doublée à chaque nouvel échec |
| Identifiants | « Matricule ou mot de passe incorrect » : le message ne révèle pas si le matricule existe |
| Requêtes d'autres sites | Les modifications venant d'une autre origine sont refusées |

> Le trafic n'est pas chiffré en HTTP simple : sur un réseau partagé, placez le serveur
> derrière un proxy HTTPS (le cookie passe alors en `Secure`).

## 🚀 Démarrage rapide

```bash
git clone https://github.com/scannerftl/file-attente.git
cd file-attente
npm install
npm start
```

Puis ouvrir dans un navigateur :

- Accueil : <http://localhost:3000/>
- Borne : <http://localhost:3000/borne/>
- Poste agent : <http://localhost:3000/poste/>
- Écran mural : <http://localhost:3000/mural/>
- Administration : <http://localhost:3000/admin/>

> 🔑 **Avant la démo** : créez le mot de passe administrateur (ouvrez `/admin/` sur la
> machine, ou démarrez avec `ADMIN_MOT_DE_PASSE=…`), puis définissez celui d'un agent
> dans **Administration → Agents** pour pouvoir ouvrir un poste.

> 💡 **Démo** : ouvrez la borne, le poste et l'écran mural côte à côte. Prenez un ticket
> sur la borne → il apparaît dans la file du poste ; cliquez « Appeler le suivant » →
> l'écran mural se met à jour instantanément.

### Référentiel de démonstration (seed)

- **Services** : `RET` (Retrait/Dépôt) · `OUV` (Ouverture de compte) · `CRE` (Crédit)
- **Agents** : `A001` Alice (RET, OUV) · `A002` Bob (RET, CRE) · `A003` Chloé (tous) —
  sans mot de passe au départ
- **Guichets** : 1, 2, 3

## 🏗️ Architecture en 3 couches

```
public/              ← PRÉSENTATION : IHM Borne / Poste agent / Écran mural / Admin
public/shared/       ← Charte : style.css (jetons de couleur), logo, icônes, thème
server/api/          ← Contrôleurs HTTP minces (traduisent HTTP ⇄ métier)
server/ws/           ← Adaptateur WebSocket (patron Observateur)
server/metier/       ← MÉTIER : GestionnaireFile, GestionHabilitation,
                       ServiceNotification, Statistiques, StrategiePriorite
server/dao/          ← ACCÈS DONNÉES : le SEUL endroit qui contient du SQL
server/db/connexion/ ← Abstraction Connexion + adaptateurs SQLite & MySQL
server/db/sql/       ← Schémas (MPD) et seed, un fichier par dialecte
```

**Contrat inter-couches** : l'IHM n'appelle que le `GestionnaireFile` ; seules ces
opérations appellent les DAO ; **aucune requête SQL hors des DAO**.

### Patrons de conception retenus

- **Observateur** — `server/metier/ServiceNotification.js` : les écrans muraux s'abonnent ;
  le serveur pousse chaque événement via WebSocket.
- **DAO** — `server/dao/*` : isole le SQL derrière une interface `Connexion` asynchrone,
  implémentée par `SqliteConnexion` (better-sqlite3) et `MysqlConnexion` (mysql2).
- **Stratégie** — `server/metier/StrategiePriorite.js` : la règle de priorité est
  encapsulée et interchangeable.

## 🛠️ Stack technique

| Couche | Choix | Mise en œuvre |
| --- | --- | --- |
| Interfaces (borne, poste, écran) | HTML / CSS / JavaScript | `public/` (kiosque navigateur) |
| Serveur (métier) | Node.js | `server/` (Express) |
| SGBD | SQLite (dev) → MySQL (cible) | `better-sqlite3` **et** `mysql2`, bascule par config |
| Communication client ⇄ serveur | API HTTP + JSON | `server/api/` |
| Push vers les écrans | WebSocket (repli polling 2 s) | `server/ws/` + `public/shared/api.js` |

## ⚙️ Configuration

Copier `.env.example` en `.env` (ou exporter les variables). Principales options :

| Variable | Défaut | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port HTTP |
| `CHEMIN_MARQUE` | `server/db/marque.json` | Fichier de la personnalisation client publiée |
| `DOSSIER_MEDIAS` | `server/db/medias/` | Images, GIF et vidéos publicitaires envoyés |
| `CHEMIN_ADMIN` | `server/db/admin.json` | Empreinte du mot de passe de l'administration |
| `ADMIN_MOT_DE_PASSE` | — | Mot de passe créé au premier démarrage s'il n'en existe aucun |
| `CHEMIN_AGENTS_ACCES` | `server/db/agents-acces.json` | Empreintes des mots de passe des agents |
| `DB_DRIVER` | `sqlite` | `sqlite` (dev) ou `mysql` (cible) |
| `DELAI_ABANDON_MIN` | `5` | Délai (min) avant qu'un ticket appelé non clôturé soit abandonné |
| `MYSQL_*` | — | Hôte, port, user, mot de passe, base (si `DB_DRIVER=mysql`) |

## 🐬 Basculer vers MySQL

La couche métier ne change pas : on choisit le SGBD par variable d'environnement.

```bash
# 1) Créer la base
mysql -u root -p -e "CREATE DATABASE file_attente CHARACTER SET utf8mb4;"

# 2) Initialiser schéma + référentiel
DB_DRIVER=mysql MYSQL_USER=root MYSQL_PASSWORD=motdepasse npm run init-db

# 3) Test de fumée : rejoue un cycle métier complet sur MySQL
DB_DRIVER=mysql MYSQL_USER=root MYSQL_PASSWORD=motdepasse npm run test:mysql

# 4) Démarrer sur MySQL
DB_DRIVER=mysql MYSQL_USER=root MYSQL_PASSWORD=motdepasse npm start
```

Seuls **3 fichiers** diffèrent entre les deux SGBD : `MysqlConnexion.js`,
`schema.mysql.sql` et `seed.mysql.sql`. Tout le reste (DAO, métier, IHM, API) est
identique — la conception était indépendante de la technique.

> `mysql2` est déclaré en `optionalDependencies` : le mode SQLite fonctionne même
> sans lui (chargement paresseux du driver).

## 📏 Règles de gestion implémentées

| Règle | Où |
| --- | --- |
| **RG2** — le plus ancien en attente | `StrategiePriorite` + `TicketDAO.plusAncienEnAttente` |
| **RG3** — parmi les services habilités | `GestionHabilitation` |
| **RG5** — n° = max du jour + 1 (repart à 1 chaque jour) | `GestionnaireFile.prendreTicket` |
| **RG6** — abandons (appelés non clôturés > délai) | `GestionnaireFile.marquerAbandons` (job 5 min) |
| **RG7** — heure_fin > heure_appel | `GestionnaireFile.cloturerTicket` |

## ✅ Tests de recette

```bash
npm test
```

`test/recette.test.js` implémente les tests **T1 → T8** (sur SQLite en mémoire) ;
`test/marque.test.js` couvre la personnalisation client (validation, modèles, médias, animations) ;
`test/acces.test.js` couvre l'accès administrateur et agents (mots de passe, sessions,
routes ouvertes et protégées, appel au nom de l'agent connecté, limitation des essais).
Pour vérifier l'adaptateur MySQL, voir `npm run test:mysql` ci-dessus.

## 🖥️ Déploiement Windows

Des scripts prêts à l'emploi et un guide pas à pas sont fournis dans
[`deploiement/`](deploiement/) (installation des dépendances, initialisation MySQL,
ouverture du pare-feu, démarrage, installation en service, mot de passe de
l'administration).

## 📄 Licence

[MIT](LICENSE)
