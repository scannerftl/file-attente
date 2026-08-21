'use strict';

const Ticket = require('../metier/models/Ticket');

/** Fabrique une liste de « ? » pour une clause IN (...). */
function placeholders(n) {
  return Array(n).fill('?').join(',');
}

/**
 * TicketDAO — accès aux données des tickets (Partie 6.2).
 * C'est le seul endroit où vit le SQL relatif aux tickets. Il parle à
 * l'interface Connexion (asynchrone), donc le même code fonctionne sur SQLite
 * comme sur MySQL — seule la Connexion injectée change (patron DAO).
 */
class TicketDAO {
  constructor(cnx) {
    this.cnx = cnx;
  }

  /** RG5 — dernier numéro attribué pour ce jour (0 si aucun). */
  async maxNumeroDuJour(date) {
    const l = await this.cnx.get(
      'SELECT COALESCE(MAX(num_ticket), 0) AS m FROM Ticket WHERE date_ticket = ?',
      [date]
    );
    return l.m;
  }

  /** Crée le ticket et le renvoie complété de son id. */
  async insererTicket(ticket) {
    const r = await this.cnx.run(
      `INSERT INTO Ticket
         (num_ticket, date_ticket, code_service, statut, heure_prise, heure_appel, heure_fin, guichet)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticket.numero,
        ticket.date,
        ticket.codeService,
        ticket.statut,
        ticket.heurePrise,
        ticket.heureAppel,
        ticket.heureFin,
        ticket.guichet,
      ]
    );
    ticket.id = r.lastId;
    return ticket;
  }

  /**
   * RG2/RG3 — le plus ancien ticket en attente parmi une liste de services.
   * @param {string[]} services  codes de services habilités
   * @param {string}   date      jour courant
   * @returns {Promise<Ticket|null>}
   */
  async plusAncienEnAttente(services, date) {
    if (!services || services.length === 0) return null;
    const l = await this.cnx.get(
      `SELECT * FROM Ticket
        WHERE date_ticket = ?
          AND statut = 'attente'
          AND code_service IN (${placeholders(services.length)})
        ORDER BY heure_prise ASC
        LIMIT 1`,
      [date, ...services]
    );
    return Ticket.depuisLigne(l);
  }

  /** Retrouve un ticket par sa clé métier (numéro + jour). */
  async trouver(numero, date) {
    const l = await this.cnx.get(
      'SELECT * FROM Ticket WHERE num_ticket = ? AND date_ticket = ?',
      [numero, date]
    );
    return Ticket.depuisLigne(l);
  }

  /**
   * Change l'état d'un ticket et horodate (opération majStatut, Partie 6.2).
   * @param {number} numero
   * @param {string} date
   * @param {{statut?:string, heureAppel?:string, heureFin?:string, guichet?:number}} champs
   */
  async majStatut(numero, date, champs) {
    const sets = [];
    const vals = [];
    if (champs.statut !== undefined) { sets.push('statut = ?'); vals.push(champs.statut); }
    if (champs.heureAppel !== undefined) { sets.push('heure_appel = ?'); vals.push(champs.heureAppel); }
    if (champs.heureFin !== undefined) { sets.push('heure_fin = ?'); vals.push(champs.heureFin); }
    if (champs.guichet !== undefined) { sets.push('guichet = ?'); vals.push(champs.guichet); }
    if (sets.length === 0) return 0;

    vals.push(numero, date);
    const r = await this.cnx.run(
      `UPDATE Ticket SET ${sets.join(', ')} WHERE num_ticket = ? AND date_ticket = ?`,
      vals
    );
    return r.changes;
  }

  // ---- Requêtes de lecture pour les IHM et les traitements automatiques ----

  /** File d'attente (statut 'attente') pour un ensemble de services — poste agent. */
  async listeAttente(services, date) {
    if (!services || services.length === 0) return [];
    const rows = await this.cnx.all(
      `SELECT * FROM Ticket
        WHERE date_ticket = ?
          AND statut = 'attente'
          AND code_service IN (${placeholders(services.length)})
        ORDER BY heure_prise ASC`,
      [date, ...services]
    );
    return rows.map(Ticket.depuisLigne);
  }

  /** Ticket « en cours » (appelé ou en traitement) à un guichet donné. */
  async enCoursGuichet(guichet, date) {
    const l = await this.cnx.get(
      `SELECT * FROM Ticket
        WHERE date_ticket = ? AND guichet = ?
          AND statut IN ('appele', 'en_traitement')
        ORDER BY heure_appel DESC
        LIMIT 1`,
      [date, guichet]
    );
    return Ticket.depuisLigne(l);
  }

  /** Derniers appels du jour — écran mural (« APPELS RÉCENTS »). */
  async appelsRecents(date, limite) {
    const rows = await this.cnx.all(
      `SELECT * FROM Ticket
        WHERE date_ticket = ? AND heure_appel IS NOT NULL
        ORDER BY heure_appel DESC
        LIMIT ?`,
      [date, limite]
    );
    return rows.map(Ticket.depuisLigne);
  }

  /**
   * RG6 — tickets appelés mais non clôturés dont l'appel est antérieur à `limiteISO`.
   * (candidats à l'abandon)
   */
  async appelesNonClotures(date, limiteISO) {
    const rows = await this.cnx.all(
      `SELECT * FROM Ticket
        WHERE date_ticket = ? AND statut = 'appele' AND heure_appel < ?`,
      [date, limiteISO]
    );
    return rows.map(Ticket.depuisLigne);
  }

  /** Tickets terminés d'un jour (base des statistiques). */
  async terminesDuJour(date) {
    const rows = await this.cnx.all(
      `SELECT * FROM Ticket WHERE date_ticket = ? AND statut = 'termine'`,
      [date]
    );
    return rows.map(Ticket.depuisLigne);
  }
}

module.exports = TicketDAO;
