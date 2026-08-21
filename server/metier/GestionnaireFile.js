'use strict';

const Ticket = require('./models/Ticket');
const { PlusAncienDabord } = require('./StrategiePriorite');
const { horlogeSysteme } = require('../util/horloge');
const { versISO, dateDuJour, minutesEntre } = require('../util/temps');

/**
 * GestionnaireFile — objet central de la couche métier (classe 3.1).
 *
 * Porte les opérations publiques de la Partie 6.1. C'est le SEUL composant
 * que les IHM appellent (contrat inter-couches, Partie 6.2). Il orchestre les
 * DAO, l'habilitation, la stratégie de priorité et la notification des écrans ;
 * il ne contient aucune requête SQL.
 *
 * Toutes les opérations sont asynchrones : elles dépendent des DAO, eux-mêmes
 * bâtis sur l'interface Connexion (SQLite ou MySQL, indifféremment).
 */
class GestionnaireFile {
  /**
   * @param {object} deps
   * @param {import('../dao/TicketDAO')}   deps.ticketDAO
   * @param {import('../dao/ServiceDAO')}  deps.serviceDAO
   * @param {import('../dao/GuichetDAO')}  deps.guichetDAO
   * @param {import('./GestionHabilitation')} deps.habilitation
   * @param {import('./ServiceNotification')} deps.notification
   * @param {object} [deps.horloge]   horloge injectable (tests)
   * @param {object} [deps.strategie] stratégie de priorité (patron Stratégie)
   */
  constructor({ ticketDAO, serviceDAO, guichetDAO, habilitation, notification, horloge, strategie }) {
    this.ticketDAO = ticketDAO;
    this.serviceDAO = serviceDAO;
    this.guichetDAO = guichetDAO;
    this.habilitation = habilitation;
    this.notification = notification;
    this.horloge = horloge || horlogeSysteme;
    this.strategie = strategie || new PlusAncienDabord();
  }

  // =====================================================================
  //  OPÉRATIONS PUBLIQUES — Partie 6.1
  // =====================================================================

  /**
   * prendreTicket(codeService) → Ticket
   * RG5 : n° = max du jour + 1 ; statut « attente » ; horodatage.
   * (Séquence n°2 : c'est le GestionnaireFile qui attribue le numéro.)
   */
  async prendreTicket(codeService) {
    if (!(await this.serviceDAO.existe(codeService))) {
      throw new ErreurMetier(`Service inconnu : ${codeService}`);
    }
    const maintenant = this.horloge.maintenant();
    const date = dateDuJour(maintenant);

    const numero = (await this.ticketDAO.maxNumeroDuJour(date)) + 1; // RG5
    const ticket = new Ticket({
      numero,
      date,
      codeService,
      statut: Ticket.ETATS.ATTENTE,
      heurePrise: versISO(maintenant),
    });
    await this.ticketDAO.insererTicket(ticket);

    // La file a changé : prévenir les postes agent.
    this.notification.notifier({ type: 'ticket', ticket: ticket.versJSON() });
    return ticket;
  }

  /**
   * appelerSuivant(matricule, guichet) → Ticket | null
   * RG2 (le plus ancien) parmi RG3 (services habilités) ; statut « appelé » ;
   * horodatage ; notifie les écrans (Observateur).
   * Renvoie null si l'agent n'a aucun ticket appelable (message « aucun »).
   *
   * NB : le paramètre `guichet` provient du contexte du poste (le poste est
   * rattaché à un guichet) ; il est nécessaire pour notifier « ticket → guichet ».
   */
  async appelerSuivant(matricule, guichet) {
    const services = await this.habilitation.servicesDe(matricule); // RG3
    if (services.length === 0) return null;

    const maintenant = this.horloge.maintenant();
    const date = dateDuJour(maintenant);

    const ticket = await this.strategie.choisir(this.ticketDAO, services, date); // RG2
    if (!ticket) return null; // aucun ticket en attente pour ses services

    if (!ticket.peutPasserA(Ticket.ETATS.APPELE)) {
      throw new ErreurMetier(`Transition invalide ${ticket.statut} → appele`);
    }

    const heureAppel = versISO(maintenant);
    await this.ticketDAO.majStatut(ticket.numero, date, {
      statut: Ticket.ETATS.APPELE,
      heureAppel,
      guichet,
    });
    ticket.statut = Ticket.ETATS.APPELE;
    ticket.heureAppel = heureAppel;
    ticket.guichet = guichet;

    // Patron Observateur : les écrans muraux sont notifiés sans être connus ici.
    this.notification.notifier({ type: 'appel', ticket: ticket.versJSON(), guichet });
    return ticket;
  }

