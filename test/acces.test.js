'use strict';

/**
 * Tests de l'accès administrateur : mot de passe, sessions, protection des
 * routes de l'API et des pages /admin/, limitation des essais.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const AccesAdmin = require('../server/securite/AccesAdmin');
const { creerContexte } = require('../server/contexte');
const { creerApp } = require('../server/server');

const MDP = 'S3cret-agence';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'acces-'));

/* ---------- Module AccesAdmin ---------- */

test('A1 — le mot de passe est stocké sous forme d\'empreinte et vérifié', () => {
  const chemin = path.join(tmp(), 'admin.json');
  const a = new AccesAdmin({ chemin });
  assert.equal(a.estConfigure(), false);
  assert.equal(a.verifier(MDP), false);
  a.definir(MDP);
  assert.equal(a.estConfigure(), true);
  assert.ok(!fs.readFileSync(chemin, 'utf8').includes(MDP), 'jamais en clair');
  assert.equal(a.verifier(MDP), true);
  assert.equal(a.verifier('mauvais-mdp'), false);
  assert.throws(() => a.definir('court'), (e) => e.metier === true);
});

test('A2 — le mot de passe initial ne sert que s\'il n\'en existe aucun', () => {
  const chemin = path.join(tmp(), 'admin.json');
  new AccesAdmin({ chemin, motDePasseInitial: MDP });
  const b = new AccesAdmin({ chemin, motDePasseInitial: 'autre-mot-de-passe' });
  assert.equal(b.verifier(MDP), true);
  assert.equal(b.verifier('autre-mot-de-passe'), false);
});

test('A3 — sessions : expiration après inactivité, fermeture des autres sessions', () => {
  let t = 0;
  const a = new AccesAdmin({ chemin: path.join(tmp(), 'admin.json'), dureeSessionMs: 1000, maintenant: () => t });
  const s1 = a.ouvrirSession();
  const s2 = a.ouvrirSession();
  t = 900; assert.equal(a.sessionValide(s1), true);   // prolongée jusqu'à 1900
  t = 1500; assert.equal(a.sessionValide(s1), true);
  assert.equal(a.sessionValide(s2), false);           // expirée à 1000
  a.fermerAutresSessions(s1);
  assert.equal(a.sessionValide(s1), true);
  a.fermerSession(s1);
  assert.equal(a.sessionValide(s1), false);
});

test('A4 — après 5 échecs, attente imposée qui double ensuite', () => {
  let t = 0;
  const a = new AccesAdmin({ chemin: path.join(tmp(), 'admin.json'), maintenant: () => t });
  for (let i = 0; i < 4; i++) a.noterEchec('ip');
  assert.equal(a.attenteAvantEssai('ip'), 0);
  a.noterEchec('ip');
  assert.equal(a.attenteAvantEssai('ip'), 60);
  t = 61000; assert.equal(a.attenteAvantEssai('ip'), 0);
  a.noterEchec('ip');
  assert.equal(a.attenteAvantEssai('ip'), 120);
  a.noterSucces('ip');
  assert.equal(a.attenteAvantEssai('ip'), 0);
});

/* ---------- Protection HTTP ---------- */

