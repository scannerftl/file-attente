'use strict';

const fs = require('fs');
const path = require('path');
const { LONGUEUR_MIN, validerMotDePasse, hacher, correspond, Sessions, Limiteur } = require('./outils');

/**
 * AccesAdmin — mot de passe et sessions de l'administration.
 *
 * - Le mot de passe n'est jamais stocké en clair : empreinte scrypt + sel
 *   aléatoire, dans un fichier JSON (relu à chaque vérification, si bien
 *   qu'un changement fait en ligne de commande s'applique sans redémarrer).
 * - Les sessions sont des jetons aléatoires gardés en mémoire, avec une
 *   durée d'inactivité maximale (un redémarrage du serveur déconnecte tout
 *   le monde).
 * - Protection contre les essais en série : après 5 échecs depuis une même
 *   adresse, attente imposée (1 min, puis doublée à chaque nouvel échec).
 */
class AccesAdmin {
  /**
   * @param {object} opts
   * @param {string} opts.chemin               fichier de l'empreinte du mot de passe
   * @param {string} [opts.motDePasseInitial]  mot de passe à définir s'il n'en existe aucun
   * @param {number} [opts.dureeSessionMs]     inactivité maximale d'une session
   * @param {() => number} [opts.maintenant]   horloge (tests)
   */
  constructor({ chemin, motDePasseInitial, dureeSessionMs = 8 * 3600 * 1000, maintenant = Date.now }) {
    this.chemin = chemin;
    this.dureeSessionMs = dureeSessionMs;
    this.maintenant = maintenant;
    this.sessions = new Sessions(dureeSessionMs, maintenant);
    this.limiteur = new Limiteur(maintenant);
    if (!this.estConfigure() && motDePasseInitial) this.definir(motDePasseInitial);
  }

  /* ---------- Mot de passe ---------- */

  estConfigure() {
    return fs.existsSync(this.chemin);
  }

  static valider(motDePasse) {
    validerMotDePasse(motDePasse);
  }

  definir(motDePasse) {
    const enregistrement = { ...hacher(motDePasse), maj: new Date(this.maintenant()).toISOString() };
    fs.mkdirSync(path.dirname(this.chemin), { recursive: true });
    const tmp = this.chemin + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(enregistrement, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.chemin);
  }

  verifier(motDePasse) {
    if (!this.estConfigure()) return false;
    return correspond(motDePasse, JSON.parse(fs.readFileSync(this.chemin, 'utf8')));
  }

  /* ---------- Sessions ---------- */

  ouvrirSession() {
    return this.sessions.ouvrir();
  }

  /** Vrai si la session existe et n'a pas expiré ; prolonge alors sa durée. */
  sessionValide(jeton) {
    return this.sessions.lire(jeton) !== null;
  }

  fermerSession(jeton) {
    this.sessions.fermer(jeton);
  }

  /** Ferme toutes les sessions sauf `garder` (après un changement de mot de passe). */
  fermerAutresSessions(garder) {
    this.sessions.fermerSi((_, jeton) => jeton !== garder);
  }

  /* ---------- Essais en série ---------- */

  attenteAvantEssai(adresse) { return this.limiteur.attente(adresse); }
  noterEchec(adresse) { this.limiteur.echec(adresse); }
  noterSucces(adresse) { this.limiteur.succes(adresse); }
}

AccesAdmin.LONGUEUR_MIN = LONGUEUR_MIN;
module.exports = AccesAdmin;
