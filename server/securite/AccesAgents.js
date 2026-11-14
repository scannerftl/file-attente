'use strict';

const fs = require('fs');
const path = require('path');
const { hacher, correspond, Sessions, Limiteur } = require('./outils');

/**
 * AccesAgents — mots de passe et sessions des agents (poste agent).
 *
 * - Un mot de passe par agent (clé : matricule), défini ou réinitialisé par
 *   l'administrateur, modifiable ensuite par l'agent lui-même.
 * - Stockés sous forme d'empreintes scrypt dans un fichier JSON, en dehors de
 *   la base : aucune migration du schéma SQLite/MySQL n'est nécessaire.
 * - Une session agent porte le matricule : le poste ne peut appeler des
 *   tickets qu'au nom de l'agent connecté.
 */
class AccesAgents {
  /**
   * @param {object} opts
   * @param {string} opts.chemin             fichier des empreintes (JSON)
   * @param {number} [opts.dureeSessionMs]   inactivité maximale d'une session (12 h)
   * @param {() => number} [opts.maintenant] horloge (tests)
   */
  constructor({ chemin, dureeSessionMs = 12 * 3600 * 1000, maintenant = Date.now }) {
    this.chemin = chemin;
    this.dureeSessionMs = dureeSessionMs;
    this.maintenant = maintenant;
    this.sessions = new Sessions(dureeSessionMs, maintenant);
    this.limiteur = new Limiteur(maintenant);
  }

  lire() {
    return fs.existsSync(this.chemin) ? JSON.parse(fs.readFileSync(this.chemin, 'utf8')) : {};
  }

  ecrire(table) {
    fs.mkdirSync(path.dirname(this.chemin), { recursive: true });
    const tmp = this.chemin + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(table, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.chemin);
  }

  /** Matricules des agents qui ont un mot de passe. */
  avecMotDePasse() {
    return new Set(Object.keys(this.lire()));
  }

  definir(matricule, motDePasse) {
    const table = this.lire();
    table[matricule] = { ...hacher(motDePasse), maj: new Date(this.maintenant()).toISOString() };
    this.ecrire(table);
  }

  verifier(matricule, motDePasse) {
    if (typeof matricule !== 'string') return false;
    const table = this.lire();
    return Object.prototype.hasOwnProperty.call(table, matricule) && correspond(motDePasse, table[matricule]);
  }

  /** Supprime le mot de passe et ferme les sessions d'un agent (agent supprimé). */
  supprimer(matricule) {
    const table = this.lire();
    if (Object.prototype.hasOwnProperty.call(table, matricule)) {
      delete table[matricule];
      this.ecrire(table);
    }
    this.fermerSessionsDe(matricule);
  }

  /* ---------- Sessions ---------- */

  ouvrirSession(matricule) {
    return this.sessions.ouvrir({ matricule });
  }

  /** Matricule de la session si elle est valide, sinon null. */
  matriculeDe(jeton) {
    const s = this.sessions.lire(jeton);
    return s ? s.matricule : null;
  }

  fermerSession(jeton) {
    this.sessions.fermer(jeton);
  }

  /** Ferme les sessions d'un agent, sauf éventuellement `garder`. */
  fermerSessionsDe(matricule, garder) {
    this.sessions.fermerSi((d, jeton) => d.matricule === matricule && jeton !== garder);
  }
}

module.exports = AccesAgents;
