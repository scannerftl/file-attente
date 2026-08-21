'use strict';

/**
 * Patron STRATÉGIE (optionnel, Partie 3.5).
 *
 * Encapsule la règle de priorité d'appel afin de pouvoir en changer (plus
 * ancien / clients prioritaires / ...) sans toucher au GestionnaireFile.
 *
 * Une stratégie sait choisir, parmi les tickets en attente d'un agent, le
 * prochain à appeler. La stratégie par défaut applique RG2 (le plus ancien).
 */

/** Stratégie par défaut : le plus ancien en attente (RG2). */
class PlusAncienDabord {
  /**
   * @param {import('../dao/TicketDAO')} ticketDAO
   * @param {string[]} services
   * @param {string} date
   * @returns {Promise<import('./models/Ticket')|null>}
   */
  async choisir(ticketDAO, services, date) {
    return ticketDAO.plusAncienEnAttente(services, date);
  }
}

module.exports = { PlusAncienDabord };
