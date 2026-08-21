'use strict';

/** Modèle métier Service (diagramme de classes 3.1). */
class Service {
  constructor({ code, libelle, dureeCible = 5 }) {
    this.code = code;
    this.libelle = libelle;
    this.dureeCible = dureeCible;
  }

  static depuisLigne(l) {
    if (!l) return null;
    return new Service({ code: l.code_service, libelle: l.libelle, dureeCible: l.duree_cible });
  }

  /** Durée moyenne indicative (min). Le vrai calculé vient des statistiques. */
  dureeMoyenne() {
    return this.dureeCible;
  }

  versJSON() {
    return { code: this.code, libelle: this.libelle, dureeCible: this.dureeCible };
  }
}

module.exports = Service;
