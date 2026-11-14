'use strict';

/**
 * GestionMarque — personnalisation de l'affichage pour le client de l'agence
 * (ex. une banque) : nom, slogan, logo, couleurs, messages publicitaires
 * (texte, image, GIF animé ou vidéo) diffusés dans plusieurs zones des écrans
 * publics, et réglages d'animation (transitions, défilement, écran de veille).
 *
 * Valide toute configuration avant enregistrement, puis notifie les écrans
 * (événement « marque ») pour qu'ils se mettent à jour sans rechargement.
 */
const ZONES = ['haut', 'lateral', 'bas', 'ticket', 'veille'];
const ECRANS = ['borne', 'mural'];
const TRANSITIONS = ['fondu', 'glissement', 'zoom', 'aucune'];
const VITESSES = ['lente', 'normale', 'rapide'];
const MAX_MESSAGES = 30;
const MAX_DATA_URL = 2 * 1024 * 1024; // image encodée dans la config (ancien format)
const MAX_MEDIA = 50 * 1024 * 1024;   // fichier envoyé (image, GIF, vidéo)

/** Types de médias acceptés à l'envoi → extension du fichier stocké. */
const TYPES_MEDIA = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
const DATA_URL_OK = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const CHEMIN_MEDIA_OK = /^\/medias\/[a-z0-9-]+\.(png|jpg|webp|gif|svg|mp4|webm)$/;
const CHEMIN_SHARED_OK = /^\/shared\/[\w.-]+\.(svg|png|jpe?g|webp)$/;
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

/**
 * Média : fichier envoyé (/medias/…), image intégrée (data URL, ancien
 * format) ou, pour le logo, une image fournie avec l'application (/shared/…).
 */
function media(v, champ, { video = true, shared = false } = {}) {
  if (!v) return '';
  if (typeof v !== 'string') throw erreur(`${champ} invalide`);
  if (shared && CHEMIN_SHARED_OK.test(v)) return v;
  if (CHEMIN_MEDIA_OK.test(v)) {
    if (!video && /\.(mp4|webm)$/.test(v)) throw erreur(`${champ} : une vidéo n'est pas acceptée ici`);
    return v;
  }
  if (DATA_URL_OK.test(v)) {
    if (v.length > MAX_DATA_URL) throw erreur(`${champ} : image trop lourde`);
    return v;
  }
  throw erreur(`${champ} : média invalide (image, GIF ou vidéo envoyée depuis l'administration)`);
}

function sousEnsemble(v, autorises, champ) {
  if (!Array.isArray(v)) throw erreur(`${champ} : liste attendue`);
  const out = [...new Set(v)];
  for (const x of out) if (!autorises.includes(x)) throw erreur(`${champ} : valeur inconnue « ${x} »`);
  return out;
}

function entier(v, min, max, defaut, champ) {
  if (v === undefined || v === null || v === '') return defaut;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw erreur(`${champ} : entier entre ${min} et ${max}`);
  return n;
}

function choix(v, autorises, defaut, champ) {
  if (v === undefined || v === null || v === '') return defaut;
  if (!autorises.includes(v)) throw erreur(`${champ} : valeur inconnue « ${v} »`);
  return v;
}

/** Valide et normalise une configuration de marque. Lève une erreur métier sinon. */
function valider(c) {
  if (!c || typeof c !== 'object') throw erreur('Configuration invalide');
  const couleurs = c.couleurs || {};
  for (const k of ['principale', 'secondaire']) {
    if (!COULEUR_OK.test(couleurs[k] || '')) throw erreur(`Couleur ${k} invalide (format #RRGGBB)`);
  }
  const anim = c.animation || {};
  const veille = entier(c.veilleSec, 0, 600, 0, 'Délai avant écran de veille');
  if (veille > 0 && veille < 10) throw erreur('Délai avant écran de veille : 0 (désactivé) ou au moins 10 secondes');
  const messages = Array.isArray(c.messages) ? c.messages : [];
  if (messages.length > MAX_MESSAGES) throw erreur(`${MAX_MESSAGES} messages maximum`);

  return {
    nom: texte(c.nom, 60, 'Nom', true),
    slogan: texte(c.slogan, 120, 'Slogan'),
    logo: media(c.logo, 'Logo', { video: false, shared: true }),
    couleurs: { principale: couleurs.principale.toUpperCase(), secondaire: couleurs.secondaire.toUpperCase() },
    rotationSec: entier(c.rotationSec, 3, 120, 8, 'Durée de rotation'),
    animation: {
      transition: choix(anim.transition, TRANSITIONS, 'fondu', 'Transition'),
      vitesseDefilement: choix(anim.vitesseDefilement, VITESSES, 'normale', 'Vitesse du défilement'),
    },
    veilleSec: veille,
    messages: messages.map((m, i) => {
      const n = `Message ${i + 1}`;
      const titre = texte(m.titre, 80, `${n} — titre`);
      const corps = texte(m.texte, 300, `${n} — texte`);
      // « image » : ancien nom du champ, repris tel quel.
      const visuel = media(m.media || m.image, `${n} — média`);
      if (!titre && !corps && !visuel) throw erreur(`${n} : titre, texte ou média requis`);
      return {
        id: texte(m.id, 40, `${n} — id`) || `m${Date.now().toString(36)}${i}`,
        titre,
        texte: corps,
        media: visuel,
        dureeSec: entier(m.dureeSec, 0, 300, 0, `${n} — durée`),
        zones: sousEnsemble(m.zones || [], ZONES, `${n} — zones`),
        ecrans: sousEnsemble(m.ecrans || [], ECRANS, `${n} — écrans`),
        actif: m.actif !== false,
      };
    }),
  };
}

/** Chemins /medias/… utilisés par une configuration. */
function mediasUtilises(c) {
  const out = new Set();
  const ajouter = (v) => { if (typeof v === 'string' && v.startsWith('/medias/')) out.add(v.slice(8)); };
  ajouter(c.logo);
  for (const m of c.messages || []) { ajouter(m.media); ajouter(m.image); }
  return out;
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
    this.nettoyerMedias();
    this.notifier();
    return propre;
  }

  /** Revient au modèle par défaut. */
  reinitialiser() {
    this.dao.supprimer();
    this.nettoyerMedias();
    this.notifier();
    return this.dao.lire();
  }

  /**
   * Enregistre un fichier média envoyé (image, GIF animé, vidéo).
   * @param {Buffer} contenu
   * @param {string} type  type MIME annoncé
   * @returns {{ url: string, type: string }}
   */
  ajouterMedia(contenu, type) {
    const mime = String(type || '').split(';')[0].trim().toLowerCase();
    const ext = TYPES_MEDIA[mime];
    if (!ext) throw erreur('Format non pris en charge (PNG, JPEG, WebP, GIF, SVG, MP4 ou WebM)');
    if (!Buffer.isBuffer(contenu) || contenu.length === 0) throw erreur('Fichier vide');
    if (contenu.length > MAX_MEDIA) throw erreur('Fichier trop lourd (50 Mo maximum)');
    const nom = this.dao.enregistrerMedia(contenu, ext);
    return { url: '/medias/' + nom, type: mime };
  }

  /** Supprime les médias envoyés qui ne servent plus (après un délai de grâce). */
  nettoyerMedias() {
    this.dao.supprimerMediasSauf(mediasUtilises(this.dao.lire()), 15 * 60 * 1000);
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
GestionMarque.MAX_MEDIA = MAX_MEDIA;
module.exports = GestionMarque;
