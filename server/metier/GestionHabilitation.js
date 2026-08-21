'use strict';

/**
 * GestionHabilitation (couche métier) — répond à « cet agent peut-il
 * traiter ce service ? » (RG3). S'appuie sur HabilitationDAO.
 */
class GestionHabilitation {
  constructor(habilitationDAO) {
    this.habilitationDAO = habilitationDAO;
  }

  /** Liste des codes de services habilités pour un agent. */
  async servicesDe(matricule) {
    return this.habilitationDAO.servicesDe(matricule);
  }

  /** RG3 — l'agent est-il habilité pour ce service ? */
  async estHabilite(matricule, codeService) {
    const services = await this.servicesDe(matricule);
    return services.includes(codeService);
  }
}

module.exports = GestionHabilitation;
