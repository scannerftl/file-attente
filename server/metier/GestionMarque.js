'use strict';

/**
 * GestionMarque — personnalisation de l'affichage pour le client de l'agence
 * (ex. une banque) : nom, slogan, logo, couleurs et messages publicitaires
 * diffusés dans plusieurs zones des écrans publics (borne, écran mural).
 *
 * Valide toute configuration avant enregistrement, puis notifie les écrans
 * (événement « marque ») pour qu'ils se mettent à jour sans rechargement.
 */
const ZONES = ['haut', 'lateral', 'bas', 'ticket'];
const ECRANS = ['borne', 'mural'];
const MAX_MESSAGES = 30;
const MAX_IMAGE = 2 * 1024 * 1024; // taille max d'une image encodée (caractères)
const IMAGE_OK = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const COULEUR_OK = /^#[0-9a-fA-F]{6}$/;

function erreur(message) {
  const e = new Error(message);
  e.metier = true;
  return e;
}

function texte(v, max, champ, requis = false) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (requis && !s) throw erreur(`${champ} requis`);
  if (s.length > max) throw erreur(`${champ} : ${max} caractères maximum`);
  return s;
}

function image(v, champ, cheminsAutorises = false) {
  if (!v) return '';
  if (typeof v !== 'string') throw erreur(`${champ} invalide`);
  if (cheminsAutorises && /^\/shared\/[\w.-]+\.(svg|png|jpe?g|webp)$/.test(v)) return v;
  if (!IMAGE_OK.test(v)) throw erreur(`${champ} : image PNG, JPEG, WebP, GIF ou SVG attendue`);
  if (v.length > MAX_IMAGE) throw erreur(`${champ} : image trop lourde (1,5 Mo maximum)`);
  return v;
}

function sousEnsemble(v, autorises, champ) {
  if (!Array.isArray(v)) throw erreur(`${champ} : liste attendue`);
  const out = [...new Set(v)];
  for (const x of out) if (!autorises.includes(x)) throw erreur(`${champ} : valeur inconnue « ${x} »`);
  return out;
}

/** Valide et normalise une configuration de marque. Lève une erreur métier sinon. */
function valider(c) {
  if (!c || typeof c !== 'object') throw erreur('Configuration invalide');
  const couleurs = c.couleurs || {};
  for (const k of ['principale', 'secondaire']) {
    if (!COULEUR_OK.test(couleurs[k] || '')) throw erreur(`Couleur ${k} invalide (format #RRGGBB)`);
  }
  const rotation = Number(c.rotationSec);
  if (!Number.isInteger(rotation) || rotation < 3 || rotation > 120) {
    throw erreur('Durée de rotation : entier entre 3 et 120 secondes');
  }
  const messages = Array.isArray(c.messages) ? c.messages : [];
  if (messages.length > MAX_MESSAGES) throw erreur(`${MAX_MESSAGES} messages maximum`);

  return {
    nom: texte(c.nom, 60, 'Nom', true),
    slogan: texte(c.slogan, 120, 'Slogan'),
    logo: image(c.logo, 'Logo', true),
    couleurs: { principale: couleurs.principale.toUpperCase(), secondaire: couleurs.secondaire.toUpperCase() },
    rotationSec: rotation,
    messages: messages.map((m, i) => {
      const n = `Message ${i + 1}`;
      const titre = texte(m.titre, 80, `${n} — titre`);
      const corps = texte(m.texte, 300, `${n} — texte`);
      if (!titre && !corps) throw erreur(`${n} : titre ou texte requis`);
      return {
        id: texte(m.id, 40, `${n} — id`) || `m${Date.now().toString(36)}${i}`,
        titre,
        texte: corps,
        image: image(m.image, `${n} — image`),
        zones: sousEnsemble(m.zones || [], ZONES, `${n} — zones`),
        ecrans: sousEnsemble(m.ecrans || [], ECRANS, `${n} — écrans`),
        actif: m.actif !== false,
      };
    }),
  };
}

class GestionMarque {
  /**
   * @param {import('../dao/MarqueDAO')} marqueDAO
   * @param {import('./ServiceNotification')} [notification]
   */
  constructor(marqueDAO, notification) {
    this.dao = marqueDAO;
    this.notification = notification;
  }

  lire() {
    return this.dao.lire();
  }

  enregistrer(config) {
    const propre = valider(config);
    this.dao.enregistrer(propre);
    this.notifier();
    return propre;
  }

  /** Revient au modèle par défaut. */
  reinitialiser() {
    this.dao.supprimer();
    this.notifier();
    return this.dao.lire();
  }

  modeles() {
    return this.dao.modeles();
  }

  modele(id) {
    const m = this.dao.modele(id);
    if (!m) throw erreur('Modèle inconnu');
    return m;
  }

  notifier() {
    if (this.notification) this.notification.notifier({ type: 'marque' });
  }
}

GestionMarque.valider = valider;
GestionMarque.ZONES = ZONES;
GestionMarque.ECRANS = ECRANS;
module.exports = GestionMarque;
