'use strict';

const Service = require('../metier/models/Service');

/** ServiceDAO — référentiel des services. */
class ServiceDAO {
  constructor(cnx) {
    this.cnx = cnx;
  }

  async tous() {
    const rows = await this.cnx.all('SELECT * FROM Service ORDER BY libelle', []);
    return rows.map(Service.depuisLigne);
  }

  async trouver(code) {
    const l = await this.cnx.get('SELECT * FROM Service WHERE code_service = ?', [code]);
    return Service.depuisLigne(l);
  }

  async existe(code) {
    const l = await this.cnx.get('SELECT 1 AS x FROM Service WHERE code_service = ?', [code]);
    return !!l;
  }
}

module.exports = ServiceDAO;
