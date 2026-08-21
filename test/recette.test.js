'use strict';

/**
 * Plan de tests de recette — Partie 6.3 du dossier de conception.
 * Un test = une ligne T1…T8. « Le développement est terminé quand T1 à T8 passent. »
 *
 * On teste la couche métier de bout en bout (GestionnaireFile + DAO + Connexion
 * SQLite en mémoire), avec une horloge fixe pour maîtriser le temps (T6/T7/T8).
 * Le métier étant asynchrone (interface Connexion commune SQLite/MySQL), les
 * tests sont eux-mêmes asynchrones.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { creerContexte } = require('../server/contexte');
const { horlogeFixe } = require('../server/util/horloge');
const { dateDuJour, versISO } = require('../server/util/temps');
const Ticket = require('../server/metier/models/Ticket');

/** Contexte de test : base SQLite en mémoire + horloge fixe. */
async function contexteTest(instant = '2026-08-20T12:00:00Z') {
  const horloge = horlogeFixe(instant);
  const ctx = await creerContexte({ driver: 'sqlite', chemin: ':memory:', seed: true, horloge });
  ctx.horloge = horloge;
  ctx.base = new Date(instant);
  ctx.dateJour = dateDuJour(horloge.maintenant());
  return ctx;
}

/** Insère directement un ticket dans un état précis (mise en place « given »). */
async function poser(ctx, t) {
  await ctx.connexion.run(
    `INSERT INTO Ticket (num_ticket, date_ticket, code_service, statut, heure_prise, heure_appel, heure_fin, guichet)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.numero,
      t.date || ctx.dateJour,
      t.codeService,
      t.statut,
      t.heurePrise,
      t.heureAppel || null,
      t.heureFin || null,
      t.guichet || null,
    ]
  );
}

const min = (base, m) => versISO(new Date(new Date(base).getTime() + m * 60000));

// ---------------------------------------------------------------------
test('T1 — File vide, service RET actif : prendre un ticket RET → n°1, attente (RG5)', async () => {
  const ctx = await contexteTest();
  const ticket = await ctx.gestionnaire.prendreTicket('RET');
  assert.equal(ticket.numero, 1, 'premier ticket du jour = 1');
  assert.equal(ticket.statut, Ticket.ETATS.ATTENTE);
  assert.equal(ticket.codeService, 'RET');
  assert.ok(ticket.heurePrise, 'ticket horodaté');
});

// ---------------------------------------------------------------------
test('T2 — Un ticket pris hier : la numérotation repart à 1 le jour suivant (RG5)', async () => {
  const ctx = await contexteTest();
  // 3 tickets pris hier.
  ctx.horloge.regler('2026-08-19T12:00:00Z');
  await ctx.gestionnaire.prendreTicket('RET');
  await ctx.gestionnaire.prendreTicket('CRE');
  await ctx.gestionnaire.prendreTicket('RET');
  // Aujourd'hui : premier ticket du jour.
  ctx.horloge.regler('2026-08-20T09:00:00Z');
  const t = await ctx.gestionnaire.prendreTicket('RET');
  assert.equal(t.numero, 1, 'la numérotation repart à 1 chaque jour');
});

// ---------------------------------------------------------------------
test('T3 — 2 tickets RET en attente, agent habilité RET : le plus ancien est appelé + écran notifié (RG2)', async () => {
  const ctx = await contexteTest();
  await poser(ctx, { numero: 1, codeService: 'RET', statut: 'attente', heurePrise: min(ctx.base, -5) });
  await poser(ctx, { numero: 2, codeService: 'RET', statut: 'attente', heurePrise: min(ctx.base, -3) });

  // Espion : le patron Observateur doit émettre l'appel vers les écrans.
  const evenements = [];
  ctx.notification.abonner({ notifier: (ev) => evenements.push(ev) });

  const appele = await ctx.gestionnaire.appelerSuivant('A001', 1); // A001 habilité RET, OUV
  assert.equal(appele.numero, 1, 'le plus ancien (n°1) est appelé');
  assert.equal(appele.statut, Ticket.ETATS.APPELE);
  assert.equal(appele.guichet, 1);
  assert.ok(appele.heureAppel, 'horodaté à l\'appel');

  const appel = evenements.find((e) => e.type === 'appel');
  assert.ok(appel, 'un événement d\'appel a été diffusé (écran mural mis à jour)');
  assert.equal(appel.ticket.numero, 1);
  assert.equal(appel.guichet, 1);
});

// ---------------------------------------------------------------------
test('T4 — Seul un ticket CRE en attente, agent NON habilité CRE : message « aucun » (RG3)', async () => {
  const ctx = await contexteTest();
  await poser(ctx, { numero: 1, codeService: 'CRE', statut: 'attente', heurePrise: min(ctx.base, -2) });

  const appele = await ctx.gestionnaire.appelerSuivant('A001', 1); // A001 : RET/OUV, pas CRE
  assert.equal(appele, null, 'le ticket CRE n\'est pas appelé par un agent non habilité');

  // Le ticket reste en attente (rien changé en base).
  const t = await ctx.dao.ticketDAO.trouver(1, ctx.dateJour);
  assert.equal(t.statut, Ticket.ETATS.ATTENTE);
});

// ---------------------------------------------------------------------
test('T5 — Aucun ticket en attente : « aucun ticket », rien ne change', async () => {
  const ctx = await contexteTest();
  const avant = (await ctx.connexion.get('SELECT COUNT(*) AS n FROM Ticket', [])).n;
  const appele = await ctx.gestionnaire.appelerSuivant('A003', 2); // A003 polyvalent, mais file vide
  assert.equal(appele, null);
  const apres = (await ctx.connexion.get('SELECT COUNT(*) AS n FROM Ticket', [])).n;
  assert.equal(apres, avant, 'aucune écriture en base');
});

// ---------------------------------------------------------------------
test('T6 — Ticket appelé il y a 10 min, jamais clôturé (délai 5) → abandonné (RG6)', async () => {
  const ctx = await contexteTest();
  await poser(ctx, {
    numero: 1, codeService: 'RET', statut: 'appele', guichet: 1,
    heurePrise: min(ctx.base, -12), heureAppel: min(ctx.base, -10),
  });

  const nb = await ctx.gestionnaire.marquerAbandons(5);
  assert.equal(nb, 1, 'un ticket marqué abandonné');
  assert.equal((await ctx.dao.ticketDAO.trouver(1, ctx.dateJour)).statut, Ticket.ETATS.ABANDONNE);
});

// ---------------------------------------------------------------------
test('T6 bis — Ticket appelé il y a 3 min (délai 5) : PAS encore abandonné', async () => {
  const ctx = await contexteTest();
  await poser(ctx, {
    numero: 1, codeService: 'RET', statut: 'appele', guichet: 1,
    heurePrise: min(ctx.base, -4), heureAppel: min(ctx.base, -3),
  });
  const nb = await ctx.gestionnaire.marquerAbandons(5);
  assert.equal(nb, 0);
  assert.equal((await ctx.dao.ticketDAO.trouver(1, ctx.dateJour)).statut, Ticket.ETATS.APPELE);
});

// ---------------------------------------------------------------------
test('T7 — Ticket appelé à 12:05, clôturé à 12:11 : terminé, heure_fin > heure_appel (RG7)', async () => {
  const ctx = await contexteTest();
  await poser(ctx, {
    numero: 1, codeService: 'RET', statut: 'appele', guichet: 1,
    heurePrise: '2026-08-20T12:00:00Z', heureAppel: '2026-08-20T12:05:00Z',
  });

  await ctx.gestionnaire.cloturerTicket(1, new Date('2026-08-20T12:11:00Z'));

  const t = await ctx.dao.ticketDAO.trouver(1, ctx.dateJour);
  assert.equal(t.statut, Ticket.ETATS.TERMINE);
  assert.equal(t.tempsTraitement(), 6, 'temps de traitement = 6 min (12:11 − 12:05)');

  // RG7 : clôturer avant l'appel est refusé.
  await poser(ctx, {
    numero: 2, codeService: 'RET', statut: 'appele', guichet: 1,
    heurePrise: '2026-08-20T12:00:00Z', heureAppel: '2026-08-20T12:05:00Z',
  });
  await assert.rejects(
    () => ctx.gestionnaire.cloturerTicket(2, new Date('2026-08-20T12:04:00Z')),
    /RG7/,
    'clôture antérieure à l\'appel refusée'
  );
});

// ---------------------------------------------------------------------
test('T8 — Journée de tickets terminés : temps d\'attente moyen par service correct', async () => {
  const ctx = await contexteTest();
  // RET : attentes 2 et 6 → moyenne 4.  CRE : attente 10 → moyenne 10.
  await poser(ctx, { numero: 1, codeService: 'RET', statut: 'termine', guichet: 1,
    heurePrise: '2026-08-20T12:00:00Z', heureAppel: '2026-08-20T12:02:00Z', heureFin: '2026-08-20T12:10:00Z' });
  await poser(ctx, { numero: 2, codeService: 'RET', statut: 'termine', guichet: 1,
    heurePrise: '2026-08-20T12:00:00Z', heureAppel: '2026-08-20T12:06:00Z', heureFin: '2026-08-20T12:20:00Z' });
  await poser(ctx, { numero: 3, codeService: 'CRE', statut: 'termine', guichet: 2,
    heurePrise: '2026-08-20T12:00:00Z', heureAppel: '2026-08-20T12:10:00Z', heureFin: '2026-08-20T12:25:00Z' });

  // Donnée calculée à la volée (jamais stockée) — opération 6.1.
  assert.equal(await ctx.gestionnaire.tempsAttenteMoyen('RET', ctx.dateJour), 4);
  assert.equal(await ctx.gestionnaire.tempsAttenteMoyen('CRE', ctx.dateJour), 10);

  // Traitement de nuit : archive le rapport (Partie 1.3).
  const rapport = await ctx.statistiques.calculerRapport(ctx.dateJour);
  const ret = rapport.find((r) => r.codeService === 'RET');
  const cre = rapport.find((r) => r.codeService === 'CRE');
  assert.equal(ret.nbTickets, 2);
  assert.equal(ret.attenteMoy, 4);
  assert.equal(cre.attenteMoy, 10);

  // Le rapport est bien persisté et relisible.
  const archive = await ctx.statistiques.lireRapport(ctx.dateJour);
  assert.equal(archive.length, 2);
});
