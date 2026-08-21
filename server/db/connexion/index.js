'use strict';

/**
 * Factory de connexion : choisit l'adaptateur selon le driver demandé et
 * applique le schéma + le référentiel du bon dialecte.
 *
 * C'est le SEUL endroit qui connaît les drivers concrets (better-sqlite3 /
 * mysql2). Ils sont chargés en `require` PARESSEUX : l'application tourne en
 * SQLite sans que mysql2 soit installé, et inversement.
 */
const fs = require('fs');
const path = require('path');

const SqliteConnexion = require('./SqliteConnexion');
const MysqlConnexion = require('./MysqlConnexion');

const DOSSIER_SQL = path.join(__dirname, '..', 'sql');

/** Applique schéma (+ seed) du dialecte de la connexion. */
async function initialiser(cnx, { seed = true } = {}) {
  const schema = fs.readFileSync(path.join(DOSSIER_SQL, `schema.${cnx.dialecte}.sql`), 'utf8');
  await cnx.executerScript(schema);
  if (seed) {
    const graine = fs.readFileSync(path.join(DOSSIER_SQL, `seed.${cnx.dialecte}.sql`), 'utf8');
    await cnx.executerScript(graine);
  }
}

/**
 * @param {object} opts
 * @param {'sqlite'|'mysql'} [opts.driver='sqlite']
 * @param {string}  [opts.chemin=':memory:']  (SQLite) fichier de base
 * @param {object}  [opts.mysql]              (MySQL) options de connexion
 * @param {boolean} [opts.seed=true]
 * @returns {Promise<import('./Connexion')>}
 */
async function creerConnexion(opts = {}) {
  const driver = opts.driver || 'sqlite';
  let cnx;

  if (driver === 'mysql') {
    const mysql = require('mysql2/promise'); // require paresseux
    const pool = mysql.createPool({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'file_attente',
      ...opts.mysql,
      multipleStatements: true, // nécessaire pour jouer schéma/seed d'un bloc
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: false,
    });
    cnx = new MysqlConnexion(pool);
  } else {
    const Database = require('better-sqlite3'); // require paresseux
    const chemin = opts.chemin || ':memory:';
    if (chemin !== ':memory:') {
      fs.mkdirSync(path.dirname(chemin), { recursive: true });
    }
    const db = new Database(chemin);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    cnx = new SqliteConnexion(db);
  }

  await initialiser(cnx, { seed: opts.seed !== false });
  return cnx;
}

module.exports = { creerConnexion, initialiser };
