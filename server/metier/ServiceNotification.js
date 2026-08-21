'use strict';

/**
 * ServiceNotification — implémentation du patron OBSERVATEUR (Partie 3.5).
 *
 * Le GestionnaireFile notifie ce service à chaque appel ; le service diffuse
 * l'événement à tous les observateurs abonnés (écrans muraux, postes agent),
 * SANS que le métier connaisse les écrans. Ajouter un écran = abonner un
 * observateur ; aucun couplage supplémentaire.
 *
 * Un « observateur » est ici un objet capable de recevoir un événement via
 * sa méthode `notifier(evenement)` (côté serveur, un adaptateur WebSocket).
 */
class ServiceNotification {
  constructor() {
    this.observateurs = new Set();
  }

  /** Abonne un observateur. Renvoie une fonction de désabonnement. */
  abonner(observateur) {
    this.observateurs.add(observateur);
    return () => this.desabonner(observateur);
  }

  desabonner(observateur) {
    this.observateurs.delete(observateur);
  }

  get nbObservateurs() {
    return this.observateurs.size;
  }

  /**
   * Diffuse un événement à tous les observateurs.
   * @param {{type:string, [k:string]:any}} evenement
   */
  notifier(evenement) {
    for (const obs of this.observateurs) {
      try {
        obs.notifier(evenement);
      } catch (e) {
        // Un observateur défaillant (socket fermée) ne doit pas bloquer les autres.
        this.observateurs.delete(obs);
      }
    }
  }
}

module.exports = ServiceNotification;
