'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * MarqueDAO — persistance de la personnalisation client (nom, logo, couleurs,
 * messages publicitaires).
 *
 * Stockée dans un fichier JSON et non en base : c'est un réglage d'affichage,
 * indépendant du SGBD (même comportement en SQLite et en MySQL).
 * Sans fichier enregistré, on renvoie le modèle par défaut.
 * Les médias envoyés (images, GIF, vidéos) sont des fichiers d'un dossier
 * dédié, servis sous /medias/.
 */
class MarqueDAO {
  /**
   * @param {string} chemin        fichier JSON de la configuration active
   * @param {string} dossierModeles dossier des modèles (*.json)
   * @param {string} [dossierMedias] dossier des médias envoyés
   */
  constructor(chemin, dossierModeles, dossierMedias) {
    this.chemin = chemin;
    this.dossierModeles = dossierModeles;
    this.dossierMedias = dossierMedias;
  }

  lire() {
    if (this.chemin && fs.existsSync(this.chemin)) {
      return JSON.parse(fs.readFileSync(this.chemin, 'utf8'));
    }
    return this.modele('defaut');
  }

  enregistrer(config) {
    fs.mkdirSync(path.dirname(this.chemin), { recursive: true });
    const tmp = this.chemin + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
    fs.renameSync(tmp, this.chemin); // écriture atomique
  }

  supprimer() {
    if (fs.existsSync(this.chemin)) fs.unlinkSync(this.chemin);
  }

  /** Écrit un média sous un nom aléatoire ; renvoie ce nom. */
  enregistrerMedia(contenu, ext) {
    fs.mkdirSync(this.dossierMedias, { recursive: true });
    const nom = crypto.randomBytes(12).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(this.dossierMedias, nom), contenu);
    return nom;
  }

  /**
   * Supprime les médias absents de `garder`, s'ils ont plus de `ageMinMs`
   * (un média tout juste envoyé n'est pas encore référencé par la config).
   */
  supprimerMediasSauf(garder, ageMinMs = 0) {
    if (!this.dossierMedias || !fs.existsSync(this.dossierMedias)) return;
    const limite = Date.now() - ageMinMs;
    for (const nom of fs.readdirSync(this.dossierMedias)) {
      if (garder.has(nom)) continue;
      const f = path.join(this.dossierMedias, nom);
      if (fs.statSync(f).mtimeMs <= limite) fs.unlinkSync(f);
    }
  }

  /** Liste des modèles disponibles : [{ id, nom }]. */
  modeles() {
    return fs
      .readdirSync(this.dossierModeles)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const id = f.replace(/\.json$/, '');
        return { id, nom: this.modele(id).nom };
      });
  }

  modele(id) {
    if (!/^[a-z0-9-]+$/.test(id)) return null;
    const f = path.join(this.dossierModeles, id + '.json');
    if (!fs.existsSync(f)) return null;
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  }
}

module.exports = MarqueDAO;
