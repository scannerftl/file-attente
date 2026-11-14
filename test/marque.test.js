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
  const dao = new MarqueDAO(path.join(dossier, 'marque.json'), path.join(__dirname, '..', 'server', 'marques'), path.join(dossier, 'medias'));
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

test('M6 — médias : formats acceptés, fichier stocké sous /medias/, refus des autres types', () => {
  const { g } = gestion();
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  const { url, type } = g.ajouterMedia(png, 'image/png');
  assert.match(url, /^\/medias\/[a-f0-9]{24}\.png$/);
  assert.equal(type, 'image/png');
  assert.match(g.ajouterMedia(Buffer.from('x'), 'video/mp4; codecs=avc1').url, /\.mp4$/);
  assert.throws(() => g.ajouterMedia(png, 'text/html'), (e) => e.metier === true);
  assert.throws(() => g.ajouterMedia(Buffer.alloc(0), 'image/gif'), (e) => e.metier === true);
});

test('M7 — animations : valeurs par défaut, transitions et veille validées, ancien champ « image » repris', () => {
  const { g } = gestion();
  const c = g.enregistrer({ ...base(), messages: [{ titre: 'A', image: 'data:image/png;base64,iVBORw0KGgo=', zones: ['veille'], ecrans: [] }] });
  assert.deepEqual(c.animation, { transition: 'fondu', vitesseDefilement: 'normale' });
  assert.equal(c.veilleSec, 0);
  assert.equal(c.messages[0].media, 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(c.messages[0].dureeSec, 0);

  const video = { ...base(), messages: [{ media: '/medias/abc123.mp4', zones: ['lateral'], ecrans: ['mural'] }] };
  assert.equal(g.enregistrer(video).messages[0].media, '/medias/abc123.mp4'); // média seul, sans texte : accepté

  const cas = [
    (c) => { c.animation = { transition: 'explosion' }; },
    (c) => { c.animation = { vitesseDefilement: 'turbo' }; },
    (c) => { c.veilleSec = 5; },
    (c) => { c.logo = '/medias/abc.mp4'; },              // pas de vidéo en logo
    (c) => { c.messages[0].media = '/medias/../x.mp4'; },
    (c) => { c.messages[0].dureeSec = -1; },
  ];
  for (const modif of cas) {
    const x = base();
    modif(x);
    assert.throws(() => g.enregistrer(x), (e) => e.metier === true);
  }
});

test('M8 — les médias qui ne servent plus sont supprimés à la publication', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'marque-'));
  const dao = new MarqueDAO(path.join(dossier, 'marque.json'), path.join(__dirname, '..', 'server', 'marques'), path.join(dossier, 'medias'));
  const g = new GestionMarque(dao);
  const garde = g.ajouterMedia(Buffer.from('a'), 'image/gif').url;
  const orphelin = g.ajouterMedia(Buffer.from('b'), 'image/gif').url;
  // Vieillit les fichiers au-delà du délai de grâce.
  const vieux = new Date(Date.now() - 3600e3);
  for (const u of [garde, orphelin]) fs.utimesSync(path.join(dossier, u), vieux, vieux);
  g.enregistrer({ ...base(), messages: [{ media: garde, zones: ['lateral'], ecrans: ['borne'] }] });
  assert.ok(fs.existsSync(path.join(dossier, garde)));
  assert.ok(!fs.existsSync(path.join(dossier, orphelin)));
});
