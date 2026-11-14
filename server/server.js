'use strict';

/**
 * Point d'entrée du serveur (couche métier + hébergement des IHM).
 *
 * Déploiement (Partie 2.3) : toute la couche métier, les DAO et le SGBD
 * tournent ici, sur le « Serveur agence ». Les bornes, postes et écrans ne
 * chargent que leur couche présentation (fichiers statiques servis ci-dessous)
 * et dialoguent via HTTP/JSON + WebSocket.
 *
 * Le SGBD (SQLite dev / MySQL cible) est choisi par config.DB_DRIVER : la
 * bascule ne change RIEN au reste du serveur (patron DAO, Partie 3.5).
 */
const path = require('path');
const http = require('http');
const os = require('os');
const express = require('express');

/** Adresses IPv4 « réseau » de la machine (pour afficher les URLs d'accès). */
function adressesLAN() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const nom of Object.keys(nets)) {
    for (const n of nets[nom] || []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

const config = require('./config');
const { creerContexte } = require('./contexte');
const { creerRoutes } = require('./api/routes');
const { brancherWebSocket } = require('./ws/notificationWS');
const { demarrerJobs } = require('./jobs/planificateur');

async function demarrer() {
  // 1) Assemblage des couches selon le SGBD configuré.
  const ctx = await creerContexte({
    driver: config.DB_DRIVER,
    chemin: config.CHEMIN_BDD,
    mysql: config.MYSQL,
    seed: true,
    cheminMarque: config.CHEMIN_MARQUE,
    dossierMedias: config.DOSSIER_MEDIAS,
  });

  // 2) Application Express : API + fichiers des IHM.
  const app = express();
  // Limite relevée : la personnalisation client peut contenir des images (logo, visuels).
  app.use(express.json({ limit: '12mb' }));
  app.use('/api', creerRoutes(ctx));

  // Médias publicitaires envoyés depuis l'administration. Un SVG ouvert
  // directement ne peut exécuter aucun script (CSP « sandbox »).
  app.use('/medias', express.static(config.DOSSIER_MEDIAS, {
    maxAge: '7d',
    immutable: true,
    setHeaders: (res) => {
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    },
  }));

  // Couche présentation (les 3 IHM) servie en statique.
  const racinePublic = path.join(__dirname, '..', 'public');
  app.use(express.static(racinePublic));
  app.get('/', (req, res) => res.sendFile(path.join(racinePublic, 'index.html')));

  // 3) Serveur HTTP + WebSocket (push / Observateur).
  const serveur = http.createServer(app);
  brancherWebSocket(serveur, ctx.notification);

  // 4) Traitements automatiques (MOT).
  const arreterJobs = demarrerJobs(ctx, config);

  serveur.listen(config.PORT, config.HOST, () => {
    const lignes = [
      '======================================================',
      "  Système de file d'attente — serveur démarré",
      `  SGBD        : ${config.DB_DRIVER}`,
      `  Écoute      : ${config.HOST}:${config.PORT}`,
      '  Accès local : http://localhost:' + config.PORT + '/',
    ];
    for (const ip of adressesLAN()) {
      lignes.push(`  Accès réseau: http://${ip}:${config.PORT}/  (borne | poste | mural)`);
    }
    lignes.push('======================================================');
    console.log(lignes.join('\n'));
  });

  // Arrêt propre.
  const arret = () => {
    arreterJobs();
    serveur.close(async () => {
      await ctx.connexion.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', arret);
  process.on('SIGTERM', arret);

  return { app, serveur, ctx };
}

// Démarrage direct (node server/server.js).
if (require.main === module) {
  demarrer().catch((e) => {
    console.error('Échec du démarrage :', e);
    process.exit(1);
  });
}

module.exports = { demarrer };
