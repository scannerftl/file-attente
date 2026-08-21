'use strict';

const Connexion = require('./Connexion');

/**
 * Adaptateur MySQL (cible de production) — enveloppe un pool mysql2/promise.
 *
 * Réalise le même contrat Connexion que SqliteConnexion. La couche métier et
 * les DAO sont donc rigoureusement identiques quel que soit le SGBD : seule
 * cette classe (et le schéma .mysql.sql) diffère. C'est la démonstration
 * concrète du patron DAO annoncé en Partie 3.5.
 */
class MysqlConnexion extends Connexion {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  get dialecte() {
    return 'mysql';
  }

  async get(sql, params = []) {
    const [rows] = await this.pool.query(sql, params);
    return rows[0];
  }

  async all(sql, params = []) {
    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  async run(sql, params = []) {
    const [res] = await this.pool.query(sql, params);
    return { lastId: res.insertId, changes: res.affectedRows };
  }

  /**
   * Transaction sur une connexion dédiée empruntée au pool (isolation correcte,
   * contrairement à SQLite mono-fichier). La fonction reçoit un objet respectant
   * l'interface Connexion mais lié à cette connexion transactionnelle.
   */
  async transaction(fn) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const cnxTx = {
        dialecte: 'mysql',
        get: async (s, p = []) => (await conn.query(s, p))[0][0],
        all: async (s, p = []) => (await conn.query(s, p))[0],
        run: async (s, p = []) => {
          const [r] = await conn.query(s, p);
          return { lastId: r.insertId, changes: r.affectedRows };
        },
        transaction: (f) => f(cnxTx),
      };
      const resultat = await fn(cnxTx);
      await conn.commit();
      return resultat;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async executerScript(sqlMultiple) {
    // Le pool est créé avec multipleStatements: true pour jouer schéma/seed.
    await this.pool.query(sqlMultiple);
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = MysqlConnexion;
