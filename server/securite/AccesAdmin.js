'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const LONGUEUR_MIN = 8;
const LONGUEUR_MAX = 128;
const ESSAIS_LIBRES = 5;
const BLOCAGE_INITIAL_MS = 60 * 1000;
const BLOCAGE_MAX_MS = 60 * 60 * 1000;

function erreur(message) {
  const e = new Error(message);
  e.metier = true;
  return e;
}

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
    this.sessions = new Map();   // jeton → échéance
    this.echecs = new Map();     // adresse → { n, jusqua }
    if (!this.estConfigure() && motDePasseInitial) this.definir(motDePasseInitial);
  }

  /* ---------- Mot de passe ---------- */

  estConfigure() {
    return fs.existsSync(this.chemin);
  }

  static valider(motDePasse) {
    if (typeof motDePasse !== 'string' || motDePasse.length < LONGUEUR_MIN) {
      throw erreur(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères`);
    }
    if (motDePasse.length > LONGUEUR_MAX) throw erreur(`Mot de passe trop long (${LONGUEUR_MAX} caractères maximum)`);
  }

  definir(motDePasse) {
    AccesAdmin.valider(motDePasse);
    const sel = crypto.randomBytes(16);
    const empreinte = crypto.scryptSync(motDePasse, sel, 64);
    fs.mkdirSync(path.dirname(this.chemin), { recursive: true });
    const tmp = this.chemin + '.tmp';
    fs.writeFileSync(
      tmp,
      JSON.stringify({ algo: 'scrypt', sel: sel.toString('hex'), empreinte: empreinte.toString('hex'), maj: new Date(this.maintenant()).toISOString() }, null, 2),
      { mode: 0o600 }
    );
    fs.renameSync(tmp, this.chemin);
  }

  verifier(motDePasse) {
    if (!this.estConfigure() || typeof motDePasse !== 'string' || motDePasse.length > LONGUEUR_MAX) return false;
    const { sel, empreinte } = JSON.parse(fs.readFileSync(this.chemin, 'utf8'));
    const attendue = Buffer.from(empreinte, 'hex');
    const calculee = crypto.scryptSync(motDePasse, Buffer.from(sel, 'hex'), attendue.length);
    return crypto.timingSafeEqual(attendue, calculee);
  }

  /* ---------- Sessions ---------- */

  ouvrirSession() {
    const jeton = crypto.randomBytes(32).toString('hex');
    this.sessions.set(jeton, this.maintenant() + this.dureeSessionMs);
    return jeton;
  }

  /** Vrai si la session existe et n'a pas expiré ; prolonge alors sa durée. */
  sessionValide(jeton) {
    if (!jeton) return false;
    const echeance = this.sessions.get(jeton);
    if (!echeance) return false;
    if (echeance < this.maintenant()) {
      this.sessions.delete(jeton);
      return false;
    }
    this.sessions.set(jeton, this.maintenant() + this.dureeSessionMs);
    return true;
  }

  fermerSession(jeton) {
    this.sessions.delete(jeton);
  }

  /** Ferme toutes les sessions sauf `garder` (après un changement de mot de passe). */
  fermerAutresSessions(garder) {
    for (const j of this.sessions.keys()) if (j !== garder) this.sessions.delete(j);
  }

  /* ---------- Essais en série ---------- */

  /** @returns {number} secondes d'attente restantes (0 = essai autorisé) */
  attenteAvantEssai(adresse) {
    const e = this.echecs.get(adresse);
    if (!e || !e.jusqua) return 0;
    return Math.max(0, Math.ceil((e.jusqua - this.maintenant()) / 1000));
  }

  noterEchec(adresse) {
    const e = this.echecs.get(adresse) || { n: 0, jusqua: 0 };
    e.n += 1;
    if (e.n >= ESSAIS_LIBRES) {
      const duree = Math.min(BLOCAGE_MAX_MS, BLOCAGE_INITIAL_MS * 2 ** (e.n - ESSAIS_LIBRES));
      e.jusqua = this.maintenant() + duree;
    }
    this.echecs.set(adresse, e);
  }

  noterSucces(adresse) {
    this.echecs.delete(adresse);
  }
}

AccesAdmin.LONGUEUR_MIN = LONGUEUR_MIN;
module.exports = AccesAdmin;
