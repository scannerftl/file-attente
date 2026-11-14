/* =====================================================================
   Personnalisation client (marque) — côté écrans.
   - Applique les couleurs du client (variables CSS --marque, --marque-2…)
     en calculant automatiquement une couleur de texte lisible.
   - Remplit le nom, le slogan et le logo (éléments [data-marque=…]).
   - Affiche les messages publicitaires dans les zones [data-zone=…] :
       haut    : bandeau sous l'en-tête (rotation)
       lateral : panneau visuel (rotation ; image, GIF animé ou vidéo)
       bas     : bandeau défilant en pied d'écran
       ticket  : message imprimé sur le ticket (borne)
       veille  : écran de veille plein écran après inactivité (borne)
     Les transitions (fondu, glissement, zoom) suivent <body data-transition>.
     L'écran courant est donné par <body data-ecran="borne|mural">.
   Chargé dans le <head> : les couleurs en cache sont appliquées avant
   l'affichage pour éviter un flash aux couleurs par défaut.
   ===================================================================== */
(function () {
  const racine = document.documentElement;
  const CLE = 'marque-couleurs';

  /* ---------- Couleurs ---------- */
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const versHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const melanger = (a, b, t) => versHex(rgb(a).map((v, i) => v * t + rgb(b)[i] * (1 - t)));
  function luminance(hex) {
    const [r, g, b] = rgb(hex).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contraste(a, b) {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  }
  /** Blanc ou quasi-noir : celui qui se lit le mieux sur `fond`. */
  const texteSur = (fond) => (contraste(fond, '#FFFFFF') >= contraste(fond, '#111418') ? '#FFFFFF' : '#111418');

  function appliquerCouleurs(c) {
    if (!c || !c.principale) return;
    const p = c.principale, s = c.secondaire;
    const fondMural = melanger(p, '#070A10', 0.16);
    // Couleur de l'appel sur l'écran mural : la première assez visible sur le fond.
    const appel = [s, p, '#FFFFFF'].find((x) => contraste(x, fondMural) >= 3);
    const vars = {
      '--marque': p,
      '--marque-2': s,
      '--sur-marque': texteSur(p),
      '--sur-marque-2': texteSur(s),
      '--mural-fond': fondMural,
      '--appel': appel,
      '--sur-appel': texteSur(appel),
    };
    for (const [k, v] of Object.entries(vars)) racine.style.setProperty(k, v);
  }

  try { appliquerCouleurs(JSON.parse(localStorage.getItem(CLE))); } catch (_) {}

  /* ---------- Contenu ---------- */
  const $$ = (sel) => document.querySelectorAll(sel);
  let config = null;

  function initiales(nom) {
    const mots = nom.trim().split(/\s+/);
    if (/^[A-Z0-9]{2,4}$/.test(mots[0])) return mots[0];
    return mots.slice(0, 2).map((m) => m[0]).join('').toUpperCase();
  }

  function rendreIdentite(m) {
    $$('[data-marque="nom"]').forEach((el) => { el.textContent = m.nom; });
    $$('[data-marque="slogan"]').forEach((el) => {
      el.textContent = m.slogan || '';
      el.classList.toggle('cachee', !m.slogan);
    });
    $$('[data-marque="logo"]').forEach((el) => {
      el.innerHTML = '';
      if (m.logo) {
        const img = document.createElement('img');
        img.src = m.logo;
        img.alt = m.nom;
        el.appendChild(img);
        el.classList.remove('logo-initiales');
      } else {
        el.textContent = initiales(m.nom);
        el.classList.add('logo-initiales');
      }
    });
    if (m.nom && document.title.includes('—')) {
      document.title = document.title.replace(/—.*$/, '— ' + m.nom);
    }
  }

  /** Messages actifs pour une zone de l'écran courant. */
  function messages(m, zone) {
    const ecran = document.body.dataset.ecran;
    return (m.messages || []).filter((x) =>
      x.actif && x.zones.includes(zone) &&
      (zone === 'ticket' || zone === 'veille' || x.ecrans.includes(ecran)));
  }

  /** Le bandeau haut et le ticket n'affichent que du texte. */
  const aTexte = (liste) => liste.filter((x) => x.titre || x.texte);
  const estVideo = (src) => /\.(mp4|webm)$/i.test(src || '');
  const mediaDe = (msg) => msg.media || msg.image || '';

  /** Image (y compris GIF animé) ou vidéo muette en lecture automatique. */
  function creerMedia(src) {
    const cadre = document.createElement('div');
    cadre.className = 'pub-media';
    let el;
    if (estVideo(src)) {
      el = document.createElement('video');
      el.muted = true;            // obligatoire pour la lecture automatique
      el.playsInline = true;
      el.preload = 'auto';
      el.setAttribute('muted', '');
      el.setAttribute('playsinline', '');
    } else {
      el = document.createElement('img');
      el.alt = '';
    }
    el.src = src;
    cadre.appendChild(el);
    return cadre;
  }

  function carteMessage(msg, avecMedia) {
    const el = document.createElement('div');
    el.className = 'pub-item';
    if (avecMedia && mediaDe(msg)) el.appendChild(creerMedia(mediaDe(msg)));
    if (msg.titre || msg.texte) {
      const txt = document.createElement('div');
      txt.className = 'pub-texte';
      if (msg.titre) { const t = document.createElement('strong'); t.textContent = msg.titre; txt.appendChild(t); }
      if (msg.texte) { const p = document.createElement('span'); p.textContent = msg.texte; txt.appendChild(p); }
      el.appendChild(txt);
    } else {
      el.classList.add('media-seul');
    }
    return el;
  }

  /**
   * Zone en rotation (haut, latéral, veille) avec transition animée.
   * Chaque message reste affiché sa durée propre, sinon la durée de rotation ;
   * une vidéo sans durée propre est lue jusqu'au bout avant de passer à la suite.
   * @returns {{ arreter: () => void }}
   */
  function rendreRotation(zoneEl, liste, avecMedia, m) {
    zoneEl.innerHTML = '';
    zoneEl.classList.toggle('cachee', liste.length === 0);
    if (!liste.length) return { arreter() {} };

    const scene = document.createElement('div');
    scene.className = 'pub-scene';
    const items = liste.map((msg) => carteMessage(msg, avecMedia));
    items.forEach((it) => scene.appendChild(it));
    zoneEl.appendChild(scene);

    let points = null;
    if (items.length > 1) {
      points = document.createElement('div');
      points.className = 'pub-points';
      items.forEach(() => points.appendChild(document.createElement('i')));
      zoneEl.appendChild(points);
    }

    let i = -1, minuteur = null, arrete = false;
    const defaut = (m.rotationSec || 8) * 1000;

    function suivant() { if (!arrete) montrer((i + 1) % items.length); }

    function montrer(n) {
      clearTimeout(minuteur);
      const ancien = items[i];
      if (ancien && n !== i) {
        ancien.classList.remove('actif');
        ancien.classList.add('sortant');
        setTimeout(() => ancien.classList.remove('sortant'), 900);
        const v = ancien.querySelector('video');
        if (v) { v.pause(); v.onended = null; }
      }
      i = n;
      const item = items[i], msg = liste[i];
      const duree = msg.dureeSec ? msg.dureeSec * 1000 : defaut;
      item.style.setProperty('--duree', (duree / 1000) + 's');
      // Redémarre les animations CSS (effet de zoom) à chaque apparition.
      item.classList.remove('actif'); void item.offsetWidth; item.classList.add('actif');
      if (points) [...points.children].forEach((p, k) => p.classList.toggle('actif', k === i));

      const v = item.querySelector('video');
      if (v) {
        v.currentTime = 0;
        v.loop = items.length === 1;
        v.play().catch(() => {});
        if (items.length > 1) {
          if (msg.dureeSec) minuteur = setTimeout(suivant, duree);
          else {
            v.onended = suivant;
            v.onerror = () => { minuteur = setTimeout(suivant, defaut); };
          }
        }
      } else if (items.length > 1) {
        minuteur = setTimeout(suivant, duree);
      }
    }

    montrer(0);
    return {
      arreter() {
        arrete = true;
        clearTimeout(minuteur);
        zoneEl.querySelectorAll('video').forEach((v) => v.pause());
      },
    };
  }

  /** Bandeau défilant (bas). */
  function rendreDefilant(zoneEl, liste, vitesse) {
    zoneEl.innerHTML = '';
    const avecTexte = liste.filter((msg) => msg.titre || msg.texte);
    zoneEl.classList.toggle('cachee', avecTexte.length === 0);
    document.body.classList.toggle('avec-defilant', avecTexte.length > 0);
    if (!avecTexte.length) return;
    const piste = document.createElement('div');
    piste.className = 'defilant-piste';
    // Deux copies du contenu pour un défilement continu sans saut.
    for (let copie = 0; copie < 2; copie++) {
      const groupe = document.createElement('div');
      groupe.className = 'defilant-groupe';
      if (copie) groupe.setAttribute('aria-hidden', 'true');
      for (const msg of avecTexte) {
        const s = document.createElement('span');
        s.className = 'defilant-item';
        if (msg.titre) { const b = document.createElement('strong'); b.textContent = msg.titre; s.appendChild(b); }
        if (msg.titre && msg.texte) s.appendChild(document.createTextNode(' — '));
        if (msg.texte) s.appendChild(document.createTextNode(msg.texte));
        groupe.appendChild(s);
      }
      piste.appendChild(groupe);
    }
    zoneEl.appendChild(piste);
    // Secondes par caractère : plus la valeur est grande, plus le texte défile lentement.
    const parCaractere = { lente: 0.4, normale: 0.28, rapide: 0.17 }[vitesse] || 0.28;
    const longueur = avecTexte.reduce((n, m) => n + m.titre.length + m.texte.length, 0);
    piste.style.animationDuration = Math.max(15, longueur * parCaractere) + 's';
  }

  /* ---------- Écran de veille publicitaire (borne) ---------- */
  let veille = { arreter() {} };

  function initVeille(m) {
    veille.arreter();
    const el = document.querySelector('[data-zone="veille"]');
    if (!el) return;
    const liste = messages(m, 'veille');
    const apercu = new URLSearchParams(location.search).has('veille');
    if (!liste.length || (!m.veilleSec && !apercu)) {
      el.classList.remove('visible');
      el.innerHTML = '';
      return;
    }

    let minuteur = null, rotation = null, visible = false;

    function afficher() {
      if (visible) return;
      visible = true;
      el.innerHTML = '';
      const entete = document.createElement('div');
      entete.className = 'veille-entete';
      entete.innerHTML = '<span class="marque-logo" data-marque="logo"></span><span data-marque="nom"></span>';
      const scene = document.createElement('div');
      scene.className = 'veille-scene';
      const appel = document.createElement('div');
      appel.className = 'veille-appel';
      appel.textContent = "Touchez l'écran pour prendre un ticket";
      el.append(entete, scene, appel);
      rendreIdentite(m);
      rotation = rendreRotation(scene, liste, true, m);
      el.classList.add('visible');
    }
    function masquer() {
      if (!visible) return;
      visible = false;
      el.classList.remove('visible');
      if (rotation) rotation.arreter();
    }
    function activite(e) {
      if (visible) {
        // Le toucher qui réveille la borne ne déclenche pas d'action dessous.
        e.preventDefault();
        e.stopPropagation();
        masquer();
      }
      clearTimeout(minuteur);
      if (m.veilleSec) minuteur = setTimeout(afficher, m.veilleSec * 1000);
    }
    const evenements = ['pointerdown', 'keydown'];
    evenements.forEach((t) => document.addEventListener(t, activite, true));
    if (m.veilleSec) minuteur = setTimeout(afficher, m.veilleSec * 1000);
    if (apercu) afficher();

    veille = {
      arreter() {
        clearTimeout(minuteur);
        evenements.forEach((t) => document.removeEventListener(t, activite, true));
        masquer();
      },
    };
  }

  let rotations = [];

  function rendreZones(m) {
    rotations.splice(0).forEach((r) => r.arreter());
    const anim = m.animation || {};
    document.body.dataset.transition = anim.transition || 'fondu';
    $$('[data-zone="haut"]').forEach((el) => rotations.push(rendreRotation(el, aTexte(messages(m, 'haut')), false, m)));
    $$('[data-zone="lateral"]').forEach((el) => {
      const liste = messages(m, 'lateral');
      rotations.push(rendreRotation(el, liste, true, m));
      document.body.classList.toggle('avec-lateral', liste.length > 0);
    });
    $$('[data-zone="bas"]').forEach((el) => rendreDefilant(el, messages(m, 'bas'), anim.vitesseDefilement));
    initVeille(m);
  }

  function rendre(m) {
    config = m;
    appliquerCouleurs(m.couleurs);
    try { localStorage.setItem(CLE, JSON.stringify(m.couleurs)); } catch (_) {}
    rendreIdentite(m);
    rendreZones(m);
    document.dispatchEvent(new CustomEvent('marque', { detail: m }));
  }

  async function charger() {
    try {
      const r = await fetch('/api/marque', { cache: 'no-store' });
      if (r.ok) rendre(await r.json());
    } catch (_) { /* hors ligne : on garde l'affichage courant */ }
  }

  window.Marque = {
    charger,
    rendre,
    /** Configuration courante (null tant qu'elle n'est pas chargée). */
    get config() { return config; },
    /** Message à imprimer sur le ticket (rotation à chaque ticket). */
    messageTicket() {
      const liste = config ? aTexte(messages(config, 'ticket')) : [];
      if (!liste.length) return null;
      Marque._iTicket = ((Marque._iTicket ?? -1) + 1) % liste.length;
      return liste[Marque._iTicket];
    },
    texteSur,
    contraste,
  };

  document.addEventListener('DOMContentLoaded', charger);
})();
