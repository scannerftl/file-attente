'use strict';

const Agent = require('../metier/models/Agent');

/** AgentDAO — accès aux agents. */
class AgentDAO {
  constructor(cnx) {
    this.cnx = cnx;
  }

  async trouver(matricule) {
    const l = await this.cnx.get('SELECT * FROM Agent WHERE matricule = ?', [matricule]);
    return Agent.depuisLigne(l);
  }

  async tous() {
    const rows = await this.cnx.all('SELECT * FROM Agent ORDER BY nom', []);
    return rows.map(Agent.depuisLigne);
  }
}

module.exports = AgentDAO;