  /**
   * cloturerTicket(num, dateFin) → void
   * RG7 : heure_fin > heure_appel. Statut « terminé ».
   * @param {number} num
   * @param {Date}   [dateFin]  instant de clôture (défaut : maintenant)
   */
  async cloturerTicket(num, dateFin) {
    const instant = dateFin ? new Date(dateFin) : this.horloge.maintenant();
    const date = dateDuJour(instant);

    const ticket = await this.ticketDAO.trouver(num, date);
    if (!ticket) throw new ErreurMetier(`Ticket ${num} introuvable pour le ${date}`);

    if (!ticket.peutPasserA(Ticket.ETATS.TERMINE)) {
      throw new ErreurMetier(`Transition invalide ${ticket.statut} → termine`);
    }

    const heureFin = versISO(instant);
    // RG7 : la clôture doit être postérieure à l'appel.
    if (minutesEntre(ticket.heureAppel, heureFin) <= 0) {
      throw new ErreurMetier('RG7 : heure_fin doit être postérieure à heure_appel');
    }

    await this.ticketDAO.majStatut(num, date, { statut: Ticket.ETATS.TERMINE, heureFin });
    ticket.statut = Ticket.ETATS.TERMINE;
    ticket.heureFin = heureFin;

    this.notification.notifier({ type: 'cloture', ticket: ticket.versJSON() });
  }

  /**
   * marquerAbandons(delaiMin) → nb
   * RG6 : les tickets appelés non clôturés depuis plus de `delaiMin` minutes
   * passent « abandonné ». Traitement automatique (MOT : toutes les 5 min).
   */
  async marquerAbandons(delaiMin) {
    const maintenant = this.horloge.maintenant();
    const date = dateDuJour(maintenant);
    const limiteISO = versISO(new Date(maintenant.getTime() - delaiMin * 60000));

    const candidats = await this.ticketDAO.appelesNonClotures(date, limiteISO);
    for (const t of candidats) {
      await this.ticketDAO.majStatut(t.numero, date, { statut: Ticket.ETATS.ABANDONNE });
    }
    if (candidats.length > 0) {
      this.notification.notifier({ type: 'abandons', nb: candidats.length });
    }
    return candidats.length;
  }

  /**
   * tempsAttenteMoyen(codeService, date) → minutes (réel) | null
   * Moyenne(heure_appel − heure_prise) sur les tickets terminés du service.
   * Donnée CALCULÉE, jamais stockée (Partie 6.1).
   */
  async tempsAttenteMoyen(codeService, date) {
    const tickets = (await this.ticketDAO.terminesDuJour(date)).filter(
      (t) => t.codeService === codeService && t.tempsAttente() !== null
    );
    if (tickets.length === 0) return null;
    const somme = tickets.reduce((acc, t) => acc + t.tempsAttente(), 0);
    return somme / tickets.length;
  }

  // =====================================================================
  //  LECTURES POUR LES IHM (toujours via la couche métier, jamais de SQL en IHM)
  // =====================================================================

  /** Services proposés sur la borne. */
  async servicesDisponibles() {
    return this.serviceDAO.tous();
  }

  /** File en attente des services d'un agent (poste agent). */
  async fileDeAgent(matricule) {
    const services = await this.habilitation.servicesDe(matricule);
    const date = dateDuJour(this.horloge.maintenant());
    return this.ticketDAO.listeAttente(services, date);
  }

  /** Ticket en cours à un guichet (zone « EN COURS » du poste). */
  async enCours(guichet) {
    const date = dateDuJour(this.horloge.maintenant());
    return this.ticketDAO.enCoursGuichet(guichet, date);
  }

  /** État de l'écran mural : appel courant + historique récent. */
  async etatMural(limite) {
    const date = dateDuJour(this.horloge.maintenant());
    const recents = await this.ticketDAO.appelsRecents(date, limite);
    return { courant: recents[0] || null, recents };
  }
}

/** Erreur métier « attendue » (règle non respectée), à mapper en HTTP 400. */
class ErreurMetier extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurMetier';
    this.metier = true;
  }
}

module.exports = GestionnaireFile;
module.exports.ErreurMetier = ErreurMetier;
