'use strict';

/**
 * Modèle métier Agent (diagramme de classes 3.1).
 * L'habilitation (estHabilite) est déléguée à GestionHabilitation, qui
 * détient la liste des services autorisés — le modèle ne porte que l'identité.
 */
class Agent {
  constructor({ matricule, nom, services = [] }) {
    this.matricule = matricule;
    this.nom = nom;
    this.services = services; // codes des services habilités (RG3)
  }

  static depuisLigne(l) {
    if (!l) return null;
    return new Agent({ matricule: l.matricule, nom: l.nom });
  }

  /** L'agent est-il habilité pour ce service ? (RG3) */
  estHabilite(codeService) {
    return this.services.includes(codeService);
  }

  versJSON() {
    return { matricule: this.matricule, nom: this.nom, services: this.services };
  }
}

module.exports = Agent;
