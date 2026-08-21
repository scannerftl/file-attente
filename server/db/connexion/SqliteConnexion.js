'use strict';

const Connexion = require('./Connexion');

/**
 * Adaptateur SQLite (développement) — enveloppe better-sqlite3.
 *
 * better-sqlite3 est SYNCHRONE : on expose ses appels derrière des méthodes
 * `async` qui résolvent immédiatement, afin de respecter l'interface Connexion
 * commune avec MySQL. Aucun appel réseau, donc le coût de l'`async` est nul.
 */
class SqliteConnexion extends Connexion {
  constructor(db) {
    super();
    this.db = db;
  }

  get dialecte() {
    return 'sqlite';
  }

  async get(sql, params = []) {
    return this.db.prepare(sql).get(...params);
  }

  async all(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  async run(sql, params = []) {
    const info = this.db.prepare(sql).run(...params);
    return { lastId: Number(info.lastInsertRowid), changes: info.changes };
  }

  /**
   * Transaction. Les opérations sous-jacentes étant synchrones et l'application
   * mono-writer, un BEGIN/COMMIT manuel suffit ; en cas d'erreur on ROLLBACK.
   * La fonction reçoit cette même connexion (les get/all/run participent alors
   * à la transaction en cours).
   */
  async transaction(fn) {
    this.db.exec('BEGIN');
    try {
      const resultat = await fn(this);
      this.db.exec('COMMIT');
      return resultat;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  async executerScript(sqlMultiple) {
    this.db.exec(sqlMultiple); // better-sqlite3 gère nativement le multi-instructions
  }

  async close() {
    this.db.close();
  }
}

module.exports = SqliteConnexion;
