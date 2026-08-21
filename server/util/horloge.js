'use strict';

/**
 * Horloge injectable.
 *
 * La couche métier ne lit jamais `new Date()` directement : elle demande
 * l'heure à une horloge. En production on injecte l'horloge système ; dans
 * les tests de recette (T6 « il y a 10 min », T7 « appelé à 09:05 ») on
 * injecte une horloge fixe et contrôlable.
 */

/** Horloge réelle. */
const horlogeSysteme = {
  maintenant() {
    return new Date();
  },
};

/**
 * Horloge de test figée à un instant donné.
 * @param {string|Date} instant
 */
function horlogeFixe(instant) {
  let t = new Date(instant);
  return {
    maintenant() {
      return new Date(t);
    },
    /** Avance l'horloge de `minutes`. */
    avancer(minutes) {
      t = new Date(t.getTime() + minutes * 60000);
      return this;
    },
    /** Positionne l'horloge à un instant précis. */
    regler(instant2) {
      t = new Date(instant2);
      return this;
    },
  };
}

module.exports = { horlogeSysteme, horlogeFixe };
