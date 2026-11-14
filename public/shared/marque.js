/* =====================================================================
   Personnalisation client (marque) — côté écrans.
   - Applique les couleurs du client (variables CSS --marque, --marque-2…)
     en calculant automatiquement une couleur de texte lisible.
   - Remplit le nom, le slogan et le logo (éléments [data-marque=…]).
   - Affiche les messages publicitaires dans les zones [data-zone=…] :
       haut    : bandeau sous l'en-tête (rotation)
       lateral : panneau visuel (rotation, avec image)
       bas     : bandeau défilant en pied d'écran
       ticket  : message imprimé sur le ticket (borne)
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
  const minuteurs = [];

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
      x.actif && x.zones.includes(zone) && (zone === 'ticket' || x.ecrans.includes(ecran)));
  }

  function carteMessage(msg, avecImage) {
    const el = document.createElement('div');
    el.className = 'pub-item';
    if (avecImage && msg.image) {
      const img = document.createElement('img');
      img.className = 'pub-image';
      img.src = msg.image;
      img.alt = '';
      el.appendChild(img);
    }
    const txt = document.createElement('div');
    txt.className = 'pub-texte';
    if (msg.titre) { const t = document.createElement('strong'); t.textContent = msg.titre; txt.appendChild(t); }
    if (msg.texte) { const p = document.createElement('span'); p.textContent = msg.texte; txt.appendChild(p); }
    el.appendChild(txt);
    return el;
  }

  /** Zone en rotation (haut, lateral). */
  function rendreRotation(zoneEl, liste, avecImage, sec) {
    zoneEl.innerHTML = '';
    zoneEl.classList.toggle('cachee', liste.length === 0);
    if (!liste.length) return;
    const items = liste.map((msg) => carteMessage(msg, avecImage));
    items.forEach((it, i) => { if (i) it.classList.add('pub-masque'); zoneEl.appendChild(it); });
    if (items.length > 1) {
      const points = document.createElement('div');
      points.className = 'pub-points';
      items.forEach(() => points.appendChild(document.createElement('i')));
      points.firstChild.classList.add('actif');
      zoneEl.appendChild(points);
      let i = 0;
      minuteurs.push(setInterval(() => {
        items[i].classList.add('pub-masque'); points.children[i].classList.remove('actif');
        i = (i + 1) % items.length;
        items[i].classList.remove('pub-masque'); points.children[i].classList.add('actif');
      }, sec * 1000));
    }
  }

  /** Bandeau défilant (bas). */
  function rendreDefilant(zoneEl, liste) {
    zoneEl.innerHTML = '';
    zoneEl.classList.toggle('cachee', liste.length === 0);
    document.body.classList.toggle('avec-defilant', liste.length > 0);
    if (!liste.length) return;
    const piste = document.createElement('div');
    piste.className = 'defilant-piste';
    // Deux copies du contenu pour un défilement continu sans saut.
    for (let copie = 0; copie < 2; copie++) {
      const groupe = document.createElement('div');
      groupe.className = 'defilant-groupe';
      if (copie) groupe.setAttribute('aria-hidden', 'true');
      for (const msg of liste) {
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
    const longueur = liste.reduce((n, m) => n + m.titre.length + m.texte.length, 0);
    piste.style.animationDuration = Math.max(20, longueur * 0.28) + 's';
  }

  function rendreZones(m) {
    minuteurs.splice(0).forEach(clearInterval);
    const sec = m.rotationSec || 8;
    $$('[data-zone="haut"]').forEach((el) => rendreRotation(el, messages(m, 'haut'), false, sec));
    $$('[data-zone="lateral"]').forEach((el) => {
      const liste = messages(m, 'lateral');
      rendreRotation(el, liste, true, sec);
      document.body.classList.toggle('avec-lateral', liste.length > 0);
    });
    $$('[data-zone="bas"]').forEach((el) => rendreDefilant(el, messages(m, 'bas')));
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
      const liste = config ? messages(config, 'ticket') : [];
      if (!liste.length) return null;
      Marque._iTicket = ((Marque._iTicket ?? -1) + 1) % liste.length;
      return liste[Marque._iTicket];
    },
    texteSur,
    contraste,
  };

  document.addEventListener('DOMContentLoaded', charger);
})();
