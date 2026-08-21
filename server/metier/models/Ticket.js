'use strict';

const { minutesEntre } = require('../../util/temps');

/**
 * Modèle métier Ticket (diagramme de classes 3.1).
 * Porte les données d'un ticket ET les règles de son cycle de vie (états 3.4).
 */
class Ticket {
  /** Les 5 statuts autorisés (diagramme d'états 3.4). */
  static ETATS = Object.freeze({
    ATTENTE: 'attente',
    APPELE: 'appele',
    EN_TRAITEMENT: 'en_traitement',
    TERMINE: 'termine',
    ABANDONNE: 'abandonne',
  });

  /**
   * Transitions valides. Toute autre transition est refusée (contrôle demandé
   * par la checklist : « valeurs autorisées de statut et transitions valides »).
   */
  static TRANSITIONS = Object.freeze({
    attente: ['appele', 'abandonne'],
    appele: ['en_traitement', 'termine', 'abandonne'],
    en_traitement: ['termine', 'abandonne'],
    termine: [],
    abandonne: [],
  });

  constructor({
    id = null,
    numero,
    date,
    codeService,
    statut = Ticket.ETATS.ATTENTE,
    heurePrise = null,
    heureAppel = null,
    heureFin = null,
    guichet = null,
  }) {
    this.id = id;
    this.numero = numero;
    this.date = date;
    this.codeService = codeService;
    this.statut = statut;
    this.heurePrise = heurePrise;
    this.heureAppel = heureAppel;
    this.heureFin = heureFin;
    this.guichet = guichet;
  }

  /** Construit un Ticket à partir d'une ligne SQL (colonnes snake_case). */
  static depuisLigne(l) {
    if (!l) return null;
    return new Ticket({
      id: l.id,
      numero: l.num_ticket,
      date: l.date_ticket,
      codeService: l.code_service,
      statut: l.statut,
      heurePrise: l.heure_prise,
      heureAppel: l.heure_appel,
      heureFin: l.heure_fin,
      guichet: l.guichet,
    });
  }

  /** La transition vers `nouveauStatut` est-elle autorisée depuis l'état courant ? */
  peutPasserA(nouveauStatut) {
    return (Ticket.TRANSITIONS[this.statut] || []).includes(nouveauStatut);
  }

  /** Temps d'attente en minutes : heure_appel − heure_prise (donnée calculée). */
  tempsAttente() {
    return minutesEntre(this.heurePrise, this.heureAppel);
  }

  /** Temps de traitement en minutes : heure_fin − heure_appel. */
  tempsTraitement() {
    return minutesEntre(this.heureAppel, this.heureFin);
  }

  /** Vue JSON destinée aux IHM. */
  versJSON() {
    return {
      id: this.id,
      numero: this.numero,
      date: this.date,
      codeService: this.codeService,
      statut: this.statut,
      heurePrise: this.heurePrise,
      heureAppel: this.heureAppel,
      heureFin: this.heureFin,
      guichet: this.guichet,
    };
  }
}

module.exports = Ticket;
