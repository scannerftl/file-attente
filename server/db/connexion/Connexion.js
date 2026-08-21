'use strict';

/**
 * Connexion — INTERFACE d'accès à la base (contrat unique de la couche données).
 *
 * C'est le pivot du patron DAO (Partie 3.5) : les DAO parlent à cette interface,
 * jamais à un SGBD concret. On peut donc brancher SQLite (dev) ou MySQL (cible)
 * sans toucher une ligne des DAO ni du métier.
 *
 * L'interface est ASYNCHRONE (Promises) : c'est le plus petit dénominateur
 * commun entre un driver synchrone (better-sqlite3) et un driver asynchrone
 * (mysql2). Le driver synchrone se contente de résoudre immédiatement.
 *
 * Méthodes attendues :
 *   get dialecte()                       -> 'sqlite' | 'mysql'
 *   async get(sql, params=[])            -> une ligne (objet) ou undefined
 *   async all(sql, params=[])            -> tableau de lignes
 *   async run(sql, params=[])            -> { lastId, changes }
 *   async transaction(async (cnx) => …)  -> exécute la fonction dans une transaction
 *   async executerScript(sqlMultiple)    -> joue un script SQL (schéma/seed)
 *   async close()
 *
 * Les paramètres SQL utilisent des '?' positionnels, communs à SQLite et MySQL.
 */
class Connexion {
  get dialecte() { throw new Error('non implémenté'); }
  async get() { throw new Error('non implémenté'); }
  async all() { throw new Error('non implémenté'); }
  async run() { throw new Error('non implémenté'); }
  async transaction() { throw new Error('non implémenté'); }
  async executerScript() { throw new Error('non implémenté'); }
  async close() { throw new Error('non implémenté'); }
}

module.exports = Connexion;
