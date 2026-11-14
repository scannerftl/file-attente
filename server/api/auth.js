'use strict';

const express = require('express');

/**
 * Couche HTTP de l'accès administrateur :
 *  - routes /api/admin/* (session, connexion, déconnexion, changement et
 *    création initiale du mot de passe) ;
 *  - middleware `exiger` qui protège les routes d'administration de l'API ;
 *  - middleware `protegerPages` qui renvoie vers la page de connexion pour
 *    les fichiers de /admin/.
 *
 * La session est un cookie HttpOnly, SameSite=Strict (non envoyé par un autre
 * site) ; les requêtes qui modifient des données vérifient en plus l'origine.
 *
 * @param {import('../securite/AccesAdmin')} acces
 */
const COOKIE = 'admin_session';
const PAGES_PUBLIQUES = new Set(['/connexion.html', '/connexion.js', '/connexion.css']);

function lireCookie(req, nom) {
  const brut = req.headers.cookie || '';
  for (const morceau of brut.split(';')) {
    const i = morceau.indexOf('=');
    if (i > 0 && morceau.slice(0, i).trim() === nom) return decodeURIComponent(morceau.slice(i + 1).trim());
  }
  return null;
}

function poserCookie(req, res, valeur, maxAgeSec) {
  const attributs = [`${COOKIE}=${valeur}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSec}`];
  if (req.secure) attributs.push('Secure');
  res.append('Set-Cookie', attributs.join('; '));
}

/** Requête venant de la machine serveur elle-même. */
function estLocale(req) {
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

/** Une requête qui modifie des données doit venir d'une page de ce serveur. */
function origineAutorisee(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const origine = req.get('Origin');
  if (!origine) return true; // outils en ligne de commande, anciens navigateurs
  try {
    return new URL(origine).host === req.get('Host');
  } catch (_) {
    return false;
  }
}

function creerAuth(acces) {
  const dureeSec = Math.floor(acces.dureeSessionMs / 1000);
  const adresse = (req) => req.socket.remoteAddress || 'inconnue';
  const connecte = (req) => acces.sessionValide(lireCookie(req, COOKIE));

  /** Middleware : exige une session administrateur valide. */
  function exiger(req, res, next) {
    if (!origineAutorisee(req)) return res.status(403).json({ erreur: 'Origine non autorisée' });
    if (!connecte(req)) return res.status(401).json({ erreur: 'Connexion administrateur requise', connexion: true });
    next();
  }

  /** Middleware monté sur /admin : pages accessibles une fois connecté. */
  function protegerPages(req, res, next) {
    if (PAGES_PUBLIQUES.has(req.path) || connecte(req)) {
      res.set('Cache-Control', 'no-store');
      return next();
    }
    res.redirect(302, '/admin/connexion.html');
  }

  const r = express.Router();

  r.get('/session', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ connecte: connecte(req), configure: acces.estConfigure(), local: estLocale(req) });
  });

  r.post('/connexion', (req, res) => {
    if (!origineAutorisee(req)) return res.status(403).json({ erreur: 'Origine non autorisée' });
    const attente = acces.attenteAvantEssai(adresse(req));
    if (attente > 0) {
      return res.status(429).json({ erreur: `Trop d'essais. Réessayez dans ${attente} s.`, attenteSec: attente });
    }
    if (!acces.estConfigure()) return res.status(409).json({ erreur: "Aucun mot de passe n'est encore défini" });
    if (!acces.verifier((req.body || {}).motDePasse)) {
      acces.noterEchec(adresse(req));
      return res.status(401).json({ erreur: 'Mot de passe incorrect' });
    }
    acces.noterSucces(adresse(req));
    poserCookie(req, res, acces.ouvrirSession(), dureeSec);
    res.json({ ok: true });
  });

  r.post('/deconnexion', (req, res) => {
    acces.fermerSession(lireCookie(req, COOKIE));
    poserCookie(req, res, '', 0);
    res.json({ ok: true });
  });

  /**
   * Création du premier mot de passe : seulement s'il n'en existe aucun,
   * et seulement depuis la machine serveur (http://localhost:…).
   */
  r.post('/initialiser', (req, res) => {
    if (!origineAutorisee(req)) return res.status(403).json({ erreur: 'Origine non autorisée' });
    if (acces.estConfigure()) return res.status(409).json({ erreur: 'Le mot de passe est déjà défini' });
    if (!estLocale(req)) {
      return res.status(403).json({ erreur: 'Le premier mot de passe se crée depuis le serveur lui-même (http://localhost)' });
    }
    try {
      acces.definir((req.body || {}).motDePasse);
    } catch (e) {
      return res.status(400).json({ erreur: e.message });
    }
    poserCookie(req, res, acces.ouvrirSession(), dureeSec);
    res.status(201).json({ ok: true });
  });

  r.post('/mot-de-passe', exiger, (req, res) => {
    const { actuel, nouveau } = req.body || {};
    if (!acces.verifier(actuel)) {
      acces.noterEchec(adresse(req));
      return res.status(400).json({ erreur: 'Mot de passe actuel incorrect' });
    }
    try {
      acces.definir(nouveau);
    } catch (e) {
      return res.status(400).json({ erreur: e.message });
    }
    acces.fermerAutresSessions(lireCookie(req, COOKIE));
    res.json({ ok: true });
  });

  return { routes: r, exiger, protegerPages };
}

module.exports = { creerAuth };
