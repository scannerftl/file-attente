-- =====================================================================
--  Jeu de données initial (référentiel) — dialecte MySQL.
--  INSERT IGNORE : rejouable sans erreur (équivalent MySQL de
--  « INSERT OR IGNORE » côté SQLite).
-- =====================================================================

INSERT IGNORE INTO Service (code_service, libelle, duree_cible) VALUES
  ('RET', 'Retrait / Dépôt',      5),
  ('OUV', 'Ouverture de compte', 15),
  ('CRE', 'Crédit',              20);

INSERT IGNORE INTO Agent (matricule, nom) VALUES
  ('A001', 'Alice Martin'),
  ('A002', 'Bob Durand'),
  ('A003', 'Chloé Petit');

INSERT IGNORE INTO Habilitation (matricule, code_service) VALUES
  ('A001', 'RET'), ('A001', 'OUV'),
  ('A002', 'RET'), ('A002', 'CRE'),
  ('A003', 'RET'), ('A003', 'OUV'), ('A003', 'CRE');

INSERT IGNORE INTO Guichet (numero, etat) VALUES
  (1, 'ouvert'),
  (2, 'ouvert'),
  (3, 'ouvert');
