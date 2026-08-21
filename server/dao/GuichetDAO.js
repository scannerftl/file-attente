'use strict';

const Guichet = require('../metier/models/Guichet');

/** GuichetDAO — accès aux guichets. */
class GuichetDAO {
  constructor(cnx) {
    this.cnx = cnx;
  }

  async tous() {
    const rows = await this.cnx.all('SELECT * FROM Guichet ORDER BY numero', []);
    return rows.map(Guichet.depuisLigne);
  }

  async trouver(numero) {
    const l = await this.cnx.get('SELECT * FROM Guichet WHERE numero = ?', [numero]);
    return Guichet.depuisLigne(l);
  }

  async estOuvert(numero) {
    const g = await this.trouver(numero);
    return !!g && g.estOuvert();
  }
}

module.exports = GuichetDAO;
