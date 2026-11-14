'use strict';

const express = require('express');
const { NB_APPELS_RECENTS, DELAI_ABANDON_MIN } = require('../config');

/**
 * Routes de l'API HTTP/JSON.
 *
 * Contrat inter-couches (Partie 6.2) : ces contrôleurs sont MINCES. Ils ne
 * font que traduire HTTP ⇄ appels de la couche métier (GestionnaireFile /
 * Statistiques). Aucune requête SQL, aucune règle de gestion ici.
 *
 * @param {object} ctx  contexte assemblé (voir contexte.js)
 */
function creerRoutes(ctx) {
  const { gestionnaire, statistiques, dao, marque } = ctx;
  const r = express.Router();

  // Enveloppe async : erreurs métier → 400, autres → 500.
  const geree = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e && e.metier) return res.status(400).json({ erreur: e.message });
      console.error(e);
      res.status(500).json({ erreur: 'Erreur interne' });
    }
  };

  // --- Référentiel (borne) ---
  r.get('/services', geree(async (req, res) => {
    const services = await gestionnaire.servicesDisponibles();
    res.json(services.map((s) => s.versJSON()));
  }));

  r.get('/agents', geree(async (req, res) => {
    const agents = await dao.agentDAO.tous();
    res.json(agents.map((a) => a.versJSON()));
  }));

  r.get('/guichets', geree(async (req, res) => {
    const guichets = await dao.guichetDAO.tous();
    res.json(guichets.map((g) => g.versJSON()));
  }));

  // --- Admin CRUD : Services ---
  r.post('/services', geree(async (req, res) => {
    const { code, libelle, dureeCible } = req.body || {};
    if (!code || !libelle) return res.status(400).json({ erreur: 'code et libelle requis' });
    await dao.serviceDAO.creer(code, libelle, dureeCible || 5);
    res.status(201).json({ ok: true });
  }));

  r.put('/services/:code', geree(async (req, res) => {
    const { libelle, dureeCible } = req.body || {};
    await dao.serviceDAO.modifier(req.params.code, libelle, dureeCible);
    res.json({ ok: true });
  }));

  r.delete('/services/:code', geree(async (req, res) => {
    try {
      await dao.serviceDAO.supprimer(req.params.code);
      res.json({ ok: true });
    } catch (e) {
      if (e.message.includes('FOREIGN KEY') || e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || e.errno === 1451) {
        return res.status(400).json({ erreur: 'Impossible de supprimer ce service car des données (tickets/stats) y sont liées.' });
      }
      throw e;
    }
  }));

  // --- Admin CRUD : Agents ---
  r.post('/agents', geree(async (req, res) => {
    const { matricule, nom } = req.body || {};
    if (!matricule || !nom) return res.status(400).json({ erreur: 'matricule et nom requis' });
    await dao.agentDAO.creer(matricule, nom);
    res.status(201).json({ ok: true });
  }));

  r.put('/agents/:matricule', geree(async (req, res) => {
    const { nom } = req.body || {};
    await dao.agentDAO.modifier(req.params.matricule, nom);
    res.json({ ok: true });
  }));

  r.delete('/agents/:matricule', geree(async (req, res) => {
    try {
      await dao.agentDAO.supprimer(req.params.matricule);
      res.json({ ok: true });
    } catch (e) {
      if (e.message.includes('FOREIGN KEY') || e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || e.errno === 1451) {
        return res.status(400).json({ erreur: 'Impossible de supprimer cet agent car des données y sont liées.' });
      }
      throw e;
    }
  }));

  // --- Admin CRUD : Guichets ---
  r.post('/guichets', geree(async (req, res) => {
    const { numero, etat } = req.body || {};
    if (!numero) return res.status(400).json({ erreur: 'numero requis' });
    await dao.guichetDAO.creer(numero, etat || 'ouvert');
    res.status(201).json({ ok: true });
  }));

  r.put('/guichets/:numero', geree(async (req, res) => {
    const { etat } = req.body || {};
    await dao.guichetDAO.modifier(req.params.numero, etat);
    res.json({ ok: true });
  }));

  r.delete('/guichets/:numero', geree(async (req, res) => {
    try {
      await dao.guichetDAO.supprimer(req.params.numero);
      res.json({ ok: true });
    } catch (e) {
      if (e.message.includes('FOREIGN KEY') || e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || e.errno === 1451) {
        return res.status(400).json({ erreur: 'Impossible de supprimer ce guichet car des tickets y sont liés.' });
      }
      throw e;
    }
  }));

  // --- Admin : Habilitations (agent ↔ service, RG3) ---
  r.get('/habilitations', geree(async (req, res) => {
    const paires = await dao.habilitationDAO.toutes();
    res.json(paires.map((h) => ({ matricule: h.matricule, codeService: h.code_service })));
  }));

  r.post('/habilitations', geree(async (req, res) => {
    const { matricule, codeService } = req.body || {};
    if (!matricule || !codeService) {
      return res.status(400).json({ erreur: 'matricule et codeService requis' });
    }
    try {
      await dao.habilitationDAO.ajouter(matricule, codeService);
      res.status(201).json({ ok: true });
    } catch (e) {
      if (e.message.includes('FOREIGN KEY') || e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || e.errno === 1452) {
        return res.status(400).json({ erreur: 'Agent ou service inexistant.' });
      }
      throw e;
    }
  }));

  r.delete('/habilitations/:matricule/:codeService', geree(async (req, res) => {
    await dao.habilitationDAO.retirer(req.params.matricule, req.params.codeService);
    res.json({ ok: true });
  }));

  // --- BORNE : prendre un ticket (opération 6.1 prendreTicket) ---
  r.post('/tickets', geree(async (req, res) => {
    const { codeService } = req.body || {};
    if (!codeService) return res.status(400).json({ erreur: 'codeService requis' });
    const ticket = await gestionnaire.prendreTicket(codeService);
    res.status(201).json(ticket.versJSON());
  }));

  // --- POSTE AGENT : sa file d'attente ---
  r.get('/file', geree(async (req, res) => {
    const { matricule } = req.query;
    if (!matricule) return res.status(400).json({ erreur: 'matricule requis' });
    const file = await gestionnaire.fileDeAgent(matricule);
    res.json(file.map((t) => t.versJSON()));
  }));

  // --- POSTE AGENT : ticket en cours à son guichet ---
  r.get('/en-cours', geree(async (req, res) => {
    const guichet = Number(req.query.guichet);
    if (!guichet) return res.status(400).json({ erreur: 'guichet requis' });
    const t = await gestionnaire.enCours(guichet);
    res.json(t ? t.versJSON() : null);
  }));

  // --- POSTE AGENT : appeler le suivant (opération 6.1 appelerSuivant) ---
  r.post('/appeler', geree(async (req, res) => {
    const { matricule, guichet } = req.body || {};
    if (!matricule || !guichet) {
      return res.status(400).json({ erreur: 'matricule et guichet requis' });
    }
    const ticket = await gestionnaire.appelerSuivant(matricule, Number(guichet));
    // Fragment « alt » de la séquence n°1 : aucun ticket → message « aucun ».
    if (!ticket) return res.json({ ticket: null, message: 'Aucun ticket en attente' });
    res.json({ ticket: ticket.versJSON() });
  }));

  // --- POSTE AGENT : clôturer (opération 6.1 cloturerTicket) ---
  r.post('/cloturer', geree(async (req, res) => {
    const { num, date } = req.body || {};
    if (num === undefined) return res.status(400).json({ erreur: 'num requis' });
    await gestionnaire.cloturerTicket(Number(num), date ? new Date(date) : undefined);
    res.json({ ok: true });
  }));

  // --- ÉCRAN MURAL : état courant (repli polling si WebSocket indisponible) ---
  r.get('/mural', geree(async (req, res) => {
    const etat = await gestionnaire.etatMural(NB_APPELS_RECENTS);
    res.json({
      courant: etat.courant ? etat.courant.versJSON() : null,
      recents: etat.recents.map((t) => t.versJSON()),
    });
  }));

  // --- Traitements automatiques (exposés pour supervision / démonstration) ---
  r.post('/abandons', geree(async (req, res) => {
    const delai = Number((req.body && req.body.delaiMin) || DELAI_ABANDON_MIN);
    const nb = await gestionnaire.marquerAbandons(delai);
    res.json({ nb });
  }));

  r.get('/stats', geree(async (req, res) => {
    const { date } = req.query;
    res.json(await statistiques.calculerRapport(date));
  }));

  // --- Personnalisation client (marque, couleurs, messages publicitaires) ---
  r.get('/marque', geree(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(marque.lire());
  }));

  r.put('/marque', geree(async (req, res) => {
    res.json(marque.enregistrer(req.body));
  }));

  r.delete('/marque', geree(async (req, res) => {
    res.json(marque.reinitialiser());
  }));

  // Envoi d'un média (corps brut, type MIME dans Content-Type) → { url, type }.
  r.post(
    '/medias',
    express.raw({ type: ['image/*', 'video/*'], limit: '50mb' }),
    geree(async (req, res) => {
      res.status(201).json(marque.ajouterMedia(req.body, req.get('Content-Type')));
    })
  );

  r.get('/marque/modeles', geree(async (req, res) => {
    res.json(marque.modeles());
  }));

  r.get('/marque/modeles/:id', geree(async (req, res) => {
    res.json(marque.modele(req.params.id));
  }));

  // Corps refusé par le parseur (fichier trop lourd, JSON invalide) → message clair.
  r.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ erreur: 'Fichier trop lourd (50 Mo maximum)' });
    }
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ erreur: 'Requête invalide' });
    }
    next(err);
  });

  return r;
}

module.exports = { creerRoutes };
