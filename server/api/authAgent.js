'use strict';

const express = require('express');
const { lireCookie, poserCookie, origineAutorisee } = require('./auth');

/**
 * Couche HTTP de l'authentification des agents (poste agent) :
 *  - routes /api/agent/* (session, connexion, déconnexion, changement de
 *    son propre mot de passe) ;
 *  - middleware `exiger` : session agent obligatoire ; place le matricule
 *    de l'agent connecté dans `req.matricule`.
 *
 * Cookie distinct de celui de l'administration (`agent_session`), HttpOnly,
 * SameSite=Strict.
 *
 * @param {import('../securite/AccesAgents')} acces
 * @param {object} ctx  contexte métier (DAO agents, habilitations)
 */
const COOKIE = 'agent_session';

function creerAuthAgent(acces, ctx) {
  const dureeSec = Math.floor(acces.dureeSessionMs / 1000);
  const adresse = (req) => req.socket.remoteAddress || 'inconnue';
  const jeton = (req) => lireCookie(req, COOKIE);

  /** Fiche de l'agent connecté (null si l'agent n'existe plus). */
  async function fiche(matricule) {
    const agent = await ctx.dao.agentDAO.trouver(matricule);
    if (!agent) return null;
    const services = await ctx.habilitation.servicesDe(matricule);
    return { matricule: agent.matricule, nom: agent.nom, services };
  }

  /** Middleware : exige une session agent valide ; fournit req.matricule. */
  function exiger(req, res, next) {
    if (!origineAutorisee(req)) return res.status(403).json({ erreur: 'Origine non autorisée' });
    const matricule = acces.matriculeDe(jeton(req));
    if (!matricule) return res.status(401).json({ erreur: 'Connexion agent requise', connexion: true });
    req.matricule = matricule;
    next();
  }

  const geree = (fn) => (req, res) => fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ erreur: 'Erreur interne' });
  });

  const r = express.Router();

  r.get('/session', geree(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const matricule = acces.matriculeDe(jeton(req));
    const agent = matricule ? await fiche(matricule) : null;
    res.json({ connecte: !!agent, agent });
  }));

  r.post('/connexion', geree(async (req, res) => {
    if (!origineAutorisee(req)) return res.status(403).json({ erreur: 'Origine non autorisée' });
    const attente = acces.limiteur.attente(adresse(req));
    if (attente > 0) {
      return res.status(429).json({ erreur: `Trop d'essais. Réessayez dans ${attente} s.`, attenteSec: attente });
    }
    const { matricule, motDePasse } = req.body || {};
    const m = typeof matricule === 'string' ? matricule.trim() : '';
    // Même message que l'agent existe ou non : on ne révèle pas les matricules.
    const agent = m && acces.verifier(m, motDePasse) ? await fiche(m) : null;
    if (!agent) {
      acces.limiteur.echec(adresse(req));
      return res.status(401).json({ erreur: 'Matricule ou mot de passe incorrect' });
    }
    acces.limiteur.succes(adresse(req));
    poserCookie(req, res, acces.ouvrirSession(m), dureeSec, COOKIE);
    res.json({ ok: true, agent });
  }));

  r.post('/deconnexion', (req, res) => {
    acces.fermerSession(jeton(req));
    poserCookie(req, res, '', 0, COOKIE);
    res.json({ ok: true });
  });

  r.post('/mot-de-passe', exiger, (req, res) => {
    const { actuel, nouveau } = req.body || {};
    if (!acces.verifier(req.matricule, actuel)) {
      acces.limiteur.echec(adresse(req));
      return res.status(400).json({ erreur: 'Mot de passe actuel incorrect' });
    }
    try {
      acces.definir(req.matricule, nouveau);
    } catch (e) {
      return res.status(400).json({ erreur: e.message });
    }
    acces.fermerSessionsDe(req.matricule, jeton(req));
    res.json({ ok: true });
  });

  return { routes: r, exiger };
}

module.exports = { creerAuthAgent };
