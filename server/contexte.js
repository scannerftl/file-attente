'use strict';

/**
 * Assemblage des couches (composition root).
 *
 * Câble Connexion → DAO → métier en un seul endroit, par injection de
 * dépendances. Le serveur l'utilise avec SQLite ou MySQL selon la config ;
 * les tests l'utilisent avec une base en mémoire et une horloge fixe. Aucune
 * couche ne s'instancie elle-même.
 */
const { creerConnexion } = require('./db/connexion');

const TicketDAO = require('./dao/TicketDAO');
const AgentDAO = require('./dao/AgentDAO');
const HabilitationDAO = require('./dao/HabilitationDAO');
const ServiceDAO = require('./dao/ServiceDAO');
const GuichetDAO = require('./dao/GuichetDAO');
const MarqueDAO = require('./dao/MarqueDAO');

const GestionHabilitation = require('./metier/GestionHabilitation');
const ServiceNotification = require('./metier/ServiceNotification');
const GestionnaireFile = require('./metier/GestionnaireFile');
const Statistiques = require('./metier/Statistiques');
const GestionMarque = require('./metier/GestionMarque');
const path = require('path');

/**
 * @param {object} [opts]
 * @param {'sqlite'|'mysql'} [opts.driver='sqlite']
 * @param {string}  [opts.chemin=':memory:'] chemin de la base SQLite
 * @param {object}  [opts.mysql]             options de connexion MySQL
 * @param {boolean} [opts.seed=true]
 * @param {object}  [opts.horloge]           horloge injectable
 * @param {string}  [opts.cheminMarque]      fichier de personnalisation client (JSON)
 * @param {string}  [opts.dossierMedias]     dossier des médias publicitaires envoyés
 * @param {import('./db/connexion/Connexion')} [opts.connexion] connexion déjà ouverte (tests)
 * @returns {Promise<object>}
 */
async function creerContexte(opts = {}) {
  const { driver, chemin, mysql, seed = true, horloge } = opts;
  const cnx =
    opts.connexion || (await creerConnexion({ driver, chemin, mysql, seed }));

  // Couche DAO
  const ticketDAO = new TicketDAO(cnx);
  const agentDAO = new AgentDAO(cnx);
  const habilitationDAO = new HabilitationDAO(cnx);
  const serviceDAO = new ServiceDAO(cnx);
  const guichetDAO = new GuichetDAO(cnx);

  // Couche métier
  const habilitation = new GestionHabilitation(habilitationDAO);
  const notification = new ServiceNotification();
  const gestionnaire = new GestionnaireFile({
    ticketDAO,
    serviceDAO,
    guichetDAO,
    habilitation,
    notification,
    horloge,
  });
  const statistiques = new Statistiques({ ticketDAO, serviceDAO, cnx, horloge });
  const marqueDAO = new MarqueDAO(opts.cheminMarque, path.join(__dirname, 'marques'), opts.dossierMedias);
  const marque = new GestionMarque(marqueDAO, notification);

  return {
    connexion: cnx,
    dao: { ticketDAO, agentDAO, habilitationDAO, serviceDAO, guichetDAO },
    habilitation,
    notification,
    gestionnaire,
    statistiques,
    marque,
  };
}

module.exports = { creerContexte };
