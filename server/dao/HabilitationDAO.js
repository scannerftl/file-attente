'use strict';

/**
 * HabilitationDAO — services habilités d'un agent (Partie 6.2 : servicesDe).
 */
class HabilitationDAO {
  constructor(cnx) {
    this.cnx = cnx;
  }

  /** SELECT code_service FROM Habilitation WHERE matricule = ? */
  async servicesDe(matricule) {
    const rows = await this.cnx.all(
      'SELECT code_service FROM Habilitation WHERE matricule = ?',
      [matricule]
    );
    return rows.map((l) => l.code_service);
  }
}

module.exports = HabilitationDAO;
