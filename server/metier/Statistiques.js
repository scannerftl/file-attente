'use strict';

const { dateDuJour } = require('../util/temps');
const { horlogeSysteme } = require('../util/horloge');

/**
 * Statistiques (couche métier) — traitement DIFFÉRÉ « calcul des statistiques »
 * (Partie 1.3 : déclencheur temporel « il est minuit », seul traitement sans
 * acteur humain). Lit tous les tickets terminés du jour, calcule les temps
 * moyens d'attente et de traitement par service, puis archive le rapport.
 *
 * Dépend de l'interface Connexion : le SEUL point spécifique au dialecte est la
 * syntaxe d'« upsert » (ON CONFLICT côté SQLite, ON DUPLICATE KEY côté MySQL),
 * choisie dynamiquement via `cnx.dialecte`.
 */
class Statistiques {
  constructor({ ticketDAO, serviceDAO, cnx, horloge }) {
    this.ticketDAO = ticketDAO;
    this.serviceDAO = serviceDAO;
    this.cnx = cnx;
    this.horloge = horloge || horlogeSysteme;
  }

  /** Renvoie la requête d'upsert adaptée au SGBD courant. */
  _sqlUpsert() {
    if (this.cnx.dialecte === 'mysql') {
      return `INSERT INTO RapportJournalier (date_rapport, code_service, nb_tickets, attente_moy, traitement_moy)
              VALUES (?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
                nb_tickets = VALUES(nb_tickets),
                attente_moy = VALUES(attente_moy),
                traitement_moy = VALUES(traitement_moy)`;
    }
    // SQLite
    return `INSERT INTO RapportJournalier (date_rapport, code_service, nb_tickets, attente_moy, traitement_moy)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(date_rapport, code_service) DO UPDATE SET
              nb_tickets = excluded.nb_tickets,
              attente_moy = excluded.attente_moy,
              traitement_moy = excluded.traitement_moy`;
  }

  /**
   * Calcule le rapport d'un jour et l'archive dans RapportJournalier.
   * @param {string} [date] jour à traiter (défaut : aujourd'hui)
   */
  async calculerRapport(date) {
    const jour = date || dateDuJour(this.horloge.maintenant());
    const tickets = await this.ticketDAO.terminesDuJour(jour);
    const services = await this.serviceDAO.tous();

    // Regroupement par service.
    const parService = new Map();
    for (const s of services) parService.set(s.code, { attentes: [], traitements: [] });
    for (const t of tickets) {
      if (!parService.has(t.codeService)) {
        parService.set(t.codeService, { attentes: [], traitements: [] });
      }
      const g = parService.get(t.codeService);
      const att = t.tempsAttente();
      const trt = t.tempsTraitement();
      if (att !== null) g.attentes.push(att);
      if (trt !== null) g.traitements.push(trt);
    }

    const moyenne = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    const rapport = [];
    for (const [code, g] of parService) {
      const nb = Math.max(g.attentes.length, g.traitements.length);
      if (nb === 0) continue; // pas de ticket terminé pour ce service ce jour-là
      rapport.push({
        codeService: code,
        nbTickets: nb,
        attenteMoy: moyenne(g.attentes),
        traitementMoy: moyenne(g.traitements),
      });
    }

    // Archivage transactionnel.
    const sql = this._sqlUpsert();
    await this.cnx.transaction(async (tx) => {
      for (const l of rapport) {
        await tx.run(sql, [jour, l.codeService, l.nbTickets, l.attenteMoy, l.traitementMoy]);
      }
    });

    return rapport;
  }

  /** Relit un rapport déjà archivé. */
  async lireRapport(date) {
    return this.cnx.all(
      'SELECT * FROM RapportJournalier WHERE date_rapport = ? ORDER BY code_service',
      [date]
    );
  }
}

module.exports = Statistiques;
