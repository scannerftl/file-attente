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

  /** Toutes les paires (matricule, code_service) — pour l'administration. */
  async toutes() {
    return this.cnx.all(
      'SELECT matricule, code_service FROM Habilitation ORDER BY matricule, code_service',
      []
    );
  }

  /** Habilite un agent pour un service (idempotent). */
  async ajouter(matricule, codeService) {
    // Seul point spécifique au dialecte : l'insertion « ignore si existe ».
    const sql = this.cnx.dialecte === 'mysql'
      ? 'INSERT IGNORE INTO Habilitation (matricule, code_service) VALUES (?, ?)'
      : 'INSERT OR IGNORE INTO Habilitation (matricule, code_service) VALUES (?, ?)';
    await this.cnx.run(sql, [matricule, codeService]);
  }

  /** Retire l'habilitation d'un agent pour un service. */
  async retirer(matricule, codeService) {
    await this.cnx.run(
      'DELETE FROM Habilitation WHERE matricule = ? AND code_service = ?',
      [matricule, codeService]
    );
  }
}

module.exports = HabilitationDAO;
