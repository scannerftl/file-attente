'use strict';

const fs = require('fs');
const path = require('path');

/**
 * MarqueDAO — persistance de la personnalisation client (nom, logo, couleurs,
 * messages publicitaires).
 *
 * Stockée dans un fichier JSON et non en base : c'est un réglage d'affichage,
 * indépendant du SGBD (même comportement en SQLite et en MySQL).
 * Sans fichier enregistré, on renvoie le modèle par défaut.
 */
class MarqueDAO {
  /**
   * @param {string} chemin        fichier JSON de la configuration active
   * @param {string} dossierModeles dossier des modèles (*.json)
   */
  constructor(chemin, dossierModeles) {
    this.chemin = chemin;
    this.dossierModeles = dossierModeles;
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
