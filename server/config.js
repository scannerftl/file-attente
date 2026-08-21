'use strict';

/**
 * Configuration centrale du serveur.
 * Toutes les valeurs "réglables" du dossier de conception sont ici,
 * afin de ne rien coder en dur dans la couche métier.
 */
const path = require('path');

module.exports = {
  // Réseau
  PORT: process.env.PORT || 3000,
  // 0.0.0.0 = écoute sur TOUTES les interfaces → accessible depuis le réseau
  // de l'entreprise (pas seulement en local). Mettre 127.0.0.1 pour restreindre.
  HOST: process.env.HOST || '0.0.0.0',

  // --- Choix du SGBD (Partie 5.1 : SQLite en dev, MySQL en cible) ---
  // Bascule d'un simple changement de variable d'environnement, sans toucher
  // au code métier (patron DAO). Voir server/db/connexion/.
  DB_DRIVER: process.env.DB_DRIVER || 'sqlite', // 'sqlite' | 'mysql'

  // SQLite (développement)
  CHEMIN_BDD: process.env.CHEMIN_BDD || path.join(__dirname, 'db', 'file-attente.sqlite'),

  // MySQL (cible de production)
  MYSQL: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'file_attente',
  },

  // Règles de gestion paramétrables
  DELAI_ABANDON_MIN: Number(process.env.DELAI_ABANDON_MIN || 5), // RG6 : délai avant abandon (min)

  // Planification des traitements automatiques (MOT — Partie 1.4)
  INTERVALLE_ABANDONS_MS: Number(process.env.INTERVALLE_ABANDONS_MS || 5 * 60 * 1000), // « toutes les 5 min »

  // Écran mural
  NB_APPELS_RECENTS: 5,
};
