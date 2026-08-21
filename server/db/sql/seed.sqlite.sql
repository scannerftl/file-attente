-- =====================================================================
--  Jeu de données initial (référentiel).
--  Les 3 services correspondent aux boutons de la maquette Borne (Partie 4.1).
--  INSERT OR IGNORE : rejouable sans erreur.
-- =====================================================================

INSERT OR IGNORE INTO Service (code_service, libelle, duree_cible) VALUES
  ('RET', 'Retrait / Dépôt',      5),
  ('OUV', 'Ouverture de compte', 15),
  ('CRE', 'Crédit',              20);

INSERT OR IGNORE INTO Agent (matricule, nom) VALUES
  ('A001', 'Alice Martin'),
  ('A002', 'Bob Durand'),
  ('A003', 'Chloé Petit');

-- Habilitations (RG3) : chaque agent ne peut appeler que ses services.
INSERT OR IGNORE INTO Habilitation (matricule, code_service) VALUES
  ('A001', 'RET'), ('A001', 'OUV'),           -- Alice : pas le Crédit
  ('A002', 'RET'), ('A002', 'CRE'),           -- Bob   : pas l'Ouverture
  ('A003', 'RET'), ('A003', 'OUV'), ('A003', 'CRE'); -- Chloé : polyvalente

INSERT OR IGNORE INTO Guichet (numero, etat) VALUES
  (1, 'ouvert'),
  (2, 'ouvert'),
  (3, 'ouvert');
