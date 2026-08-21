# Système de file d'attente d'agence

Implémentation complète du **dossier de conception (Phase 2)** — mise en œuvre de
la pile technique retenue en **Partie 5** :

| Couche | Choix retenu (Partie 5) | Ici |
| --- | --- | --- |
| Interfaces (borne, poste, écran) | HTML / CSS / JavaScript | `public/` (mode kiosque navigateur) |
| Couche métier (serveur) | Node.js | `server/` (Express) |
| SGBD | SQLite (dev) puis MySQL (cible) | `better-sqlite3` **et** `mysql2`, bascule par config |
| Communication client-serveur | API HTTP + JSON | `server/api/` |
| Push vers les écrans | WebSocket (repli polling 2 s) | `server/ws/` + `public/shared/api.js` |

> Vérification annoncée en Partie 5.2 : **aucun modèle du dossier n'est modifié**.
> Seule la mise en œuvre est fixée. Le code suit fidèlement les MCT/MOT, le
> diagramme de classes, les séquences, les états et les contrats de la Partie 6.

## Architecture en 3 couches (Partie 2)

```
public/            ← Couche PRÉSENTATION : IHM Borne / Poste agent / Écran mural
server/api/        ← contrôleurs HTTP minces (ne font que traduire HTTP ⇄ métier)
server/ws/         ← adaptateur WebSocket (patron Observateur)
server/metier/     ← Couche MÉTIER : GestionnaireFile, GestionHabilitation,
                     ServiceNotification (Observateur), Statistiques, Stratégie
server/dao/        ← Couche ACCÈS DONNÉES : Ticket/Agent/Habilitation/Service/GuichetDAO
                     (le SEUL endroit qui contient du SQL)
server/db/connexion/ ← abstraction Connexion + adaptateurs SQLite & MySQL
server/db/sql/     ← schémas (MPD) et seed, un fichier par dialecte
```

Contrat inter-couches (Partie 6.2) : **l'IHM n'appelle que les opérations 6.1**
(le `GestionnaireFile`) ; **seules ces opérations appellent les DAO** ; **aucune
requête SQL hors des DAO**.

## Patrons retenus (Partie 3.5)

- **Observateur** — `server/metier/ServiceNotification.js` : les écrans muraux
  s'abonnent ; à chaque appel, le serveur pousse l'événement (via WebSocket).
- **DAO** — `server/dao/*` : isole le SQL. Les DAO parlent à une **interface
  `Connexion`** asynchrone (`server/db/connexion/`) implémentée par deux
  adaptateurs — `SqliteConnexion` (better-sqlite3) et `MysqlConnexion`
  (mysql2). Changer de SGBD ne modifie **ni les DAO ni le métier**.
- **Stratégie** (optionnel) — `server/metier/StrategiePriorite.js` : la règle de
  priorité (« le plus ancien ») est encapsulée et interchangeable.

## Installation & lancement

```bash
cd file-attente
npm install
npm start
```

Puis ouvrir dans un navigateur :

- Accueil : http://localhost:3000/
- **Borne** : http://localhost:3000/borne/
- **Poste agent** : http://localhost:3000/poste/ (choisir agent + guichet en haut)
- **Écran mural** : http://localhost:3000/mural/

Démonstration : ouvrir la borne, le poste et l'écran mural côte à côte ; prendre
un ticket sur la borne → il apparaît dans la file du poste ; cliquer « Appeler le
suivant » → l'écran mural s'actualise **instantanément** (push Observateur).

## Basculer vers MySQL (SGBD cible, Partie 5.1)

La couche métier ne change pas : on choisit le SGBD par **variable
d'environnement** (voir `.env.example`).

```bash
# 1) Créer la base côté MySQL
mysql -u root -p -e "CREATE DATABASE file_attente CHARACTER SET utf8mb4;"

# 2) Initialiser le schéma + le référentiel sur MySQL
DB_DRIVER=mysql MYSQL_USER=root MYSQL_PASSWORD=motdepasse npm run init-db

# 3) Test de fumée : rejoue un cycle métier complet sur MySQL
DB_DRIVER=mysql MYSQL_USER=root MYSQL_PASSWORD=motdepasse npm run test:mysql

# 4) Démarrer le serveur sur MySQL
DB_DRIVER=mysql MYSQL_USER=root MYSQL_PASSWORD=motdepasse npm start
```

Ce qui diffère entre les deux SGBD se limite à **3 fichiers** :
`server/db/connexion/MysqlConnexion.js`, `server/db/sql/schema.mysql.sql` et
`server/db/sql/seed.mysql.sql`. Le reste (DAO, métier, IHM, API) est identique —
c'est exactement la preuve annoncée en Partie 5.2 : la conception était
indépendante de la technique.

> `mysql2` est déclaré en `optionalDependencies` : le mode SQLite fonctionne
> même s'il n'est pas installé (chargement paresseux du driver).

## Règles de gestion implémentées

| Règle | Où |
| --- | --- |
| RG2 — le plus ancien en attente | `StrategiePriorite` + `TicketDAO.plusAncienEnAttente` |
| RG3 — parmi les services habilités | `GestionHabilitation` |
| RG5 — n° = max du jour + 1 (repart à 1 chaque jour) | `GestionnaireFile.prendreTicket` |
| RG6 — abandons (appelés non clôturés > délai) | `GestionnaireFile.marquerAbandons` (job 5 min) |
| RG7 — heure_fin > heure_appel | `GestionnaireFile.cloturerTicket` |

## Traitements automatiques (MOT, Partie 1.4)

- **Marquer les abandons** — toutes les 5 min (`server/jobs/planificateur.js`).
- **Calculer les statistiques** — chaque nuit à minuit (traitement différé,
  Partie 1.3 ; `server/metier/Statistiques.js`).

## Tests de recette (Partie 6.3)

```bash
npm test
```

Le fichier `test/recette.test.js` implémente **T1 → T8** (sur SQLite en mémoire).
Le développement est considéré terminé quand tous passent. Pour vérifier
l'adaptateur MySQL, voir `npm run test:mysql` ci-dessus.

## Référentiel de démonstration (seed)

- Services : `RET` (Retrait/Dépôt), `OUV` (Ouverture de compte), `CRE` (Crédit)
- Agents : `A001` Alice (RET, OUV) · `A002` Bob (RET, CRE) · `A003` Chloé (tous)
- Guichets : 1, 2, 3
