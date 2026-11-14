'use strict';

/**
 * Tests des accès : administration et postes agents (mots de passe,
 * sessions, protection des routes de l'API et des pages /admin/,
 * limitation des essais).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const AccesAdmin = require('../server/securite/AccesAdmin');
const AccesAgents = require('../server/securite/AccesAgents');
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
  const accesAgents = new AccesAgents({ chemin: path.join(dossier, 'agents-acces.json') });
  const app = creerApp(ctx, acces, path.join(dossier, 'medias'), accesAgents);
  const http = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${http.address().port}`;
  const appel = (url, { methode = 'GET', corps, cookie, entetes = {} } = {}) => fetch(base + url, {
    method: methode,
    redirect: 'manual',
    headers: { ...(corps ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...entetes },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const fermer = async () => { await new Promise((r) => http.close(r)); await ctx.connexion.close(); };
  return { appel, fermer, acces, accesAgents };
}

async function seConnecter(appel) {
  const r = await appel('/api/admin/connexion', { methode: 'POST', corps: { motDePasse: MDP } });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}

test('A5 — borne et mural restent ouverts ; poste et administration exigent une session', async () => {
  const { appel, fermer } = await serveur();
  try {
    // Ouvertes
    for (const url of ['/api/services', '/api/guichets', '/api/mural', '/api/marque']) {
      assert.equal((await appel(url)).status, 200, url);
    }
    assert.equal((await appel('/api/tickets', { methode: 'POST', corps: { codeService: 'RET' } })).status, 201);

    // Poste agent : session agent requise
    for (const [methode, url, corps] of [
      ['GET', '/api/file?matricule=A001'], ['GET', '/api/en-cours?guichet=1'],
      ['POST', '/api/appeler', { matricule: 'A001', guichet: 1 }], ['POST', '/api/cloturer', { num: 1 }],
      ['POST', '/api/agent/mot-de-passe', {}],
    ]) {
      assert.equal((await appel(url, { methode, corps })).status, 401, `${methode} ${url}`);
    }

    // Administration
    const protegees = [
      ['GET', '/api/agents'], ['PUT', '/api/agents/A001/mot-de-passe'],
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

/* ---------- Postes agents ---------- */

async function connecterAgent(appel, matricule, motDePasse) {
  const r = await appel('/api/agent/connexion', { methode: 'POST', corps: { matricule, motDePasse } });
  return { r, cookie: r.status === 200 ? r.headers.get('set-cookie').split(';')[0] : null };
}

test('A10 — l\'administrateur définit le mot de passe d\'un agent ; la liste indique qui en a un', async () => {
  const { appel, fermer } = await serveur();
  try {
    const admin = await seConnecter(appel);
    assert.equal((await appel('/api/agents/A001/mot-de-passe', { methode: 'PUT', cookie: admin, corps: { motDePasse: 'court' } })).status, 400);
    assert.equal((await appel('/api/agents/ZZZ/mot-de-passe', { methode: 'PUT', cookie: admin, corps: { motDePasse: 'Agent-mdp-1' } })).status, 404);
    assert.equal((await appel('/api/agents/A001/mot-de-passe', { methode: 'PUT', cookie: admin, corps: { motDePasse: 'Agent-mdp-1' } })).status, 200);
    const agents = await (await appel('/api/agents', { cookie: admin })).json();
    const a1 = agents.find((a) => a.matricule === 'A001');
    assert.equal(a1.motDePasse, true);
    assert.deepEqual([...a1.services].sort(), ['OUV', 'RET']); // services habilités renseignés
    assert.equal(agents.find((a) => a.matricule === 'A002').motDePasse, false);
    // Création d'un agent avec mot de passe initial.
    assert.equal((await appel('/api/agents', { methode: 'POST', cookie: admin, corps: { matricule: 'A009', nom: 'Test', motDePasse: 'Agent-mdp-9' } })).status, 201);
    assert.equal((await connecterAgent(appel, 'A009', 'Agent-mdp-9')).r.status, 200);
  } finally { await fermer(); }
});

