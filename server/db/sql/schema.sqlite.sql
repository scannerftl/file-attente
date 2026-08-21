-- =====================================================================
--  MPD — Système de file d'attente d'agence
--  Dossier de conception Phase 2, Partie 6.2 (contrats DAO)
--
--  Dialecte : SQLite (développement). Le schéma reste volontairement
--  standard (types simples, clés étrangères) pour migrer vers MySQL
--  en cible sans toucher à la couche métier (cf. patron DAO, Partie 3.5).
-- =====================================================================

PRAGMA foreign_keys = ON;

-- --- Référentiel des services (Retrait/Dépôt, Ouverture, Crédit...) ---
CREATE TABLE IF NOT EXISTS Service (
  code_service TEXT PRIMARY KEY,          -- ex. 'RET', 'OUV', 'CRE'
  libelle      TEXT    NOT NULL,
  duree_cible  INTEGER NOT NULL DEFAULT 5 -- durée indicative (min), sert d'affichage
);

-- --- Agents (personnel des guichets) ---
CREATE TABLE IF NOT EXISTS Agent (
  matricule TEXT PRIMARY KEY,
  nom       TEXT NOT NULL
);

-- --- Habilitations : quels services un agent peut-il traiter (RG3) ---
CREATE TABLE IF NOT EXISTS Habilitation (
  matricule    TEXT NOT NULL,
  code_service TEXT NOT NULL,
  PRIMARY KEY (matricule, code_service),
  FOREIGN KEY (matricule)    REFERENCES Agent(matricule)    ON DELETE CASCADE,
  FOREIGN KEY (code_service) REFERENCES Service(code_service) ON DELETE CASCADE
);

-- --- Guichets physiques ---
CREATE TABLE IF NOT EXISTS Guichet (
  numero INTEGER PRIMARY KEY,
  etat   TEXT NOT NULL DEFAULT 'ouvert'   -- 'ouvert' | 'ferme'
);

-- --- Tickets (le cœur de la file) ---
--  numero repart à 1 chaque jour (RG5) : la clé métier est (num_ticket, date_ticket).
--  Un id technique auto-incrémenté sert de clé primaire portable.
CREATE TABLE IF NOT EXISTS Ticket (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  num_ticket   INTEGER NOT NULL,
  date_ticket  TEXT    NOT NULL,          -- 'YYYY-MM-DD'
  code_service TEXT    NOT NULL,
  statut       TEXT    NOT NULL,          -- attente | appele | en_traitement | termine | abandonne
  heure_prise  TEXT    NOT NULL,          -- horodatage ISO 8601
  heure_appel  TEXT,                      -- rempli à l'appel
  heure_fin    TEXT,                      -- rempli à la clôture
  guichet      INTEGER,                   -- guichet qui a appelé
  UNIQUE (num_ticket, date_ticket),
  FOREIGN KEY (code_service) REFERENCES Service(code_service),
  FOREIGN KEY (guichet)      REFERENCES Guichet(numero)
);

-- Index qui accélère « le plus ancien en attente parmi des services » (RG2)
CREATE INDEX IF NOT EXISTS idx_ticket_file
  ON Ticket (date_ticket, statut, code_service, heure_prise);

-- --- Archive des statistiques journalières (traitement de nuit, Partie 1.3) ---
CREATE TABLE IF NOT EXISTS RapportJournalier (
  date_rapport   TEXT    NOT NULL,
  code_service   TEXT    NOT NULL,
  nb_tickets     INTEGER NOT NULL,
  attente_moy    REAL,                    -- minutes : moyenne(heure_appel - heure_prise)
  traitement_moy REAL,                    -- minutes : moyenne(heure_fin  - heure_appel)
  PRIMARY KEY (date_rapport, code_service),
  FOREIGN KEY (code_service) REFERENCES Service(code_service)
);
