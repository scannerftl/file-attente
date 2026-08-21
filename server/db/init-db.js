'use strict';

/**
 * Script utilitaire : (ré)initialise la base (schéma + référentiel).
 * Respecte DB_DRIVER : `npm run init-db` (SQLite) ou
 * `DB_DRIVER=mysql npm run init-db` (MySQL).
 */
const { creerConnexion } = require('./connexion');
const { DB_DRIVER, CHEMIN_BDD, MYSQL } = require('../config');

(async () => {
  const cnx = await creerConnexion({
    driver: DB_DRIVER,
    chemin: CHEMIN_BDD,
    mysql: MYSQL,
    seed: true,
  });

  const nbServices = (await cnx.get('SELECT COUNT(*) AS n FROM Service', [])).n;
  const nbAgents = (await cnx.get('SELECT COUNT(*) AS n FROM Agent', [])).n;
  await cnx.close();

  console.log(`Base initialisée (${DB_DRIVER}).`);
  if (DB_DRIVER === 'sqlite') console.log(`  Fichier : ${CHEMIN_BDD}`);
  else console.log(`  MySQL : ${MYSQL.user}@${MYSQL.host}:${MYSQL.port}/${MYSQL.database}`);
  console.log(`  ${nbServices} services, ${nbAgents} agents chargés.`);
})().catch((e) => {
  console.error('Échec init-db :', e.message);
  process.exit(1);
});
