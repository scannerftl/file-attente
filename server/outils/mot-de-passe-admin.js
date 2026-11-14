'use strict';

/**
 * Définit ou réinitialise le mot de passe de l'administration, depuis la
 * machine serveur (utile au premier démarrage ou en cas d'oubli).
 *
 *   npm run admin:mot-de-passe
 *
 * Le mot de passe est saisi sans écho, deux fois. Les sessions ouvertes
 * restent valides jusqu'au redémarrage du serveur ; le nouveau mot de passe
 * s'applique immédiatement aux connexions suivantes.
 */
const readline = require('readline');
const config = require('../config');
const AccesAdmin = require('../securite/AccesAdmin');

function demander(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Masque la saisie : rien n'est réécrit à l'écran pendant la frappe.
    rl._writeToOutput = (texte) => { if (texte.includes(question)) process.stdout.write(texte); };
    rl.question(question, (reponse) => {
      rl.close();
      process.stdout.write('\n');
      resolve(reponse);
    });
  });
}

async function principal() {
  if (!process.stdin.isTTY) {
    console.error('Lancez cette commande dans un terminal interactif.');
    process.exit(1);
  }
  const acces = new AccesAdmin({ chemin: config.CHEMIN_ADMIN });
  console.log(acces.estConfigure()
    ? 'Réinitialisation du mot de passe de l\'administration.'
    : 'Création du mot de passe de l\'administration.');
  console.log(`(${AccesAdmin.LONGUEUR_MIN} caractères minimum)`);

  const motDePasse = await demander('Nouveau mot de passe : ');
  try {
    AccesAdmin.valider(motDePasse);
  } catch (e) {
    console.error('✗ ' + e.message);
    process.exit(1);
  }
  const confirmation = await demander('Confirmez le mot de passe : ');
  if (confirmation !== motDePasse) {
    console.error('✗ Les deux saisies ne correspondent pas.');
    process.exit(1);
  }
  acces.definir(motDePasse);
  console.log(`✓ Mot de passe enregistré (${config.CHEMIN_ADMIN}).`);
}

principal();
