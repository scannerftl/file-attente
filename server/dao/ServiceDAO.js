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

  async creer(code, libelle, dureeCible = 5) {
    await this.cnx.run(
      'INSERT INTO Service (code_service, libelle, duree_cible) VALUES (?, ?, ?)',
      [code, libelle, dureeCible]
    );
  }

  async modifier(code, libelle, dureeCible) {
    await this.cnx.run(
      'UPDATE Service SET libelle = ?, duree_cible = ? WHERE code_service = ?',
      [libelle, dureeCible, code]
    );
  }

  async supprimer(code) {
    await this.cnx.run('DELETE FROM Service WHERE code_service = ?', [code]);
  }
}

module.exports = ServiceDAO;
