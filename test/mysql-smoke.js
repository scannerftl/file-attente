'use strict';

/**
 * Test de fumée MySQL — à lancer sur un poste disposant d'un serveur MySQL.
 *
 *   1) créer la base :   CREATE DATABASE file_attente;
 *   2) exporter les identifiants (voir .env.example) puis :
 *        DB_DRIVER=mysql MYSQL_USER=root MYSQL_PASSWORD=... node test/mysql-smoke.js
 *
 * Il rejoue un cycle métier complet sur MySQL (mêmes DAO, même métier que la
 * prod) : prendre → appeler → clôturer → statistiques, et vérifie les résultats.
 * C'est la preuve que l'adaptateur MySQL est interchangeable avec SQLite sans
 * toucher au code métier (patron DAO, Partie 3.5).
 */
const assert = require('node:assert/strict');
const { creerContexte } = require('../server/contexte');
const { MYSQL } = require('../server/config');
const { dateDuJour } = require('../server/util/temps');

(async () => {
  console.log(`Connexion MySQL : ${MYSQL.user}@${MYSQL.host}:${MYSQL.port}/${MYSQL.database}`);
  const ctx = await creerContexte({ driver: 'mysql', mysql: MYSQL, seed: true });
  const { gestionnaire, statistiques, connexion } = ctx;

  try {
    assert.equal(connexion.dialecte, 'mysql');

    // 1) Prendre un ticket CRE.
    const t = await gestionnaire.prendreTicket('CRE');
    console.log('  prendreTicket ->', t.numero, t.statut);
    assert.equal(t.statut, 'attente');

    // 2) Appeler avec un agent habilité CRE (A002) au guichet 3.
    const appele = await gestionnaire.appelerSuivant('A002', 3);
    console.log('  appelerSuivant ->', appele && appele.numero, appele && appele.statut);
    assert.ok(appele && appele.statut === 'appele');
    assert.equal(appele.guichet, 3);

    // 3) Clôturer.
    await gestionnaire.cloturerTicket(appele.numero);
    const relu = await ctx.dao.ticketDAO.trouver(appele.numero, dateDuJour(new Date()));
    console.log('  cloturerTicket ->', relu.statut);
    assert.equal(relu.statut, 'termine');

    // 4) Statistiques du jour (archive dans RapportJournalier via ON DUPLICATE KEY).
    const rapport = await statistiques.calculerRapport();
    console.log('  calculerRapport ->', JSON.stringify(rapport));
    assert.ok(Array.isArray(rapport));

    console.log('\n✅ Adaptateur MySQL : cycle complet OK.');
  } finally {
    await connexion.close();
  }
})().catch((e) => {
  console.error('\n❌ Échec test MySQL :', e.message);
  process.exit(1);
});
