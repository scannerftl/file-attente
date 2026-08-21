-- =====================================================================
--  MPD — Système de file d'attente d'agence — dialecte MySQL (cible)
--
--  Même modèle logique que la version SQLite (schema.sqlite.sql) : seuls
--  les types et quelques mots-clés changent. Aucun impact sur la couche
--  métier, qui ne connaît que l'interface Connexion (patron DAO, Partie 3.5).
--
--  Les horodatages sont stockés en texte ISO 8601 (VARCHAR) exactement comme
--  en SQLite : la logique JavaScript de calcul des durées reste identique.
-- =====================================================================

CREATE TABLE IF NOT EXISTS Service (
  code_service VARCHAR(10)  NOT NULL PRIMARY KEY,
  libelle      VARCHAR(100) NOT NULL,
  duree_cible  INT          NOT NULL DEFAULT 5
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Agent (
  matricule VARCHAR(10)  NOT NULL PRIMARY KEY,
  nom       VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Habilitation (
  matricule    VARCHAR(10) NOT NULL,
  code_service VARCHAR(10) NOT NULL,
  PRIMARY KEY (matricule, code_service),
  FOREIGN KEY (matricule)    REFERENCES Agent(matricule)     ON DELETE CASCADE,
  FOREIGN KEY (code_service) REFERENCES Service(code_service) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Guichet (
  numero INT         NOT NULL PRIMARY KEY,
  etat   VARCHAR(10) NOT NULL DEFAULT 'ouvert'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Ticket (
  id           INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  num_ticket   INT         NOT NULL,
  date_ticket  CHAR(10)    NOT NULL,          -- 'YYYY-MM-DD'
  code_service VARCHAR(10) NOT NULL,
  statut       VARCHAR(15) NOT NULL,          -- attente | appele | en_traitement | termine | abandonne
  heure_prise  VARCHAR(30) NOT NULL,          -- horodatage ISO 8601
  heure_appel  VARCHAR(30) NULL,
  heure_fin    VARCHAR(30) NULL,
  guichet      INT         NULL,
  UNIQUE KEY uq_ticket_jour (num_ticket, date_ticket),
  KEY idx_ticket_file (date_ticket, statut, code_service, heure_prise),
  FOREIGN KEY (code_service) REFERENCES Service(code_service),
  FOREIGN KEY (guichet)      REFERENCES Guichet(numero)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS RapportJournalier (
  date_rapport   CHAR(10)    NOT NULL,
  code_service   VARCHAR(10) NOT NULL,
  nb_tickets     INT         NOT NULL,
  attente_moy    DOUBLE      NULL,            -- minutes : moyenne(heure_appel - heure_prise)
  traitement_moy DOUBLE      NULL,            -- minutes : moyenne(heure_fin  - heure_appel)
  PRIMARY KEY (date_rapport, code_service),
  FOREIGN KEY (code_service) REFERENCES Service(code_service)
) ENGINE=InnoDB;
