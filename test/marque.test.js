'use strict';

/**
 * Tests de la personnalisation client (GestionMarque + MarqueDAO).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const GestionMarque = require('../server/metier/GestionMarque');
const MarqueDAO = require('../server/dao/MarqueDAO');

function gestion() {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'marque-'));
  const evenements = [];
  const dao = new MarqueDAO(path.join(dossier, 'marque.json'), path.join(__dirname, '..', 'server', 'marques'));
  const g = new GestionMarque(dao, { notifier: (e) => evenements.push(e) });
  return { g, evenements };
}

const base = () => ({
  nom: 'UBA Cameroun',
  slogan: '',
  logo: '',
  couleurs: { principale: '#d6001c', secondaire: '#1d1d1b' },
  rotationSec: 8,
  messages: [{ titre: 'Promo', texte: 'Texte', zones: ['haut', 'bas'], ecrans: ['mural'] }],
});

test('M1 — sans configuration enregistrée, le modèle par défaut est servi', () => {
  const { g } = gestion();
  assert.equal(g.lire().nom, 'Agence');
});

test('M2 — une configuration valide est enregistrée, normalisée et notifiée', () => {
  const { g, evenements } = gestion();
  const c = g.enregistrer(base());
  assert.equal(c.couleurs.principale, '#D6001C');
  assert.equal(c.messages[0].actif, true);
  assert.ok(c.messages[0].id);
  assert.equal(g.lire().nom, 'UBA Cameroun');
  assert.deepEqual(evenements, [{ type: 'marque' }]);
});

test('M3 — couleurs, zones, écrans et images invalides sont refusés', () => {
  const { g } = gestion();
  const cas = [
    (c) => { c.couleurs.principale = 'rouge'; },
    (c) => { c.messages[0].zones = ['plafond']; },
    (c) => { c.messages[0].ecrans = ['poste']; },
    (c) => { c.logo = 'javascript:alert(1)'; },
    (c) => { c.messages[0].image = 'data:text/html;base64,PGgxPg=='; },
    (c) => { c.nom = ''; },
    (c) => { c.rotationSec = 1; },
  ];
  for (const modif of cas) {
    const c = base();
    modif(c);
    assert.throws(() => g.enregistrer(c), (e) => e.metier === true);
  }
});

test('M4 — réinitialiser revient au modèle par défaut ; les modèles sont listés', () => {
  const { g } = gestion();
  g.enregistrer(base());
  assert.equal(g.reinitialiser().nom, 'Agence');
  const ids = g.modeles().map((m) => m.id);
  assert.ok(ids.includes('defaut') && ids.includes('uba-cameroun'));
  assert.equal(g.modele('uba-cameroun').nom, 'UBA Cameroun');
  assert.throws(() => g.modele('../secret'), (e) => e.metier === true);
});

test('M5 — les modèles fournis sont eux-mêmes valides', () => {
  const { g } = gestion();
  for (const { id } of g.modeles()) GestionMarque.valider(g.modele(id));
});