test('A11 — l\'agent connecté appelle en son nom uniquement', async () => {
  const { appel, fermer, accesAgents } = await serveur();
  try {
    accesAgents.definir('A001', 'Agent-mdp-1');
    assert.equal((await connecterAgent(appel, 'A001', 'faux-mdp-123')).r.status, 401);
    assert.equal((await connecterAgent(appel, 'A002', 'Agent-mdp-1')).r.status, 401); // pas de mot de passe
    const { r, cookie } = await connecterAgent(appel, 'A001', 'Agent-mdp-1');
    assert.equal(r.status, 200);
    assert.equal((await r.json()).agent.nom, 'Alice Martin');
    assert.equal((await (await appel('/api/agent/session', { cookie })).json()).agent.matricule, 'A001');

    // Ticket CRE : A001 n'y est pas habilitée. Même en se faisant passer pour
    // A002 (habilité CRE) dans la requête, l'appel reste au nom de A001.
    await appel('/api/tickets', { methode: 'POST', corps: { codeService: 'CRE' } });
    const usurpation = await appel('/api/appeler', { methode: 'POST', cookie, corps: { matricule: 'A002', guichet: 1 } });
    assert.equal((await usurpation.json()).ticket, null);
    const file = await (await appel('/api/file?matricule=A002', { cookie })).json();
    assert.equal(file.length, 0, 'la file est celle de A001, pas celle demandée');

    await appel('/api/tickets', { methode: 'POST', corps: { codeService: 'RET' } });
    const ok = await (await appel('/api/appeler', { methode: 'POST', cookie, corps: { guichet: 1 } })).json();
    assert.equal(ok.ticket.codeService, 'RET');
    assert.equal((await appel('/api/cloturer', { methode: 'POST', cookie, corps: { num: ok.ticket.numero } })).status, 200);

    // Un cookie agent n'ouvre pas l'administration.
    assert.equal((await appel('/api/stats', { cookie })).status, 401);

    await appel('/api/agent/deconnexion', { methode: 'POST', cookie });
    assert.equal((await appel('/api/file', { cookie })).status, 401);
  } finally { await fermer(); }
});

test('A12 — réinitialisation par l\'admin, suppression de l\'agent et changement par l\'agent ferment les sessions', async () => {
  const { appel, fermer, accesAgents } = await serveur();
  try {
    const admin = await seConnecter(appel);
    accesAgents.definir('A001', 'Agent-mdp-1');
    const s1 = (await connecterAgent(appel, 'A001', 'Agent-mdp-1')).cookie;
    const s2 = (await connecterAgent(appel, 'A001', 'Agent-mdp-1')).cookie;

    // Changement par l'agent : sa session reste, l'autre est fermée.
    assert.equal((await appel('/api/agent/mot-de-passe', { methode: 'POST', cookie: s1, corps: { actuel: 'mauvais-123', nouveau: 'Agent-mdp-2' } })).status, 400);
    assert.equal((await appel('/api/agent/mot-de-passe', { methode: 'POST', cookie: s1, corps: { actuel: 'Agent-mdp-1', nouveau: 'Agent-mdp-2' } })).status, 200);
    assert.equal((await appel('/api/file', { cookie: s1 })).status, 200);
    assert.equal((await appel('/api/file', { cookie: s2 })).status, 401);

    // Réinitialisation par l'admin : toutes les sessions de l'agent sont fermées.
    await appel('/api/agents/A001/mot-de-passe', { methode: 'PUT', cookie: admin, corps: { motDePasse: 'Agent-mdp-3' } });
    assert.equal((await appel('/api/file', { cookie: s1 })).status, 401);
    assert.equal((await connecterAgent(appel, 'A001', 'Agent-mdp-2')).r.status, 401);

    // Suppression de l'agent : mot de passe effacé.
    accesAgents.definir('A009', 'Agent-mdp-9');
    await appel('/api/agents', { methode: 'POST', cookie: admin, corps: { matricule: 'A009', nom: 'Temp' } });
    const s9 = (await connecterAgent(appel, 'A009', 'Agent-mdp-9')).cookie;
    assert.equal((await appel('/api/agents/A009', { methode: 'DELETE', cookie: admin })).status, 200);
    assert.equal((await appel('/api/file', { cookie: s9 })).status, 401);
    assert.equal(accesAgents.avecMotDePasse().has('A009'), false);
  } finally { await fermer(); }
});

test('A13 — essais en série sur le poste agent bloqués (429)', async () => {
  const { appel, fermer, accesAgents } = await serveur();
  try {
    accesAgents.definir('A001', 'Agent-mdp-1');
    for (let i = 0; i < 5; i++) await connecterAgent(appel, 'A001', 'essai-' + i + 'xxxx');
    assert.equal((await connecterAgent(appel, 'A001', 'Agent-mdp-1')).r.status, 429);
  } finally { await fermer(); }
});
