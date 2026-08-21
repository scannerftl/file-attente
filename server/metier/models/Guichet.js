'use strict';

/** Modèle métier Guichet (diagramme de classes 3.1). */
class Guichet {
  constructor({ numero, etat = 'ouvert' }) {
    this.numero = numero;
    this.etat = etat;
  }

  static depuisLigne(l) {
    if (!l) return null;
    return new Guichet({ numero: l.numero, etat: l.etat });
  }

  estOuvert() {
    return this.etat === 'ouvert';
  }

  versJSON() {
    return { numero: this.numero, etat: this.etat };
  }
}

module.exports = Guichet;
