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
  const { gestionnaire, statistiques, dao } = ctx;
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

  return r;
}

module.exports = { creerRoutes };