async function serveur({ configure = true } = {}) {
  const dossier = tmp();
  const ctx = await creerContexte({
    driver: 'sqlite', chemin: ':memory:', seed: true,
    cheminMarque: path.join(dossier, 'marque.json'), dossierMedias: path.join(dossier, 'medias'),
  });
  const acces = new AccesAdmin({ chemin: path.join(dossier, 'admin.json'), motDePasseInitial: configure ? MDP : '' });
  const app = creerApp(ctx, acces, path.join(dossier, 'medias'));
  const http = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${http.address().port}`;
  const appel = (url, { methode = 'GET', corps, cookie, entetes = {} } = {}) => fetch(base + url, {
    method: methode,
    redirect: 'manual',
    headers: { ...(corps ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...entetes },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const fermer = async () => { await new Promise((r) => http.close(r)); await ctx.connexion.close(); };
  return { appel, fermer, acces };
}

async function seConnecter(appel) {
  const r = await appel('/api/admin/connexion', { methode: 'POST', corps: { motDePasse: MDP } });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}

test('A5 — borne, poste et mural restent ouverts ; l\'administration exige une session', async () => {
  const { appel, fermer } = await serveur();
  try {
    // Ouvertes
    for (const url of ['/api/services', '/api/agents', '/api/guichets', '/api/mural', '/api/marque', '/api/file?matricule=A001', '/api/en-cours?guichet=1']) {
      assert.equal((await appel(url)).status, 200, url);
    }
    assert.equal((await appel('/api/tickets', { methode: 'POST', corps: { codeService: 'RET' } })).status, 201);
    assert.equal((await appel('/api/appeler', { methode: 'POST', corps: { matricule: 'A001', guichet: 1 } })).status, 200);

    // Protégées
    const protegees = [
      ['GET', '/api/stats'], ['GET', '/api/habilitations'], ['GET', '/api/marque/modeles'],
      ['POST', '/api/services'], ['PUT', '/api/services/RET'], ['DELETE', '/api/services/RET'],
      ['POST', '/api/agents'], ['DELETE', '/api/agents/A001'], ['POST', '/api/guichets'],
      ['POST', '/api/habilitations'], ['DELETE', '/api/habilitations/A001/RET'],
      ['POST', '/api/abandons'], ['PUT', '/api/marque'], ['DELETE', '/api/marque'], ['POST', '/api/medias'],
      ['POST', '/api/admin/mot-de-passe'],
    ];
    for (const [methode, url] of protegees) {
      const r = await appel(url, { methode, corps: methode === 'GET' ? undefined : {} });
      assert.equal(r.status, 401, `${methode} ${url}`);
    }
    // Rien n'a été supprimé.
    assert.equal((await (await appel('/api/services')).json()).length, 3);

    // Pages : connexion publique, le reste redirigé.
    assert.equal((await appel('/admin/connexion.html')).status, 200);
    for (const url of ['/admin/', '/admin/index.html', '/admin/admin.js']) {
      const r = await appel(url);
      assert.equal(r.status, 302, url);
      assert.equal(r.headers.get('location'), '/admin/connexion.html');
    }
  } finally { await fermer(); }
});

test('A6 — connexion, accès, déconnexion', async () => {
  const { appel, fermer } = await serveur();
  try {
    assert.equal((await appel('/api/admin/connexion', { methode: 'POST', corps: { motDePasse: 'faux-mot-de-passe' } })).status, 401);
    const cookie = await seConnecter(appel);
    assert.match(cookie, /^admin_session=[a-f0-9]{64}$/);
    assert.equal((await appel('/api/stats', { cookie })).status, 200);
    assert.equal((await appel('/admin/', { cookie })).status, 200);
    assert.deepEqual(await (await appel('/api/admin/session', { cookie })).json(), { connecte: true, configure: true, local: true });

    // Une page d'un autre site ne peut pas utiliser la session.
    const r = await appel('/api/services', { methode: 'POST', cookie, corps: { code: 'X', libelle: 'X' }, entetes: { Origin: 'http://pirate.example' } });
    assert.equal(r.status, 403);

    await appel('/api/admin/deconnexion', { methode: 'POST', cookie });
    assert.equal((await appel('/api/stats', { cookie })).status, 401);
  } finally { await fermer(); }
});

test('A7 — changement du mot de passe : ancien refusé, autres sessions fermées', async () => {
  const { appel, fermer } = await serveur();
  try {
    const c1 = await seConnecter(appel);
    const c2 = await seConnecter(appel);
    const faux = await appel('/api/admin/mot-de-passe', { methode: 'POST', cookie: c1, corps: { actuel: 'pas-le-bon', nouveau: 'Nouveau-mdp-1' } });
    assert.equal(faux.status, 400);
    const ok = await appel('/api/admin/mot-de-passe', { methode: 'POST', cookie: c1, corps: { actuel: MDP, nouveau: 'Nouveau-mdp-1' } });
    assert.equal(ok.status, 200);
    assert.equal((await appel('/api/stats', { cookie: c1 })).status, 200);
    assert.equal((await appel('/api/stats', { cookie: c2 })).status, 401);
    assert.equal((await appel('/api/admin/connexion', { methode: 'POST', corps: { motDePasse: MDP } })).status, 401);
    assert.equal((await appel('/api/admin/connexion', { methode: 'POST', corps: { motDePasse: 'Nouveau-mdp-1' } })).status, 200);
  } finally { await fermer(); }
});

test('A8 — essais en série bloqués (429), même avec le bon mot de passe', async () => {
  const { appel, fermer } = await serveur();
  try {
    for (let i = 0; i < 5; i++) {
      await appel('/api/admin/connexion', { methode: 'POST', corps: { motDePasse: 'essai-' + i } });
    }
    const r = await appel('/api/admin/connexion', { methode: 'POST', corps: { motDePasse: MDP } });
    assert.equal(r.status, 429);
    assert.ok((await r.json()).attenteSec > 0);
  } finally { await fermer(); }
});

test('A9 — premier mot de passe : création unique, depuis le serveur', async () => {
  const { appel, fermer } = await serveur({ configure: false });
  try {
    assert.deepEqual(await (await appel('/api/admin/session')).json(), { connecte: false, configure: false, local: true });
    assert.equal((await appel('/api/admin/connexion', { methode: 'POST', corps: { motDePasse: MDP } })).status, 409);
    assert.equal((await appel('/api/admin/initialiser', { methode: 'POST', corps: { motDePasse: 'court' } })).status, 400);
    const r = await appel('/api/admin/initialiser', { methode: 'POST', corps: { motDePasse: MDP } });
    assert.equal(r.status, 201);
    const cookie = r.headers.get('set-cookie').split(';')[0];
    assert.equal((await appel('/api/stats', { cookie })).status, 200);
    // Une seconde création est refusée.
    assert.equal((await appel('/api/admin/initialiser', { methode: 'POST', corps: { motDePasse: 'Autre-mdp-123' } })).status, 409);
  } finally { await fermer(); }
});
