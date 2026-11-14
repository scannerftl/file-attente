'use strict';

/**
 * Briques de sécurité communes à l'administration et aux agents :
 * empreinte des mots de passe, sessions, limitation des essais.
 */
const crypto = require('crypto');

const LONGUEUR_MIN = 8;
const LONGUEUR_MAX = 128;

function erreur(message) {
  const e = new Error(message);
  e.metier = true;
  return e;
}

function validerMotDePasse(motDePasse) {
  if (typeof motDePasse !== 'string' || motDePasse.length < LONGUEUR_MIN) {
    throw erreur(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères`);
  }
  if (motDePasse.length > LONGUEUR_MAX) throw erreur(`Mot de passe trop long (${LONGUEUR_MAX} caractères maximum)`);
}

/** Empreinte scrypt avec sel aléatoire : { algo, sel, empreinte } (hexadécimal). */
function hacher(motDePasse) {
  validerMotDePasse(motDePasse);
  const sel = crypto.randomBytes(16);
  return {
    algo: 'scrypt',
    sel: sel.toString('hex'),
    empreinte: crypto.scryptSync(motDePasse, sel, 64).toString('hex'),
  };
}

/** Compare un mot de passe à une empreinte, en temps constant. */
function correspond(motDePasse, enregistrement) {
  if (!enregistrement || typeof motDePasse !== 'string' || motDePasse.length > LONGUEUR_MAX) return false;
  const attendue = Buffer.from(enregistrement.empreinte, 'hex');
  const calculee = crypto.scryptSync(motDePasse, Buffer.from(enregistrement.sel, 'hex'), attendue.length);
  return crypto.timingSafeEqual(attendue, calculee);
}

/**
 * Sessions en mémoire : jeton aléatoire → { echeance, donnees }.
 * L'échéance est repoussée à chaque utilisation (expiration par inactivité).
 */
class Sessions {
  constructor(dureeMs, maintenant = Date.now) {
    this.dureeMs = dureeMs;
    this.maintenant = maintenant;
    this.table = new Map();
  }

  ouvrir(donnees = {}) {
    const jeton = crypto.randomBytes(32).toString('hex');
    this.table.set(jeton, { echeance: this.maintenant() + this.dureeMs, donnees });
    return jeton;
  }

  /** Données de la session si elle est valide (et la prolonge), sinon null. */
  lire(jeton) {
    if (!jeton) return null;
    const s = this.table.get(jeton);
    if (!s) return null;
    if (s.echeance < this.maintenant()) {
      this.table.delete(jeton);
      return null;
    }
    s.echeance = this.maintenant() + this.dureeMs;
    return s.donnees;
  }

  fermer(jeton) {
    this.table.delete(jeton);
  }

  /** Ferme les sessions pour lesquelles `filtre(donnees, jeton)` est vrai. */
  fermerSi(filtre) {
    for (const [jeton, s] of this.table) if (filtre(s.donnees, jeton)) this.table.delete(jeton);
  }
}

/**
 * Limitation des essais en série : après `essaisLibres` échecs depuis une
 * même clé (adresse), attente imposée de 1 min, doublée à chaque nouvel
 * échec (1 h au plus).
 */
class Limiteur {
  constructor(maintenant = Date.now, essaisLibres = 5) {
    this.maintenant = maintenant;
    this.essaisLibres = essaisLibres;
    this.echecs = new Map();
  }

  /** @returns {number} secondes d'attente restantes (0 = essai autorisé) */
  attente(cle) {
    const e = this.echecs.get(cle);
    if (!e || !e.jusqua) return 0;
    return Math.max(0, Math.ceil((e.jusqua - this.maintenant()) / 1000));
  }

  echec(cle) {
    const e = this.echecs.get(cle) || { n: 0, jusqua: 0 };
    e.n += 1;
    if (e.n >= this.essaisLibres) {
      e.jusqua = this.maintenant() + Math.min(3600e3, 60e3 * 2 ** (e.n - this.essaisLibres));
    }
    this.echecs.set(cle, e);
  }

  succes(cle) {
    this.echecs.delete(cle);
  }
}

module.exports = { LONGUEUR_MIN, LONGUEUR_MAX, erreur, validerMotDePasse, hacher, correspond, Sessions, Limiteur };
